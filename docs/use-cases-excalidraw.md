# Overlay Runtime Use Cases

This file captures the buyer-led use cases introduced by the new landing page and guided demo surface.
The structure below is also the source outline for an Excalidraw-safe Mermaid diagram generated from the same content.

## Buyer-Led Surface

- Primary buyer: automation and platform teams running Playwright or browser agents.
- Adjacent users: frontend engineers and accessibility reviewers who consume the same evidence.
- Core jobs: read structure before acting, wait on stable rendered state, and keep the failure package after a broken run.

## Site Story Flow

- The landing page explains what the runtime is, who it is for, and why DOM-only or screenshot-only tooling is insufficient.
- The primary CTA sends the user to the guided demo.
- The secondary CTA sends the user to the local extension install path.

## Guided Demo Flow

- Open `demo.html`.
- Load `reference.html` in a same-origin iframe.
- Inject `a11y-overlay.js`.
- Wait for the runtime to install and settle.
- Apply the `agent-capture` preset.
- Read the automation contract and generate JSON or HTML reports.

## Core Product Use Cases

- Pre-action context for browser agents before click or input.
- Readiness gating before a step executes.
- Failure diagnostics after a flaky or blocked run.
- Evidence export for post-run review and handoff.
- Local evaluation with extension runtime when available.

## Product Boundary

- Not a generic overlay UI.
- Semantic execution runtime for browser automation.
- Queryable diagnostics and durable post-run evidence.

### Excalidraw-Safe Mermaid

The diagrams below stay within the conservative Mermaid subset that imports cleanly into Excalidraw.
The consolidated companion output generated with the `excalidraw-mermaid-safe` skill is saved in `docs/use-cases-excalidraw.mmd`.

```mermaid
flowchart LR
  A["Overlay Runtime for Browser Agents"] --> B["Automation and Platform Team"]
  A --> C["Frontend Engineer"]
  A --> D["Accessibility Reviewer"]
  B --> E["Read structure before acting"]
  B --> F["Wait for stable rendered state"]
  B --> G["Keep failure package after a broken run"]
  C --> G
  D --> G
```

```mermaid
flowchart LR
  A["Landing Page"] --> B["What this is"]
  B --> C["Who it is for"]
  C --> D["Why DOM-only and screenshot-only fall short"]
  D --> E["How the runtime loop works"]
  E --> F["What the runtime contract exposes"]
  F --> G["What proof survives a failed run"]
  G --> H["Try Demo"]
  G --> I["Load Extension Locally"]
  H --> J["Guided Demo"]
```

```mermaid
flowchart LR
  A["Open demo.html"] --> B["Load reference.html in iframe"]
  B --> C["Inject a11y-overlay.js"]
  C --> D["Wait for runtime install and ready state"]
  D --> E["Apply agent-capture preset"]
  E --> F["Read automation contract"]
  F --> G["Build live summary"]
  G --> H["Build JSON report"]
  G --> I["Build HTML report"]
  G --> J["Download audit bundle when extension runtime is available"]
```

```mermaid
flowchart LR
  A["Core Product Use Cases"] --> B["Pre-action context before click or input"]
  A --> C["Readiness gating before a step executes"]
  A --> D["Failure diagnostics after a flaky or blocked run"]
  A --> E["Evidence export for post-run review"]
  A --> F["Local evaluation with extension runtime"]
```

```mermaid
flowchart LR
  A["Not the Product"] --> B["Generic overlay UI"]
  A --> C["One-off screenshot only"]
  A --> D["Manual inspection only"]
  E["Product Boundary"] --> F["Semantic execution runtime"]
  E --> G["Queryable diagnostics"]
  E --> H["Durable post-run evidence"]
  B -.-> F
  C -.-> G
  D -.-> H
```
