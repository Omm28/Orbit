import assert from "assert";
import { AgentActionSchema } from "../../src/types";

export function testTypes() {
  console.log("Running unit tests for: types/index.ts (Zod Action Schemas)");

  // ── VALID CASES ───────────────────────────────────────────────────────────

  // 1. Valid navigate
  const r1 = AgentActionSchema.safeParse({ action: "navigate", url: "https://wikipedia.org" });
  assert.strictEqual(r1.success, true, "Valid navigate should parse");

  // 2. Valid click
  const r2 = AgentActionSchema.safeParse({ action: "click", orbitId: 42 });
  assert.strictEqual(r2.success, true, "Valid click should parse");

  // 3. Valid type
  const r3 = AgentActionSchema.safeParse({ action: "type", orbitId: 10, text: "Hello World" });
  assert.strictEqual(r3.success, true, "Valid type should parse");

  // 4. Valid switchTab
  const r4 = AgentActionSchema.safeParse({ action: "switchTab", tabId: 2 });
  assert.strictEqual(r4.success, true, "Valid switchTab should parse");

  // 5. Valid scroll
  const r5 = AgentActionSchema.safeParse({ action: "scroll", direction: "down", amount: 500 });
  assert.strictEqual(r5.success, true, "Valid scroll should parse");

  // 6. Valid finish with optional reason
  const r6 = AgentActionSchema.safeParse({ action: "finish", reason: "Task complete" });
  assert.strictEqual(r6.success, true, "Valid finish with reason should parse");

  // 7. Valid finish with no reason (reason is optional)
  const r7 = AgentActionSchema.safeParse({ action: "finish" });
  assert.strictEqual(r7.success, true, "Valid finish without reason should parse");

  // 8. Valid readPage (no extra fields required)
  const r8 = AgentActionSchema.safeParse({ action: "readPage" });
  assert.strictEqual(r8.success, true, "Valid readPage should parse");

  // ── INVALID / HALLUCINATED LLM OUTPUT CASES ───────────────────────────────

  // 9. Navigate with relative path (no protocol) — Zod URL validator rejects it
  const r9 = AgentActionSchema.safeParse({ action: "navigate", url: "tests/evals/mock_pages/popup.html" });
  assert.strictEqual(r9.success, false, "Relative path without file:// should fail validation");

  // 10. Navigate with empty URL string
  const r10 = AgentActionSchema.safeParse({ action: "navigate", url: "" });
  assert.strictEqual(r10.success, false, "Empty URL should fail validation");

  // 11. Click with negative orbitId
  const r11 = AgentActionSchema.safeParse({ action: "click", orbitId: -5 });
  assert.strictEqual(r11.success, false, "Negative orbitId should fail validation");

  // 12. Click with float orbitId (LLM hallucination: "orbitId": 3.7)
  const r12 = AgentActionSchema.safeParse({ action: "click", orbitId: 3.7 });
  assert.strictEqual(r12.success, false, "Float orbitId should fail validation (must be integer)");

  // 13. Click with string orbitId (LLM hallucination: "orbitId": "12")
  const r13 = AgentActionSchema.safeParse({ action: "click", orbitId: "12" });
  assert.strictEqual(r13.success, false, "String orbitId should fail validation");

  // 14. Type with missing text field
  const r14 = AgentActionSchema.safeParse({ action: "type", orbitId: 5 });
  assert.strictEqual(r14.success, false, "Type action without text field should fail validation");

  // 15. Scroll with invalid direction
  const r15 = AgentActionSchema.safeParse({ action: "scroll", direction: "diagonal", amount: 300 });
  assert.strictEqual(r15.success, false, "Scroll with invalid direction should fail validation");

  // 16. Unknown action name (LLM hallucination: made-up action)
  const r16 = AgentActionSchema.safeParse({ action: "warpDrive", speed: 9.9 });
  assert.strictEqual(r16.success, false, "Hallucinated action name should fail validation");

  // 17. switchTab with missing tabId
  const r17 = AgentActionSchema.safeParse({ action: "switchTab" });
  assert.strictEqual(r17.success, false, "switchTab without tabId should fail validation");

  // 18. switchTab with negative tabId
  const r18 = AgentActionSchema.safeParse({ action: "switchTab", tabId: -1 });
  assert.strictEqual(r18.success, false, "switchTab with negative tabId should fail validation");

  // 19. Action object with no action field at all
  const r19 = AgentActionSchema.safeParse({ orbitId: 10 });
  assert.strictEqual(r19.success, false, "Object without action field should fail validation");

  // 20. Completely empty object
  const r20 = AgentActionSchema.safeParse({});
  assert.strictEqual(r20.success, false, "Empty object should fail validation");

  console.log("types/index.ts unit tests passed successfully.");
}
