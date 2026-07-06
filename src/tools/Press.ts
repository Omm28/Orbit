// ──────────────────────────────────────────────────
//  Tool: Press  (Phase 3: orbitId)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { orbitSelector } from "../types";
import { logger } from "../utils/logger";

export async function press(pageManager: PageManager, orbitId: number, key: string): Promise<void> {
  const sel = orbitSelector(orbitId);
  logger.action(`press  → orbitId=${orbitId}  key="${key}"`);
  const frame = await pageManager.getFrameForOrbitId(orbitId);
  await frame.press(sel, key, { timeout: 10_000, noWaitAfter: true });
  await frame.waitForTimeout(300);
}
