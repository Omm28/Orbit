// ──────────────────────────────────────────────────
//  Orbit – Logger utility
// ──────────────────────────────────────────────────

import { Subtask } from "../types";

type LogLevel = "info" | "action" | "warn" | "error" | "success" | "dim" | "plan";

const COLORS: Record<LogLevel, string> = {
  info:    "\x1b[36m",   // cyan
  action:  "\x1b[35m",   // magenta
  warn:    "\x1b[33m",   // yellow
  error:   "\x1b[31m",   // red
  success: "\x1b[32m",   // green
  dim:     "\x1b[90m",   // dark gray
  plan:    "\x1b[34m",   // blue
};
const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function log(level: LogLevel, prefix: string, message: string): void {
  const color = COLORS[level];
  console.log(`${COLORS.dim}[${timestamp()}]${RESET} ${color}${BOLD}${prefix}${RESET} ${message}`);
}

const STATUS_ICON: Record<string, string> = {
  done:        "[x]",
  in_progress: "[>]",
  todo:        "[ ]",
};

export const logger = {
  info   : (msg: string) => log("info",    "[INFO]   ", msg),
  action : (msg: string) => log("action",  "[ACTION] ", msg),
  warn   : (msg: string) => log("warn",    "[WARN]   ", msg),
  error  : (msg: string) => log("error",   "[ERROR]  ", msg),
  success: (msg: string) => log("success", "[SUCCESS]", msg),
  dim    : (msg: string) => log("dim",     "  ·      ", msg),

  plan: (subtasks: Subtask[]) => {
    if (subtasks.length === 0) return;
    log("plan", "[PLAN]   ", "");
    for (const st of subtasks) {
      const icon = STATUS_ICON[st.status] ?? "?";
      const color = st.status === "done"
        ? COLORS.success
        : st.status === "in_progress"
          ? COLORS.plan
          : COLORS.dim;
      console.log(`           ${color}${icon} [${st.status}] ${st.title}${RESET}`);
    }
  },
};
