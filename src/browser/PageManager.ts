// ──────────────────────────────────────────────────
//  Orbit – Page manager  (Phase 3: orbit-id injection)
// ──────────────────────────────────────────────────

import path from "path";
import fs from "fs";
import { Page, BrowserContext, Frame } from "playwright";
import { PageElement, PageSnapshot, TabInfo } from "../types";
import { logger } from "../utils/logger";

export class PageManager {
  /** Currently active page (the tab the agent interacts with). */
  private activePage:     Page | null = null;
  private screenshotDir:  string;
  private stepIndex = 0;

  /** Number of successful self-healing overlay dismissals this run. */
  public selfHealingCount = 0;

  constructor(private context: BrowserContext, screenshotDir: string) {
    this.screenshotDir = screenshotDir;
    fs.mkdirSync(screenshotDir, { recursive: true });

    // Track new popups / tabs opened by the page automatically
    this.context.on("page", (newPage) => {
      logger.info(`[PageManager] New tab opened: ${newPage.url() || "(loading…)"}`);
      newPage.once("load", () => {
        logger.info(`[PageManager] New tab loaded: ${newPage.url()}`);
      });
    });
  }

  updateContext(newContext: BrowserContext): void {
    this.context    = newContext;
    this.activePage = null;
  }

  async getFrameForOrbitId(orbitId: number): Promise<Frame> {
    const page = await this.getPage();
    for (const frame of page.frames()) {
      try {
        const exists = await frame.evaluate((id) => {
          function findEl(root: Document | ShadowRoot, idVal: string): Element | null {
            if (!root) return null;
            const match = root.querySelector(`[data-orbit-id="${idVal}"]`);
            if (match) return match;
            
            const all = root.querySelectorAll("*");
            for (const el of Array.from(all)) {
              if (el.shadowRoot) {
                const m = findEl(el.shadowRoot, idVal);
                if (m) return m;
              }
            }
            return null;
          }
          return !!findEl(document, String(id));
        }, orbitId);

        if (exists) return frame;
      } catch {
        // ignore cross-origin access errors
      }
    }
    return page.mainFrame();
  }

