# overlay-playwright-runtime Plugin Bundle

## What this folder is

- This folder packages the installable Codex plugin and bundled skill for `overlay-playwright-runtime`.
- Boundaries:
  - skill instructions, references, bundled runtime assets, and sandbox assets live here
  - this folder owns distribution-facing UX, not the runtime source of truth

## Local invariants

- Keep the bundled assets in sync with the repo source of truth.
- Keep `adopt` deterministic by copying from bundled local assets, not live GitHub fetches.
- Keep the sandbox bootstrap path non-invasive to target repos.
- Keep the sandbox bootstrap script from replacing sandbox-specific files with runtime-only variants.

## Safe changes

- Prefer evolving the skill UX, references, sandbox helper, and vendoring scripts here.
- Prefer documenting modality-specific flows here rather than overloading the runtime docs.
- Prefer evidence-placement scoring, retry/reflow policy, and route-level annotation helpers in the sandbox helper.
- Avoid duplicating large source files manually when a sync step can update bundled assets.

## Validate

- Fast check: `python3 /Users/joaquinvenegasarevalo/coding/frontend-gadget/plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/scripts/bootstrap_operate_sandbox.py --dry-run`
- Full check: `node /Users/joaquinvenegasarevalo/coding/frontend-gadget/tests/verify_overlay_sandbox.mjs`

## ONGOING IMPLEMENTATION

- Roadmap source: [docs/overlay-playwright-runtime-roadmap.md](/Users/joaquinvenegasarevalo/coding/frontend-gadget/docs/overlay-playwright-runtime-roadmap.md)
- Priority work owned here:
  1. keep case-routed skill docs and metadata aligned with the real helper surface
  2. keep canonical report template assets and bundled clients in sync
  3. extend the sandbox helper with evidence-quality logic such as quiet capture and annotation reflow
  4. extend vendoring/bootstrap flows without breaking local installed sandboxes
  5. document auth, pairing, and responsive-route patterns
