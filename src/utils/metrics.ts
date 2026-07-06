// ──────────────────────────────────────────────────
//  Orbit – Metrics Tracker
//  Tracks LLM token usage, cost estimates, timing,
//  action counts, and self-healing events per run.
// ──────────────────────────────────────────────────

// Gemini Flash Lite approximate pricing (per 1M tokens)
const COST_PER_1M_INPUT_TOKENS  = 0.075;
const COST_PER_1M_OUTPUT_TOKENS = 0.30;

/**
 * Estimates the number of tokens in a text string.
 * Rule of thumb: 1 token ≈ 4 characters.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface MetricsSummary {
  durationMs:          number;
  durationSec:         string;
  stepCount:           number;
  actionCount:         number;
  llmCalls:            number;
  promptTokens:        number;
  completionTokens:    number;
  totalTokens:         number;
  estimatedCostUsd:    string;
  selfHealingTriggers: number;
  recordingPath?:      string;
}

export class MetricsTracker {
  private startTime:           number;
  private _llmCalls:            number = 0;
  private _promptTokens:        number = 0;
  private _completionTokens:    number = 0;
  private _actionCount:         number = 0;
  private _selfHealingTriggers: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /** Call after each LLM response to track token estimates and call count. */
  recordLlmCall(promptText: string, responseText: string): void {
    this._llmCalls++;
    this._promptTokens      += estimateTokens(promptText);
    this._completionTokens  += estimateTokens(responseText);
  }

  /** Call when an action is dispatched to the executor. */
  recordAction(): void {
    this._actionCount++;
  }

  /** Call when the self-healing overlay dismissal succeeds. */
  recordSelfHealing(): void {
    this._selfHealingTriggers++;
  }

  /** Build the final metrics summary. */
  summary(stepCount: number, selfHealingTriggers: number, recordingPath?: string): MetricsSummary {
    const durationMs       = Date.now() - this.startTime;
    const durationSec      = (durationMs / 1000).toFixed(1) + "s";
    const totalTokens      = this._promptTokens + this._completionTokens;
    const costUsd          =
      (this._promptTokens     / 1_000_000) * COST_PER_1M_INPUT_TOKENS  +
      (this._completionTokens / 1_000_000) * COST_PER_1M_OUTPUT_TOKENS;

    return {
      durationMs,
      durationSec,
      stepCount,
      actionCount:         this._actionCount,
      llmCalls:            this._llmCalls,
      promptTokens:        this._promptTokens,
      completionTokens:    this._completionTokens,
      totalTokens,
      estimatedCostUsd:    `$${costUsd.toFixed(5)}`,
      selfHealingTriggers,
      recordingPath,
    };
  }

  /**
   * Logs a formatted metrics card to the console.
   * Accepts a logger instance with a .dim() or .info() method.
   */
  logCard(
    summary: MetricsSummary,
    logger: { info: (m: string) => void; dim: (m: string) => void }
  ): void {
    logger.info("---------------- Run Metrics ----------------");
    logger.info(`  Duration           : ${summary.durationSec}`);
    logger.info(`  Steps / Actions    : ${summary.stepCount} steps / ${summary.actionCount} actions`);
    logger.info(`  LLM Calls          : ${summary.llmCalls}`);
    logger.info(`  Tokens (in / out)  : ${summary.promptTokens.toLocaleString()} / ${summary.completionTokens.toLocaleString()} (~${summary.totalTokens.toLocaleString()} total)`);
    logger.info(`  Est. Cost (USD)    : ${summary.estimatedCostUsd}`);
    logger.info(`  Self-Healing       : ${summary.selfHealingTriggers} overlay dismissal(s)`);
    if (summary.recordingPath) {
      logger.info(`  Recording          : ${summary.recordingPath}`);
    }
    logger.info("------------------------------------------------");
  }
}
