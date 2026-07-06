// ──────────────────────────────────────────────────
//  Tool: Navigate
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { logger } from "../utils/logger";

export async function navigate(pageManager: PageManager, url: string): Promise<void> {
  logger.action(`navigate → ${url}`);
  const page = await pageManager.getPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
}
