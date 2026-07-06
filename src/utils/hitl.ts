// ──────────────────────────────────────────────────
//  Orbit – Human-in-the-Loop helper
// ──────────────────────────────────────────────────

import readline from "readline";
import { logger } from "./logger";

/**
 * Pauses terminal execution and waits for the user to press Enter.
 */
export function waitForUserEnter(promptMessage: string): Promise<void> {
  if (process.env.NON_INTERACTIVE === "true") {
    logger.info("[HITL] Non-interactive mode; auto-confirming prompt.");
    return Promise.resolve();
  }

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptMessage, () => {
      rl.close();
      resolve();
    });
  });
}
