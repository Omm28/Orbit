// ──────────────────────────────────────────────────
//  Tool: Type  (Phase 3: orbitId)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { orbitSelector } from "../types";
import { logger } from "../utils/logger";

export async function type(pageManager: PageManager, orbitId: number, text: string): Promise<void> {
  const sel = orbitSelector(orbitId);
  logger.action(`type   → orbitId=${orbitId}  text="${text}"`);
  const frame = await pageManager.getFrameForOrbitId(orbitId);
  await frame.fill(sel, text, { timeout: 10_000 });
}
