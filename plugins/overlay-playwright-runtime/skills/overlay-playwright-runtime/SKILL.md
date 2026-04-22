---
name: overlay-playwright-runtime
description: Adopt and operate the a11y-overlay runtime in Playwright or browser-agent repos. Prefer a persistent browser session for local iteration, and vendor `a11y-overlay.js` plus `playwright/overlay-client.mjs` into other repos when needed.
---

# Overlay Playwright Runtime

## Overview

Use this skill to add or operate the `a11y-overlay` runtime in Playwright-oriented repos.
The runtime stays inside the page as a semantic inspection layer. Playwright remains the action layer for clicks, typing, assertions, and screenshots.

This skill has two modes:

1. `adopt` — vendor the reusable runtime files into another repo.
2. `operate` — keep a persistent browser session alive in a dedicated local sandbox and use the live helper for semantic context, reports, screenshots, and annotations.

Prefer `operate` when you are iterating locally inside Codex and `js_repl` is available. Do not relaunch the browser on every turn unless the app ownership changed or the session is stale.

## Bundled Assets

This skill carries its own vendorable runtime files under:

- `assets/runtime/a11y-overlay.js`
- `assets/runtime/playwright/overlay-client.mjs`
- `assets/runtime/playwright/overlay-client-live.mjs`
- `assets/sandbox/package.json`
- `assets/sandbox/launch-session.mjs`
- `assets/sandbox/overlay-client-live.mjs`
- `assets/templates/accessibility-audit-report.md`

It also carries workflow doctrine under:

- `references/reporting.md`

That makes `adopt` deterministic:

- install the skill or plugin once
- vendor from local bundled assets
- do not fetch live from GitHub during each adopt run

## Mode Selection

Choose the path that matches the task:

- If the target repo does not already contain `a11y-overlay.js` and `playwright/overlay-client.mjs`, start with `adopt`.
- If the user wants live debugging, repeated inspection, mobile checks, or iterative UI work, use `operate` and keep the browser open.
- If `js_repl` is unavailable, fall back to normal Playwright code or vendoring plus static examples; do not pretend the persistent session path is available.

## Adopt Workflow

### 1. Detect whether the repo already has the runtime

From the target repo root, check for the reusable files first:

```bash
rg --files | rg '(^a11y-overlay\\.js$|^playwright/overlay-client\\.mjs$)'
```

If both files exist:

- prefer the in-repo versions
- do not vendor fresh copies unless the user explicitly asks to overwrite

### 2. Vendor the runtime when the repo does not have it

Use the bundled vendor script:

```bash
python3 scripts/vendor_overlay_runtime.py \
  --target-root /absolute/path/to/repo
```

Dry run first when the target repo is unfamiliar:

```bash
python3 scripts/vendor_overlay_runtime.py \
  --target-root /absolute/path/to/repo \
  --dry-run
```

Use `--force` only when the user explicitly wants to overwrite existing files.

### 3. Use the Playwright client instead of raw `page.evaluate(...)` sprawl

Canonical usage:

```js
import { OverlayClient } from './playwright/overlay-client.mjs';

const client = new OverlayClient();

await client.inject(page);
await client.applyPreset(page, 'agent-capture', { announce: false });

const contract = await client.getContract(page);
const report = await client.buildReport(page, 'json', { scope: 'all' });
```

### 4. Collect a Playwright-native failure package

Use the client helper rather than rebuilding the bundle layout manually:

```js
const artifacts = await client.writeFailurePackage(page, {
  dir: './artifacts/checkout-failure',
  scope: 'all',
  includeHtmlReport: true,
  includeAuditBundle: true,
  fullPage: true
});
```

This writes:

- `contract.json`
- `report.json`
- `report.html`
- `audit-bundle.html`
- `viewport.png`
- `manifest.json`

### 4.1 Use the built-in reporting doctrine and template

When the task is to produce a persistent audit report, use:

- `references/reporting.md` for the reporting standard and allowed claims
- `assets/templates/accessibility-audit-report.md` for the actual Markdown scaffold

Use that split intentionally:

- `reporting.md` tells you what kind of report this skill should produce
- `accessibility-audit-report.md` tells you how to structure the deliverable

Default posture:

- produce a **Website Accessibility Audit Report**
- do **not** default to a formal conformance claim, VPAT, or ACR

If the user asks for stronger standards backing or if the report structure is being changed materially:

- re-check the primary references listed in `references/reporting.md`
- keep the local doctrine as the default source of truth
- do not reinvent the report structure from scratch on every run

