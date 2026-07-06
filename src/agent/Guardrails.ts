// ──────────────────────────────────────────────────
//  Orbit – Safety Guardrails
//  Ensures the autonomous agent operates within
//  acceptable parameters.
// ──────────────────────────────────────────────────

import { AgentAction, PageSnapshot } from "../types";
import { logger } from "../utils/logger";

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

// Simple rules for recruiting demo
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
   * Checks if an action is safe to execute given the current page snapshot.
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
}
