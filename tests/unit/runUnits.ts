// ──────────────────────────────────────────────────
//  Orbit – Unit Test Suite Runner
// ──────────────────────────────────────────────────

import { testGuardrails } from "./guardrails.test";
import { testTypes } from "./types.test";
import { testCheckpointManager } from "./checkpoint.test";

async function runAllUnits() {
  console.log("==================================================");
  console.log("RUNNING ORBIT UNIT TEST SUITE");
  console.log("==================================================");

  let passed = true;

  try {
    testGuardrails();
  } catch (err: any) {
    console.error("FAIL: Guardrails test failed:", err.message || err);
    passed = false;
  }

  try {
    testTypes();
  } catch (err: any) {
    console.error("FAIL: Types Zod schema test failed:", err.message || err);
    passed = false;
  }

  try {
    await testCheckpointManager();
  } catch (err: any) {
    console.error("FAIL: CheckpointManager test failed:", err.message || err);
    passed = false;
  }

  console.log("==================================================");
  if (passed) {
    console.log("SUCCESS: All unit tests passed cleanly.");
    process.exit(0);
  } else {
    console.error("FAILURE: Some unit tests failed.");
    process.exit(1);
  }
}

runAllUnits();
