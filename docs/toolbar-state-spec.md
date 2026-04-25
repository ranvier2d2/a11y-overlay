# Toolbar Behavior and State Spec for `a11y-overlay`

Date: 2026-04-19

## Purpose

This document defines how the overlay toolbar should behave once the extension supports:

- source-backed accessibility findings
- advisory platform profiles
- heuristic review slices
- annotation tools
- inspector-driven detail panels

The goal is to make the toolbar predictable. Each control must have a single job:

- **global mode switch**
- **slice toggle**
- **placement mode**
- **selection action**
- **utility action**

No button should ambiguously behave like both a mode and a one-shot action.

## Product Principles

1. **Conformance and review are different jobs**
   - Conformance answers: "what is clearly wrong?"
   - Review answers: "what deserves attention?"

2. **Heuristics must never masquerade as standards**
   - If a finding is heuristic, the UI must say so.

3. **Toolbar state must be legible**
   - A button is either:
     - inactive
     - active
     - disabled
     - armed for placement

4. **Text entry suspends overlay hotkeys**
   - When the user is typing in a note or another overlay input, global hotkeys are off.

## State Model

The overlay should be modeled with a small explicit runtime state.

```ts
type LayerMode = "conformance" | "review";
type PlacementMode = "none" | "note" | "arrow";
type SelectionKind = "none" | "finding" | "note" | "arrow";
type TouchProfile = "web-default" | "apple-44pt" | "android-48dp" | "both";
type FocusContext = "page" | "overlay-text-entry" | "overlay-control";

type OverlayState = {
  layerMode: LayerMode;
  landmark: boolean;
  heading: boolean;
  interact: boolean;
  form: boolean;
  target: boolean;
  alt: boolean;
  repeat: boolean;
  focus: boolean;
  depth: boolean;
  grid: boolean;
  placementMode: PlacementMode;
  selection: {
    kind: SelectionKind;
    id: string | null;
  };
  inspector: {
    open: boolean;
    findingId: string | null;
  };
  exportWindowOpen: boolean;
  helpOpen: boolean;
  focusContext: FocusContext;
  touchProfile: TouchProfile;
};
```

Public snapshots, presets, and persisted sessions may serialize those slice flags
as an `enabledSlices` object with the same keys.

## Main Axes of Behavior

### 1. Global layer mode

This is the main product-level switch:

- `conformance`
- `review`

#### `conformance`

Visible findings may include only:

- `Standard`
- `Advisory`

Heuristic slices are not active in this mode.

#### `review`

Visible findings may include:

- `Standard`
- `Advisory`
- `Heuristic`

This mode is intentionally noisier and intended for UI review work.

## Slice Classification

Each slice must declare its minimum layer:

```ts
type SliceMeta = {
  id: string;
  label: string;
  findingType: "standard" | "advisory" | "heuristic" | "mixed";
  minLayer: "conformance" | "review";
};
```

Examples:

- `Landmarks`: `standard`, `conformance`
- `Headings`: `standard`, `conformance`
- `ALT errors`: `standard`, `conformance`
- `Targets too small`: `mixed`, `conformance`
- `Repeats outlier`: `heuristic`, `review`
- `Truncation`: `heuristic`, `review`

## Toolbar Rules

### Global modes

The toolbar should expose a single top-level layer switch:

- `Conformance`
- `Review`

This should be visually distinct from slice buttons.

Recommended placement:

- left side of the toolbar, before slice toggles
- compact two-state segmented control

### Slice buttons

Slice buttons are visibility toggles, not global modes.

A slice button can be:

- `inactive`: slice hidden
- `active`: slice visible
- `disabled`: unavailable because the runtime cannot perform that action
- `busy`: recomputing

A `slice button` for `heuristic slices` is not `disabled` only because the toolbar is in `conformance mode`.
Pressing it should switch the layer control to `Review` and make that slice `active`.

### Placement buttons

Placement buttons arm an interaction mode:

- `NOTE`
- `ARROW`

These are not persistent visibility filters. They arm the next placement action.

### Utility buttons

Utility buttons do one thing immediately:

- `COPY PNG`
- `SAVE PNG`
- `?`
- close button

These should never act as toggled modes.

## Expected Button Behavior

### `Conformance`

When pressed:

1. set `layerMode = "conformance"`
2. hide all findings from heuristic slices
3. keep heuristic toggle memory internally, but do not render them
4. if inspector is open on a heuristic finding, close the inspector

### `Review`

When pressed:

1. set `layerMode = "review"`
2. restore active heuristic slices that were previously enabled
3. allow heuristic inspector panels again

### Heuristic slice press while in `conformance`

Recommended behavior:

1. switch to `review`
2. activate the pressed heuristic slice
3. show a small status message such as:
   - `Review mode enabled`

This is better than a dead disabled click because it teaches the model without friction.

## Default Startup State

```ts
{
  layerMode: "conformance",
  landmark: true,
  heading: true,
  interact: false,
  form: false,
  target: false,
  alt: true,
  repeat: false,
  focus: false,
  depth: false,
  grid: false,
  placementMode: "none",
  selection: { kind: "none", id: null },
  inspector: { open: false, findingId: null },
  exportWindowOpen: false,
  helpOpen: true,
  focusContext: "page",
  touchProfile: "web-default"
}
```

Notes:

- startup should expose the low-noise content baseline: landmarks, headings, and image semantics
- heuristic slices should remain off until `Review` or explicit heuristic-slice activation
- advisory platform profiles should be off by default

## `A` Slice Decision

For now, `A` should remain a single slice with narrow semantics.

Recommended label:

- `IMG ALT`

