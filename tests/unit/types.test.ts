import assert from "assert";
import { AgentActionSchema } from "../../src/types";

export function testTypes() {
  console.log("Running unit tests for: types/index.ts (Zod Action Schemas)");

  // 1. Valid Navigate Action
  const validNav = { action: "navigate", url: "https://wikipedia.org" };
  const navResult = AgentActionSchema.safeParse(validNav);
  assert.strictEqual(navResult.success, true, "Should successfully parse a valid navigate action");

  // 2. Invalid Navigate Action (Not a URL)
  const invalidNav = { action: "navigate", url: "not-a-url" };
  const navResultInvalid = AgentActionSchema.safeParse(invalidNav);
  assert.strictEqual(navResultInvalid.success, false, "Should fail to parse navigate with an invalid URL format");

  // 3. Valid Click Action
  const validClick = { action: "click", orbitId: 42 };
  const clickResult = AgentActionSchema.safeParse(validClick);
  assert.strictEqual(clickResult.success, true, "Should successfully parse a valid click action");

  // 4. Invalid Click Action (Negative OrbitId)
  const invalidClick = { action: "click", orbitId: -5 };
  const clickResultInvalid = AgentActionSchema.safeParse(invalidClick);
  assert.strictEqual(clickResultInvalid.success, false, "Should fail to parse click with a negative orbitId");

  // 5. Valid Type Action
  const validType = { action: "type", orbitId: 10, text: "Hello World" };
  const typeResult = AgentActionSchema.safeParse(validType);
  assert.strictEqual(typeResult.success, true, "Should successfully parse a valid type action");

  // 6. Valid Switch Tab Action
  const validSwitchTab = { action: "switchTab", tabId: 2 };
  const switchTabResult = AgentActionSchema.safeParse(validSwitchTab);
  assert.strictEqual(switchTabResult.success, true, "Should successfully parse a valid switchTab action");

  // 7. Invalid Action (Missing Action type)
  const missingActionType = { orbitId: 10 };
  const missingResult = AgentActionSchema.safeParse(missingActionType);
  assert.strictEqual(missingResult.success, false, "Should fail to parse when action type is missing");

  // 8. Invalid Action (Unknown Action name)
  const unknownAction = { action: "warpDrive", speed: 9.9 };
  const unknownResult = AgentActionSchema.safeParse(unknownAction);
  assert.strictEqual(unknownResult.success, false, "Should fail to parse unknown action name");

  console.log("types/index.ts unit tests passed successfully.");
}
