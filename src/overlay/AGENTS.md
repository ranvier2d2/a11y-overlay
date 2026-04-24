# Overlay Runtime Source

## What this folder is

- This folder contains the modular source of truth for the in-page overlay runtime.
- Boundaries:
  - this folder owns runtime semantics, rendering, annotations, hotkeys, and the public in-page API
  - this folder does not own high-level audit orchestration or repo vendoring behavior

## Local invariants

- Preserve the ordered module build structure.
- Keep runtime APIs explicit and versioned through `getAutomationContract()`.
- Only add workflow-facing runtime APIs when the client or skill layer cannot reasonably own the behavior.
- Keep annotation geometry persistence and UI-state toggles stable; higher-level note scoring or retry policy should stay outside this folder.
- Rebuild generated runtime files after changes here.

## Safe changes

- Prefer small runtime API additions that support client or skill orchestration cleanly.
- Prefer keeping readiness policy out of the runtime until there is a concrete cross-surface need.
- Avoid coupling runtime logic to Codex-specific install or sandbox assumptions.

## Validate

- Fast check: `python3 /Users/joaquinvenegasarevalo/coding/frontend-gadget/scripts/build_overlay.py`
- Full check: `python3 /Users/joaquinvenegasarevalo/coding/frontend-gadget/scripts/build_overlay.py && node /Users/joaquinvenegasarevalo/coding/frontend-gadget/tests/verify_overlay_client.mjs`

## ONGOING IMPLEMENTATION

- Roadmap source: [docs/overlay-playwright-runtime-roadmap.md](/Users/joaquinvenegasarevalo/coding/frontend-gadget/docs/overlay-playwright-runtime-roadmap.md)
- Runtime-facing work should stay narrow:
  1. preserve current agent UI configuration support, including capture-time chrome suppression
  2. keep note and arrow storage/replay stable for downstream report renderers
  3. add new public methods only when the audit operator layer genuinely needs them
  4. avoid implementing readiness heuristics or note-placement policy here prematurely
