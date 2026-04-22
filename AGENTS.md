# frontend-gadget

## What this repo is

- This repo is the source of truth for the `a11y-overlay` runtime, its Playwright integration layer, its Codex skill and plugin distribution, and the public marketing site.
- Primary implementation surfaces:
  - `src/overlay/` for runtime behavior
  - `playwright/` for Node and live-session clients
  - `plugins/overlay-playwright-runtime/` for skill and plugin packaging
  - `tests/` for client and sandbox verification

## Repository expectations

- Keep changes minimal and scoped to the current request.
- Preserve the architecture boundary:
  - Playwright performs browser actions.
  - The overlay runtime provides semantic inspection and annotation state.
  - The skill and plugin orchestrate adoption and local operation.
- If you change public behavior, update the relevant docs and tests in the same change.
- Rebuild generated runtime files whenever `src/overlay/` changes.

## Setup

- Runtime and packaging helpers are Python and ESM-based.
- Rebuild the runtime: `python3 scripts/build_overlay.py`
- Bootstrap the local skill sandbox when needed: `python3 plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/scripts/bootstrap_operate_sandbox.py`

## Fast checks

- Runtime/client verification: `node tests/verify_overlay_client.mjs`
- Sandbox verification: `node tests/verify_overlay_sandbox.mjs`
- Overlay rebuild: `python3 scripts/build_overlay.py`
- Diff hygiene: `git diff --check`

## Architecture map

- `src/overlay/`: ordered runtime source modules that build `a11y-overlay.js`
- `playwright/`: Playwright-facing clients for live sessions and artifact writing
- `plugins/overlay-playwright-runtime/`: Codex plugin + bundled skill distribution
- `tests/`: runtime/client/sandbox verification
- `site/`: static public deploy surface
- `scripts/`: repo-level build and packaging helpers
- `docs/`: roadmap and implementation notes

## Guardrails

- Do not add filesystem-writing behavior to `playwright/overlay-client-live.mjs`; keep it `js_repl` safe.
- Do not mutate a target repo `package.json` or lockfile from the skill adopt flow unless the user explicitly asks.
- Keep most operator UX logic in the client, sandbox, or skill layers; do not push workflow policy into the runtime without a concrete need.
- Treat `a11y-overlay.js` and `site/a11y-overlay.js` as generated artifacts.

## ONGOING IMPLEMENTATION

- Source roadmap: [docs/overlay-playwright-runtime-roadmap.md](/Users/joaquinvenegasarevalo/coding/frontend-gadget/docs/overlay-playwright-runtime-roadmap.md)
- Current program of work:
  1. add first-class audit modalities
  2. standardize artifact outputs and report templates
  3. add readiness and auth/pairing strategies in the sandbox/skill layer
  4. add temporary audit-only adopt mode
- Before changing a subdirectory with its own `AGENTS.md`, read that file and follow its narrower rules.
