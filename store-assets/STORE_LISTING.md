# a11y-overlay Store Listing Kit

Use this file as the single source for Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO metadata.

## Positioning

- Product name: `a11y-overlay`
- Category: Developer tools / accessibility tooling
- Single purpose: Inject a local overlay into the current page to visualize landmarks, headings, focus order, layout depth, repeating components, and related accessibility structure.

## Short description

Visualize page structure, landmarks, headings, focus order, and layout layers on any tab.

## Long description

a11y-overlay is a lightweight page inspection overlay for humans and browser-driving agents.

Inject it on the current tab and use one-key layer toggles to inspect:

- landmarks and page regions
- heading order and heading jumps
- interactive controls
- images missing alt text
- repeating sibling structures
- focus order and positive tabindex
- DOM depth bands
- block-level layout grid

This extension does not crawl your browsing history, collect analytics, or send page content to a server. It runs locally in the active tab when you invoke it.

## Permissions justification

- `activeTab`: required so the extension can operate only on the page the user explicitly activates.
- `scripting`: required to inject `a11y-overlay.js` into the active tab.
- `clipboardWrite`: required so the extension can copy exported PNG images to the system clipboard.
- `downloads`: required so the extension can save exported PNG images to disk with a predictable filename.
- `storage`: required to keep the most recent export context available while the focused export window opens.

## Privacy answers

- Collects browsing history: `No`
- Collects personally identifiable information: `No`
- Sells data: `No`
- Uses remote code: `No`
- Uses analytics: `No`
- Uses ads or affiliate tracking: `No`

Privacy policy page: `https://ranvier2d2.github.io/a11y-overlay/privacy.html`

## Test instructions for reviewers

1. Open any `http`, `https`, or `file` page.
2. Click the extension action, or press `Cmd+Shift+Y` on macOS / `Ctrl+Shift+Y` on Windows and Linux.
3. Click inside the page once if the browser keeps focus on the toolbar.
4. Press `L`, `H`, `I`, `A`, `R`, `F`, `D`, `G`, `?`, and `X` to verify the overlay toggles and teardown.
5. Press `C` to copy the visible viewport as a PNG, then paste it into an image-capable target.
6. Press `S` to open the PNG save dialog and confirm the suggested filename is prefilled.

## Suggested screenshots

Use the existing repo images for store submissions:

- `landing-hero.png`
- `github-overlay-default.png`
- `github-overlay-focus.png`
- `landing-full.png`

## Required follow-up before submission

- For Firefox, choose a stable `gecko.id`, for example `a11y-overlay@yourdomain.com`.
