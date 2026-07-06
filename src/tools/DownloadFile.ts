// ──────────────────────────────────────────────────
//  Tool: DownloadFile  (Phase 2)
// ──────────────────────────────────────────────────

import path from "path";
import { PageManager } from "../browser/PageManager";
import { orbitSelector } from "../types";
import { logger } from "../utils/logger";

export async function downloadFile(
  pageManager: PageManager,
  orbitId: number,
  saveDir: string,
): Promise<string> {
  const sel = orbitSelector(orbitId);
  logger.action(`downloadFile → orbitId=${orbitId}  saveDir="${saveDir}"`);
  const page = await pageManager.getPage();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.click(sel, { timeout: 10_000 }),
  ]);

  const suggestedName = download.suggestedFilename();
  const savePath = path.join(saveDir, suggestedName);
  await download.saveAs(savePath);
  logger.dim(`File downloaded → ${savePath}`);
  return savePath;
}
