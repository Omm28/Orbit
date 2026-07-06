// ──────────────────────────────────────────────────
//  Tool: Navigation Actions  (Phase 2)
//  Exports: goBack, goForward, refresh
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { logger } from "../utils/logger";

export async function goBack(pageManager: PageManager): Promise<void> {
  logger.action("goBack");
  const page = await pageManager.getPage();
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 });
}

export async function goForward(pageManager: PageManager): Promise<void> {
  logger.action("goForward");
  const page = await pageManager.getPage();
  await page.goForward({ waitUntil: "domcontentloaded", timeout: 15_000 });
}

export async function refresh(pageManager: PageManager): Promise<void> {
  logger.action("refresh");
  const page = await pageManager.getPage();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
}
