# Verification Surface

## What this folder is

- This folder contains repo-level verification for the overlay runtime, Playwright clients, and sandbox flows.
- Boundaries:
  - tests here should validate integration behavior, not become large application fixtures
  - fixture HTML should stay deterministic and minimal

## Local invariants

- Keep tests runnable from the repo root without hidden external state beyond the documented sandbox.
- Prefer small, explicit assertions over broad snapshot-only checks.
- When adding a new helper in `playwright/` or the sandbox launcher, add or update a test here in the same change.

## Safe changes

- Prefer extending `verify_overlay_client.mjs` for client API changes.
- Prefer extending `verify_overlay_sandbox.mjs` for sandbox/operator changes.
- Prefer deterministic geometry fixtures when changing annotation placement, quiet capture, or report replay behavior.
- Avoid making tests depend on third-party sites for core verification.

## Validate

- Fast check from repo root: `node tests/verify_overlay_client.mjs`
- Full check from repo root: `node tests/verify_overlay_client.mjs && node tests/verify_overlay_sandbox.mjs`

## ONGOING IMPLEMENTATION

- Roadmap source: `docs/overlay-playwright-runtime-roadmap.md`
- Priority work owned here:
  1. cover file-oriented audit helpers and quiet-capture state restoration
  2. cover standardized artifact set generation and report replay fidelity
  3. cover readiness and route-audit wiring with deterministic fixtures
  4. add targeted checks for annotation placement/reflow behavior without depending on external apps
