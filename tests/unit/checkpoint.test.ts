import assert from "assert";
import { CheckpointManager } from "../../src/agent/CheckpointManager";

// ── Pure mocks — no Playwright process is spawned ─────────────────────────────
//
// CheckpointManager's public API only depends on:
//   context.storageState()      → returns an object
//   browser.resetContext(state) → returns a new context mock
//   pageManager.updateContext() → void
//   pageManager.getPage()       → returns { goto(), url() }
//   pageManager.waitForStability() → void
//
// All of these are injected as arguments, so we can stub them completely.

function makeMockContext(storagePayload: object = {}) {
  return {
    storageState: async () => storagePayload,
  };
}

function makeMockBrowser(returnContext: any) {
  return {
    resetContext: async (_state: any) => returnContext,
  };
}

function makeMockPageManager(currentUrl: string) {
  let navigatedUrl = currentUrl;
  return {
    updatedContextArg: null as any,
    updateContext(ctx: any) {
      this.updatedContextArg = ctx;
    },
    async getPage() {
      return {
        goto: async (url: string) => { navigatedUrl = url; },
        url: () => navigatedUrl,
      };
    },
    async waitForStability() {},
    getNavigatedUrl: () => navigatedUrl,
  };
}

// ──────────────────────────────────────────────────────────────────────────────

export async function testCheckpointManager() {
  console.log("Running unit tests for: CheckpointManager.ts");

  // ── SAVE LOGIC ────────────────────────────────────────────────────────────

  // 1. saveCheckpoint stores a checkpoint retrievable via getLastCheckpoint
  {
    const mgr = new CheckpointManager();
    const ctx = makeMockContext({ cookies: [{ name: "session", value: "abc123" }] });
    await mgr.saveCheckpoint(ctx as any, "Fill in email", "https://app.com/signup");
    const cp = mgr.getLastCheckpoint();
    assert.ok(cp, "Checkpoint should exist after save");
    assert.strictEqual(cp?.subtaskTitle, "Fill in email");
    assert.strictEqual(cp?.url, "https://app.com/signup");
    assert.deepStrictEqual(cp?.storageState, { cookies: [{ name: "session", value: "abc123" }] });
  }

  // 2. getLastCheckpoint returns undefined when no checkpoints have been saved
  {
    const mgr = new CheckpointManager();
    const result = mgr.getLastCheckpoint();
    assert.strictEqual(result, undefined, "Should return undefined when no checkpoints exist");
  }

  // 3. Saving a second checkpoint returns the most recent one via getLastCheckpoint
  {
    const mgr = new CheckpointManager();
    const ctx1 = makeMockContext({ cookies: [] });
    const ctx2 = makeMockContext({ cookies: [{ name: "auth", value: "token-xyz" }] });
    await mgr.saveCheckpoint(ctx1 as any, "Step 1 done", "https://app.com/step1");
    await mgr.saveCheckpoint(ctx2 as any, "Step 2 done", "https://app.com/step2");
    const cp = mgr.getLastCheckpoint();
    assert.strictEqual(cp?.subtaskTitle, "Step 2 done", "getLastCheckpoint should return the most recent checkpoint");
    assert.strictEqual(cp?.url, "https://app.com/step2");
  }

  // 4. Saving a checkpoint for the same subtask title deduplicates (replaces, not appends)
  {
    const mgr = new CheckpointManager();
    const ctx1 = makeMockContext({ cookies: [{ name: "v", value: "first" }] });
    const ctx2 = makeMockContext({ cookies: [{ name: "v", value: "second" }] });
    await mgr.saveCheckpoint(ctx1 as any, "Fill in email", "https://app.com/step1");
    await mgr.saveCheckpoint(ctx2 as any, "Fill in email", "https://app.com/step1-retry");
    const cp = mgr.getLastCheckpoint();
    // Should only have one checkpoint for this subtask, with the latest storage state
    assert.deepStrictEqual(
      (cp?.storageState as any).cookies[0].value,
      "second",
      "Re-saving same subtask should replace, not duplicate"
    );
  }

  // ── RESTORE LOGIC ─────────────────────────────────────────────────────────

  // 5. restoreCheckpoint calls browser.resetContext with the saved storage state
  {
    const mgr = new CheckpointManager();
    const savedState = { cookies: [{ name: "session", value: "restore-me" }] };
    const ctx = makeMockContext(savedState);
    await mgr.saveCheckpoint(ctx as any, "Login done", "https://app.com/dashboard");
    const cp = mgr.getLastCheckpoint()!;

    const newCtxMock = makeMockContext({});
    const browserMock = makeMockBrowser(newCtxMock);
    const pageMgr = makeMockPageManager("https://app.com/");

    await mgr.restoreCheckpoint(browserMock as any, pageMgr as any, cp);

    // PageManager should have received the new context
    assert.strictEqual(pageMgr.updatedContextArg, newCtxMock, "PageManager should be bound to the new context after restore");

    // PageManager should have navigated to the checkpoint URL
    assert.strictEqual(pageMgr.getNavigatedUrl(), "https://app.com/dashboard", "Restore should navigate to the checkpoint URL");
  }

  // 6. restoreCheckpoint passes the correct storageState to browser.resetContext
  {
    const mgr = new CheckpointManager();
    let receivedState: any = null;
    const savedState = { cookies: [{ name: "tok", value: "secret" }] };
    const ctx = makeMockContext(savedState);
    await mgr.saveCheckpoint(ctx as any, "Auth step", "https://app.com/home");
    const cp = mgr.getLastCheckpoint()!;

    const browserMock = {
      resetContext: async (state: any) => {
        receivedState = state;
        return makeMockContext({});
      },
    };
    const pageMgr = makeMockPageManager("https://app.com/");
    await mgr.restoreCheckpoint(browserMock as any, pageMgr as any, cp);

    assert.deepStrictEqual(receivedState, savedState, "browser.resetContext should receive the exact saved storage state");
  }

  console.log("CheckpointManager.ts unit tests passed successfully.");
}
