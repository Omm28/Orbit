// ──────────────────────────────────────────────────
//  Orbit – Executor  (Phase 2 + Phase 3)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { AgentAction, PageSnapshot, StepResult } from "../types";
import { Guardrails        } from "./Guardrails";
import { navigate           } from "../tools/Navigate";
import { click              } from "../tools/Click";
import { type               } from "../tools/Type";
import { press              } from "../tools/Press";
import { hover              } from "../tools/Hover";
import { scroll             } from "../tools/Scroll";
import { select             } from "../tools/Select";
import { uploadFile         } from "../tools/UploadFile";
import { downloadFile       } from "../tools/DownloadFile";
import { goBack, goForward, refresh } from "../tools/NavigationActions";
import { waitForElement, waitForText } from "../tools/Wait";
import { readPage           } from "../tools/ReadPage";
import { switchTab          } from "../tools/SwitchTab";
import { logger             } from "../utils/logger";

export class Executor {
  constructor(
    private readonly pageManager: PageManager,
    private readonly downloadDir: string = "./downloads",
  ) {}

  async run(action: AgentAction, currentSnapshot: PageSnapshot): Promise<StepResult> {
    const result: StepResult = { action };

    // Check Safety Guardrails before execution
    const safety = Guardrails.check(action, currentSnapshot);
    if (!safety.allowed) {
      const msg = safety.reason ?? "Blocked by safety guardrail.";
      logger.warn(`Guardrails: ${msg}`);
      return { action, error: `Safety violation: ${msg}` };
    }

    try {
      switch (action.action) {
        // ── Navigation ──────────────────────────────
        case "navigate":
          await navigate(this.pageManager, action.url);
          break;

        case "goBack":
          await goBack(this.pageManager);
          break;

        case "goForward":
          await goForward(this.pageManager);
          break;

        case "refresh":
          await refresh(this.pageManager);
          break;

        // ── Element interaction ──────────────────────
        case "click":
          await click(this.pageManager, action.orbitId);
          break;

        case "type":
          await type(this.pageManager, action.orbitId, action.text);
          break;

        case "press":
          await press(this.pageManager, action.orbitId, action.key);
          break;

        case "hover":
          await hover(this.pageManager, action.orbitId);
          break;

        case "select":
          await select(this.pageManager, action.orbitId, action.value);
          break;

        case "uploadFile":
          await uploadFile(this.pageManager, action.orbitId, action.filePath);
          break;

        case "downloadFile":
          await downloadFile(this.pageManager, action.orbitId, this.downloadDir);
          break;

        // ── Scroll ───────────────────────────────────
        case "scroll":
          await scroll(this.pageManager, action.direction, action.amount);
          break;

        // ── Wait ─────────────────────────────────────
        case "waitForElement":
          await waitForElement(this.pageManager, action.selector, action.timeout);
          break;

        case "waitForText":
          await waitForText(this.pageManager, action.text, action.timeout);
          break;

        // ── Page read ────────────────────────────────
        case "readPage":
          result.snapshot = await readPage(this.pageManager);
          break;

        // ── Tab switching ───────────────────────────
        case "switchTab":
          await switchTab(this.pageManager, action.tabId);
          break;

        // ── Finish ───────────────────────────────────
        case "finish":
          logger.success(`Agent finished. Reason: ${action.reason ?? "(none)"}`);
          return result;
      }

      // Take screenshot + fresh snapshot after every action
      result.screenshotPath = await this.pageManager.takeScreenshot();
      if (action.action !== "readPage") {
        result.snapshot = await this.pageManager.snapshot();
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Executor error: ${message}`);
      result.error = message;

      try {
        result.screenshotPath = await this.pageManager.takeScreenshot();
        result.snapshot = await this.pageManager.snapshot();
      } catch { /* ignore secondary failures */ }
    }

    return result;
  }
}
