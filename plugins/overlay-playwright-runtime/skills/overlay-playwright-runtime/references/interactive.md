# Persistent Interactive Usage

Use this reference when the user wants to keep a browser open while iterating locally in Codex.

If the current repo does not already contain `playwright/overlay-client.mjs` and
`a11y-overlay.js`, run `adopt` first so the runtime files are present locally.

## Why this path exists

`OverlayClient` is a semantic adapter, not a browser-session manager.

So the best local workflow is:

1. bootstrap a dedicated sandbox under `~/.codex/overlay-playwright-runtime/sandbox`
2. keep a real Playwright browser session alive in `js_repl`
3. inject the overlay runtime into those persistent pages
4. use the runtime for reports, evidence, and annotations
5. use Playwright for navigation and interaction

This avoids relaunching the browser on every turn and makes mobile/desktop iteration much faster.

It also avoids mutating the target repo's `package.json`, lockfiles, or Node toolchain.

## Bootstrap the sandbox once

```bash
python3 scripts/bootstrap_operate_sandbox.py
```

The default sandbox root is:

```text
~/.codex/overlay-playwright-runtime/sandbox
```

## Bootstrap once inside `js_repl`

Starter cell:

```javascript
var overlaySandboxFactory;
var overlaySession;

({ createOverlaySandboxSession: overlaySandboxFactory } = await import("file:///Users/joaquinvenegasarevalo/.codex/overlay-playwright-runtime/sandbox/launch-session.mjs"));

overlaySession ??= await overlaySandboxFactory({
  outputDir: "/Users/joaquinvenegasarevalo/.codex/overlay-playwright-runtime/sandbox/output"
});

console.log("sandboxed Playwright + live overlay helper loaded");
```

## Runtime path choices

Use these rules consistently:

- local development inside this repo:
  - `runtimeScriptPath = "/absolute/path/to/repo/a11y-overlay.js"`
- adopted repo that owns the vendored runtime:
  - `runtimeScriptPath = "/absolute/path/to/target-repo/a11y-overlay.js"`
- skill-owned bundled runtime:
  - use only when you explicitly want to test the skill bundle itself rather than a repo checkout

Prefer the repo runtime during development so you are testing the code you are actively editing.

## Minimal session variables

```javascript
var TARGET_URL = "http://127.0.0.1:3000";
var RUNTIME_SCRIPT = "/absolute/path/to/repo/a11y-overlay.js";
```

## Typical desktop flow

```javascript
const page = await overlaySession.ensureDesktopPage({
  url: TARGET_URL,
  viewport: { width: 1600, height: 900 }
});

const contract = await overlaySession.ensureOverlay(page, {
  runtimeScriptPath: RUNTIME_SCRIPT,
  preset: "agent-capture",
  announce: false
});

const report = await overlaySession.buildJsonReport(page, { scope: "all" });

console.log(contract);
console.log(report.audit);
```

## Typical mobile flow

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

## Annotation flow

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

console.log(await overlaySession.saveSession(page));
```

## Session discipline

- Keep the browser open across turns unless it is stale.
- Reload the page for renderer-only changes.
- Rebuild the page or context only when necessary.
- Change viewport mode by replacing the context, not by mutating an old one.
- Use the sandbox as the Playwright home for `operate`.
- Do not add a new `package.json` to the target repo for this path.
- Use `agent-capture` for dense semantic capture.
- Use `mobile` for touch-target and mobile-oriented checks.

## Troubleshooting

- Browser does not open:
  - rerun `python3 scripts/bootstrap_operate_sandbox.py`
  - confirm the sandbox exists at `~/.codex/overlay-playwright-runtime/sandbox`
- Runtime is not injected:
  - check `runtimeScriptPath`
  - make sure it points at a real `a11y-overlay.js`
- Page is stale or detached:
  - recreate the page with `ensureDesktopPage(...)` or `ensureMobilePage(...)`
  - do not assume an old page handle is still healthy after a navigation error
- Unexpected old behavior:
  - reload the current page
  - if that is not enough, close the sandbox session and start a fresh one
- Target repo has no Playwright setup:
  - that is fine for `operate`
  - the sandbox owns Playwright for local testing

## Architecture boundary

Use this boundary consistently:

```text
Playwright session owns the browser
Live helper injects the runtime
Runtime returns semantic context and evidence
Playwright performs actions and assertions
```

Do not turn the overlay into a locator replacement or a generic browser-control API.
