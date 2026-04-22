# a11y-overlay

Accessibility overlay runtime, Chrome extension, and static marketing site.

## Primary files

- `site/index.html` — canonical public landing page and Vercel entrypoint
- `site/` — self-contained static deploy surface for the marketing site, including the public privacy page
- `demo.html` — guided proof path for the runtime contract and reports
- `demo.js` — controller for the guided demo page
- `a11y-overlay.js` — generated zero-dependency overlay runtime
- `playwright/overlay-client.mjs` — Playwright-facing helper for injection, contract reads, and failure packages
- `playwright/overlay-client-live.mjs` — js_repl-safe live-session helper without file-writing concerns
- `src/overlay/` — modular source of truth for the overlay runtime
- `reference.html` — deterministic product-like target used by the demo iframe
- `landing.html` — older landing variant kept in the repo but no longer canonical

## Overlay source layout

The runtime is built from ordered source modules in `src/overlay/`:

- `00-intro.js` — wrapper and install bootstrap
- `10-constants.js` — constants and runtime capability flags
- `20-shadow-dom.js` — overlay host and embedded styles
- `30-state.js` — state, presets, and shared typedefs
- `40-utils.js` — general helpers and inspector formatting
- `50-detectors.js` — scanners plus report generation
- `60-annotations.js` — note and arrow interactions
- `70-render.js` — toolbar, settings, inspector, and render loop
- `80-runtime.js` — hotkeys, teardown, and public API

Rebuild the shipped runtime with:

```bash
python3 scripts/build_overlay.py
```

## Local preview

Run a static server from the repo root:

```bash
python3 -m http.server 8765
```

Then open:

- `http://localhost:8765/site/`
- `http://localhost:8765/demo.html`

Local `http://` preview is the most reliable path for the site and demo. Direct `file:///` opens can work, but browser restrictions around local files and extension access vary.

## Public site deployment

The public landing site is the `site/` directory.

For Vercel:

- set the project Root Directory to `site`
- use the `Other` framework preset
- no build command is required

For GitHub Pages:

- the workflow uploads `site/` directly
- no site build step is required

That keeps the public deployment isolated from extension-only files such as
`manifest.json`, `service-worker.js`, tests, and build scripts.

## Codex distribution

This repo now ships the `overlay-playwright-runtime` workflow in two Codex-facing forms:

- an installable skill at `plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime`
- a minimal plugin wrapper at `plugins/overlay-playwright-runtime`

Recommended split:

- use the skill form for local setup and experimentation
- use the plugin form for reusable team distribution

### Install the skill from GitHub

In Codex, use [$skill-installer](/Users/joaquinvenegasarevalo/.codex/skills/.system/skill-installer/SKILL.md) and point it at:

- repo: `ranvier2d2/a11y-overlay`
- path: `plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime`

That installs the skill locally so it can be invoked directly as `$overlay-playwright-runtime`.

### Install the plugin from a Git-backed marketplace

Add this repo as a marketplace source:

```bash
codex plugin marketplace add ranvier2d2/a11y-overlay --ref main --sparse .agents/plugins --sparse plugins/overlay-playwright-runtime
```

Then open the Codex plugin browser and install `overlay-playwright-runtime`.

The plugin wraps the same skill, but gives you the official install surface for wider reuse.

### Operate sandbox

For live local `js_repl` testing, the skill now expects a dedicated sandbox under:

```text
~/.codex/overlay-playwright-runtime/sandbox
```

Bootstrap it with the skill-bundled script:

```bash
python3 scripts/bootstrap_operate_sandbox.py
```

That sandbox owns the local `playwright` dependency and browser install for the
skill's `operate` flow. It is intentionally separate from any adopted target repo,
so local visual QA does not add or mutate a target repo `package.json` or lockfiles.

## How the script works

1. Inject `a11y-overlay.js` with a bookmarklet, a `<script>` tag, or browser automation.
2. The script appends one fixed host node to `document.documentElement`.
3. All overlay chrome lives inside an open shadow root on that host.
4. Detectors scan visible landmarks, headings, interactive elements, missing-alt images, repeating siblings, focus order, depth, and block-level layout boxes.
5. Scroll, resize, and DOM mutations funnel into one `requestAnimationFrame` repaint loop.
6. Per-page audit state persists locally, including slice toggles, mode, and annotations.
7. The public API is exposed at `window.__a11yOverlayInstalled`.

