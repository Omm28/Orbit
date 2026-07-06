// ──────────────────────────────────────────────────
//  Orbit – Entry point
// ──────────────────────────────────────────────────

import "dotenv/config";
import readline from "readline";
import path from "path";
import { Agent } from "./agent/Agent";
import { logger } from "./utils/logger";

async function promptTask(): Promise<string> {
  // If a task was passed as CLI args, use that
  const cliTask = process.argv.slice(2).join(" ").trim();
  if (cliTask) return cliTask;

  // Otherwise, prompt interactively
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("\nEnter your browser task: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  console.log("\n");
  console.log("  ██████╗ ██████╗ ██████╗ ██╗████████╗");
  console.log("  ██╔═══██╗██╔══██╗██╔══██╗██║╚══██╔══╝");
  console.log("  ██║   ██║██████╔╝██████╔╝██║   ██║   ");
  console.log("  ██║   ██║██╔══██╗██╔══██╗██║   ██║   ");
  console.log("  ╚██████╔╝██║  ██║██████╔╝██║   ██║   ");
  console.log("   ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ");
  console.log("  AI Browser Agent  ·  powered by OpenAI\n");

  const task = await promptTask();
  if (!task) {
    logger.error("No task provided. Exiting.");
    process.exit(1);
  }

  const agent = new Agent({
    headless:      process.env.HEADLESS === "true",
    screenshotDir: process.env.SCREENSHOTS_DIR ?? path.join(process.cwd(), "screenshots"),
    maxSteps:      parseInt(process.env.MAX_STEPS ?? "20", 10),
    recordVideo:   process.env.RECORD_VIDEO === "true",
    videoDir:      process.env.VIDEO_DIR ?? path.join(process.cwd(), "recordings"),
  });

  await agent.run(task);
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
