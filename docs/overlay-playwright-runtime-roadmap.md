# overlay-playwright-runtime Roadmap

## Scope

This roadmap covers the next layer above the current `overlay-playwright-runtime` skill: turning it from a capable adoption and live-inspection toolkit into a dependable audit operator for messy real apps.

## Success Criteria

1. An agent can choose a named audit modality without inventing orchestration from scratch.
2. A run can produce a standard artifact set with stable names and paths.
3. App boot, readiness, and auth or pairing flows have explicit operator guidance and helpers.
4. Temporary audit-only adoption can avoid leaving repo churn behind.
5. The roadmap remains implementable directory-by-directory without needing the whole repo in working memory at once.

## Evidence Summary

### What already exists

- The repo already documents two user-facing modes, `adopt` and `operate`, in the skill bundle: [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/SKILL.md](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/SKILL.md).
- The local sandbox and plugin distribution are already first-class concepts in the repo docs: [README.md](../README.md).
- The runtime and client boundary is real and useful:
  - the live client is `js_repl` safe and intentionally avoids file IO: [playwright/overlay-client-live.mjs](../playwright/overlay-client-live.mjs)
  - the full client adds file-oriented failure packaging: [playwright/overlay-client.mjs](../playwright/overlay-client.mjs)
- The sandbox launcher already owns the browser lifecycle, desktop/mobile page helpers, agent UI defaults, and runtime injection: [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/assets/sandbox/launch-session.mjs](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/assets/sandbox/launch-session.mjs).
- The runtime already exposes enough control for agents to:
  - apply presets
  - configure UI state
  - annotate notes and arrows
  - save and read session state
  Evidence: [src/overlay/40-utils.js](../src/overlay/40-utils.js), [src/overlay/80-runtime.js](../src/overlay/80-runtime.js), [src/overlay/30-state.js](../src/overlay/30-state.js).
- Test coverage already exists for:
  - client delegation and artifact writing: [tests/verify_overlay_client.mjs](../tests/verify_overlay_client.mjs)
  - sandbox boot and basic live flow: [tests/verify_overlay_sandbox.mjs](../tests/verify_overlay_sandbox.mjs)

### What is missing

- The skill still stops at the toolkit layer. It does not yet provide a first-class audit operator workflow.
- `buildAuditBundle(...)` still returns HTML content rather than a saved artifact path, which pushes packaging work to the agent: [playwright/overlay-client-live.mjs](../playwright/overlay-client-live.mjs), [playwright/overlay-client.mjs](../playwright/overlay-client.mjs).
- The skill has no explicit readiness strategy beyond the current live-session examples. It acknowledges that a real readiness contract is not yet exposed: [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/SKILL.md](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/SKILL.md).
- Auth and pairing flows are not modeled as first-class operator modes.
- Temporary audit-only adoption is not yet formalized even though vendoring is already deterministic via the skill bundle: [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/scripts/vendor_overlay_runtime.py](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/scripts/vendor_overlay_runtime.py).

## Numbered Roadmap

### 1. Add first-class audit modalities

Goal: move from generic `operate` to explicit audit entrypoints.

#### 1.1 Define the operator-facing modalities

- `audit-local-web`
- `audit-authenticated-web`
- `audit-desktop-shell`

Why:
- The current skill combines local iteration, evidence capture, and adoption, but not a named audit path.
- The critique from real-world use showed that the largest time sink was orchestration, not overlay capability.

#### 1.2 Reflect those modalities in the skill docs and prompt metadata

- Update the skill overview and mode-selection text in:
  - [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/SKILL.md](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/SKILL.md)
  - [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/agents/openai.yaml](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/agents/openai.yaml)
- Add short “use this when…” guidance for each modality.

#### 1.3 Add thin modality entry helpers

Start in the sandbox layer rather than the runtime:
- add helpers or documented wrappers around `createOverlaySandboxSession(...)`
- keep the initial implementation shallow and deterministic
- do not introduce app-specific logic into the runtime itself

### 2. Standardize the artifact contract

Goal: every audit mode should be able to emit a predictable artifact set.

#### 2.1 Add file-oriented audit helpers

New helper targets in [playwright/overlay-client.mjs](../playwright/overlay-client.mjs):
- `buildReportToFile(...)`
- `buildAuditBundleToFile(...)`
- `writeAuditArtifactSet(...)`

`writeAuditArtifactSet(...)` should produce:
- `artifact-index.json`
- `report.md`
- `desktop.html`
- `mobile.html`
- `desktop.jpg` or `desktop.png`
- `mobile.jpg` or `mobile.png`
- optional `contract.json`
- optional `report.json`

#### 2.2 Keep the live client pure

Do not add filesystem writes to [playwright/overlay-client-live.mjs](../playwright/overlay-client-live.mjs).

Why:
- it is intentionally `js_repl` safe
- the split between live control and artifact writing is already a good boundary

#### 2.3 Reuse the sandbox output directory consistently

