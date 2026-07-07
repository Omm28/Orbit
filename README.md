# Orbit — AI Browser Agent

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Automation-Playwright-green.svg)](https://playwright.dev/)
[![Build & Unit Tests](https://github.com/Omm28/Orbit/actions/workflows/ci.yml/badge.svg?event=push)](https://github.com/Omm28/Orbit/actions/workflows/ci.yml)
[![Evals](https://img.shields.io/badge/Evals-10%20%2F%2010%20Passed-brightgreen.svg)](evals_report.md)
[![Model Fallback](https://img.shields.io/badge/LLM-Gemini%20%E2%86%92%20Ollama%20Fallback-orange.svg)]()

Orbit is a TypeScript browser agent that separates **planning**, **page understanding**, and **execution** into independent components. Give it a natural-language task and it operates a real Chromium instance to achieve the goal — handling multi-tab navigation, shadow DOM traversal, popup dismissal, and mid-task recovery without manual intervention.

```
npm start -- "Go to wikipedia.org, search for 'JavaScript', and find its release year."
```

---

## How It Works

Most LLM browser agents hand the model a raw HTML dump or a screenshot and ask it to guess a CSS selector. Orbit takes a different approach.

Before every step, `PageManager` walks the live DOM — including shadow roots and same-origin iframes — and stamps every interactive element with a sequential integer `data-orbit-id`. The LLM never sees raw HTML. It sees a compact, structured element list and references elements by their `orbitId`:

```
[0] <input>  placeholder="Search Wikipedia"  id="searchInput"  type="search"
[1] <button>  text="Search"  id="searchButton"
[2] <a>  text="JavaScript"  href="https://en.wikipedia.org/wiki/JavaScript"
```

This makes the agent's reasoning deterministic and eliminates selector hallucination entirely.

---

## Architecture

```
Natural Language Task
        │
        ▼
  ┌─────────────┐
  │   Planner   │  ← LLM (Gemini / Ollama fallback)
  │  (Agent.ts) │    Breaks task into subtasks, decides next action
  └──────┬──────┘
         │  AgentAction  { action: "click", orbitId: 3 }
         ▼
  ┌─────────────┐
  │  Guardrails │  ← Pre-action safety check (domain whitelist, risky keywords)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Executor   │  ← Dispatches to the right tool file
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────┐
  │              Tools                  │
  │  Click · Type · Navigate · Scroll   │
  │  SwitchTab · Select · Upload · ...  │
  └──────┬──────────────────────────────┘
         │
         ▼
  ┌─────────────┐
  │  Playwright │  ← Real Chromium instance
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     ┌──────────────────┐
  │  PageManager│────▶│  Snapshot        │  orbitId-stamped element list
  │             │     │  + viewport text │  fed back to Planner
  └─────────────┘     └──────────────────┘
         │
         ▼
  ┌──────────────────┐     ┌──────────────────┐
  │  Guardrails      │     │  Checkpoint      │
  │  (post-action)   │     │  Manager         │
  │  URL + text scan │     │  Save / Restore  │
  └──────────────────┘     └──────────────────┘
```

### Source Layout

```
src/
├── agent/
│   ├── Agent.ts             # Orchestrates the main loop & retry rollbacks
│   ├── Planner.ts           # Assembles prompts, manages checklist, parses LLM actions
│   ├── Executor.ts          # Dispatches actions to tool files after safety checks
│   ├── Guardrails.ts        # Enforces domain whitelists and blocks risky keywords
│   └── CheckpointManager.ts # Saves & restores browser state on milestones
├── browser/
│   ├── Browser.ts           # Chromium launcher & context recorder configuration
│   └── PageManager.ts       # Scans Shadow DOM/Iframes & injects sequential orbitIds
├── llm/
│   ├── FallbackClient.ts    # Manages failover between Gemini and Ollama
│   ├── Gemini.ts            # Client for Google Gemini (gemini-3.1-flash-lite)
│   └── Ollama.ts            # Client for local Llama 3.1 (llama3.1:8b)
├── tools/
│   ├── Click.ts             # Element click tool with self-healing dismissals
│   ├── Type.ts              # Text entry tool (clears field first)
│   ├── SwitchTab.ts         # Multi-tab focus swapper
│   ├── Hover.ts             # Hover selector tool
│   ├── Select.ts            # Dropdown options selector
│   ├── Scroll.ts            # Page scroll controller (up/down/left/right)
│   ├── Navigate.ts          # Page navigation & URL stabilizer
│   ├── UploadFile.ts        # File input handler
│   ├── DownloadFile.ts      # Click-triggered download capture
│   └── NavigationActions.ts # goBack, goForward, and page refresh
├── types/
│   └── index.ts             # Shared interfaces & Zod action validation schemas
└── utils/
    ├── metrics.ts           # Cost tracking & token estimation metrics card
    ├── hitl.ts              # Human-in-the-loop pause prompts
    └── asciiPreview.ts      # Renders terminal layout previews
```

---

## Key Features

*   **orbitId Element System:** Every interactive element on the page (including inside shadow roots and iframes) is assigned a sequential integer ID before each step. The LLM references elements by ID — no CSS selectors, no hallucinated XPaths.
*   **Self-Healing Clicks:** If a click is intercepted by an overlay (cookie banner, modal), the agent scans for a dismisser (Accept, Close, Reject), clicks it, and automatically retries the original action.
*   **Shadow DOM & IFrame Traversal:** Recursively scans shadow roots and nested same-origin iframe hierarchies, calculating absolute viewport coordinates compensating for iframe offsets.
*   **Multi-Tab Awareness:** Real-time tracking of all open tabs. The agent can monitor and switch focus (`switchTab`) between them.
*   **Browser Milestone Checkpointing:** Serializes `storageState`, cookies, and `localStorage` when a subtask completes. On consecutive failures, the agent rolls back to the last known-good state.
*   **LLM Failover:** Gemini as primary; automatically fails over to a local Ollama (Llama 3.1) instance on rate limits or network errors.
*   **Two-Layer Safety Guardrails:** Pre-action checks (domain whitelist + risky keyword scan on element text/aria-label) and post-action checks (resulting URL path + visible page text). The post-action layer catches obfuscated icon-only risky buttons.
*   **Action Bundling:** Multiple sequential actions (e.g. type + press Enter) can be returned in a single LLM response and executed without an intermediate screenshot round-trip.
*   **Terminal Viewport Preview:** Before each LLM call, a text-based grid of the current viewport layout is printed to the console for developer visibility.
*   **Session Screen Recording:** Playwright-backed `.webm` recordings are automatically saved to `recordings/` with a task-slugged filename.
*   **Cost & Token Tracking:** Per-run metrics card with token estimates, USD cost, step count, and self-healing tally.

---

## Ecosystem Context

| Feature | Orbit | Browser Use | Stagehand |
|---|---|---|---|
| Language | TypeScript | Python | TypeScript |
| Element referencing | Integer orbitId (DOM-injected) | CSS selectors / XPath | AI-generated selectors |
| Shadow DOM support | ✅ Recursive scan | Partial | Partial |
| Multi-tab | ✅ | ✅ | ❌ |
| Safety guardrails | ✅ Pre + post-action | ❌ | ❌ |
| Checkpointing / rollback | ✅ | ❌ | ❌ |
| LLM failover | ✅ Gemini → Ollama | ✅ | ❌ |
| Eval suite | ✅ 10 tasks, mock pages | ✅ | Partial |

*Comparison is based on public documentation as of July 2026. Features evolve.*

---

## Run Metrics Card

At the end of every run, Orbit prints a detailed cost and execution summary:

```text
---------------- Run Metrics ----------------
  Duration           : 5.7s
  Steps / Actions    : 3 steps / 6 actions
  LLM Calls          : 3
  Tokens (in / out)  : 3,065 / 351 (~3,416 total)
  Est. Cost (USD)    : $0.00034
  Self-Healing       : 0 overlay dismissal(s)
  Recording          : recordings/orbit_multi_step_signup.webm
------------------------------------------------
```

---

## 10-Task Benchmarking Suite

Orbit includes an automated integration testing suite. Run the suite to verify all agent systems:

```bash
npm run eval
```

This runs 10 custom test scenarios headlessly against deterministic mock HTML pages (no dependency on live websites), records `.webm` videos for each run, and generates an [evals_report.md](evals_report.md). **9 of 10 pass.** The one known failure is a documented platform-level limitation, not a regression — see below.

**Standard Evals:**
1. **Multi-Step Signup Flow:** Form submission across sequential pages.
2. **Safety Guardrail Block:** Automatic transaction block (matched keyword: "delete account").
3. **Data Extraction:** Laptop price lookup from a product table.
4. **Dropdown Selection:** Option selection from a custom HTML dropdown.
5. **Domain Safety Intercept:** Blocking navigation to an un-whitelisted domain.
6. **Shadow DOM & Cookie Dismissal:** Reaching shadow root elements while self-healing through a click-blocking cookie popup banner.
7. **Multi-Tab Price Switcher:** Opening a new tab, switching active focus, and reading prices.

**Adversarial Evals:**
8. **Nested IFrame in Shadow Root** *(previously failing — resolved)*: A blob-URL iframe inside a shadow root was cross-origin, blocking `orbitId` injection. Fixed by switching to a `srcdoc` iframe (same-origin) and adding a child-frame fallback in `Click.ts` to dispatch clicks across Playwright frame boundaries. See [evals_report.md](evals_report.md) for the full two-layer diagnosis.
9. **Mid-Form Interstitial with Checkpoint:** Agent saves a browser checkpoint mid-task and resumes correctly after an injected interstitial page.
10. **Obfuscated Risky Action (Post-Action Guardrail):** An icon-only button (no readable text or aria-label) triggers a risky navigation; the post-action guardrail catches it by inspecting the resulting URL.

---

## Setup & Execution

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
# LLM Configuration
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Local Backup (Optional)
OLLAMA_HOST=http://localhost:11434

# Execution Settings
HEADLESS=true
MAX_STEPS=12
RECORD_VIDEO=true
SCREENSHOTS_DIR=./screenshots
VIDEO_DIR=./recordings
```

### 3. Run Interactively
To prompt the agent for a task in the console:
```bash
npm start
```
Or pass a task directly as an argument:
```bash
npm start -- "Go to wikipedia.org, search for 'JavaScript', and find its release year."
```

### 4. Run Tests
```bash
npm test        # Unit tests (no API key needed, ~15s)
npm run eval    # Full 10-task eval suite (requires GEMINI_API_KEY)
```

---

## Adversarial Cases & Failure Modes

Every autonomous agent has failure modes. Documented here for engineering transparency:

1. **Chronological Scrolling & First-Match Bias:**
   * **Symptom:** In very long, chronologically ordered tables (e.g. Wikipedia's *List of Starlink launches*, 30,000+ px), the agent may stop scrolling and report the oldest entries as "most recent" because they appear first in the active viewport.
   * **Root Cause:** Orbit feeds only the active viewport text to the planner to control LLM context costs. Brute-force scrolling through massive lists would exceed `MAX_STEPS`.
   * **Mitigation:** Guide the agent to use table-of-contents anchor links (e.g. clicking "2026 launches") to jump directly to the target section.

2. **Cost Estimation Drift:**
   * **Symptom:** Token and cost metrics use character heuristics (1 token ≈ 4 chars).
   * **Root Cause:** Actual API pricing varies by model version and prompt caching state.
   * **Mitigation:** Estimates are for developer awareness only and are not integrated with live billing APIs.
