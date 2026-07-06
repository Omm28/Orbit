# Development Log

This is an honest engineering log of the hardest bugs encountered while building Orbit — kept as a record of what actually broke, why, and what it taught me, rather than a polished changelog. False starts are left in on purpose.

---

## 1. Video Recording Race Condition (`EBUSY: resource busy or locked`)

**Symptom:** On run finalization, renaming the recorded `.webm` file threw `EBUSY: resource busy or locked, rename '.../page@abc.webm' -> '.../orbit_task.webm'`.

**Root cause:** `finalizeRun()` (which renames the recording) was being called before `browser.close()`. The browser context still held an active write lock on the video file. Even after `close()`, Playwright needs a brief async window to flush the video stream and release the OS file handle — the rename was racing that flush.

**Fix:** Restructured `Agent.ts` so `browser.close()` runs inside a `finally` block before `finalizeRun()` is ever called, and added a retry loop inside `finalizeRun` — up to 10 attempts with a 200ms backoff — to absorb the remaining race window instead of assuming the file is instantly available.

**Lesson:** Async browser automation frameworks do filesystem writes out-of-band from the calls that appear to trigger them. Never assume a resource is ready for manipulation the instant a "close" call returns — poll or retry.

---

## 2. Viewport-Blind Text Extraction (Endless Scroll on Wikipedia GDP Table)

**Symptom:** Tasked with extracting a GDP table from a Wikipedia article, the agent scrolled repeatedly and re-read the page in a loop until it hit the 20-step execution limit — never finding the data.

**Root cause:** The text extractor cloned `document.documentElement` and returned the first ~3000 characters from the top of the page. Wikipedia's long intro + table of contents pushed the actual data table past that cutoff. Since extraction always started from the top of the DOM regardless of scroll position, scrolling changed nothing the agent could see — it was reading the same static snapshot every time.

**Fix:** Rewrote extraction in `PageManager.ts` to be viewport-aware: uses `document.createTreeWalker` to walk text nodes and `getBoundingClientRect()` to filter to only text currently inside the visible viewport bounds, so scrolling actually changes what the LLM reads.

**Lesson:** Context compression for an LLM-driven agent has to reflect the agent's actual current view of the world, not a static dump of the document. A truncated top-of-page snapshot silently breaks any "scroll to find X" workflow, and the failure mode (infinite scrolling) looks like a planning bug rather than a perception bug — which made it harder to diagnose than it should have been.

---

## 3. Safety Violations Triggering Infinite Retry Loops in CI

**Symptom:** In non-interactive/CI runs, a blocked action (e.g. attempting to click "Delete Account") caused the agent to either hang waiting for keyboard input or loop through retries indefinitely instead of stopping.

**Root cause:** The failure-recovery path didn't distinguish *why* an action failed. A safety-guardrail block was being treated identically to a transient execution error (missing element, network blip) — both incremented `consecutiveFailures` and triggered the same auto-recovery path (refresh / checkpoint rollback), which in a `NON_INTERACTIVE` environment had no human available to break the loop.

**Fix:** Added an explicit check in `Agent.ts`: if a safety violation fires and `NON_INTERACTIVE=true`, bypass the human-in-the-loop prompt entirely and throw a terminal error to abort immediately, rather than attempting auto-recovery.

**Lesson:** Recovery strategy has to know the *category* of failure. Transient execution errors are worth retrying; policy/safety violations are not — they should fail fast and loud, not get silently retried until something breaks worse. Treating all failures as the same "type" of problem was the actual bug, not the retry logic itself.

---

## 4. Zod Rejecting Relative File Paths for Local Test Pages

**Symptom:** Running against local eval pages crashed at step 1: `Zod validation failed on action: {"action":"navigate","url":"tests/evals/mock_pages/popup.html"} - Invalid URL`.

**Root cause:** The `navigate` action schema uses `z.string().url()`, which requires a full protocol (`http://`, `file://`, etc.). The LLM was extracting the relative path as it appeared in the task description and passing it straight through, which is a valid file path but not a valid URL by Zod's definition.

**Fix:** Normalized relative local paths into fully-qualified `file:///` URLs in the test runners before they reach the LLM/schema layer, rather than relaxing the schema itself.

**Lesson:** Strict runtime validation (Zod) is only as good as the inputs feeding it — if an LLM is the one generating structured input, the prompt has to be explicit about format requirements the schema will enforce, or normalize/sanitize before validation rather than after.

---

## 5. Self-Healing Clicks Working, But Not Being Counted

**Symptom:** Console logs showed successful overlay dismissals (e.g. "Accept Cookies" clicked to unblock a subsequent action), but the end-of-run metrics card always reported `0 overlay dismissal(s)`.

**Root cause:** The self-healing logic in `Click.ts` ran and succeeded independently, but had no reference back to `PageManager`'s `selfHealingCount` — it was a correct fix with no telemetry attached to it.

**Fix:** Passed a `pageManager` reference into `Click.ts` and incremented `pageManager.selfHealingCount` at the point of a successful overlay dismissal.

**Lesson:** A tool doing the right thing silently is still a bug if nothing downstream can see it happened. Execution and observability are separate concerns — a fix isn't done until the system can report on itself accurately.

---

## What I'd Still Improve

- Guardrails only inspect elements *before* an action — an obfuscated risky action (icon-only button, no keyword in text/aria-label) would currently slip through. Post-action state verification is the next planned safety improvement.
- These bugs were found through manual + eval-driven testing, not unit tests in isolation. Guardrails, Zod validation, and checkpoint restore logic don't yet have dedicated unit tests.
