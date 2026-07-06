// ──────────────────────────────────────────────────
//  Tool: Wait  (Phase 2)
//  Exports: waitForElement, waitForText
// ──────────────────────────────────────────────────

import { PageManager } from "../browser/PageManager";
import { logger } from "../utils/logger";

export async function waitForElement(
  pageManager: PageManager,
  selector: string,
  timeout: number,
): Promise<void> {
  logger.action(`waitForElement → selector="${selector}"  timeout=${timeout}ms`);
  const page = await pageManager.getPage();
  await page.waitForSelector(selector, { state: "visible", timeout });
}

export async function waitForText(
  pageManager: PageManager,
  text: string,
  timeout: number,
): Promise<void> {
  logger.action(`waitForText → "${text}"  timeout=${timeout}ms`);
  const page = await pageManager.getPage();
  // Use getByText to find the text anywhere on the page
  await page.getByText(text).first().waitFor({ state: "visible", timeout });
}
