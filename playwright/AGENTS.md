# Playwright Client Layer

## What this folder is

- This folder contains the Playwright-facing adapter layer for the overlay runtime.
- Boundaries:
  - `overlay-client-live.mjs` is for live `js_repl` and persistent browser sessions.
  - `overlay-client.mjs` builds on the live client and adds file-oriented artifact writing.

## Local invariants

- Keep `overlay-client-live.mjs` free of filesystem concerns and safe for `js_repl`.
- Keep file writing and package-style artifact generation in `overlay-client.mjs`.
- Prefer additive wrappers over breaking changes to the current client API.

## Safe changes

- Prefer adding explicit helper methods such as file-oriented audit helpers in `overlay-client.mjs`.
- Prefer keeping browser-driving logic delegated to Playwright callers or the sandbox launcher.
- Avoid mixing repo bootstrap logic into these files.

## Validate

- Fast check: `node /Users/joaquinvenegasarevalo/coding/frontend-gadget/tests/verify_overlay_client.mjs`
- Full check: `node /Users/joaquinvenegasarevalo/coding/frontend-gadget/tests/verify_overlay_client.mjs && node /Users/joaquinvenegasarevalo/coding/frontend-gadget/tests/verify_overlay_sandbox.mjs`

## ONGOING IMPLEMENTATION

- Roadmap source: [docs/overlay-playwright-runtime-roadmap.md](/Users/joaquinvenegasarevalo/coding/frontend-gadget/docs/overlay-playwright-runtime-roadmap.md)
- Priority work owned here:
  1. add `buildReportToFile(...)`
  2. add `buildAuditBundleToFile(...)`
  3. add `writeAuditArtifactSet(...)`
  4. keep the live client pure while extending the full client for audit operator workflows