## Public API

- `toggle(key)`
- `toggleHelp()`
- `collectDetections()` — return structured landmark/heading/interactive/focus detections with document-space rects
- `buildReport(format, opts)` — build JSON report data or an HTML report document string
- `buildAuditBundle(opts)` — build the standalone evidence bundle HTML string
- `downloadReport(format, opts)` — download the current audit scope as `json` or `html`
- `downloadAuditBundle(opts)` — download the report plus viewport evidence when extension capture is available
- `exportPng(target)` — extension mode only; `clipboard` opens the focused export window, `download` opens the save dialog
- `getAutomationContract()` — return the versioned method/preset/slice contract for agents and CI
- `listPresets()` / `applyPreset(id)` — named audit workflows for humans and agents
- `setLayerMode(mode)` — switch between `conformance` and `review` layer modes
- `setAnnotationMode(mode)` — `note`, `arrow`, or `idle`
- `addNote(point, text)` / `addArrow(start, end)` — create annotations directly from agents or automation
- `saveSession()` / `clearSavedSession()` / `getSessionSnapshot()`
- `annotations` — live notes/arrows state for the current page session
- `render()`
- `teardown()`
- `state`

Parent pages can also drive an injected iframe via:

```js
iframe.contentWindow.postMessage({ __a11yov: true, key: "L" }, "*");
```

## Where to use it

- Bookmarklet: quick human audits on pages that allow injected scripts
- Browser extension: the most reliable human path across third-party sites
- Script tag: sites you own, dev/staging environments, design review builds
- Playwright/Puppeteer: agents, CI, scraping, regression screenshots

What will not work with the bookmarklet: sites protected by strict Content Security Policy. For those, the next delivery shape is an extension or a DevTools/userscript flow.

## Playwright client

`playwright/overlay-client.mjs` is the canonical Node-side wrapper for Playwright users.

It keeps the runtime as the source of semantic context and keeps Playwright as the executor for:

- navigation
- clicks
- typing
- assertions
- screenshots

### Basic usage

```js
import { OverlayClient } from './playwright/overlay-client.mjs';

const client = new OverlayClient();

await client.inject(page);
await client.applyPreset(page, 'agent-capture', { announce: false });

const contract = await client.getContract(page);
const report = await client.buildReport(page, 'json', { scope: 'all' });
```

### Desktop and mobile presets

```js
import { OverlayClient } from './playwright/overlay-client.mjs';

const client = new OverlayClient();

await client.inject(page);
await client.applyPreset(page, 'agent-capture', { announce: false });

const desktopReport = await client.buildReport(page, 'json', { scope: 'all' });

await client.inject(mobilePage);
await client.applyPreset(mobilePage, 'mobile', { announce: false });

const mobileReport = await client.buildReport(mobilePage, 'json', { scope: 'all' });
```

### Annotation helpers

```js
import { OverlayClient } from './playwright/overlay-client.mjs';

const client = new OverlayClient();

await client.inject(page);
await client.annotateNote(page, {
  x: 640,
  y: 280,
  text: 'Primary CTA needs a stronger accessible name.'
});

await client.annotateArrow(page, {
  x1: 640,
  y1: 280,
  x2: 840,
  y2: 220
});

await client.saveSession(page);
```

### Live-session helper

For persistent local `js_repl` browser work, prefer:

```js
import { OverlayLiveClient } from './playwright/overlay-client-live.mjs';
```

Use `OverlayLiveClient` when you want:

- injection
- presets
- report reads
- annotations
- session save or restore

Use `OverlayClient` when you also need artifact writing such as
`writeFailurePackage(...)`.

### Failure package usage

```js
import { OverlayClient } from './playwright/overlay-client.mjs';

const client = new OverlayClient();

await client.inject(page);
await client.applyPreset(page, 'agent-capture', { announce: false });

const artifacts = await client.writeFailurePackage(page, {
  dir: './artifacts/checkout-failure',
  scope: 'all',
  includeHtmlReport: true,
  includeAuditBundle: true,
  fullPage: true
});

console.log(artifacts);
```

That writes:

- `contract.json`
- `report.json`
- `report.html`
- `audit-bundle.html`
- `viewport.png`
- `manifest.json`

