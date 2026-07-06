// ──────────────────────────────────────────────────
//  Tool: Select  (Phase 2)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { orbitSelector } from "../types";
import { logger } from "../utils/logger";

export async function select(pageManager: PageManager, orbitId: number, value: string): Promise<void> {
  const sel = orbitSelector(orbitId);
  logger.action(`select → orbitId=${orbitId}  value="${value}"`);
  const frame = await pageManager.getFrameForOrbitId(orbitId);
  // selectOption matches by value, label, or index string
  await frame.selectOption(sel, value, { timeout: 10_000 });
  await frame.waitForTimeout(300);
}
