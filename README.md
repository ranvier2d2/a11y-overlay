# a11y-overlay

Static scaffold for an accessibility structure overlay and its product landing page.

## Primary files

- `landing.html` — canonical marketing / demo page
- `a11y-overlay.js` — zero-dependency overlay script
- `reference.html` — local target page used by the demo iframe
- `demo.html` — minimal demo shell

## Local preview

Run a static server from the repo root:

```bash
python3 -m http.server 8765
```

Then open:

- `http://localhost:8765/landing.html`
- `http://localhost:8765/demo.html`

## How the script works

1. Inject `a11y-overlay.js` with a bookmarklet, a `<script>` tag, or browser automation.
2. The script appends one fixed host node to `document.documentElement`.
3. All overlay chrome lives inside an open shadow root on that host.
4. Detectors scan visible landmarks, headings, interactive elements, missing-alt images, repeating siblings, focus order, depth, and block-level layout boxes.
5. Scroll, resize, and DOM mutations funnel into one `requestAnimationFrame` repaint loop.
6. The public API is exposed at `window.__a11yOverlayInstalled`.

## Public API

- `toggle(key)`
- `toggleHelp()`
- `collectDetections()` — return structured landmark/heading/interactive/focus detections with document-space rects
- `exportPng(target)` — extension mode only; `clipboard` opens the focused export window, `download` opens the save dialog
- `setAnnotationMode(mode)` — `note`, `arrow`, or `idle`
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
- In extension mode only:
  - `C` opens a focused export window for clipboard PNG copy
  - `S` opens a save dialog for the current viewport PNG
- Press `X` on the page to tear the overlay down.

If the browser shortcut does not fire, open `chrome://extensions/shortcuts` and assign it manually. Chrome may leave an extension shortcut inactive if it conflicts with another extension or a reserved browser / OS shortcut.

### Important for local files

For pages opened as `file:///...`, Chrome requires one extra toggle:

1. Open the extension card on `chrome://extensions`
2. Turn on **Allow access to file URLs**

Without that toggle, the extension will not inject into local HTML files.

## Distribution scaffold

This repo now includes a release path for browser stores and GitHub Pages.

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

### Build the GitHub Pages artifact locally

```bash
python3 scripts/build_site.py
```

This stages the deployable site into `.site-dist/`. The GitHub Actions workflow at `.github/workflows/pages.yml`
does the same thing on push to `main`.

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