The client also exposes forward-compatible wrappers for future runtime methods such as `getReadyState()` and `waitForStableState()`. In the current build those calls fail explicitly because the runtime does not yet expose a readiness contract.

## Browser extension

This repo root is now also a Chrome/Chromium MV3 extension.

### Install it

1. Open `chrome://extensions` (or the equivalent extensions page in Edge / Brave).
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the cloned repo folder.

### Use it

- Click the extension toolbar icon on any `http`, `https`, or `file` page.
- Or use the shortcut:
  - `Command+Shift+Y` on macOS
  - `Ctrl+Shift+Y` on Windows / Linux
- After injection, click the page once if needed, then use the in-page keys:
  - `L H I A R F D G N W V C S ? X`
- Annotation keys:
  - `N` places one note
  - `W` places one arrow with two clicks
  - `V` or `Esc` exits placement and clears the current note/arrow selection
  - `Delete` / `Backspace` removes the selected note or arrow
  - Clicking non-interactive page space while idle also clears the current selection
- Click any overlay label or badge to open the selection inspector for that element
- Open `Cfg` for named workflow presets:
  - `Content`
  - `Navigation`
  - `Forms`
  - `Mobile`
  - `Agent`
- In extension mode only:
  - `C` opens a focused export window for clipboard PNG copy
  - `S` opens a save dialog for the current viewport PNG
- In all modes:
  - `JSON` downloads the current audit scope as a structured report
  - `HTML` downloads the current audit scope as a readable review report
- Press `X` on the page to tear the overlay down.

If the browser shortcut does not fire, open `chrome://extensions/shortcuts` and assign it manually. Chrome may leave an extension shortcut inactive if it conflicts with another extension or a reserved browser / OS shortcut.

### Important for local files

For pages opened as `file:///...`, Chrome requires one extra toggle:

1. Open the extension card on `chrome://extensions`
2. Turn on **Allow access to file URLs**

Without that toggle, the extension will not inject into local HTML files.

## Distribution scaffold

This repo includes a release path for browser stores. The public website is
served from `site/` separately.

### Generate icons

```bash
python3 scripts/generate_icons.py
```

This writes the store/runtime icons into `icons/`.

### Build extension packages

Chrome and Chromium package:

```bash
python3 scripts/build_release.py
```

Chrome plus Firefox package:

```bash
FIREFOX_EXTENSION_ID='a11y-overlay@yourdomain.com' python3 scripts/build_release.py --firefox
```

The Firefox package is generated from the same source and keeps the same focused export-window flow for PNG copy.

Outputs land in `dist/`.

## Verification

Fixture-based browser verification lives in `tests/`.

Run it with:

```bash
python3 tests/verify_overlay.py
node tests/verify_overlay_client.mjs
```

That script opens deterministic HTML fixtures, checks the expected findings, verifies report generation, and confirms saved session state survives a reload.

It also verifies that workflow presets apply the expected layer, slices, and touch profile, and that the automation contract is exposed.

### Store metadata

Use [`store-assets/STORE_LISTING.md`](./store-assets/STORE_LISTING.md) for:

- short and long descriptions
- permission justifications
- privacy answers
- reviewer test instructions
- screenshot mapping

Use [`store-assets/SUBMISSION_CHECKLIST.md`](./store-assets/SUBMISSION_CHECKLIST.md) for the actual store upload flow and exact asset files.

### Privacy policy

The repo includes [`privacy.html`](./privacy.html), which is meant to be published alongside the landing page.

## Most valuable user stories

### Humans

- As a QA lead, I want to audit production page structure fast, so I can verify landmarks, headings, and focus flow without opening DevTools.
- As a content editor, I want missing-alt images highlighted instantly, so I can fix accessibility issues before publish.
- As a frontend engineer, I want repeating cards grouped visually, so I can spot broken siblings and layout drift at a glance.

### Agents

- As a browser-driving agent, I want one injected script that exposes page structure visually, so I can reason from annotated screenshots instead of raw DOM alone.
- As a Playwright worker, I want deterministic layer toggles, so I can capture one screenshot per structural concern.
- As a scraping or QA agent, I want repeating clusters and focus order surfaced automatically, so I can avoid fragile selectors and catch regressions earlier.
