// ──────────────────────────────────────────────────
//  Tool: Hover  (Phase 2)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { orbitSelector } from "../types";
import { logger } from "../utils/logger";

export async function hover(pageManager: PageManager, orbitId: number): Promise<void> {
  const sel = orbitSelector(orbitId);
  logger.action(`hover  → orbitId=${orbitId}  (${sel})`);
  const frame = await pageManager.getFrameForOrbitId(orbitId);
  await frame.hover(sel, { timeout: 10_000 });
  await frame.waitForTimeout(300);
}
