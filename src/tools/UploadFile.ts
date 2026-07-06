// ──────────────────────────────────────────────────
//  Tool: UploadFile  (Phase 2)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { orbitSelector } from "../types";
import { logger } from "../utils/logger";

export async function uploadFile(pageManager: PageManager, orbitId: number, filePath: string): Promise<void> {
  const sel = orbitSelector(orbitId);
  logger.action(`uploadFile → orbitId=${orbitId}  path="${filePath}"`);
  const page = await pageManager.getPage();
  await page.setInputFiles(sel, filePath);
}
