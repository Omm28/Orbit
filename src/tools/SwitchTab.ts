// ──────────────────────────────────────────────────
//  Tool: SwitchTab  (Phase 10: Multi-Tab Support)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { logger } from "../utils/logger";

export async function switchTab(pageManager: PageManager, tabId: number): Promise<void> {
  logger.action(`switchTab → tabId=${tabId}`);
  await pageManager.switchTab(tabId);
  // Brief pause for the newly focused tab to settle
  const page = await pageManager.getPage();
  await page.waitForTimeout(300);
}
