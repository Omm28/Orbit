// ──────────────────────────────────────────────────
//  Orbit – Planner  (Phase 4 + 5 + 6)
// ──────────────────────────────────────────────────

import { LLMClient } from "../llm/LLMClient";
import {
  AgentAction,
  AgentActionSchema,
  ChatMessage,
  LLMResponse,
  PageSnapshot,
  SessionState,
  Subtask,
} from "../types";
import { logger } from "../utils/logger";
import { renderAsciiPreview } from "../utils/asciiPreview";
import { MetricsTracker } from "../utils/metrics";

const SYSTEM_PROMPT = `You are Orbit, an AI browser agent. Your job is to complete a user-provided browser task step by step.

You control a real browser. Every interactive element on the page is labelled with a unique integer "orbitId".
You MUST reference elements by their orbitId — do NOT invent CSS selectors.

RESPONSE FORMAT — You MUST return a single valid JSON object with exactly two top-level keys:
{
  "subtasks": [ { "title": "...", "status": "todo" | "in_progress" | "done" } ],
  "actions": [ { ... action object ... } ]
}
(You can return either a single action or an array of actions under "actions" to execute multiple inputs/clicks sequentially on the same page).

No markdown. No code fences. No extra text. Just the JSON object.

SUBTASKS RULES:
- On your first response, break the objective into 3-7 concise high-level subtasks.
- On every subsequent response, update the status of subtasks based on what has been completed.
- Only ONE subtask should be "in_progress" at a time.
- Mark subtasks "done" only when they are provably complete (page loaded, value confirmed, etc.).

AVAILABLE ACTIONS (for the "action" key):

1. Navigate to a URL:
   {"action":"navigate","url":"https://example.com"}

2. Click an element:
   {"action":"click","orbitId":3}

3. Type text into a field (clears existing value first):
   {"action":"type","orbitId":5,"text":"hello world"}

4. Press a keyboard key on an element:
   {"action":"press","orbitId":5,"key":"Enter"}

5. Hover over an element:
   {"action":"hover","orbitId":7}

6. Scroll the page:
   {"action":"scroll","direction":"down","amount":400}

7. Select a dropdown option:
   {"action":"select","orbitId":9,"value":"United States"}

8. Upload a file:
   {"action":"uploadFile","orbitId":11,"filePath":"/path/to/file.pdf"}

9. Click a download trigger:
   {"action":"downloadFile","orbitId":14}

10. Go back in browser history:
    {"action":"goBack"}

11. Go forward in browser history:
    {"action":"goForward"}

12. Refresh the current page:
    {"action":"refresh"}

13. Wait for an element to become visible (CSS selector):
    {"action":"waitForElement","selector":"#results","timeout":5000}

14. Wait for specific text to appear:
    {"action":"waitForText","text":"Success","timeout":5000}

15. Re-read the page (refreshes the element list without performing an action):
    {"action":"readPage"}

16. Switch to a different open browser tab:
    {"action":"switchTab","tabId":1}

17. Finish when the task is fully complete (all subtasks done):
    {"action":"finish","reason":"Task completed successfully."}

RULES:
- ALWAYS use orbitId from the INTERACTIVE ELEMENTS list. Never guess or hallucinate orbitIds.
- If the element you want is not listed, use readPage or scroll to reveal it first.
- If an action just failed, the error will be shown — pick a DIFFERENT strategy.
- Prefer the simplest reliable action. Avoid unnecessary steps.
- If multiple browser tabs are open, check OPEN TABS to decide if you need to switchTab before acting.
`;

export interface HistoryEntry {
  action: AgentAction;
  status: "success" | "failed";
  error?: string;
}