Recommended meaning in the current phase:

- visible `<img>`
- missing `alt`
- excluding presentation / hidden cases

This keeps the slice honest.

### Future split

Later, it may split into:

- `ALT ERRORS`
- `IMAGE AUDIT`

But not before image semantics become materially richer.

## Advisory Touch Profiles

Touch target platform advice should not be active by default.

### Setting

Use a small settings panel, not a toolbar button.

Allowed values:

- `web-default`
- `apple-44pt`
- `android-48dp`
- `both`

### Semantics

- `web-default`: only WCAG-backed target checks
- `apple-44pt`: add advisory warnings using Apple sizing guidance
- `android-48dp`: add advisory warnings using Android sizing guidance
- `both`: show both advisory profiles

### Severity model

- WCAG 24x24 failure: `Standard`
- Apple / Android misses: `Advisory`

They must not share the same severity badge.

## Heuristic Policy

Heuristic slices should be inactive by default, not `disabled`.

They are available only when:

- the user switches to `Review`, or
- the user clicks a heuristic slice, which auto-switches to `Review`

Each heuristic finding should show:

- `Type: Heuristic`
- `Reason`
- `Why it may matter`

This is important because heuristic findings are not proof of a defect.

## Annotation State Rules

### Placement modes

Only one placement mode may be armed at a time:

- `none`
- `note`
- `arrow`

Entering one placement mode clears the other.

### `NOTE`

When pressed:

1. set `placementMode = "note"`
2. toolbar shows armed state
3. next valid page click places a note
4. after placement, keep note focused for editing
5. set `focusContext = "overlay-text-entry"`

### `ARROW`

When pressed:

1. set `placementMode = "arrow"`
2. first page click sets start point
3. second page click sets end point
4. after completion, set `placementMode = "none"`

### `DESELECT`

Recommended semantics:

- button label: `DESELECT`
- hotkey: `V`

When pressed:

1. clear selected note or arrow
2. clear selected finding highlight
3. exit any placement mode
4. keep active slices unchanged

### Empty-space click

When the user clicks empty page space outside:

- note body
- note controls
- arrow handles
- inspector
- toolbar

Then:

1. clear selection
2. keep slices as they are
3. keep layer mode as it is
4. do not close the overlay

## Hotkey Gate

This should be strict.

### When `focusContext = "overlay-text-entry"`

Suspend overlay hotkeys for:

- all slice toggles
- note placement
- arrow placement
- deselect
- delete
- export shortcuts

Allowed exceptions:

- browser-native shortcuts
- standard text editing keys
- optional `Escape` if implemented as "blur current editor"

### When `focusContext = "overlay-control"`

Hotkeys may remain active except when a control consumes the keystroke directly.

### When `focusContext = "page"`

Overlay hotkeys are fully active.

## Inspector Behavior

The inspector is tied to a selected finding.

### Open inspector

Triggered by:

- clicking a finding label
- clicking a badge

Effects:

1. `selection.kind = "finding"`
2. `selection.id = findingId`
3. `inspector.open = true`
4. `inspector.findingId = findingId`

### Close inspector

Triggered by:

- clicking close in inspector
- switching to `conformance` while inspector shows heuristic finding
- selecting empty space

Effects:

1. `inspector.open = false`
2. `inspector.findingId = null`
3. if no annotation is selected, set `selection = none`

## Inspector Content Contract

Every finding inspector should show these rows:

- `Type`: `Standard`, `Advisory`, or `Heuristic`
- `Slice`
- `Severity`
- `Why flagged`
- `Evidence`
- `Path` or structural signature

Optional rows by slice:

- `Role`
- `Accessible name`
- `Visible label`
- `Alt state`
- `Target size`
- `Contrast ratio`
- `Repeat context`
- `Source`

## Visual States

### Toolbar button appearance

Recommended meanings:

- neutral dark = inactive
- bright slice color = active
- dimmed = unavailable runtime action
- accent outline = armed placement mode
- temporary status text = one-shot action feedback

### Finding badges

Recommended mapping:

- red or pink = `Standard`
- amber = `Advisory`
- violet or cyan = `Heuristic`

The exact palette can vary, but the category must remain legible.

## State Transition Diagram

```text
                  +------------------+
                  |  CONFORMANCE     |
                  |  std + advisory  |
                  +---------+--------+
                            |
          press Review      | press heuristic slice
                            v
                  +------------------+
                  |     REVIEW       |
                  | std + adv + heu  |
                  +---------+--------+
                            |
            press Conformance
                            v
                  +------------------+
                  |  CONFORMANCE     |
                  +------------------+


      +---------+   NOTE press   +---------+
      |  idle   | -------------> | note    |
      | place=0 |                | armed   |
      +----+----+                +----+----+
           ^                          |
           |     deselect / V         | place note
           |                          v
      +----+----+                +---------+
      | selected | <------------ | editing |
      | item     |   click note  | note    |
      +----+----+                +----+----+
           ^                          |
           | empty click / V          | blur editor
           +--------------------------+
```

## Recommended Implementation Order

1. Add `layerMode` to runtime state
2. Add slice metadata with `minLayer`
3. Add toolbar segmented control: `Conformance / Review`
4. Gate heuristic slice activation behind `review`
5. Rename `A` to a narrower label such as `IMG ALT`
6. Add settings storage for `touchProfile`
7. Add finding `Type` row to inspector
8. Add explicit hotkey suppression based on `focusContext`

## Out of Scope for This Spec

- exact CSS styling
- persistence format for all settings
- contrast engine implementation details
- final inspector layout visuals
- complex multi-select behavior

This spec is only about behavior and state semantics.
