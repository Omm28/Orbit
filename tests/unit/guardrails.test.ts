import assert from "assert";
import { Guardrails } from "../../src/agent/Guardrails";
import { AgentAction, PageSnapshot } from "../../src/types";

// ── Shared test fixtures ──────────────────────────────────────────────────────

const baseElements: PageSnapshot["elements"] = [
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
  },
  // Obfuscated: icon-only button with no text, no aria-label — pre-action check will pass it
  {
    orbitId: 3,
    tag: "button",
    text: "",
    visible: true,
    enabled: true,
  },
];

const safeSnapshot: PageSnapshot = {
  url: "https://www.google.com",
  title: "Google",
  elements: baseElements,
};

export function testGuardrails() {
  console.log("Running unit tests for: Guardrails.ts (pre-action + post-action)");

  // ── PRE-ACTION CHECKS ─────────────────────────────────────────────────────

  // 1. Whitelisted domain allowed
  const safeNav: AgentAction = { action: "navigate", url: "https://en.wikipedia.org" };
  const r1 = Guardrails.check(safeNav, safeSnapshot);
  assert.strictEqual(r1.allowed, true, "Should allow navigation to whitelisted domain");

  // 2. Non-whitelisted domain blocked
  const unsafeNav: AgentAction = { action: "navigate", url: "https://malicious-website.org" };
  const r2 = Guardrails.check(unsafeNav, safeSnapshot);
  assert.strictEqual(r2.allowed, false, "Should block navigation to non-whitelisted domain");
  assert.match(r2.reason ?? "", /blocked by safety policy/);

  // 3. file:// protocol always allowed (local eval pages)
  const fileNav: AgentAction = { action: "navigate", url: "file:///C:/Users/ombko/Projects/Orbit/tests/evals/mock_pages/signup.html" };
  const r3 = Guardrails.check(fileNav, safeSnapshot);
  assert.strictEqual(r3.allowed, true, "Should allow file:// protocol for local eval pages");

  // 4. Safe element click passes
  const safeClick: AgentAction = { action: "click", orbitId: 0 };
  const r4 = Guardrails.check(safeClick, safeSnapshot);
  assert.strictEqual(r4.allowed, true, "Should allow click on safe element");

  // 5. Element with 'delete account' in text is blocked
  const deletAccountClick: AgentAction = { action: "click", orbitId: 1 };
  const r5 = Guardrails.check(deletAccountClick, safeSnapshot);
  assert.strictEqual(r5.allowed, false, "Should block click on element with 'delete account' text");
  assert.match(r5.reason ?? "", /matched keyword: "delete account"/);

  // 6. Element with 'purchase' in text is blocked
  const purchaseClick: AgentAction = { action: "click", orbitId: 2 };
  const r6 = Guardrails.check(purchaseClick, safeSnapshot);
  assert.strictEqual(r6.allowed, false, "Should block click on element with 'purchase' text");
  assert.match(r6.reason ?? "", /matched keyword: "purchase"/);

  // 7. Obfuscated icon-only button passes pre-action check (no visible keyword)
  const iconClick: AgentAction = { action: "click", orbitId: 3 };
  const r7 = Guardrails.check(iconClick, safeSnapshot);
  assert.strictEqual(r7.allowed, true, "Icon-only button with no text should pass pre-action check — post-action catches this");

  // ── POST-ACTION CHECKS ────────────────────────────────────────────────────

  // 8. Safe resulting URL passes post-action check
  const safeResultSnapshot: PageSnapshot = {
    url: "https://www.google.com/search?q=typescript",
    title: "Search Results",
    elements: [],
    textContent: "TypeScript is a programming language",
  };
  const r8 = Guardrails.checkPostAction({ action: "click", orbitId: 0 }, safeResultSnapshot);
  assert.strictEqual(r8.allowed, true, "Safe URL and text should pass post-action check");

  // 9. Resulting URL matching /checkout pattern is blocked
  const checkoutResultSnapshot: PageSnapshot = {
    url: "https://shop.example.com/checkout/step2",
    title: "Checkout",
    elements: [],
    textContent: "Enter your shipping details",
  };
  const r9 = Guardrails.checkPostAction({ action: "click", orbitId: 3 }, checkoutResultSnapshot);
  assert.strictEqual(r9.allowed, false, "URL matching /checkout should be blocked post-action");
  assert.match(r9.reason ?? "", /risky path pattern/);

  // 10. Resulting URL matching /delete-account pattern is blocked
  const deleteResultSnapshot: PageSnapshot = {
    url: "https://app.example.com/account/delete",
    title: "Delete Account",
    elements: [],
    textContent: "Your account will be permanently deleted",
  };
  const r10 = Guardrails.checkPostAction({ action: "click", orbitId: 3 }, deleteResultSnapshot);
  assert.strictEqual(r10.allowed, false, "URL matching /account/delete should be blocked post-action");

  // 11. Confirmation phrase in page text is blocked (even on safe-looking URL)
  const confirmationResultSnapshot: PageSnapshot = {
    url: "https://www.google.com/done",
    title: "Done",
    elements: [],
    textContent: "Your order has been confirmed. Order confirmed — thank you.",
  };
  const r11 = Guardrails.checkPostAction({ action: "click", orbitId: 3 }, confirmationResultSnapshot);
  assert.strictEqual(r11.allowed, false, "Page text containing 'order confirmed' should be blocked post-action");
  assert.match(r11.reason ?? "", /risky confirmation phrase/);

  // 12. Post-action check is skipped for non-interaction actions (scroll, navigate, readPage)
  const scrollResult: PageSnapshot = {
    url: "https://shop.example.com/checkout",
    title: "Checkout",
    elements: [],
    textContent: "order confirmed",
  };
  const r12 = Guardrails.checkPostAction({ action: "scroll", direction: "down", amount: 300 }, scrollResult);
  assert.strictEqual(r12.allowed, true, "Post-action check should be skipped for scroll actions");

  console.log("Guardrails.ts unit tests passed successfully.");
}