### 5. Be explicit about current limits

The current runtime does **not** yet expose a real readiness contract.
So:

- `client.getReadyState(...)` and `client.waitForStableState(...)` are forward-compatible wrappers
- they fail explicitly until the runtime adds those methods
- do not claim readiness support in a repo unless the runtime contract actually exposes it

### 6. Keep the architecture boundary clear

Use this model:

```text
Playwright -> inject/use OverlayClient -> query runtime contract/report -> act with Playwright
```

Do not turn the overlay runtime into a replacement for Playwright locators or browser actions.

## Operate Workflow

When using this skill locally in Codex, prefer a persistent `js_repl` Playwright session over one-shot browser launches. The browser dependency should live in a dedicated sandbox under `~/.codex/overlay-playwright-runtime/sandbox`, not in the target repo. The recommended mental model is:

```text
Dedicated sandbox -> persistent browser session -> live helper injects runtime -> runtime returns semantic context -> Playwright acts
```

### Preconditions

- `js_repl` is available in the current Codex session.
- The sandbox is bootstrapped locally.
- A dev server or target URL is already reachable.
- Reuse the existing browser if one is already open and healthy.

### Bootstrap the sandbox once

Run this from any working directory:

```bash
python3 scripts/bootstrap_operate_sandbox.py
```

Default sandbox root:

```text
~/.codex/overlay-playwright-runtime/sandbox
```

This command:

- copies the bundled sandbox helper files into the sandbox
- installs local `playwright` there
- installs Chromium there

It does **not** mutate the target repo's `package.json` or lockfiles.

### Bootstrap once inside `js_repl`

```javascript
var overlaySandboxFactory;
var overlaySession;

({ createOverlaySandboxSession: overlaySandboxFactory } = await import("file:///Users/joaquinvenegasarevalo/.codex/overlay-playwright-runtime/sandbox/launch-session.mjs"));

overlaySession ??= await overlaySandboxFactory({
  outputDir: "/Users/joaquinvenegasarevalo/.codex/overlay-playwright-runtime/sandbox/output"
});
```

### Minimal session variables

```javascript
var TARGET_URL = "http://127.0.0.1:3000";
var RUNTIME_SCRIPT = "/absolute/path/to/repo/a11y-overlay.js";
```

### Typical desktop pass

```javascript
const page = await overlaySession.ensureDesktopPage({
  url: TARGET_URL,
  viewport: { width: 1600, height: 900 }
});

await overlaySession.ensureOverlay(page, {
  runtimeScriptPath: RUNTIME_SCRIPT,
  preset: "agent-capture",
  announce: false
});

const report = await overlaySession.buildJsonReport(page, { scope: "all" });
console.log(report.audit);
```

### Typical mobile pass

```javascript
const mobilePage = await overlaySession.ensureMobilePage({
  url: TARGET_URL
});

await overlaySession.ensureOverlay(mobilePage, {
  runtimeScriptPath: RUNTIME_SCRIPT,
  preset: "mobile",
  announce: false
});

const report = await overlaySession.buildJsonReport(mobilePage, { scope: "all" });
console.log(report.audit);
```

### Annotation pass in the persistent session

```javascript
const page = await overlaySession.ensureDesktopPage({ url: TARGET_URL });

await overlaySession.ensureOverlay(page, {
  runtimeScriptPath: RUNTIME_SCRIPT,
  preset: "agent-capture",
  announce: false
});

await overlaySession.annotateNote(page, {
  x: 640,
  y: 280,
  text: "Primary CTA needs a stronger accessible name."
});

await overlaySession.annotateArrow(page, {
  x1: 640,
  y1: 280,
  x2: 840,
  y2: 220
});

await overlaySession.saveSession(page);
```

### Session rules

- Keep the browser open across turns when iterating locally.
- Reload pages for renderer-only changes instead of relaunching the browser.
- Recreate a page or context only when the handle is stale or the viewport mode changed.
- Use the sandbox as the Playwright home for `operate`.
- Do not add a new `package.json` to the target repo as part of this workflow.
- Close the browser only when the task is actually finished.
- Use Playwright for actions and assertions; use the live helper for semantic reads, screenshots, and session annotations.

## References

- Adoption notes and examples: `references/adoption.md`
- Persistent session examples: `references/interactive.md`

## Validation

Validate the skill itself:

```bash
python3 /absolute/path/to/skill-creator/scripts/quick_validate.py \
  /absolute/path/to/overlay-playwright-runtime
```

Test the vendor script on a temp directory before using it on an unfamiliar repo.
