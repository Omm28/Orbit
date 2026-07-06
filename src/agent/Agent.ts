// ──────────────────────────────────────────────────
//  Orbit – Agent  (Phase 10: Metrics + Multi-Tab + Recording)
//  Orchestrates the plan → execute → observe loop.
// ──────────────────────────────────────────────────

import path from "path";
import fs   from "fs";
import { Browser    } from "../browser/Browser";
import { PageManager } from "../browser/PageManager";
import { FallbackClient } from "../llm/FallbackClient";
import { Planner     } from "./Planner";
import { Executor    } from "./Executor";
import { PageSnapshot, SessionState } from "../types";
import { logger       } from "../utils/logger";
import { waitForUserEnter } from "../utils/hitl";
import { CheckpointManager } from "./CheckpointManager";
import { MetricsTracker, MetricsSummary } from "../utils/metrics";

export interface AgentOptions {
  headless?:      boolean;
  screenshotDir?: string;
  maxSteps?:      number;
  maxRetries?:    number;
  recordVideo?:   boolean;
  videoDir?:      string;
}

export class Agent {
  private browser:    Browser;
  private options:    Required<AgentOptions>;

  constructor(options: AgentOptions = {}) {
    this.options = {
      headless:      options.headless      ?? (process.env.HEADLESS === "true"),
      screenshotDir: options.screenshotDir ?? (process.env.SCREENSHOTS_DIR ?? "./screenshots"),
      maxSteps:      options.maxSteps      ?? parseInt(process.env.MAX_STEPS  ?? "20", 10),
      maxRetries:    options.maxRetries    ?? parseInt(process.env.MAX_RETRIES ?? "3",  10),
      recordVideo:   options.recordVideo   ?? (process.env.RECORD_VIDEO === "true"),
      videoDir:      options.videoDir      ?? (process.env.VIDEO_DIR    ?? "./recordings"),
    };
    this.browser = new Browser();
  }

