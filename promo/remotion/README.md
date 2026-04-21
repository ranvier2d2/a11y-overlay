# Remotion Promo Layer

This directory turns the packaged promo assets into editable Remotion compositions.

## Workflow

The promo pipeline is split into two parts:

1. `promo/remotion-assets/` is the source-of-truth asset pack.
2. `promo/remotion/` turns that pack into polished video cuts.

Before Studio or a render runs, `promo/remotion/sync-assets.mjs` copies the asset
pack into `public/remotion-assets/`, which is where Remotion expects static files.

## Commands

Prepare the static assets:

```bash
npm run promo:remotion:prepare
```

List compositions:

```bash
npm run promo:remotion:compositions
```

Open Remotion Studio:

```bash
npm run promo:remotion:studio
```

Render the current agent cut:

```bash
npm run promo:remotion:render:agent
```

Render the current human cut:

```bash
npm run promo:remotion:render:human
```

## Edit Surface

Most tweaks should stay in a few files:

- `src/data/cuts.js` - scene order, durations, copy, and cut-level framing
- `src/theme.js` - palette, spacing, and typography tokens
- `src/components/PromoComposition.jsx` - layout and motion treatment
- `src/components/PromoMedia.jsx` - preview/render media behavior

## Notes

- Studio uses `Html5Video` for fast preview.
- Final renders switch to `OffthreadVideo` for frame-accurate extraction.
- The clips were captured at `25fps`, so composition timing is kept at `25fps`.