function buildUserMessage(
  task: string,
  snapshot: PageSnapshot,
  history: HistoryEntry[],
  session: SessionState,
  lastSubtasks: Subtask[],
): string {
  const elementsText = snapshot.elements
    .map((el) => {
      const parts: string[] = [`[${el.orbitId}] <${el.tag}>`];
      if (el.text)        parts.push(`text="${el.text}"`);
      if (el.value)       parts.push(`value="${el.value}"`);
      if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
      if (el.ariaLabel)   parts.push(`aria-label="${el.ariaLabel}"`);
      if (el.id)          parts.push(`id="${el.id}"`);
      if (el.name)        parts.push(`name="${el.name}"`);
      if (el.role)        parts.push(`role="${el.role}"`);
      if (el.href)        parts.push(`href="${el.href.substring(0, 80)}"`);
      if (el.type)        parts.push(`type="${el.type}"`);
      if (!el.enabled)    parts.push(`DISABLED`);
      return parts.join("  ");
    })
    .join("\n");

  let msg = `OBJECTIVE: ${task}\n\n`;

  // Session memory
  msg += `SESSION STATE:\n`;
  msg += `  Steps completed: ${session.stepCount}\n`;
  if (session.visitedUrls.length > 0) {
    msg += `  Visited URLs: ${session.visitedUrls.slice(-5).join(", ")}\n`; // last 5
  }
  msg += `\n`;

  // Subtask checklist
  if (lastSubtasks.length > 0) {
    msg += `CURRENT SUBTASKS (carry these forward with updated statuses):\n`;
    lastSubtasks.forEach((st, i) => {
      msg += `  ${i + 1}. [${st.status}] ${st.title}\n`;
    });
    msg += `\n`;
  }

  // Action history
  if (history.length > 0) {
    msg += `HISTORY OF ACTIONS TAKEN SO FAR:\n`;
    history.forEach((entry, i) => {
      const statusText = entry.status === "success" ? "SUCCESS" : `FAILED (${entry.error})`;
      msg += `Step ${i + 1}: ${JSON.stringify(entry.action)} -> ${statusText}\n`;
    });
    msg += `\n`;

    const last = history[history.length - 1];
    if (last.status === "failed") {
      msg += `⚠ WARNING: Your last action failed. You MUST choose a DIFFERENT action, orbitId, or strategy now.\n\n`;
    }
  }

  // Open tabs (multi-tab awareness)
  if (snapshot.tabs && snapshot.tabs.length > 1) {
    msg += `OPEN TABS (${snapshot.tabs.length} total):\n`;
    snapshot.tabs.forEach((tab) => {
      const marker = tab.isActive ? " ◀ ACTIVE" : "";
      msg += `  [Tab ${tab.tabId}] ${tab.title || "Untitled"} | ${tab.url}${marker}\n`;
    });
    msg += `\nTo switch to a different tab: {"action":"switchTab","tabId":N}\n\n`;
  }

  msg += `CURRENT PAGE:
  URL:   ${snapshot.url}
  Title: ${snapshot.title}
`;

  if (snapshot.textContent) {
    msg += `\n  VISIBLE PAGE CONTENT (clean/excerpt):\n  """\n  ${snapshot.textContent}\n  """\n`;
  }

  msg += `
INTERACTIVE ELEMENTS (use orbitId to reference them):
${elementsText || "(none found — try readPage, scroll, or navigate)"}

What is the next single action to take? Respond with updated subtasks + next action as a single JSON object.`;

  return msg;
}

export class Planner {
  private llm:              LLMClient;
  private executionHistory: HistoryEntry[] = [];
  public  subtasks:         Subtask[]      = [];
  private metrics?:         MetricsTracker;

  constructor(llm: LLMClient, metrics?: MetricsTracker) {
    this.llm     = llm;
    this.metrics = metrics;
  }

  getActiveSubtask(): string | undefined {
    return this.subtasks.find((s) => s.status === "in_progress")?.title;
  }

  async decide(
    task: string,
    snapshot: PageSnapshot,
    session: SessionState,
    lastResult?: { status: "success" | "failed"; error?: string },
  ): Promise<LLMResponse> {
    // Update status of last action in history
    if (lastResult && this.executionHistory.length > 0) {
      const lastEntry = this.executionHistory[this.executionHistory.length - 1];
      lastEntry.status = lastResult.status;
      lastEntry.error = lastResult.error;
    }

    // Print ASCII layout preview to the console for DX visualization
    const ascii = renderAsciiPreview(snapshot.elements);
    logger.dim(`\n📄 Viewport Layout Preview:\n${ascii}\n`);

    const userMessage = buildUserMessage(task, snapshot, this.executionHistory, session, this.subtasks);

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userMessage },
    ];

    const raw = await this.llm.chat(messages);

    // Record token metrics
    const promptText = messages.map((m) => m.content).join("\n");
    this.metrics?.recordLlmCall(promptText, raw);

    logger.dim(`[Metrics] LLM responded (${raw.length} chars).`);
    // Strip any accidental markdown code fences
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    // Parse outer JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error(`LLM returned non-JSON: ${raw}`);
      throw new Error(`LLM returned invalid JSON: ${raw}`);
    }

    const obj = parsed as Record<string, unknown>;

    // Support either "actions" (array) or "action" (single object)
    let rawActions: any[] = [];
    if (Array.isArray(obj["actions"])) {
      rawActions = obj["actions"];
    } else if (obj["action"] && typeof obj["action"] === "object") {
      rawActions = [obj["action"]];
    } else if (Array.isArray(obj["action"])) {
      rawActions = obj["action"];
    } else {
      throw new Error(`LLM response missing required "actions" or "action" key: ${cleaned}`);
    }

    const actions: AgentAction[] = [];
    for (const rawAct of rawActions) {
      const actionResult = AgentActionSchema.safeParse(rawAct);
      if (!actionResult.success) {
        logger.error(`Zod validation failed on action: ${JSON.stringify(rawAct)} - ${actionResult.error.message}`);
        throw new Error(`Invalid action schema: ${actionResult.error.message}`);
      }
      actions.push(actionResult.data);
    }

    if (actions.length === 0) {
      throw new Error(`At least one action must be returned: ${cleaned}`);
    }

    // Extract and store subtasks
    const rawSubtasks = Array.isArray(obj["subtasks"]) ? obj["subtasks"] : [];
    this.subtasks = rawSubtasks
      .filter((s): s is { title: string; status: string } =>
        typeof s === "object" && s !== null && "title" in s && "status" in s
      )
      .map((s) => ({
        title:  String(s.title),
        status: (["todo", "in_progress", "done"].includes(s.status) ? s.status : "todo") as Subtask["status"],
      }));

    // Log plan to console
    logger.plan(this.subtasks);

    return { subtasks: this.subtasks, actions };
  }

  recordAction(action: AgentAction): void {
    this.executionHistory.push({ action, status: "success" });
  }
}
