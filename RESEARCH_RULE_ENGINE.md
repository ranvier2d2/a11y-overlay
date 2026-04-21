# Research Pass: Rule Engine for `a11y-overlay`

Date: 2026-04-19

## Scope

This document defines how `a11y-overlay` should turn accessibility and UI/UX guidance into page-level detectors and inspector output.

The core decision is to **not** treat all guidance the same. The extension should separate:

1. **Normative rules**: official standards with stable pass/fail criteria.
2. **Advisory conventions**: strong platform guidance that is useful but not universal.
3. **Heuristics**: review signals that deserve attention but should never be presented as conformance failures.

## Success Criteria for Future Slices

Every slice should declare:

- `rule_type`: `normative`, `advisory`, or `heuristic`
- `severity_default`: `error`, `warning`, or `info`
- `confidence`: `high`, `medium`, or `low`
- `source_url`: at least one canonical source
- `detector_shape`: what the page-level detector actually measures
- `inspector_rows`: what the inspector should explain for a selected finding

## Source Hierarchy

Use sources in this order:

1. **W3C WAI / WCAG / HTML / ARIA** for web accessibility rules
2. **Official platform guidance** such as Apple Developer and Android Developers for strong design conventions
3. **Heuristics explicitly marked as heuristics** when there is no canonical source

Memory is useful for triage and drafting, but thresholds should only be encoded after checking primary sources.

## Facts Confirmed in Primary Sources

### 1. Target size on the web

- WCAG 2.2 AA target size minimum is based on a **24 by 24 CSS pixel** target area, with a **spacing exception** for undersized targets:
  - https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- WCAG 2.2 AAA target size enhanced is **44 by 44 CSS pixels**:
  - https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced

### 2. Images and `alt`

- Decorative images should use **empty `alt=""`** rather than omit `alt`:
  - https://www.w3.org/WAI/tutorials/images/decorative/
- WAI’s image decision tree is the right canonical model for deciding whether an image is decorative, functional, informative, redundant, or complex:
  - https://www.w3.org/WAI/tutorials/images/decision-tree/

### 3. Forms and labels

- Inputs requiring user input need **labels or instructions**:
  - https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions
- WAI’s forms tutorial recommends associating labels explicitly or implicitly and explains when `aria-label` / `aria-labelledby` are appropriate:
  - https://www.w3.org/WAI/tutorials/forms/labels/
- The ARIA APG accessible naming guidance states that `title` and `placeholder` are fallback naming mechanisms and generally lower quality than explicit labels:
  - https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/

### 4. Label in name

- Visible labels and accessible names should align so speech users can invoke controls predictably:
  - https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html

### 5. Contrast

- Text contrast minimum is **4.5:1** for normal text and **3:1** for large text:
  - https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
- Non-text contrast minimum is **3:1** for visual information needed to identify controls and states:
  - https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html

### 6. Focus quality

- Focus order must preserve meaning and operability:
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
- Focus must be visible:
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-visible
- WCAG 2.2 adds focus-not-obscured guidance:
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- WCAG 2.2 AAA adds focus appearance metrics:
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

### 7. Platform guidance for touch targets

These are not universal web conformance rules, but they are strong advisory references for touch-first UI:

- Apple recommends controls of at least **44pt x 44pt**:
  - https://developer.apple.com/design/tips/
- Android recommends touch targets of at least **48dp x 48dp**:
  - https://developer.android.com/design/ui/mobile/guides/foundations/accessibility
  - https://developer.android.com/guide/topics/ui/accessibility/apps

## Rule Taxonomy for the Extension

| Rule Type | Meaning | UI Treatment |
|---|---|---|
| `normative` | Based on a primary accessibility standard with concrete criteria | `error` or `warning`, source-backed |
| `advisory` | Strong official guidance, but not universal web conformance | `warning`, clearly labeled advisory |
| `heuristic` | Review aid without stable pass/fail source | `info` or `warning`, clearly labeled heuristic |

## Slice Matrix

