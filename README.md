# Orbit — AI Browser Agent

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Automation-Playwright-green.svg)](https://playwright.dev/)
[![Orbit CI](https://github.com/Omm28/Orbit/actions/workflows/ci.yml/badge.svg)](https://github.com/Omm28/Orbit/actions/workflows/ci.yml)
[![Evals](https://img.shields.io/badge/Evals-7%20%2F%207%20Passed-brightgreen.svg)](evals_report.md)
[![Model Fallback](https://img.shields.io/badge/LLM-Gemini%20%E2%86%92%20Ollama%20Fallback-orange.svg)]()

Orbit is a **fully autonomous, self-healing AI browser agent** built in TypeScript. Give it a natural-language task (e.g. *"Log in, open the product catalog in a new tab, extract the price, and dismiss any cookie popups along the way"*), and Orbit will operate a real Chromium instance to achieve the goal.

Unlike simple LLM-wrapper scripts, Orbit is architected with production-level concerns in mind, including **fault tolerance, cost optimization, multi-tab awareness, and strict safety guardrails**.

---

## Core Features

*   **Action Bundling:** Minimizes API latency and LLM costs by executing multiple sequential inputs/clicks in a single turn without waiting for intermediate screenshots.
*   **Multi-Tab Support:** Real-time awareness of all open browser tabs/popups. The agent can monitor open tabs and actively switch focus (`switchTab`) between them.
*   **Self-Healing Clicks:** Catching click-interception errors (such as cookie banners or popups blocking target elements), dynamically scanning the page for overlay dismissers (e.g. Accept, Close, Reject, Dismiss), clicking them, and automatically retrying the original target click.
*   **Shadow DOM & IFrame Traversal:** Recursively scans and maps interactive elements hidden deep inside shadow roots and nested same-origin iframe hierarchies, calculating absolute viewport coordinates compensating for iframe offsets.
*   **LLM Failover Routing:** Operates with a dual-provider client (Gemini as the primary brain, automatically failing over to a local Ollama Llama 3.1 model if rate limits or network issues arise).
*   **Browser Milestone Checkpointing:** Automatically serializes browser contexts (`storageState`, cookies, and localStorage) when subtasks are achieved, allowing the agent to roll back to the last known-good milestone if it hits consecutive failures.
*   **Terminal Viewport Previews:** Generates scaled, text-based grid previews of the page viewport layout (`[orbitId:tag]`) in the console, providing developers with clear visual context directly in the logs.
*   **Session Screen Recording:** Playwright-backed screen recordings are automatically captured, flushed, and saved as clean task-slugged `.webm` video files inside the `recordings/` folder for visual replays.
*   **Cost & Token Tracking:** Computes estimated prompt/completion token usage, action success rates, self-healing occurrences, and USD cost calculations per run.

---

## Project Architecture

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
Or run directly passing a task argument:
```bash
npm start -- "Go to wikipedia.org, search for 'JavaScript', and find its release year."
```

---

## Run Metrics Card

At the end of every run, Orbit prints a detailed cost and execution summary card:

```text
---------------- Run Metrics ----------------
  Duration           : 5.7s
  Steps / Actions    : 3 steps / 6 actions
  LLM Calls          : 3
  Tokens (in / out)  : 3,065 / 351 (~3,416 total)
  Est. Cost (USD)    : $0.00034
  Self-Healing       : 0 overlay dismissal(s)
  Recording          : C:\Users\ombko\Projects\Orbit\recordings\orbit_multi_step_signup.webm
------------------------------------------------
```

---

## 7-Task Benchmarking Suite

Orbit includes an automated integration testing suite. Run the suite to verify all agent systems:

```bash
npm run eval
```

This runs 7 custom test scenarios headlessly, records videos for each run, and generates an [evals_report.md](evals_report.md) report detailing:
1. **Multi-Step Signup Flow:** Form submission across sequential pages.
2. **Safety Guardrail Block:** Automatic transaction blocks (matched keyword: "delete account").
3. **Data Extraction:** Laptop price lookup from a data table.
4. **Dropdown Selection:** Option selection from a custom HTML dropdown.
5. **Domain Safety Intercept:** Blocking navigation to unlisted domains.
6. **Shadow DOM & Cookie Dismissal:** Accessing shadow root elements while programmatically closing a click-blocking cookie popup banner.
7. **Multi-Tab Price Switcher:** Clicking a button to open a new tab, switching active focus to that tab, and reading prices.

---

## Adversarial Cases & Failure Modes

Every autonomous agent has failure modes. To maintain engineering transparency, we document known challenges and architectural trade-offs:

1. **Chronological Scrolling & First-Match Bias:**
   * **Symptom:** In very long, chronologically ordered tables (such as Wikipedia's *List of Starlink launches* which exceeds 30,000 pixels in height), the agent may stop scrolling and prematurely report the oldest entries (e.g., from 2018) as the "most recent" because they appear first in its active viewport.
   * **Root Cause:** To conserve LLM context window costs, Orbit only feeds the active viewport text to the planner. Reaching the bottom of massive lists using brute-force scrolling would exceed the maximum step limit (`MAX_STEPS=20`).
   * **Mitigation:** Guide the agent to use table-of-contents navigation anchor links (e.g., clicking on "2026 launches" directly) which jumps to the bottom in a single step instead of scrolling.

2. **Cost Estimation Drift:**
   * **Symptom:** Cost and token metrics printed at the end of runs are calculated using character heuristics (1 token ≈ 4 characters).
   * **Root Cause:** The actual API pricing fluctuates based on provider models and prompt caching states.
   * **Mitigation:** These estimates are intended for developer awareness and are not directly integrated with live billing APIs.
