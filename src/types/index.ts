// ──────────────────────────────────────────────────
//  Orbit – Shared types  (Phase 2 + Phase 3)
// ──────────────────────────────────────────────────

import { z } from "zod";

// ── Page snapshot ─────────────────────────────────

export interface PageElement {
  orbitId:    number;        // unique sequential id injected by PageManager
  tag:        string;
  text?:      string;
  value?:     string;
  placeholder?: string;
  ariaLabel?: string;
  id?:        string;
  name?:      string;
  role?:      string;
  href?:      string;
  type?:      string;
  visible:    boolean;
  enabled:    boolean;
  x?:         number;
  y?:         number;
  width?:     number;
  height?:    number;
}

// ── Tab metadata ──────────────────────────────────

export interface TabInfo {
  tabId:    number;   // index in context.pages()
  title:    string;
  url:      string;
  isActive: boolean;
}

export interface PageSnapshot {
  url:          string;
  title:        string;
  elements:     PageElement[];
  textContent?: string;
  tabs?:        TabInfo[];  // all open tabs in the context
}

// ── Subtask checklist ─────────────────────────────

export type SubtaskStatus = "todo" | "in_progress" | "done";

export interface Subtask {
  title:  string;
  status: SubtaskStatus;
}

// ── Session memory (maintained by Agent across steps) ──

export interface SessionState {
  objective:        string;
  visitedUrls:      string[];
  screenshotPaths:  string[];
  stepCount:        number;
}

// ── Combined LLM response (action + updated plan) ──

export interface LLMResponse {
  subtasks:  Subtask[];
  action?:   AgentAction;
  actions?:  AgentAction[];
}

// ── Helper: build the Playwright selector for a given orbitId ──
export function orbitSelector(orbitId: number): string {
  return `[data-orbit-id="${orbitId}"]`;
}

// ── LLM Actions (Zod schemas + inferred types) ────

/** Actions that target a specific element use orbitId */
export const NavigateActionSchema = z.object({
  action: z.literal("navigate"),
  url: z.string().url(),
});

export const ClickActionSchema = z.object({
  action:   z.literal("click"),
  orbitId:  z.number().int().nonnegative(),
});

export const TypeActionSchema = z.object({
  action:   z.literal("type"),
  orbitId:  z.number().int().nonnegative(),
  text:     z.string(),
});

export const PressActionSchema = z.object({
  action:   z.literal("press"),
  orbitId:  z.number().int().nonnegative(),
  key:      z.string().min(1),
});

export const HoverActionSchema = z.object({
  action:   z.literal("hover"),
  orbitId:  z.number().int().nonnegative(),
});

export const ScrollActionSchema = z.object({
  action:     z.literal("scroll"),
  direction:  z.enum(["up", "down", "left", "right"]),
  amount:     z.number().int().positive().default(300), // pixels
});

export const SelectActionSchema = z.object({
  action:   z.literal("select"),
  orbitId:  z.number().int().nonnegative(),
  value:    z.string(),  // the <option> value or label to select
});

export const UploadFileActionSchema = z.object({
  action:   z.literal("uploadFile"),
  orbitId:  z.number().int().nonnegative(),
  filePath: z.string().min(1),  // absolute local path to the file
});

export const DownloadFileActionSchema = z.object({
  action:   z.literal("downloadFile"),
  orbitId:  z.number().int().nonnegative(),  // element to click to trigger download
});

export const GoBackActionSchema   = z.object({ action: z.literal("goBack")   });
export const GoForwardActionSchema = z.object({ action: z.literal("goForward") });
export const RefreshActionSchema  = z.object({ action: z.literal("refresh")  });

export const SwitchTabActionSchema = z.object({
  action: z.literal("switchTab"),
  tabId:  z.number().int().nonnegative(),
});

export const WaitForElementActionSchema = z.object({
  action:   z.literal("waitForElement"),
  selector: z.string().min(1),   // CSS selector or text= for hard-coded waits
  timeout:  z.number().int().positive().default(10_000),
});

export const WaitForTextActionSchema = z.object({
  action:  z.literal("waitForText"),
  text:    z.string().min(1),
  timeout: z.number().int().positive().default(10_000),
});

export const ReadPageActionSchema = z.object({
  action: z.literal("readPage"),
});

export const FinishActionSchema = z.object({
  action: z.literal("finish"),
  reason: z.string().optional(),
});

/** Union of every valid action the LLM may return */
export const AgentActionSchema = z.discriminatedUnion("action", [
  NavigateActionSchema,
  ClickActionSchema,
  TypeActionSchema,
  PressActionSchema,
  HoverActionSchema,
  ScrollActionSchema,
  SelectActionSchema,
  UploadFileActionSchema,
  DownloadFileActionSchema,
  GoBackActionSchema,
  GoForwardActionSchema,
  RefreshActionSchema,
  WaitForElementActionSchema,
  WaitForTextActionSchema,
  ReadPageActionSchema,
  FinishActionSchema,
  SwitchTabActionSchema,
]);

export type NavigateAction        = z.infer<typeof NavigateActionSchema>;
export type ClickAction           = z.infer<typeof ClickActionSchema>;
export type TypeAction            = z.infer<typeof TypeActionSchema>;
export type PressAction           = z.infer<typeof PressActionSchema>;
export type HoverAction           = z.infer<typeof HoverActionSchema>;
export type ScrollAction          = z.infer<typeof ScrollActionSchema>;
export type SelectAction          = z.infer<typeof SelectActionSchema>;
export type UploadFileAction      = z.infer<typeof UploadFileActionSchema>;
export type DownloadFileAction    = z.infer<typeof DownloadFileActionSchema>;
export type GoBackAction          = z.infer<typeof GoBackActionSchema>;
export type GoForwardAction       = z.infer<typeof GoForwardActionSchema>;
export type RefreshAction         = z.infer<typeof RefreshActionSchema>;
export type WaitForElementAction  = z.infer<typeof WaitForElementActionSchema>;
export type WaitForTextAction     = z.infer<typeof WaitForTextActionSchema>;
export type ReadPageAction        = z.infer<typeof ReadPageActionSchema>;
export type FinishAction          = z.infer<typeof FinishActionSchema>;
export type SwitchTabAction       = z.infer<typeof SwitchTabActionSchema>;
export type AgentAction           = z.infer<typeof AgentActionSchema>;

// ── Message history ───────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ── Step result (returned by Executor) ───────────

export interface StepResult {
  action:          AgentAction;
  screenshotPath?: string;
  snapshot?:       PageSnapshot;
  error?:          string;
}
