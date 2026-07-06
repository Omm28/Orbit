// ──────────────────────────────────────────────────
//  Tool: Click  (Phase 9: Self-Healing Overlay Dismissal)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { orbitSelector } from "../types";
import { logger } from "../utils/logger";

export async function click(pageManager: PageManager, orbitId: number): Promise<void> {
  const sel = orbitSelector(orbitId);
  logger.action(`click  → orbitId=${orbitId}  (${sel})`);
  const page = await pageManager.getPage();
  
  try {
    // Keep timeout short so self-healing doesn't wait too long
    await page.click(sel, { timeout: 6000 });
    await page.waitForTimeout(500);
  } catch (err: any) {
    const errorMsg = err.message.toLowerCase();
    const isIntercepted = 
      errorMsg.includes("click intercepted") || 
      errorMsg.includes("intercepted") || 
      errorMsg.includes("pointing to other element") ||
      errorMsg.includes("obscuring") ||
      errorMsg.includes("timeout") ||
      errorMsg.includes("exceeded");

    if (isIntercepted) {
      logger.warn(`⚠️ [Self-Healing] Click intercepted by overlay blocker. Attempting automatic popup/cookie banner dismissal...`);
      
      const closeSelectors = [
        "button[aria-label*='close' i]",
        "button[class*='close' i]",
        "button[id*='close' i]",
        "a[class*='close' i]",
        "[class*='cookie' i] button",
        "[id*='cookie' i] button",
        "button:has-text('accept' i)",
        "button:has-text('agree' i)",
        "button:has-text('dismiss' i)",
        "button:has-text('close' i)",
        "button:has-text('decline' i)",
        "button:has-text('reject' i)",
        ".modal-close",
        ".modal .close",
        "[class*='modal' i] [class*='close' i]",
        "#cookie-accept",
        "#cookie-dismiss"
      ];

      let dismissed = false;
      for (const selector of closeSelectors) {
        try {
          const locator = page.locator(selector).first();
          if (await locator.isVisible()) {
            logger.dim(`[Self-Healing] Found overlay close element: "${selector}". Clicking it...`);
            await locator.click({ timeout: 2000 });
            await page.waitForTimeout(500);
            dismissed = true;
            break;
          }
        } catch {
          // ignore locator errors
        }
      }

      if (dismissed) {
        pageManager.selfHealingCount++;
        logger.success(`[Self-Healing] Overlay dismissed! Retrying original click...`);
        await page.click(sel, { timeout: 5000 });
        await page.waitForTimeout(500);
        return;
      } else {
        logger.warn(`[Self-Healing] No dismissable overlay elements detected. Raising original error.`);
      }
    }
    
    throw err;
  }
}
