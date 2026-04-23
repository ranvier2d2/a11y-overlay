# Adoption Notes

## Purpose

Use the overlay runtime as a semantic inspection layer for Playwright and browser-agent workflows.
It helps answer:

- what structure is visible right now
- which preset should be active for this run
- what report or evidence should be captured after a failure

It does **not** replace Playwright as the action engine.

For persistent local debugging, this reference is intentionally incomplete. Use `references/interactive.md` for the `js_repl` session pattern and browser reuse guidance.

## Canonical Repo Files

The reusable files are:

- `a11y-overlay.js`
- `playwright/overlay-client.mjs`

In this skill, those files are bundled locally under `assets/runtime/` so `adopt`
does not need to fetch from GitHub each time it runs.

The operate sandbox is separate from this path. `adopt` should not create or edit a
target repo `package.json` unless the user explicitly asks for dependency integration help.

## Playwright Usage Pattern

Basic pattern:

```js
import { OverlayClient } from './playwright/overlay-client.mjs';

const client = new OverlayClient();

await client.inject(page);
await client.applyPreset(page, 'agent-capture', { announce: false });

const report = await client.buildReport(page, 'json', { scope: 'all' });
```

Failure package pattern:

```js
const artifacts = await client.writeFailurePackage(page, {
  dir: './artifacts/case-001',
  scope: 'all',
  includeHtmlReport: true,
  includeAuditBundle: true,
  fullPage: true
});
```

## Where This Fits

Use this adoption path when:

- another repo needs the overlay runtime files vendored in
- the user wants reproducible semantic reports in CI
- the browser session does not need to stay alive between turns

Preferred packaging model:

1. install the skill or plugin once
2. vendor from the installed bundled assets
3. commit the vendored files into the target repo when that repo should own them

## Compatibility-aware vendoring

The bundled vendor script now treats identical files as compatible:

- if the target repo already has the same `a11y-overlay.js`, it is reused
- if the target repo already has the same `playwright/overlay-client.mjs`, it is reused
- only divergent files are treated as conflicts that require `--force`

This makes repeat adoption and cross-repo maintenance less noisy.

## Temporary audit-only adopt mode

For audit runs that should not leave vendored files behind, use:

```bash
python3 scripts/vendor_overlay_runtime.py \
  --target-root /absolute/path/to/repo \
  --temporary
```

That writes a vendoring manifest under:

```text
.codex/overlay-playwright-runtime/vendor-manifest.json
```

After the audit run, clean up the copied files with:

```bash
python3 scripts/vendor_overlay_runtime.py \
  --target-root /absolute/path/to/repo \
  --cleanup
```

Cleanup is conservative:

- files copied by the temporary run are removed
- files changed after vendoring are preserved
- the manifest is removed only when cleanup completes fully

Do not use this as the only guidance for local iterative QA in Codex. In that case, prefer the persistent browser/session path from `references/interactive.md`.

## Recommended Agent Flow

1. Inject runtime.
2. Read `getAutomationContract()`.
3. Apply `agent-capture`.
4. Build JSON report.
5. Use Playwright for clicks, typing, and assertions.
6. On failure, write a failure package.

If the task includes responsive checks, visual iteration, or repeated debugging, keep the Playwright session alive and rerun these steps in the same browser context instead of recreating everything from scratch.

## Current Limits

- No runtime readiness primitive yet.
- No stable target query API yet.
- No frame or open-shadow traversal contract yet.

Treat the current runtime as:

- inspection
- diagnostics
- evidence packaging

Do not describe it as a complete autonomous action-selection layer until those gaps are closed.
