# Agent Runtime Gap-Closure Roadmap

## Goal

Make `a11y-overlay` genuinely useful as execution context and failure diagnostics for Playwright and browser-agent teams, not just as a visual inspection overlay.

The product is already useful for:

- structure-aware human audits
- contract-backed inspection in deterministic fixtures
- report and audit-bundle generation

The product is not yet strong enough to fully support the stronger promise now implied by the landing page:

- read structure before acting
- wait on a meaningful stable state
- keep a durable failure package
- help agents re-find the right target after a rerender

## Current Truth

Today the runtime exposes a versioned public contract with reports, presets, export helpers, session persistence, and teardown:

- `collectDetections()`
- `buildReport(format, opts)`
- `buildAuditBundle(opts)`
- `downloadReport(format, opts)`
- `downloadAuditBundle(opts)`
- `getAutomationContract()`
- `listPresets()`
- `applyPreset(id, opts)`
- `saveSession()` / `clearSavedSession()` / `getSessionSnapshot()`
- `render()` / `teardown()`
- `state`

That makes the runtime a good inspection layer. It does not yet make it a complete execution-context layer for agents.

## What Is Missing

| Gap | Why it matters | Current limitation | Priority |
| --- | --- | --- | --- |
| No readiness contract | Agents need to know when a page is stable enough to act | No `getReadyState()` or `waitForStableState()` surface exists | High |
| No stable target references in findings | Agents need to re-resolve a finding after DOM movement or rerender | Findings include rects and metadata, but not a durable locator payload | High |
| No frame or shadow traversal in scanning | Modern apps often hide relevant UI inside same-origin iframes or open shadow roots | Detectors scan the top-level `document` only | High |
| Weak Playwright-native evidence bundle | Extension capture is useful, but the primary buyer is already using Playwright | Bundle export is strongest in extension mode and weaker in browser automation mode | High |
| No task-oriented query surface | Reports explain the page but do not help the agent choose the next target | No `queryTargets`, `rankTargets`, or `resolveTarget` API | Medium |
| No benchmark proving better agent outcomes | The claim needs task-level proof, not only audit-level proof | Current tests prove contract/report correctness, not task success improvement | Medium |

## Definition of Done

We should consider the runtime useful "as promised" for browser agents when all of the following are true:

1. An agent can ask the runtime whether the page is stable enough for the next step.
2. A finding or candidate target includes enough information to be re-resolved after a rerender.
3. The runtime can inspect same-origin frames and open shadow roots, or explicitly report unsupported gaps.
4. A Playwright worker can produce a durable failure package without depending on extension-only capture.
5. The runtime can return ranked candidate targets for a declared intent.
6. We can show, with fixtures and benchmark tasks, that agent runs are more reliable with the runtime than without it.

## Design Principles

- Keep the runtime framework-free and static.
- Extend the existing contract instead of replacing it.
- Make changes additive and versioned.
- Keep the same data useful for humans, CI, and browser agents.
- Expose capability gaps explicitly rather than silently failing.

## Proposed Contract Additions

These should be introduced as a contract version bump, because they materially expand what agents can depend on.

### 1. Readiness surface

```js
getReadyState() => {
  contractVersion: 2,
  stable: boolean,
  phase: "loading" | "settling" | "ready" | "unsupported",
  quietMs: number,
  lastChangeAt: string,
  reasons: string[],
  capabilities: {
    mutationTracking: boolean,
    frameTraversal: boolean,
    shadowTraversal: boolean
  }
}

waitForStableState({ quietMs = 300, timeoutMs = 5000 }) => Promise<ReadyState>
```

### 2. Stable reference payloads

Every detection and report finding should gain a `stableRef` object:

```js
stableRef: {
  selector: string,
  framePath: number[],
  shadowPath: string[],
  tag: string,
  role: string,
  accessibleName: string,
  textSnippet: string
}
```

This is the minimum needed for a Playwright helper to re-resolve the same node later.

### 3. Target query surface

```js
queryTargets({
  text,
  role,
  kind,
  limit = 5
}) => RankedTarget[]

resolveStableRef(stableRef) => RankedTarget | null
```

Where `RankedTarget` includes:

- `stableRef`
- `score`
- `reason`
- `rect`
- `meta`

### 4. Capability surface

Expand `capabilities` to make scanning and evidence limits explicit:

```js
capabilities: {
  extensionRuntime: boolean,
  viewportCapture: boolean,
  readyState: boolean,
  sameOriginFrames: boolean,
  openShadowRoots: boolean,
  targetQuery: boolean
}
```

## Phase Plan

## Phase 1: Stable References and Report Enrichment

### Objective

Make every detection and report finding re-targetable by an agent.

### Files

- `src/overlay/40-utils.js`
- `src/overlay/50-detectors.js`
- `src/overlay/80-runtime.js`
- `tests/verify_overlay.py`
- `tests/fixtures/`

### Work

1. Add a `stableRefForElement(el)` helper.
2. Include `stableRef` in `detectionRecord()`.
3. Include `stableRef` in serialized report findings.
4. Add `accessibleName`, `role`, and `tag` to the top-level serialized payload where useful.
5. Add a resolver helper and fixture tests that survive a simple rerender.

### Acceptance

