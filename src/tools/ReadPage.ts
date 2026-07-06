// ──────────────────────────────────────────────────
//  Tool: ReadPage (returns snapshot — used by agent loop)
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { PageSnapshot } from "../types";
import { logger } from "../utils/logger";

export async function readPage(pageManager: PageManager): Promise<PageSnapshot> {
  logger.action("readPage → extracting interactive elements …");
  const snapshot = await pageManager.snapshot();
  logger.dim(`URL: ${snapshot.url}  |  Title: "${snapshot.title}"  |  Elements: ${snapshot.elements.length}`);
  return snapshot;
}