| Slice | Rule Type | Severity Default | Confidence | Detector Shape | Inspector Rows | Canonical Sources |
|---|---|---:|---:|---|---|---|
| Targets too small | Normative + advisory overlay | `error` for WCAG AA under 24x24 and failing spacing exception; optional `warning` for platform advice | High | Interactive elements whose target box cannot contain a 24x24 CSS px square; later add advisory overlays for 44pt / 48dp profiles | `role`, `name`, `size`, `adjacent targets`, `wcag_result`, `advisory_profiles` | WCAG 2.5.8, WCAG 2.5.5, Apple, Android |
| Image audit | Normative + heuristic | `error` for `<img>` missing `alt`; `info` for alt present; `warning` for suspicious empty alt on likely-informative image | High for missing `alt`, low-medium for informative/decorative guesses | Start with visible `<img>` elements, then enrich with alt state; treat CSS background images as separate advisory class | `alt_state`, `alt_text`, `src`, `decorative_markers`, `image_role`, `source_type` | WAI decorative images, alt decision tree, APG names/descriptions |
| Forms / labeling audit | Normative + advisory | `error` for unlabeled required controls / controls with no accessible name; `warning` for placeholder-only or title-only fallback names | High | Inputs, selects, textareas, buttons, grouped controls; test for accessible name source and associated instructions | `role`, `name_source`, `visible_label`, `placeholder`, `title`, `required`, `instruction_binding` | WCAG 3.3.2, WAI forms labels, APG names/descriptions |
| Label in name | Normative | `warning` (not every mismatch is equally severe, but it is source-backed) | High | For controls with visible text near the component, compare visible label prefix vs computed accessible name | `visible_label`, `accessible_name`, `match_type`, `speech_risk` | WCAG 2.5.3 |
| Text contrast | Normative | `error` | High once implemented with reliable sampling | Compute foreground/background contrast for visible text and image-text; separate normal vs large text | `text_sample`, `font_size`, `font_weight`, `contrast_ratio`, `required_ratio` | WCAG 1.4.3 |
| Non-text contrast | Normative | `warning` or `error` depending on certainty | Medium-high | Borders, icons, focus rings, state indicators that are required to identify control or state | `element_type`, `indicator_type`, `contrast_ratio`, `required_ratio` | WCAG 1.4.11 |
| Focus quality | Mixed normative | `warning` / `error` depending on sub-check | Medium | Existing tab-order detector can be extended into: odd sequence, nested focusables, missing visible focus, focus obscured by sticky overlays | `tab_order`, `nested_focus`, `focus_visible`, `focus_obscured`, `state_change` | WCAG 2.4.3, 2.4.7, 2.4.11, 2.4.13 |
| Truncation / overflow | Heuristic | `warning` | Medium | Detect text boxes with `ellipsis`, `line-clamp`, clipped overflow, horizontal scroll, cut-off labels | `visible_text`, `full_text_if_available`, `overflow_mode`, `container_size` | No stable normative web source for general “avoid truncation”; treat as heuristic |
| Repeats outlier detection | Heuristic | `warning` | Medium | Within repeated groups, find items whose structure, action count, media presence, or text length diverges from siblings | `group_size`, `index`, `outlier_reason`, `peer_signature` | No canonical standard; treat as review heuristic |
| Nested scroll regions | Heuristic with some standard relevance | `warning` | Medium | Find scrollable regions inside scrollable regions, sticky content obscuring content, horizontal overflow | `scroll_axes`, `ancestor_scroll`, `sticky_overlap`, `focus_risk` | WCAG focus-not-obscured is relevant to overlap, but nested scroll itself is still a heuristic |
| CTA density / action hierarchy | Heuristic | `info` / `warning` | Low-medium | Count competing actions inside a visual block and flag unusually dense areas | `action_count`, `primary_guess`, `adjacent_action_count` | No canonical standard; heuristic only |
| Spacing / density balance | Heuristic | `info` | Low | Infer crowded or visually imbalanced blocks from spacing ratios | `gap_estimate`, `content_density`, `small_target_overlap` | No canonical standard; heuristic only |

## Immediate Product Decisions

### Keep `A` narrow for now

Current `A` behavior is correct for a first normative slice:

- visible `<img>`
- no `alt`
- not `role="presentation"`
- not `aria-hidden="true"`

This should remain the default meaning of `A` until the image slice is expanded.

### Do not encode “component names”

Internal component names are rarely available on production websites and are not a reliable basis for UX review.

Instead, prefer:

- semantic role
- accessible name
- DOM path
- structural signature such as `card > img, h3, p, button`
- repeat context such as `x4 siblings · item 2`

### Separate “conformance” from “review”

In the UI, every finding should visibly declare one of:

- `Standard`
- `Advisory`
- `Heuristic`

The extension should never present heuristic findings as if they were WCAG failures.

## Recommended Implementation Order

1. **Targets too small**
   - Most objective next slice
   - Strong standards basis
   - High UX value

2. **Image audit**
   - Natural extension of existing `A`
   - Strong standards basis
   - High product clarity

3. **Forms / labeling audit**
   - Very high utility
   - Strong standards basis
   - Excellent inspector fit

4. **Label in name**
   - Narrow, source-backed, and valuable
   - Good addition once form/control inspection is richer

5. **Focus quality**
   - Builds directly on current tab-order work
   - Strong standards basis

6. **Text contrast**
   - High value, but implementation quality matters
   - Better after the extension has a clearer severity model

7. **Truncation / overflow**
   - Useful for review, but keep heuristic

8. **Repeats outlier detection**
   - Useful design-review signal, but heuristic

## Implementation Policy

Before implementing any slice:

1. Define the **rule type**
2. Link the **source**
3. Write the **detector logic**
4. Decide the **severity**
5. Decide the **inspector rows**
6. Document any **known false-positive zones**

## Open Questions

1. Should the toolbar expose a filter by `Standard / Advisory / Heuristic`?
2. Should platform advisory profiles such as `Apple 44pt` and `Android 48dp` be opt-in?
3. Should `A` remain a single mode, or eventually split into:
   - `Alt errors`
   - `Image audit`
4. Should heuristic slices be disabled by default until the user opts into “review mode”?
