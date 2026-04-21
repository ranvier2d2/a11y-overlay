# ASCII Storyboards

These are layout diagrams for the four representative Remotion proof frames:

- `output/remotion/frames/agent-01.jpg`
- `output/remotion/frames/agent-02.jpg`
- `output/remotion/frames/human-01.jpg`
- `output/remotion/frames/human-02.jpg`

They are composition diagrams, not pixel-level ASCII renders.

## Agent 01

`agent-01.jpg`

```text
+--------------------------------------------------------------------------------------------------+
|                                     dark washed still background                                 |
|                                                                                                  |
|  LEFT COPY COLUMN                                             RIGHT MEDIA COLUMN                 |
|  +------------------------------------------------------+    +--------------------------------+  |
|  | OVERLAY RUNTIME                                      |    | [Context first]               |  |
|  | ---------- accent rule ----------                    |    |                                |  |
|  | [dot] For agents  01 / 06                            |    |  landing hero demo clip       |  |
|  |                                                      |    |  large browser surface        |  |
|  | CONTEXT FIRST                                        |    |                                |  |
|  | Give agents context                                  |    |                                |  |
|  | before they click.                                   |    |                         +----+ |  |
|  |                                                      |    |                         |mini| |  |
|  | Start from a page state that can be                  |    |                         |proof| |  |
|  | inspected and replayed, not a blind                  |    |                         +----+ |  |
|  | screenshot and a guess.                              |    |                                |  |
|  |                                                      |    +--------------------------------+  |
|  | [Runtime contract] [Stable waiting] [Evidence bundle]                                       |
|  +------------------------------------------------------+                                        |
|                                                                                                  |
|  progress bar ----------------------------------------------------------------------             |
|  Give browser agents context before they click.              Overlay runtime for browser agents  |
+--------------------------------------------------------------------------------------------------+
```

## Agent 02

`agent-02.jpg`

```text
+--------------------------------------------------------------------------------------------------+
|                                     dark washed still background                                 |
|                                                                                                  |
|  LEFT COPY COLUMN                                             RIGHT MEDIA COLUMN                 |
|  +------------------------------------------------------+    +--------------------------------+  |
|  | OVERLAY RUNTIME                                      |    | [Live contract]               |  |
|  | ---------- accent rule ----------                    |    |                                |  |
|  | [dot] For agents  04 / 06                            |    |  contract panel demo clip     |  |
|  |                                                      |    |  browser page with runtime    |  |
|  | LIVE CONTRACT                                        |    |  contract / JSON visible      |  |
|  | Read the live contract                               |    |                                |  |
|  | instead of guessing                                  |    |                         +----+ |  |
|  | what the page exposes.                               |    |                         |mini| |  |
|  |                                                      |    |                         |proof| |  |
|  | The clip keeps the current contract                  |    |                         +----+ |  |
|  | visible while the runtime state                      |    |                                |  |
|  | changes underneath it.                               |    +--------------------------------+  |
|  |                                                      |                                        |
|  | [Runtime contract] [Stable waiting] [Evidence bundle]                                       |
|  +------------------------------------------------------+                                        |
|                                                                                                  |
|  progress bar ---------------------------------------------------------                          |
|  Read the live runtime contract instead of guessing what the page exposes.                      |
|                                                                  Overlay runtime for agents     |
+--------------------------------------------------------------------------------------------------+
```

## Human 01

`human-01.jpg`

```text
+--------------------------------------------------------------------------------------------------+
|                                     dark washed still background                                 |
|                                                                                                  |
|  LEFT COPY COLUMN                                             RIGHT MEDIA COLUMN                 |
|  +------------------------------------------------------+    +--------------------------------+  |
|  | OVERLAY RUNTIME                                      |    | [Readable slices]             |  |
|  | ---------- accent rule ----------                    |    |                                |  |
|  | [dot] For humans  02 / 04                            |    |  human-slices demo clip       |  |
|  |                                                      |    |  page covered with overlay    |  |
|  | READABLE SLICES                                      |    |  diagnostics and slice labels |  |
|  | Toggle interactives,                                 |    |                                |  |
|  | forms, targets, and tab                              |    |                         +----+ |  |
|  | order on a real page.                                |    |                         |mini| |  |
|  |                                                      |    |                         |proof| |  |
|  | Each slice stays visible long enough                 |    |                         +----+ |  |
|  | to inspect, compare, and explain                     |    |                                |  |
|  | without pausing the demo.                            |    +--------------------------------+  |
|  |                                                      |                                        |
|  | [Visual inspection] [Preset slices] [Local privacy]                                        |
|  +------------------------------------------------------+                                        |
|                                                                                                  |
|  progress bar ------------------------------------                                               |
|  Toggle interactives, forms, targets, and tab order on a real page.                             |
|                                                                  Overlay runtime for local reviews|
+--------------------------------------------------------------------------------------------------+
```

## Human 02

`human-02.jpg`

```text
+--------------------------------------------------------------------------------------------------+
|                                     dark washed still background                                 |
|                                                                                                  |
|  LEFT COPY COLUMN                                             RIGHT MEDIA COLUMN                 |
|  +------------------------------------------------------+    +--------------------------------+  |
|  | OVERLAY RUNTIME                                      |    | [Local privacy]               |  |
|  | ---------- accent rule ----------                    |    |                                |  |
|  | [dot] For humans  04 / 04                            |    |  privacy page demo clip       |  |
|  |                                                      |    |  local-only / no analytics    |  |
|  | LOCAL PRIVACY                                        |    |  policy copy visible          |  |
|  | Keep the data path local,                            |    |                                |  |
|  | with no analytics and no                             |    |                         +----+ |  |
|  | remote code.                                         |    |                         |mini| |  |
|  |                                                      |    |                         |proof| |  |
|  | The closing shot lands the product                   |    |                         +----+ |  |
|  | promise clearly without switching                    |    |                                |  |
|  | to a different environment.                          |    +--------------------------------+  |
|  |                                                      |                                        |
|  | [Visual inspection] [Preset slices] [Local privacy]                                        |
|  +------------------------------------------------------+                                        |
|                                                                                                  |
|  progress bar ------------------------------------------------------                             |
|  Runs locally, with no analytics and no remote code.                                             |
|                                                                  Overlay runtime for local reviews|
+--------------------------------------------------------------------------------------------------+
```

## Shared frame grammar

Every screenshot is using the same structural pattern:

```text
+----------------------------------------------------------------------------------------------+
| background wash                                                                              |
|                                                                                              |
| left narrative panel                          right captured clip + small proof inset         |
|                                                                                              |
| full-width progress bar + caption                                                    brand   |
+----------------------------------------------------------------------------------------------+
```