Thread the sandbox `outputDir` through the new audit helpers so naming is standardized and runs do not invent ad hoc layouts.

### 3. Add readiness and boot strategies

Goal: stop forcing agents to improvise around blank pages and modern app loading behavior.

#### 3.1 Add named readiness strategies in the sandbox helper layer

Candidates:
- `dom-marker`
- `route-match`
- `selector-visible`
- `custom-wait`

Likely home:
- [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/assets/sandbox/launch-session.mjs](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/assets/sandbox/launch-session.mjs)

#### 3.2 Add operator guidance for bad startup states

Document concrete triage cases:
- blank page
- error boundary
- backend unavailable
- infinite loading or websocket wait
- wrong dev-server port

This belongs in:
- [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/references/interactive.md](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/references/interactive.md)

#### 3.3 Delay any runtime-level readiness contract

Do not force this into `src/overlay/` yet.

Why:
- the current runtime explicitly lacks a stable readiness API
- the next useful layer is operator strategy, not runtime speculation

### 4. Add auth and pairing workflow support

Goal: make authenticated and paired apps a first-class path instead of an improvisation.

#### 4.1 Add documented auth patterns

Document flows for:
- token in URL
- token input form
- waiting for post-auth route
- preserving session across reloads
- pairing screens

#### 4.2 Add optional helper hooks in the sandbox session

Potential helpers:
- `waitForRoute(...)`
- `waitForSelectorReady(...)`
- `preserveSession(...)`

Keep them generic rather than app-specific.

### 5. Add temporary audit-only adoption

Goal: support audit runs that need runtime vendoring without leaving the target repo modified by default.

#### 5.1 Extend the vendoring script or wrap it with a temporary mode

Target file:
- [plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/scripts/vendor_overlay_runtime.py](../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/scripts/vendor_overlay_runtime.py)

Desired behavior:
- vendor runtime files into the repo
- perform the audit run
- automatically clean up unless the user explicitly requests durable adoption

#### 5.2 Keep durable adoption unchanged

Do not regress the current deterministic bundle-copy flow.

### 6. Add a canonical report template

Goal: stop forcing each audit run to invent its own Markdown summary shape.

#### 6.1 Introduce a reusable report template in the skill bundle

Suggested sections:
- Executive summary
- Run context
- Desktop findings summary
- Mobile findings summary
- Priority issues
- Artifact links
- Environment blockers
- Recommended fix order

Likely home:
- `plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/references/`

#### 6.2 Make the new file-oriented helpers populate it

`writeAuditArtifactSet(...)` should be able to emit `report.md` from this template with stable headings.

### 7. Expand tests to cover the operator layer

Goal: keep the new orchestration layer honest.

#### 7.1 Extend client tests

Add coverage for:
- `buildReportToFile(...)`
- `buildAuditBundleToFile(...)`
- `writeAuditArtifactSet(...)`

Target:
- [tests/verify_overlay_client.mjs](../tests/verify_overlay_client.mjs)

#### 7.2 Extend sandbox tests

Add coverage for:
- audit-local-web happy path
- readiness strategy selection
- artifact output structure

Target:
- [tests/verify_overlay_sandbox.mjs](../tests/verify_overlay_sandbox.mjs)

### 8. Keep docs and distribution aligned

Goal: make the install surface, operate surface, and audit surface tell the same story.

#### 8.1 Update repo docs

- [README.md](../README.md) should describe the operator split:
  - adopt
  - operate
  - audit

#### 8.2 Update plugin and skill metadata

- plugin description should mention audit workflows once they exist
- prompt examples should include the new audit entrypoints

## Sub-task Breakdown by Directory

### Root

- Update [README.md](../README.md)
- Keep high-level docs aligned with the new modality model

### `playwright/`

- Add the new file-oriented helper methods in [overlay-client.mjs](../playwright/overlay-client.mjs)
- Keep [overlay-client-live.mjs](../playwright/overlay-client-live.mjs) live-session only

### `src/overlay/`

- Only change runtime code when the operator layer truly needs new capabilities
- Avoid forcing readiness policy into the runtime prematurely

### `plugins/overlay-playwright-runtime/`

- Add audit modality docs
- add report template assets
- expand sandbox helper behavior
- extend vendoring flow for temporary audit-only adoption

### `tests/`

- Add coverage for:
  - file-oriented artifact writing
  - audit-mode happy paths
  - readiness strategy wiring

## Recommended Execution Order

1. `playwright/overlay-client.mjs` file-oriented audit helpers
2. skill report template and standardized artifact layout
3. sandbox audit-local-web happy path
4. readiness strategy layer
5. auth and pairing patterns
6. temporary audit-only adoption
7. docs and metadata cleanup

## Notes

- Keep the runtime lean. Most remaining work belongs in the client, sandbox, and skill layers.
- Prefer additive operator helpers over broad rewrites.
- Preserve the current architecture boundary:

```text
Playwright actions -> Overlay client -> overlay runtime semantic surface
```
