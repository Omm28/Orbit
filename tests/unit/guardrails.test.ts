import assert from "assert";
import { Guardrails } from "../../src/agent/Guardrails";
import { AgentAction, PageSnapshot } from "../../src/types";

export function testGuardrails() {
  console.log("Running unit tests for: Guardrails.ts");

  const mockSnapshot: PageSnapshot = {
    url: "https://www.google.com",
    title: "Google",
    elements: [
      {
        orbitId: 0,
        tag: "button",
        text: "Search",
        ariaLabel: "Search Google",
        visible: true,
        enabled: true,
      },
      {
        orbitId: 1,
        tag: "a",
        text: "Delete Account Now",
        ariaLabel: "Settings link",
        href: "https://www.google.com/delete-account",
        visible: true,
        enabled: true,
      },
      {
        orbitId: 2,
        tag: "button",
        text: "Checkout and purchase",
        visible: true,
        enabled: true,
      }
    ],
  };

  // 1. Test Whitelisted domain navigation
  const safeNavigation: AgentAction = { action: "navigate", url: "https://en.wikipedia.org" };
  const res1 = Guardrails.check(safeNavigation, mockSnapshot);
  assert.strictEqual(res1.allowed, true, "Should allow navigation to whitelisted domain");

  // 2. Test Blocked domain navigation
  const unsafeNavigation: AgentAction = { action: "navigate", url: "https://malicious-website.org" };
  const res2 = Guardrails.check(unsafeNavigation, mockSnapshot);
  assert.strictEqual(res2.allowed, false, "Should block navigation to non-whitelisted domain");
  assert.match(res2.reason || "", /blocked by safety policy/, "Blocked reason should match");

  // 3. Test Safe element actions
  const safeClick: AgentAction = { action: "click", orbitId: 0 };
  const res3 = Guardrails.check(safeClick, mockSnapshot);
  assert.strictEqual(res3.allowed, true, "Should allow click on safe elements");

  // 4. Test Element action blocked by risky keyword (delete account)
  const unsafeClick1: AgentAction = { action: "click", orbitId: 1 };
  const res4 = Guardrails.check(unsafeClick1, mockSnapshot);
  assert.strictEqual(res4.allowed, false, "Should block click on elements containing delete account");
  assert.match(res4.reason || "", /matched keyword: "delete account"/, "Reason should mention delete account");

  // 5. Test Element action blocked by risky keyword (purchase)
  const unsafeClick2: AgentAction = { action: "click", orbitId: 2 };
  const res5 = Guardrails.check(unsafeClick2, mockSnapshot);
  assert.strictEqual(res5.allowed, false, "Should block click on elements containing purchase");
  assert.match(res5.reason || "", /matched keyword: "purchase"/, "Reason should mention purchase");

  console.log("Guardrails.ts unit tests passed successfully.");
}
