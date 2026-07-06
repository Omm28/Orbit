// ──────────────────────────────────────────────────
//  Tool: Scroll  (Phase 2)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { logger } from "../utils/logger";

export async function scroll(
  pageManager: PageManager,
  direction: "up" | "down" | "left" | "right",
  amount: number,
): Promise<void> {
  logger.action(`scroll → ${direction}  amount=${amount}px`);
  const page = await pageManager.getPage();

  const deltaX = direction === "left" ? -amount : direction === "right" ? amount : 0;
  const deltaY = direction === "up"   ? -amount : direction === "down"  ? amount : 0;

  await page.mouse.wheel(deltaX, deltaY);
  await page.waitForTimeout(400);
}
