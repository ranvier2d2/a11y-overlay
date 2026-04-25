# Image Audit Spec for `A`

Date: 2026-04-19

## Goal

Evolve the current `A` slice from a narrow `missing alt` check into a broader `Image audit`
without making the overlay visually noisy.

The UX rule is:

- `A` remains a single shortcut and a single toolbar slice
- the canvas shows only findings that deserve attention by default
- the inspector carries the richer explanation
- future reporting/export should be powered by the same structured findings

## Product Semantics

`A` means:

- audit the accessibility state of visible images
- classify image findings into `Standard` and `Advisory`
- keep likely-pass states available for inspector/report, not for noisy default painting

## Phase Order

### Phase 1

Implement classification for visible `<img>` elements:

- `alt-missing`
- `alt-present`
- `img-presentation`
- `img-aria-hidden`
- `alt-empty-decorative`
- `alt-empty-suspicious`

### Phase 2

Add:

- `functional-image-missing-name`

### Phase 3

Add:

- `background-image-content-risk`

## Visibility Policy

### Paint by default

- `alt-missing`
- `alt-empty-suspicious`
- later: `functional-image-missing-name`
- later: `background-image-content-risk`

### Do not paint by default

- `alt-present`
- `img-presentation`
- `img-aria-hidden`
- `alt-empty-decorative`

These still exist as findings for inspector/reporting.

## Finding Taxonomy

| Kind | Type | Severity | Confidence | Default canvas |
|---|---|---:|---:|---|
| `alt-missing` | `standard` | `error` | `high` | yes |
| `alt-present` | `standard` | `pass` | `high` | no |
| `img-presentation` | `standard` | `pass` | `high` | no |
| `img-aria-hidden` | `standard` | `pass` | `high` | no |
| `alt-empty-decorative` | `standard` | `pass` | `medium` | no |
| `alt-empty-suspicious` | `advisory` | `warning` | `medium` | yes |

## Detection Rules

### `alt-missing`

Applies when:

- element is a visible `<img>`
- `alt` attribute is absent
- `role="presentation"` is not present
- `aria-hidden="true"` is not present

### `alt-present`

Applies when:

- visible `<img>`
- `alt` exists and is non-empty

### `img-presentation`

Applies when:

- visible `<img>`
- `role="presentation"`

### `img-aria-hidden`

Applies when:

- visible `<img>`
- `aria-hidden="true"`

### `alt-empty-decorative`

Applies when:

- visible `<img alt="">`
- and decorative markers suggest decoration is plausible:
  - small image footprint
  - repeated ornament-like usage
  - likely redundant with nearby text
  - not inside interactive control

### `alt-empty-suspicious`

Applies when:

- visible `<img alt="">`
- and content markers suggest it may carry meaning:
  - large image footprint
  - isolated content image
  - hero/card/media role
  - no obvious nearby text redundancy

## Finding Contract

Every image finding should emit:

```ts
type ImageFindingMeta = {
  kind: string;
  sliceKey: "alt";
  findingType: "standard" | "advisory";
  severity: "error" | "warning" | "info" | "pass";
  confidence: "high" | "medium" | "low";
  summary: string;
  whyFlagged: string;
  evidence: Array<{ label: string; value: string }>;
  sources: Array<{
    label: string;
    url: string;
    type: "standard" | "advisory";
  }>;
  suggestedFix: string;
  altState: string;
  altText?: string;
  sourceType: "img";
  showInCanvas?: boolean;
};
```

## Inspector Rows

The inspector should show:

- `Type`
- `Severity`
- `Confidence`
- `Why flagged`
- `Evidence`
- `Source`
- `Suggested fix`

Then slice-specific image rows:

- `Alt state`
- `Alt text`
- `Source type`
- `Image src`
- `Decorative markers`
- `Interactive context`

## Overlay Labels

Keep labels short:

- `MISSING alt`
- `EMPTY alt ?`

Phase 1 does not paint pass states, so they do not need overlay labels yet.

## Sources

Primary references:

- WAI Images Tutorial: Decorative Images
  - https://www.w3.org/WAI/tutorials/images/decorative/
- WAI Images Decision Tree
  - https://www.w3.org/WAI/tutorials/images/decision-tree/

When image naming intersects interactive controls in later phases:

- ARIA APG Names and Descriptions
  - https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/

## Export / Report Readiness

The image slice should be implemented so future report export can group findings by:

- `Errors`
- `Advisories`
- `Passed / informational`

with:

- summary
- explanation
- evidence
- sources
- confidence
- suggested fix

The report should be generated from structured findings, not from screenshot parsing.
