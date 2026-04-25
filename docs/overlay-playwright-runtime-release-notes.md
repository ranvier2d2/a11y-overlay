# Overlay Playwright Runtime Release Notes

## Trust-But-Verify Annotation Review

This release adds a Codex-aware review path for planned annotation placement.

### Added

- `reviewPlannedAnnotation(...)` now queues required visual reviews when a repo
  has a `.codex/` directory.
- Repo-local Codex hooks can surface the exact flat preview image that the
  agent should inspect before applying, retrying, or downgrading a placement.
- `.codex/hooks/overlay-review-hook.mjs` reads pending review descriptors,
  ignores stale artifacts, and returns an actionable `PostToolUse` message.
- `.codex/config.toml` enables `codex_hooks` for this repo.
- `.codex/hooks.json` registers the overlay visual review hook.

### Behavior

- High-confidence placements may auto-apply.
- Medium-confidence placements are trust-but-verify.
- Low-confidence placements should be inspected, retried, or downgraded to a
  safer renderer.

### Deferred

- `Stop` hook enforcement is intentionally deferred until we see a real need to
  block turn completion on pending reviews.
