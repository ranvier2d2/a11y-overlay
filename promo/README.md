# Promo Pipeline

This directory contains the scene-based capture pipeline for promo clips and assembled cuts.

## Why it exists

The demo is deterministic, so the cleanest workflow is:

1. capture stable scene clips with Playwright
2. assemble cuts from those clips with FFmpeg
3. regenerate captions and voiceover notes from the same scene metadata

That keeps clip logic, copy, and cut order editable without redoing the whole video workflow by hand.

## Setup

Install the local Node dependency once:

```bash
npm install
```

The pipeline expects Google Chrome to be installed locally. It uses `playwright-core` with the system `chrome` channel instead of downloading Playwright-managed browsers.

## Commands

List scenes and cuts:

```bash
npm run promo:capture -- --list
```

Capture every scene in draft mode:

```bash
npm run promo:capture -- --profile draft
```

Capture only the scenes needed for the agent cut:

```bash
npm run promo:capture -- --profile draft --cut agent
```

Assemble previously captured cuts:

```bash
npm run promo:assemble -- --profile draft --cut agent --cut human
```

Run the full capture + assemble flow:

```bash
npm run promo:render -- --profile draft --cut agent --cut human
```

Prepare the Remotion asset sync:

```bash
npm run promo:remotion:prepare
```

List Remotion compositions:

```bash
npm run promo:remotion:compositions
```

Open Remotion Studio:

```bash
npm run promo:remotion:studio
```

Render the current Remotion cuts:

```bash
npm run promo:remotion:render:agent
npm run promo:remotion:render:human
```

## Structure

- `config.mjs` - profiles, cuts, and scene registry
- `capture.mjs` - Playwright scene capture
- `assemble.mjs` - FFmpeg concat and caption assembly
- `render.mjs` - capture then assemble
- `scenes/` - one module per scene
- `lib/` - CLI parsing, local server, and FFmpeg helpers
- `remotion/` - polished React compositions driven by the packaged asset pack
- `remotion-assets/` - source-of-truth clips, stills, and copy for the Remotion layer

## Outputs

Generated files land in:

```text
output/promo/<profile>/
```

Per scene:

- `scenes/<scene-id>/clip.webm`
- `scenes/<scene-id>/poster.png`
- `scenes/<scene-id>/trace.zip`
- `scenes/<scene-id>/scene.json`

Per cut:

- `cuts/<cut-id>/<cut-id>.mp4`
- `cuts/<cut-id>/<cut-id>.vtt`
- `cuts/<cut-id>/<cut-id>-voiceover.txt`
- `cuts/<cut-id>/<cut-id>-story.md`

## First-pass scenes

- `landing-hero`
- `demo-inject`
- `agent-preset`
- `contract-panel`
- `json-report`
- `html-report`
- `human-slices`
- `install-card`
- `privacy-page`
