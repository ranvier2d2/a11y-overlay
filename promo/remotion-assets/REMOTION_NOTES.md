# Remotion Notes

This is the recommended direction for the next promo pass.

## Why Remotion is a better fit

Official Remotion docs line up with what this project needs:

- Remotion positions itself as programmatic video in React, with local and server rendering and a Studio for previewing and scrubbing:
  - https://www.remotion.dev/
- `<Sequence>` time-shifts and trims scenes frame-by-frame, which is the right primitive for turning this asset pack into a timeline:
  - https://www.remotion.dev/docs/sequence
- `<Series>` stitches scenes one after another, which maps cleanly to the current `agent` and `human` story flows:
  - https://www.remotion.dev/docs/series
- `<AbsoluteFill>` is the base layering primitive for full-frame backgrounds, overlays, UI chrome, and captions:
  - https://www.remotion.dev/docs/absolute-fill
- `<Img>` waits for images to load before rendering a frame, which is useful for hero stills and evidence cards:
  - https://www.remotion.dev/docs/img
- `<OffthreadVideo>` extracts exact video frames outside the browser using FFmpeg, which is a better source primitive for scene clips than a generic HTML video tag:
  - https://www.remotion.dev/docs/offthreadvideo
- The captions docs cover importing and displaying subtitles, and exporting either burned-in captions or sidecar subtitles:
  - https://www.remotion.dev/docs/captions
- `@remotion/transitions` provides `TransitionSeries`, timings, and built-in presentations like fade, slide, wipe, and flip:
  - https://www.remotion.dev/docs/transitions
- The Remotion Player can embed and parameterize the composition inside a React app for iteration:
  - https://www.remotion.dev/docs/player

## What to build next

Build a small Remotion app with:

1. One composition for `AgentPromo`
2. One composition for `HumanPromo`
3. Shared scene components for:
   - hero opener
   - runtime contract
   - JSON report
   - HTML handoff report
   - human slice tour
   - install/privacy close
4. Props for:
   - headline copy
   - scene order
   - subtitle visibility
   - theme and background treatment

## Suggested first technical approach

- Use `stills/landing-hero.png` and `stills/landing-full.png` as layered backgrounds
- Use `clips/*.webm` as source footage inside tightly framed scene components
- Put all copy in a typed data file and render it through React instead of baking it into raw screen recordings
- Start with simple `fade()` and `slide()` transitions only
- Burn captions in only after the motion and layout feel right

## Practical implication

The current Playwright pipeline is still useful, but only as an asset generator.
The final promo should be assembled in Remotion, not by concatenating captured clips directly.