  async getPage(): Promise<Page> {
    // Use existing active page if still open
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }
    // Fall back to the most recently opened page in the context
    const pages = this.context.pages();
    if (pages.length > 0) {
      this.activePage = pages[pages.length - 1];
      return this.activePage;
    }
    // Create a fresh page
    this.activePage = await this.context.newPage();
    return this.activePage;
  }

  /**
   * Switches the active tab to the given index (0-based).
   * The next snapshot / interaction will target this tab.
   */
  async switchTab(tabId: number): Promise<void> {
    const pages = this.context.pages();
    if (tabId < 0 || tabId >= pages.length) {
      throw new Error(
        `switchTab: tab ${tabId} does not exist. ${pages.length} tab(s) currently open.`
      );
    }
    this.activePage = pages[tabId];
    await this.activePage.bringToFront();
    logger.info(`[PageManager] Switched to tab ${tabId}: ${this.activePage.url()}`);
  }

  // ── Stability ──────────────────────────────────

  async waitForStability(): Promise<void> {
    const page = await this.getPage();
    try {
      // Wait for page loading to settle, max 3 seconds
      await Promise.race([
        page.waitForLoadState("domcontentloaded", { timeout: 3000 }),
        page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      // Ignore errors from context destruction/navigation
    }
  }

  // ── Screenshot ──────────────────────────────────

  async takeScreenshot(): Promise<string> {
    await this.waitForStability();
    const page = await this.getPage();
    this.stepIndex++;
    const filename = `step-${String(this.stepIndex).padStart(3, "0")}.png`;
    const filepath  = path.join(this.screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    logger.dim(`Screenshot saved → ${filepath}`);
    return filepath;
  }

  // ── Page snapshot (Phase 3: injects orbit-id, rich element map) ──

  async snapshot(activeSubtask?: string): Promise<PageSnapshot> {
    await this.waitForStability();
    const page  = await this.getPage();
    const url   = page.url();
    const title = await page.title();

    // Inject data-orbit-id attributes and collect element metadata in one pass
    type RawEl = {
      orbitId:     number;
      tag:         string;
      text?:       string;
      placeholder?: string;
      ariaLabel?:  string;
      id?:         string;
      name?:       string;
      role?:       string;
      href?:       string;
      type?:       string;
      visible:     boolean;
      enabled:     boolean;
      x?:          number;
      y?:          number;
      width?:      number;
      height?:     number;
    };

    const elements: PageElement[] = await page.evaluate((subtaskText?: string): RawEl[] => {
      // Clear any existing stale data-orbit-id attributes first
      const existing = document.querySelectorAll("[data-orbit-id]");
      existing.forEach((el) => el.removeAttribute("data-orbit-id"));

      const SELECTORS =
        "a, button, input, textarea, select, [role='button'], [role='link'], " +
        "[role='menuitem'], [role='option'], [role='tab'], [role='checkbox'], " +
        "[role='radio'], [tabindex]:not([tabindex='-1'])";

      function collectElements(root: Document | ShadowRoot, list: Element[]) {
        if (!root) return;
        const matches = root.querySelectorAll(SELECTORS);
        matches.forEach((el) => {
          if (!list.includes(el)) list.push(el);
        });

        const all = root.querySelectorAll("*");
        all.forEach((el) => {
          if (el.shadowRoot) {
            collectElements(el.shadowRoot, list);
          }
        });

        const iframes = root.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
          try {
            if (iframe.contentDocument) {
              collectElements(iframe.contentDocument, list);
            }
          } catch {
            // cross-origin iframe
          }
        });
      }

      const nodes: Element[] = [];
      collectElements(document, nodes);

      // Filter visible elements and calculate layout coordinates
      const visibleNodes = nodes.filter((el) => {
        const rect  = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0"
        );
      });

      // Score and sort elements by relevance if a subtask is active
      if (subtaskText) {
        const scoreElement = (el: Element, text: string): number => {
          let score = 0;
          const keywords = text.toLowerCase().split(/\s+/).filter(k => k.length > 2);
          if (keywords.length === 0) return 0;
          
          const e = el as HTMLElement;
          const inp = el as HTMLInputElement;
          const targetText = [
            e.innerText,
            el.getAttribute("aria-label"),
            inp.placeholder,
            el.id,
            inp.name,
            el.getAttribute("href")
          ].filter((t): t is string => typeof t === "string").map(t => t.toLowerCase()).join(" ");

          for (const keyword of keywords) {
            if (targetText.includes(keyword)) score += 10;
          }

          const subLower = text.toLowerCase();
          const isInput = subLower.includes("type") || subLower.includes("enter") || subLower.includes("fill") || subLower.includes("search");
          const isClick = subLower.includes("click") || subLower.includes("press") || subLower.includes("submit") || subLower.includes("go");

          const tagName = el.tagName.toLowerCase();
          if (isInput && (tagName === "input" || tagName === "textarea")) score += 5;
          if (isClick && (tagName === "button" || tagName === "a" || el.getAttribute("role") === "button")) score += 5;

          return score;
        };

        visibleNodes.sort((a, b) => scoreElement(b, subtaskText) - scoreElement(a, subtaskText));
      }

      let idCounter = 0;

      return visibleNodes
        .slice(0, 80)  // cap to avoid huge prompts
        .map((el) => {
          const orbitId = idCounter++;
          (el as HTMLElement).setAttribute("data-orbit-id", String(orbitId));

          const e   = el as HTMLElement;
          const inp = el as HTMLInputElement;
          const anc = el as HTMLAnchorElement;

          const isDisabled =
            (inp as unknown as HTMLButtonElement).disabled ||
            el.getAttribute("aria-disabled") === "true";

          const tagName = el.tagName.toLowerCase();
          const val = (tagName === "input" || tagName === "textarea" || tagName === "select")
            ? (el as HTMLInputElement).value
            : undefined;

          // Calculate absolute coordinates compensating for same-origin iframes
          let rect = el.getBoundingClientRect();
          let left = rect.left;
          let top = rect.top;

          let currentDoc = el.ownerDocument;
          while (currentDoc !== document) {
            const win = currentDoc.defaultView;
            if (!win) break;
            const iframe = win.frameElement;
            if (!iframe) break;
            const iframeRect = iframe.getBoundingClientRect();
            left += iframeRect.left;
            top += iframeRect.top;
            currentDoc = iframe.ownerDocument;
          }

          return {
            orbitId,
            tag:         tagName,
            text:        (e.innerText || e.textContent || "").trim().substring(0, 120) || undefined,
            value:       val || undefined,
            placeholder: inp.placeholder || undefined,
            ariaLabel:   el.getAttribute("aria-label") || undefined,
            id:          el.id || undefined,
            name:        inp.name || undefined,
            role:        el.getAttribute("role") || undefined,
            href:        anc.href ? anc.href.substring(0, 80) : undefined,
            type:        inp.type || undefined,
            visible:     true,
            enabled:     !isDisabled,
            x:           Math.floor(left),
            y:           Math.floor(top),
            width:       Math.floor(rect.width),
            height:      Math.floor(rect.height),
          };
        });
    }, activeSubtask);

    // Extract a cleaned representation of text visible in the viewport
    const textContent: string = await page.evaluate((): string => {
      const viewHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewWidth = window.innerWidth || document.documentElement.clientWidth;

      function isVisible(el: Element): boolean {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return false;
        }
        return (
          rect.bottom > 0 &&
          rect.top < viewHeight &&
          rect.right > 0 &&
          rect.left < viewWidth
        );
      }

      const visibleTexts: string[] = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            
            // Filter out scripting/layout containers
            const tag = parent.tagName.toLowerCase();
            if (["script", "style", "noscript", "iframe", "svg"].includes(tag)) {
              return NodeFilter.FILTER_REJECT;
            }

            if (isVisible(parent)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );

      let currentNode = walker.nextNode();
      while (currentNode) {
        const txt = currentNode.textContent?.trim();
        if (txt) {
          visibleTexts.push(txt);
        }
        currentNode = walker.nextNode();
      }

      return visibleTexts
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 3500);
    }).catch(() => "");
    
    // Compile tab metadata for all open pages in the context
    const allPages = this.context.pages();
    const tabs: TabInfo[] = await Promise.all(
      allPages.map(async (p, i) => ({
        tabId:    i,
        url:      p.url(),
        title:    p.isClosed() ? "(closed)" : await p.title().catch(() => "(unknown)"),
        isActive: p === page,
      }))
    );

    return { url, title, elements, textContent, tabs };
  }
}