  async run(task: string): Promise<{
    success:      boolean;
    stepCount:    number;
    visitedUrls:  string[];
    error?:       string;
    metrics?:     MetricsSummary;
  }> {
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`Task: "${task}"`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // ── Metrics & State initialization ───────────
    const metrics = new MetricsTracker();
    const videoDir = this.options.recordVideo ? this.options.videoDir : undefined;

    const session: SessionState = {
      objective:       task,
      visitedUrls:     [],
      screenshotPaths: [],
      stepCount:       0,
    };

    let snapshot: PageSnapshot = { url: "about:blank", title: "", elements: [] };
    let lastResult: { status: "success" | "failed"; error?: string } | undefined = undefined;
    const previouslyCompletedSubtasks: string[] = [];

    let consecutiveFailures = 0;
    let success  = false;
    let lastError: string | undefined = undefined;
    let videoPage: import("playwright").Page | null = null;
    let selfHealingCount = 0;

    try {
      await this.browser.launch(this.options.headless, videoDir);
      let context       = this.browser.getContext();
      const pageManager = new PageManager(context, this.options.screenshotDir);

      const provider = process.env.LLM_PROVIDER ?? "gemini";
      const llm      = new FallbackClient(provider, "ollama");
      const planner  = new Planner(llm, metrics);
      const executor = new Executor(pageManager);
      const checkpointManager = new CheckpointManager();

      for (let step = 1; step <= this.options.maxSteps; step++) {
        logger.info(`── Step ${step} / ${this.options.maxSteps} ─────────────────────`);
        session.stepCount = step;

        // ── Phase 7: Human-in-the-Loop consecutive failure check ──
        if (consecutiveFailures > this.options.maxRetries + 1) {
          logger.warn(`[HITL] ${consecutiveFailures} consecutive failures. Agent is stuck.`);
          await waitForUserEnter(
            "Please check the browser, manually resolve any issues (e.g. solve CAPTCHA), and press Enter to resume..."
          );
          consecutiveFailures = 0;
          snapshot = await pageManager.snapshot(planner.getActiveSubtask());
          lastResult = { status: "success" };
          continue;
        }

        // ── Phase 8: Checkpoint restore / Auto-recovery ──
        if (consecutiveFailures === this.options.maxRetries) {
          const checkpoint = checkpointManager.getLastCheckpoint();
          if (checkpoint) {
            logger.warn(
              `[Checkpoint] ${consecutiveFailures} consecutive failures. Rollback to Milestone: "${checkpoint.subtaskTitle}"...`
            );
            await checkpointManager.restoreCheckpoint(this.browser, pageManager, checkpoint);
            context = this.browser.getContext();
            snapshot = await pageManager.snapshot(planner.getActiveSubtask());
            consecutiveFailures = 0;
            lastResult = { status: "success" };
            continue;
          } else {
            logger.warn(
              `${consecutiveFailures} consecutive failures — auto-recovering (refresh page)…`
            );
            const recoveryResult = await executor.run({ action: "refresh" }, snapshot);
            if (recoveryResult.snapshot) snapshot = recoveryResult.snapshot;
            consecutiveFailures++;
            lastResult = { status: "failed", error: "Auto-recovery page refresh triggered" };
            continue;
          }
        }

        // ── Prune & Sort Snapshot by Active Subtask ──
        const activeSubtask = planner.getActiveSubtask();
        snapshot = await pageManager.snapshot(activeSubtask);

        // Keep local references for finalization
        selfHealingCount = pageManager.selfHealingCount;
        videoPage = await pageManager.getPage().catch(() => null);

        // ── Decide ──────────────────────────────────────
        const { actions } = await planner.decide(task, snapshot, session, lastResult);
        lastResult = undefined;

        // ── Execute Actions Loop (Action Bundling) ──────
        let executionFailed = false;

        for (const action of actions || []) {
          planner.recordAction(action);
          metrics.recordAction();
          logger.action(`LLM chose action: ${JSON.stringify(action)}`);

          if (action.action === "finish") {
            logger.success("Task complete ✔");
            success = true;
            break;
          }

          const result = await executor.run(action, snapshot);

          // Track visited URLs
          if (result.snapshot?.url && result.snapshot.url !== snapshot.url) {
            session.visitedUrls.push(result.snapshot.url);
          }

          // Track screenshots
          if (result.screenshotPath) {
            session.screenshotPaths.push(result.screenshotPath);
          }

          if (result.error) {
            logger.warn(`Action failed: ${result.error}`);
            lastError = result.error;

            // ── Safety Guardrail HITL Bypass check ──
            if (result.error.includes("Safety violation")) {
              logger.warn(`[HITL] Safety Guardrail triggered: ${result.error}`);
              if (process.env.NON_INTERACTIVE === "true") {
                logger.error("[HITL] Non-interactive mode: Safety violation cannot be bypassed. Aborting.");
                throw new Error(result.error);
              }
              await waitForUserEnter(
                "Safety Warning: Press Enter to authorize the bypass and continue, or Ctrl+C to abort..."
              );
              snapshot = await pageManager.snapshot(planner.getActiveSubtask());
              lastResult = { status: "success" };
              consecutiveFailures = 0;
              executionFailed = true;
              break;
            }

            snapshot    = result.snapshot ?? snapshot;
            lastResult  = { status: "failed", error: result.error };
            consecutiveFailures++;
            executionFailed = true;
            break;
          }

          // Success on this action — update snapshot context
          if (result.snapshot) snapshot = result.snapshot;
        }

        if (success) break;
        if (executionFailed) continue;

        // All actions in the bundle succeeded
        consecutiveFailures = 0;
        lastResult = { status: "success" };

        // ── Checkpoint Check ──
        const completedSubtask = planner.subtasks.find(
          (s) => s.status === "done" && !previouslyCompletedSubtasks.includes(s.title)
        );
        if (completedSubtask) {
          logger.info(`[Checkpoint] Subtask completed: "${completedSubtask.title}". Saving browser checkpoint...`);
          await checkpointManager.saveCheckpoint(context, completedSubtask.title, snapshot.url);
          previouslyCompletedSubtasks.push(completedSubtask.title);
        }

        if (step === this.options.maxSteps) {
          logger.warn(`Reached maximum step limit (${this.options.maxSteps}). Stopping.`);
          lastError = "Reached maximum step limit";
        }
      }
    } catch (err: any) {
      lastError = err.message || String(err);
      logger.error(`Unhandled agent error: ${lastError}`);
    } finally {
      // Always close the browser context first so Playwright flushes and unlocks the video file!
      await this.browser.close();
    }

    // ── Finalize recording renaming & build metrics summary after context close ──
    const metricsSummary = await this.finalizeRun(
      videoPage, metrics, session.stepCount, selfHealingCount, task
    );

    metrics.logCard(metricsSummary, logger);

    return {
      success,
      stepCount: session.stepCount,
      visitedUrls: session.visitedUrls,
      error: lastError,
      metrics: metricsSummary,
    };
  }

  /**
   * Waits for the video file to finalize, renames it to a clean task-based name,
   * then returns the completed MetricsSummary.
   */
  private async finalizeRun(
    videoPage: import("playwright").Page | null,
    metrics: MetricsTracker,
    stepCount: number,
    selfHealingCount: number,
    task: string,
  ): Promise<MetricsSummary> {
    let recordingPath: string | undefined;

    if (videoPage && this.options.recordVideo) {
      try {
        const video = videoPage.video();
        if (video) {
          const rawPath = await video.path().catch(() => null);
          if (rawPath) {
            // Build a clean file name from the task text
            const slug = task
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .substring(0, 50)
              .replace(/^_|_$/g, "");
            const dir        = path.dirname(rawPath);
            const targetPath = path.join(dir, `orbit_${slug}.webm`);
            
            // Wait for Playwright to fully release the file handle
            let renamed = false;
            for (let attempt = 1; attempt <= 10; attempt++) {
              try {
                if (fs.existsSync(rawPath)) {
                  fs.renameSync(rawPath, targetPath);
                  recordingPath = targetPath;
                  renamed = true;
                  break;
                }
              } catch (err: any) {
                if (attempt === 10) {
                  logger.warn(`Could not rename video file after 10 attempts: ${err.message}`);
                  recordingPath = rawPath;
                } else {
                  await new Promise((resolve) => setTimeout(resolve, 200));
                }
              }
            }
            if (renamed) {
              logger.success(`Screen recording saved: ${recordingPath}`);
            }
          }
        }
      } catch (err: any) {
        logger.warn(`Could not finalize recording: ${err.message}`);
      }
    }

    return metrics.summary(stepCount, selfHealingCount, recordingPath);
  }
}
