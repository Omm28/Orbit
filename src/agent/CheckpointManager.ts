// ──────────────────────────────────────────────────
//  Orbit – Checkpoint Manager
//  Manages browser storage state saves and restores
//  at completed subtask milestones.
// ──────────────────────────────────────────────────

import { BrowserContext } from "playwright";
import { Browser } from "../browser/Browser";
import { PageManager } from "../browser/PageManager";
import { logger } from "../utils/logger";

export interface Checkpoint {
  subtaskTitle: string;
  url:          string;
  storageState: any;
}

export class CheckpointManager {
  private checkpoints: Checkpoint[] = [];

  /**
   * Saves the current browser context state as a checkpoint
   */
  async saveCheckpoint(
    context: BrowserContext,
    subtaskTitle: string,
    url: string
  ): Promise<void> {
    try {
      const storageState = await context.storageState();
      
      // Remove any existing checkpoint for this exact subtask to avoid duplication
      this.checkpoints = this.checkpoints.filter((cp) => cp.subtaskTitle !== subtaskTitle);

      this.checkpoints.push({
        subtaskTitle,
        url,
        storageState,
      });

      logger.dim(`[Checkpoint] Saved state for subtask: "${subtaskTitle}" at ${url}`);
    } catch (err: any) {
      logger.warn(`Failed to save checkpoint: ${err.message}`);
    }
  }

  /**
   * Gets the last saved checkpoint
   */
  getLastCheckpoint(): Checkpoint | undefined {
    if (this.checkpoints.length === 0) return undefined;
    return this.checkpoints[this.checkpoints.length - 1];
  }

  /**
   * Restores the browser context and page to the specified checkpoint
   */
  async restoreCheckpoint(
    browser: Browser,
    pageManager: PageManager,
    checkpoint: Checkpoint
  ): Promise<void> {
    logger.info(`[Checkpoint] Restoring browser state to milestone: "${checkpoint.subtaskTitle}"…`);
    
    // Reset Playwright context with the saved storage state
    const newContext = await browser.resetContext(checkpoint.storageState);
    
    // Bind PageManager to the new context and reset page reference
    pageManager.updateContext(newContext);

    // Force context page creation and navigate to the milestone URL
    const page = await pageManager.getPage();
    await page.goto(checkpoint.url);
    await pageManager.waitForStability();

    logger.success(`[Checkpoint] Restored. Currently at URL: ${page.url()}`);
  }
}