- Every interactive, focus, repeat, alt, and form finding includes `stableRef`.
- A fixture test can rerender a section and still resolve the same logical target from `stableRef`.
- The report schema version and contract version both bump with explicit changelog notes.

## Phase 2: Readiness Contract

### Objective

Give agents a meaningful answer to "can I act now?"

### Files

- `src/overlay/30-state.js`
- `src/overlay/40-utils.js`
- `src/overlay/70-render.js`
- `src/overlay/80-runtime.js`
- `demo.js`
- `tests/verify_overlay.py`
- `reference.html`

### Work

1. Track mutation quiet time and last structural change time.
2. Track whether the overlay has completed at least one successful detection pass.
3. Implement `getReadyState()`.
4. Implement `waitForStableState({ quietMs, timeoutMs })`.
5. Surface readiness in `demo.html` as actual runtime state, not just "injected successfully."

### Acceptance

- A delayed fixture transitions from `loading` to `settling` to `ready`.
- `waitForStableState()` resolves on stable fixtures and times out with explicit reasons on unstable ones.
- The demo status panel reflects real readiness state.

## Phase 3: Same-Origin Frames and Open Shadow Roots

### Objective

Make scanning reflect the way production apps are actually built.

### Files

- `src/overlay/50-detectors.js`
- `src/overlay/40-utils.js`
- `src/overlay/80-runtime.js`
- `tests/fixtures/`
- `tests/verify_overlay.py`

### Work

1. Traverse same-origin iframes and record a `framePath`.
2. Traverse open shadow roots and record a `shadowPath`.
3. Add explicit unsupported markers for cross-origin frames and closed shadow roots where visibility matters.
4. Merge findings into one report while preserving context.

### Acceptance

- A fixture with a same-origin iframe and an open shadow root produces findings from both contexts.
- Report findings preserve context with `framePath` and `shadowPath`.
- Unsupported contexts are surfaced explicitly in diagnostics instead of silently disappearing.

## Phase 4: Playwright-Native Failure Package

### Objective

Make the failure package first-class for the primary buyer, even without the extension.

### Files

- `src/overlay/50-detectors.js`
- `src/overlay/80-runtime.js`
- `README.md`
- `tests/verify_overlay.py`
- new helper under `playwright/` or `examples/`

### Work

1. Keep `downloadAuditBundle()` as the extension-aware path.
2. Add a documented Playwright helper that combines:
   - `buildReport('json')`
   - `getAutomationContract()`
   - `page.screenshot()`
   - optional DOM snapshot or trace metadata
3. Standardize one failure package layout for Playwright use.
4. Add a deterministic test that assembles the package from Playwright.

### Acceptance

- A Playwright worker can produce a complete evidence package without extension-only APIs.
- The package contains report JSON, contract snapshot, viewport image, and page URL/title.
- The README shows the canonical agent path separately from the extension path.

## Phase 5: Target Query and Ranking

### Objective

Stop making every agent invent its own target ranking logic.

### Files

- `src/overlay/40-utils.js`
- `src/overlay/50-detectors.js`
- `src/overlay/80-runtime.js`
- `reference.html`
- `tests/verify_overlay.py`

### Work

1. Implement `queryTargets()` with text, role, and kind filters.
2. Rank candidates using visible text, role match, accessible name, and current geometry.
3. Return `reason` and `score` alongside each candidate.
4. Add fixture coverage for repeated cards and ambiguous controls.

### Acceptance

- A fixture query like `{ text: "Review run", role: "link" }` returns deterministic candidate ordering.
- The top result remains stable after non-destructive rerenders.
- The query surface is documented as additive, not as a replacement for Playwright locators.

## Phase 6: Benchmark Harness

### Objective

Prove the runtime improves agent outcomes instead of only producing richer artifacts.

### Files

- `tests/fixtures/`
- `tests/verify_overlay.py`
- new benchmark script under `tests/` or `benchmarks/`
- `docs/`

### Work

1. Define 3 to 5 canonical agent tasks on deterministic fixtures.
2. Run each task with:
   - baseline Playwright locator strategy
   - runtime-assisted strategy
3. Measure:
   - task success
   - retries
   - rerender recovery
   - artifact quality on failure
4. Publish the results in a small benchmark note.

### Acceptance

- Runtime-assisted flows outperform or meaningfully explain failures better than baseline on at least 3 benchmark tasks.
- The benchmark can run locally and in CI.

## Recommended Shipping Order

Ship in this order:

1. Stable references
2. Readiness contract
3. Same-origin frame and open shadow traversal
4. Playwright-native failure package
5. Target query and ranking
6. Benchmark harness

This order matters because the first three items create the minimum credible execution-context layer. The later items make it pleasant, measurable, and easier to adopt.

## Non-Goals for This Roadmap

- Cross-origin frame introspection beyond explicit unsupported diagnostics
- Replacing Playwright locators entirely
- Autonomous action planning inside the overlay runtime
- Framework migration or backend services
- Analytics or telemetry

## First Milestone

The first milestone should be:

**"An agent can wait for stable state, collect findings with durable references, and export a Playwright-native failure package from a deterministic rerendering fixture."**

If we cannot do that, then the current product is still closer to an audit overlay than to the agent runtime described on the site.
