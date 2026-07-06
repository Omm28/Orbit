// ──────────────────────────────────────────────────
//  Orbit – Safety Guardrails
// ──────────────────────────────────────────────────
//
//  DESIGN OVERVIEW
//  ────────────────
//  Guardrails runs two distinct checks:
//
//  1. PRE-ACTION CHECK  (Guardrails.check)
//     Inspects the element the LLM wants to interact with before execution.
//     Scans text, aria-label, id, name, href for risky keyword matches and
//     validates navigation URLs against the domain whitelist.
//
//     Limitation: purely text-based. An icon-only button ("🗑" with no
//     aria-label) or an obfuscated action will slip through.
//
//  2. POST-ACTION CHECK  (Guardrails.checkPostAction)
//     Runs after a click/type executes, against the resulting DOM state.
//     Checks two things:
//       a) URL path pattern — does the new URL match known checkout/payment
//          path signatures (e.g. /checkout, /payment, /order/confirm)?
//       b) Visible page text — does the visible content contain phrases
//          that signal a risky transaction completed or is in progress
//          (e.g. "order confirmed", "payment processed", "account deleted")?
//
//     TRADEOFF: This is a heuristic, not a proof. It can:
//       - False-positive: block a legitimate page that happens to contain
//         the word "payment" in a neutral context (e.g. a help article).
//       - False-negative: miss a risky action on a heavily JS-rendered page
//         that hasn't flushed visible text by the time the check runs.
//
//     The choice to implement it as a post-action heuristic rather than
//     a strict allowlist reflects the agent's use case: it is designed to
//     operate on open-ended tasks against arbitrary pages, so a hard
//     allowlist would be too brittle. The heuristic adds a meaningful
//     second layer of defence against obfuscated risky actions without
//     requiring every page to be pre-catalogued.
//
// ──────────────────────────────────────────────────

import { AgentAction, PageSnapshot } from "../types";
import { logger } from "../utils/logger";

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

const RISKY_KEYWORDS = [
  "buy",
  "purchase",
  "pay",
  "checkout",
  "delete account",
  "deactivate",
  "terminate",
  "wipe",
  "credit card",
  "subscribe",
  "order",
];

// URL path segments that strongly indicate a payment/destructive flow
const RISKY_URL_PATTERNS = [
  /\/checkout/i,
  /\/payment/i,
  /\/pay\b/i,
  /\/order\/confirm/i,
  /\/purchase/i,
  /\/delete[-_]?account/i,
  /\/account\/delete/i,
  /\/billing/i,
  /\/subscribe/i,
];

// Phrases that indicate a risky action already completed
const RISKY_CONFIRMATION_PHRASES = [
  "order confirmed",
  "order placed",
  "payment processed",
  "payment successful",
  "payment complete",
  "purchase complete",
  "account deleted",
  "account deactivated",
  "successfully deleted",
  "thank you for your order",
  "your card has been charged",
];

const DOMAIN_WHITELIST = [
  "wikipedia.org",
  "en.wikipedia.org",
  "google.com",
  "github.com",
  "heroku.com",
  "herokuapp.com",
  "localhost",
  "127.0.0.1",
  "about:blank",
];

export class Guardrails {
  /**
   * PRE-ACTION CHECK
   * Checks if an action is safe to execute given the current page snapshot.
   * Called before the action runs.
   */
  static check(action: AgentAction, snapshot: PageSnapshot): SafetyCheckResult {
    // 1. Navigation checks
    if (action.action === "navigate") {
      try {
        const urlObj = new URL(action.url);
        const host = urlObj.hostname.toLowerCase();

        // Allow file protocol (for local evals)
        if (urlObj.protocol === "file:") {
          return { allowed: true };
        }

        const isWhitelisted = DOMAIN_WHITELIST.some(
          (domain) => host === domain || host.endsWith("." + domain)
        );

        if (!isWhitelisted) {
          return {
            allowed: false,
            reason: `Navigation to domain "${host}" is blocked by safety policy. Only whitelisted domains are allowed.`,
          };
        }
      } catch (err) {
        // Handle invalid url strings or custom about:blank
        if (action.url !== "about:blank") {
          return {
            allowed: false,
            reason: `Invalid URL: "${action.url}"`,
          };
        }
      }
    }

    // 2. Element action checks (click, type, press, select, hover, etc.)
    if ("orbitId" in action) {
      const element = snapshot.elements.find((el) => el.orbitId === action.orbitId);
      if (element) {
        // Check text label or attributes for risky transaction keywords
        const textToCheck = [
          element.text,
          element.ariaLabel,
          element.placeholder,
          element.id,
          element.name,
          element.href,
        ]
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.toLowerCase());

        for (const item of textToCheck) {
          for (const keyword of RISKY_KEYWORDS) {
            if (item.includes(keyword)) {
              return {
                allowed: false,
                reason: `Action blocked. Target element matches transaction safeguard policy (matched keyword: "${keyword}").`,
              };
            }
          }
        }
      }
    }

    return { allowed: true };
  }

  /**
   * POST-ACTION CHECK
   * Inspects the resulting DOM/URL state after a click or type action executes.
   * Detects risky outcomes that slipped past the pre-action check (e.g. obfuscated
   * icon-only buttons with no readable text/aria-label).
   * Called in Executor after the action completes and the fresh snapshot is taken.
   */
  static checkPostAction(
    action: AgentAction,
    resultSnapshot: PageSnapshot
  ): SafetyCheckResult {
    // Only meaningful to check after element interactions (click, type, press, select)
    const interactionActions = new Set(["click", "type", "press", "select"]);
    if (!interactionActions.has(action.action)) {
      return { allowed: true };
    }

    // 1. URL pattern check
    const url = resultSnapshot.url ?? "";
    for (const pattern of RISKY_URL_PATTERNS) {
      if (pattern.test(url)) {
        const msg = `Post-action URL "${url}" matches a risky path pattern (${pattern}). Potential unintended transaction.`;
        logger.warn(`[Guardrails Post-Action] ${msg}`);
        return { allowed: false, reason: msg };
      }
    }

    // 2. Visible page text confirmation phrase check
    const visibleText = (resultSnapshot.textContent ?? "").toLowerCase();
    for (const phrase of RISKY_CONFIRMATION_PHRASES) {
      if (visibleText.includes(phrase)) {
        const msg = `Post-action page text contains risky confirmation phrase: "${phrase}". Potential unintended transaction.`;
        logger.warn(`[Guardrails Post-Action] ${msg}`);
        return { allowed: false, reason: msg };
      }
    }

    return { allowed: true };
  }
}
