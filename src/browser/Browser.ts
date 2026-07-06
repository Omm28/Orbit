// ──────────────────────────────────────────────────
//  Orbit – Browser wrapper
// ──────────────────────────────────────────────────

import path from "path";
import fs   from "fs";
import { chromium, Browser as PlaywrightBrowser, BrowserContext } from "playwright";
import { logger } from "../utils/logger";

const BASE_CONTEXT_OPTIONS = {
  viewport:  { width: 1280, height: 800 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36",
};

export class Browser {
  private browser:  PlaywrightBrowser | null = null;
  private context:  BrowserContext    | null = null;
  private videoDir: string            | undefined;

  async launch(headless = false, videoDir?: string): Promise<void> {
    logger.info(`Launching browser (headless=${headless}) …`);
    this.browser  = await chromium.launch({ headless });
    this.videoDir = videoDir;

    const options: any = { ...BASE_CONTEXT_OPTIONS };
    if (videoDir) {
      fs.mkdirSync(videoDir, { recursive: true });
      options.recordVideo = { dir: videoDir, size: { width: 1280, height: 800 } };
      logger.dim(`[Recording] Video will be saved to: ${videoDir}`);
    }

    this.context = await this.browser.newContext(options);
    logger.success("Browser launched.");
  }

  getContext(): BrowserContext {
    if (!this.context) throw new Error("Browser not launched. Call launch() first.");
    return this.context;
  }

  async resetContext(storageState?: any): Promise<BrowserContext> {
    if (!this.browser) throw new Error("Browser not launched. Call launch() first.");
    if (this.context) {
      await this.context.close().catch(() => {});
    }
    const options: any = { ...BASE_CONTEXT_OPTIONS, storageState };
    if (this.videoDir) {
      options.recordVideo = { dir: this.videoDir, size: { width: 1280, height: 800 } };
    }
    this.context = await this.browser.newContext(options);
    return this.context;
  }

  async close(): Promise<void> {
    if (this.browser) {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
      await this.browser.close();
      this.browser = null;
      this.context = null;
      logger.info("Browser closed.");
    }
  }
}
