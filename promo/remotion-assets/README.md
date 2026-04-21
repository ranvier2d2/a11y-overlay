# Remotion Asset Pack

This folder packages the current promo source material into one place for a Remotion rebuild.

## What is inside

- `stills/` - curated static images for hero frames, proof cards, and overlays
- `clips/` - short deterministic scene clips and their poster frames
- `copy/` - subtitles, voiceover notes, and scene-order story files
- `references/` - canonical product pages to mirror or re-screenshot in a composition

## Recommended use

Use this pack as the source for a code-based Remotion composition:

1. Build the video from `clips/*.webm` and `stills/*.png`
2. Use `copy/*.vtt` and `copy/*-voiceover.txt` as starter subtitle and narration sources
3. Recreate product framing and motion in React instead of relying on the screen-recorded cuts
4. Keep `references/*.html` nearby for layout truth and for any re-capture pass

## Suggested priority assets

For the agent version:

- `stills/landing-hero.png`
- `stills/github-overlay-default.png`
- `stills/github-overlay-focus.png`
- `clips/demo-inject.webm`
- `clips/agent-preset.webm`
- `clips/contract-panel.webm`
- `clips/json-report.webm`
- `clips/html-report.webm`

For the human version:

- `stills/landing-full.png`
- `stills/reference-overlay-proof.png`
- `stills/demo-summary-proof.png`
- `clips/human-slices.webm`
- `clips/install-card.webm`
- `clips/privacy-page.webm`

## Why this pack exists

The generated draft `mp4`s were useful for proving the capture pipeline, but they are not the right final medium.
This folder is the cleaner source layer for a Remotion timeline: stills, short clips, copy, and reference pages.
