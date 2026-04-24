  // ---------- host shadow DOM for UI chrome ----------
  const host = document.createElement('div');
  host.id = NS + '-host';
  host.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${Z};`;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .layer { position: fixed; inset: 0; pointer-events: none; }
      .mark {
        position: absolute;
        box-sizing: border-box;
        pointer-events: none;
        font-family: ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace;
      }
      .mark.inspectable .tag,
      .mark.inspectable .badge {
        pointer-events: auto;
        cursor: pointer;
      }
      .mark.inspectable .tag:hover,
      .mark.inspectable .badge:hover {
        filter: brightness(1.08);
      }
      .mark.inspect-hit {
        pointer-events: auto;
        cursor: pointer;
      }
      .mark.inspect-hit:hover {
        outline: 1px dashed rgba(148,163,184,0.55) !important;
        outline-offset: 0 !important;
      }
      .mark.inspect-hit.ghost {
        outline: 1px solid transparent !important;
      }
      .mark.inspected {
        box-shadow: 0 0 0 2px rgba(255,255,255,0.8), inset 0 0 0 1px rgba(12,10,9,0.28);
      }
      .mark .tag {
        position: absolute;
        top: -1px;
        left: -1px;
        transform: translateY(-100%);
        padding: 2px 6px;
        font-size: 10px;
        line-height: 1.2;
        letter-spacing: 0.02em;
        color: #0c0a09;
        white-space: nowrap;
        font-weight: 600;
      }
      .mark .tag.bottom {
        transform: none;
        top: auto;
        bottom: -1px;
        left: -1px;
      }
      .mark .tag.quiet {
        background: transparent !important;
        color: #94a3b8;
        font-weight: 500;
        opacity: 0.7;
      }
      .badge {
        position: absolute;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        font-size: 10px;
        font-weight: 700;
        line-height: 18px;
        text-align: center;
        font-family: ui-monospace, monospace;
        color: white;
      }
      .toolbar {
        position: fixed;
        top: 12px;
        right: 12px;
        max-width: calc(100vw - 24px);
        pointer-events: auto;
        background: #0c0a09;
        color: #e7e5e4;
        border: 1px solid #44403c;
        padding: 6px 8px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        line-height: 1.5;
        display: flex;
        gap: 4px;
        align-items: center;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      }
      .toolbar.hidden {
        display: none;
      }
      .toolbar.agent-desktop {
        top: auto;
        bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        right: 12px;
        max-width: min(calc(100vw - 24px), 1280px);
      }
      .toolbar::-webkit-scrollbar { display: none; }
      .toolbar.compact {
        padding: 5px 6px;
        gap: 3px;
      }
      .toolbar.tight {
        width: calc(100vw - 24px);
        max-width: none;
        flex-wrap: wrap;
        row-gap: 4px;
        overflow-x: visible;
      }
      .toolbar .title {
        color: #a3e635;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 0 6px 0 4px;
        border-right: 1px solid #292524;
        margin-right: 4px;
      }
      .toolbar.compact .title {
        padding-right: 4px;
        margin-right: 2px;
      }
      .toolbar.tight .title {
        padding-right: 6px;
        margin-right: 4px;
      }
      .toolbar .seg {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 2px;
        border: 1px solid #292524;
        background: #14110f;
      }
      .toolbar .segbtn {
        background: transparent;
        border: 1px solid transparent;
        color: #a8a29e;
        padding: 3px 7px;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        cursor: pointer;
        text-transform: uppercase;
      }
      .toolbar .segbtn:hover {
        color: #f5f5f4;
      }
      .toolbar .segbtn.on {
        background: #e7e5e4;
        border-color: #e7e5e4;
        color: #0c0a09;
      }
      .toolbar .tbtn {
        background: transparent;
        border: 1px solid #292524;
        color: #78716c;
        padding: 3px 7px;
        font: inherit;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.05em;
        cursor: pointer;
        display: inline-flex;
        gap: 5px;
        align-items: center;
        text-transform: uppercase;
      }
      .toolbar .tbtn:hover { border-color: #57534e; color: #e7e5e4; }
      .toolbar .tbtn.on { color: #0c0a09; border-color: currentColor; }
      .toolbar .tbtn.review-only {
        border-color: #3f3f46;
        color: #57534e;
      }
      .toolbar .tbtn.review-only:hover {
        border-color: #a78bfa;
        color: #ddd6fe;
      }
      .toolbar .tbtn .kbd {
        font-size: 9px;
        opacity: 0.6;
      }
      .toolbar .tbtn.on .kbd { opacity: 0.9; }
      .toolbar .sep { width: 1px; align-self: stretch; background: #292524; margin: 2px 4px; }
      .toolbar.compact .sep { margin: 2px 2px; }
      .toolbar.tight .sep { margin: 2px 3px; }
      .toolbar .close {
        background: transparent;
        border: 1px solid #44403c;
        color: #fb7185;
        padding: 3px 7px;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }
      .toolbar .close:hover { background: #fb7185; color: #0c0a09; }
      .toolbar .collapse {
        background: transparent;
        border: 1px solid #44403c;
        color: #22d3ee;
        padding: 3px 7px;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        text-transform: uppercase;
      }
      .toolbar .collapse:hover { background: #22d3ee; color: #0c0a09; }
      .toolbar .status {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #a8a29e;
        font-size: 10px;
        padding: 0 4px;
      }
      .toolbar .status.success { color: #a3e635; }
      .toolbar .status.error { color: #fb7185; }
      .toolbar .status.mode { color: #22d3ee; }
      .toolbar .status.paused { color: #facc15; }
      .toolbar.mobile {
        top: calc(10px + env(safe-area-inset-top, 0px));
        left: calc(10px + env(safe-area-inset-left, 0px));
        right: calc(10px + env(safe-area-inset-right, 0px));
        padding: 10px 12px;
        gap: 10px;
        justify-content: space-between;
      }
      .toolbar.mobile.agent {
        padding: 8px 10px;
        gap: 8px;
      }
      .toolbar.mobile .mobile-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1 1 auto;
      }
      .toolbar.mobile.agent .mobile-brand {
        gap: 6px;
      }
      .toolbar.mobile .mobile-title {
        color: #a3e635;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .toolbar.mobile .mobile-summary {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .toolbar.mobile .mobile-summary .eyebrow {
        color: #a8a29e;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .toolbar.mobile .mobile-summary .value {
        color: #fafaf9;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .toolbar.mobile.agent .mobile-summary .eyebrow {
        font-size: 9px;
      }
      .toolbar.mobile.agent .mobile-summary .value {
        font-size: 11px;
      }
      .toolbar.mobile .mobile-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }
      .toolbar.mobile .mobile-chip {
        border: 1px solid #292524;
        background: #14110f;
        color: #a8a29e;
        padding: 5px 8px;
        border-radius: 999px;
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .toolbar.mobile .mobile-close {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #44403c;
        background: transparent;
        color: #fb7185;
        font: inherit;
        font-size: 16px;
        font-weight: 700;
        border-radius: 10px;
        cursor: pointer;
      }
      .toolbar.mobile.agent .mobile-close {
        width: 32px;
        height: 32px;
      }
      .toolbar.mobile .mobile-close:hover {
        background: #fb7185;
        color: #0c0a09;
      }
      .mobile-dock {
        position: fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        right: calc(10px + env(safe-area-inset-right, 0px));
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        display: none;
        gap: 8px;
        padding: 8px;
        pointer-events: auto;
        background: rgba(12, 10, 9, 0.98);
        color: #e7e5e4;
        border: 1px solid #44403c;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.55);
      }
      .mobile-dock.open { display: flex; }
      .mobile-dock.agent {
        gap: 6px;
        padding: 6px;
      }
      .mobile-dock .dockbtn {
        flex: 1 1 0;
        min-width: 0;
        border: 1px solid #292524;
        background: #14110f;
        color: #a8a29e;
        border-radius: 12px;
        padding: 8px 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
        justify-content: center;
        font: inherit;
        cursor: pointer;
      }
      .mobile-dock.agent .dockbtn {
        padding: 8px 4px;
        gap: 3px;
      }
      .mobile-dock .dockbtn:hover {
        border-color: #57534e;
        color: #e7e5e4;
      }
      .mobile-dock .dockbtn.on {
        color: #0c0a09;
        border-color: currentColor;
      }
      .mobile-dock .dockbtn .dock-icon {
        width: 24px;
        height: 24px;
        border-radius: 8px;
        border: 1px solid currentColor;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
      }
      .mobile-dock.agent .dockbtn .dock-icon {
        width: 22px;
        height: 22px;
        border-radius: 7px;
      }
      .mobile-dock .dockbtn .dock-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .mobile-dock .dockbtn .dock-meta {
        font-size: 9px;
        color: rgba(231, 229, 228, 0.72);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .mobile-dock.agent .dockbtn .dock-meta {
        display: none;
      }
      .agent-launcher {
        position: fixed;
        right: 12px;
        bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        display: none;
        align-items: center;
        gap: 8px;
        pointer-events: auto;
        z-index: 2147483647;
      }
      .agent-launcher.open {
        display: flex;
      }
      .agent-launcher .agent-chip,
      .agent-launcher .agent-close {
        appearance: none;
        border: 1px solid #44403c;
        background: rgba(12, 10, 9, 0.92);
        color: #e7e5e4;
        padding: 8px 12px;
        border-radius: 999px;
        font: inherit;
        font-size: 11px;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        backdrop-filter: blur(10px);
      }
      .agent-launcher .agent-chip {
        color: #a3e635;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .agent-launcher .agent-close {
        color: #fb7185;
        font-weight: 700;
      }
      .agent-launcher .agent-chip:hover {
        border-color: #a3e635;
      }
      .agent-launcher .agent-close:hover {
        border-color: #fb7185;
        background: rgba(64, 12, 20, 0.92);
      }
      .mobile-modebar {
        position: fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        right: calc(10px + env(safe-area-inset-right, 0px));
        bottom: calc(88px + 16px + env(safe-area-inset-bottom, 0px));
        display: none;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        pointer-events: auto;
        background: rgba(12, 10, 9, 0.98);
        color: #e7e5e4;
        border: 1px solid #44403c;
        border-radius: 16px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.55);
      }
      .mobile-modebar.open { display: flex; }
      .mobile-modebar .mode-copy {
        min-width: 0;
        flex: 1 1 auto;
      }
      .mobile-modebar .mode-copy .eyebrow {
        color: #a3e635;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .mobile-modebar .mode-copy .value {
        margin-top: 3px;
        color: #fafaf9;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 700;
      }
      .mobile-modebar .mode-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
      }
      .mobile-modebar .modebtn {
        border: 1px solid #292524;
        background: #14110f;
        color: #a8a29e;
        border-radius: 12px;
        padding: 7px 9px;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .mobile-modebar .modebtn.on {
        color: #0c0a09;
        border-color: currentColor;
      }
      .mobile-modebar .modebtn.ghost {
        color: #e7e5e4;
        border-color: #57534e;
      }
      .mobile-modebar .modebtn.danger {
        color: #fb7185;
        border-color: #fb7185;
      }
      .mobile-sheet-backdrop {
        position: fixed;
        inset: 0;
        display: none;
        pointer-events: auto;
        background: rgba(0,0,0,0.42);
      }
      .mobile-sheet-backdrop.open { display: block; }
      .mobile-sheet {
        position: fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        right: calc(10px + env(safe-area-inset-right, 0px));
        bottom: calc(88px + 14px + env(safe-area-inset-bottom, 0px));
        display: none;
        overflow: auto;
        pointer-events: auto;
        background: #0c0a09;
        color: #e7e5e4;
        border: 1px solid #44403c;
        border-radius: 18px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.5);
        font-family: ui-monospace, monospace;
      }
      .mobile-sheet.open { display: block; }
      .mobile-sheet[data-detent="peek"] {
        max-height: min(34vh, 300px);
      }
      .mobile-sheet[data-detent="medium"] {
        max-height: min(58vh, 520px);
      }
      .mobile-sheet[data-detent="full"] {
        max-height: min(78vh, calc(100vh - 168px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)));
      }
      .mobile-sheet-handle {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 14px 2px;
        background: linear-gradient(180deg, rgba(12,10,9,0.98), rgba(12,10,9,0.92));
      }
      .mobile-sheet-detent {
        border: 0;
        background: transparent;
        color: #a8a29e;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0;
        font: inherit;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .mobile-sheet-detent .knob {
        width: 48px;
        height: 5px;
        border-radius: 999px;
        background: #44403c;
      }
      .mobile-sheet-head {
        position: sticky;
        top: 26px;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 14px 12px;
        background: rgba(12,10,9,0.98);
        border-bottom: 1px solid #292524;
      }
      .mobile-sheet-head .eyebrow {
        color: #a8a29e;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .mobile-sheet-head .title {
        margin-top: 4px;
        color: #fafaf9;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }
      .mobile-sheet-close {
        border: 1px solid #44403c;
        background: transparent;
        color: #a8a29e;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        font: inherit;
        font-size: 16px;
        cursor: pointer;
      }
      .mobile-sheet-close:hover {
        border-color: #78716c;
        color: #fafaf9;
      }
      .mobile-sheet-section {
        padding: 14px;
        border-bottom: 1px solid #1c1917;
      }
      .mobile-sheet-section:last-child { border-bottom: 0; }
      .mobile-sheet-section h4 {
        margin: 0 0 8px;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #a3e635;
      }
      .mobile-sheet-section .subtle {
        color: #a8a29e;
        font-size: 11px;
        line-height: 1.55;
        margin-bottom: 10px;
      }
      .mobile-sheet-section.tone-primary h4 { color: #22d3ee; }
      .mobile-sheet-section.tone-inspect h4 { color: #38bdf8; }
      .mobile-sheet-section.tone-annotate h4 { color: #fb7185; }
      .mobile-sheet-section.tone-secondary h4 { color: #d6d3d1; }
      .mobile-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .mobile-grid.one { grid-template-columns: 1fr; }
      .mobile-grid.compact {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .mobile-action {
        border: 1px solid #292524;
        background: #14110f;
        color: #a8a29e;
        border-radius: 12px;
        padding: 10px 12px;
        text-align: left;
        font: inherit;
        font-size: 11px;
        line-height: 1.45;
        cursor: pointer;
      }
      .mobile-action:hover {
        border-color: #57534e;
        color: #e7e5e4;
      }
      .mobile-action.on {
        color: #0c0a09;
        border-color: currentColor;
      }
      .mobile-action.primary {
        min-height: 84px;
        padding: 12px;
        background: linear-gradient(180deg, rgba(23,21,19,0.96), rgba(12,10,9,0.98));
      }
      .mobile-action.compact {
        padding: 9px 10px;
        border-radius: 10px;
      }
      .mobile-action.ghost {
        background: transparent;
      }
      .mobile-action .eyebrow {
        display: block;
        margin-bottom: 4px;
        font-size: 9px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      .mobile-action .label {
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .mobile-action .meta {
        display: block;
        margin-top: 4px;
        color: inherit;
        opacity: 0.82;
      }
      .mobile-receipt {
        border: 1px solid #292524;
        background: linear-gradient(180deg, rgba(20,17,15,0.96), rgba(12,10,9,0.98));
        border-radius: 14px;
        padding: 12px;
      }
      .mobile-receipt .eyebrow {
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }
      .mobile-receipt .title {
        margin-top: 6px;
        color: #fafaf9;
        font-size: 15px;
        line-height: 1.3;
        font-weight: 700;
      }
      .mobile-receipt .subtle {
        margin-top: 8px;
        color: #a8a29e;
        font-size: 11px;
        line-height: 1.55;
      }
      .mobile-empty {
        border: 1px dashed #292524;
        border-radius: 12px;
        padding: 14px;
        color: #a8a29e;
        font-size: 12px;
        line-height: 1.6;
      }
      .mobile-inspector-rows {
        display: grid;
        gap: 8px;
      }
      .mobile-inspector-row {
        border: 1px solid #1c1917;
        background: #14110f;
        border-radius: 12px;
        padding: 10px 12px;
      }
      .mobile-inspector-row .key {
        color: #a8a29e;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-size: 10px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .mobile-inspector-row .value {
        color: #f5f5f4;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .help {
        position: fixed;
        bottom: 12px;
        right: 12px;
        pointer-events: auto;
        background: #0c0a09;
        color: #e7e5e4;
        border: 1px solid #44403c;
        padding: 14px 16px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        line-height: 1.7;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        max-width: 280px;
      }
      .settings {
        position: fixed;
        top: 58px;
        right: 12px;
        width: 280px;
        pointer-events: auto;
        background: #0c0a09;
        color: #e7e5e4;
        border: 1px solid #44403c;
        padding: 12px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        line-height: 1.6;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      }
      .settings h4 {
        margin: 0 0 6px;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #22d3ee;
      }
      .settings .subtle {
        color: #a8a29e;
        margin-bottom: 10px;
      }
      .settings .seg {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        border: 0;
        background: transparent;
        padding: 0;
      }
      .settings .segbtn {
        border: 1px solid #292524;
        background: transparent;
        color: #a8a29e;
        padding: 6px 8px;
        text-align: left;
      }
      .settings .segbtn.on {
        background: #22d3ee;
        border-color: #22d3ee;
        color: #0c0a09;
      }
      .settings .meta {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #292524;
        color: #78716c;
        font-size: 10px;
      }
      .help h4 {
        margin: 0 0 8px;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #a3e635;
      }
      .help .row { display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: baseline; }
      .help .row kbd {
        background: #292524;
        border: 1px solid #44403c;
        border-bottom-width: 2px;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 10px;
        text-align: center;
      }
      .help .row .desc { color: #a8a29e; }
      .help .row.on .desc { color: #e7e5e4; }
      .help .row.on kbd { background: #a3e635; color: #0c0a09; border-color: #a3e635; }
      .help .meta {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #292524;
        color: #78716c;
        font-size: 10px;
      }
      .inspector {
        position: fixed;
        left: 12px;
        bottom: 12px;
        width: 360px;
        max-height: 46vh;
        overflow: auto;
        pointer-events: auto;
        background: #0c0a09;
        color: #e7e5e4;
        border: 1px solid #44403c;
        box-shadow: 0 12px 28px rgba(0,0,0,0.45);
        font-family: ui-monospace, monospace;
      }
      .inspector-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 12px 10px;
        border-bottom: 1px solid #292524;
      }
      .inspector-eyebrow {
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }
      .inspector-title {
        margin-top: 4px;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 700;
        color: #fafaf9;
      }
      .inspector-close {
        border: 1px solid #44403c;
        background: transparent;
        color: #a8a29e;
        padding: 3px 7px;
        font: inherit;
        font-size: 11px;
        cursor: pointer;
      }
      .inspector-close:hover {
        border-color: #78716c;
        color: #fafaf9;
      }
      .inspector-body {
        padding: 10px 12px 12px;
      }
      .inspector-row {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr);
        gap: 10px;
        padding: 5px 0;
        border-bottom: 1px solid rgba(68, 64, 60, 0.55);
      }
      .inspector-row:last-child {
        border-bottom: 0;
      }
      .inspector-key {
        color: #a8a29e;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 10px;
        font-weight: 700;
      }
      .inspector-value {
        min-width: 0;
        color: #f5f5f4;
        font-size: 12px;
        line-height: 1.45;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .inspector-hint {
        margin-top: 10px;
        color: #78716c;
        font-size: 10px;
      }
      .annotation-svg {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .annotation-html {
        position: fixed;
        inset: 0;
        pointer-events: none;
      }
      .annotation-capture {
        position: fixed;
        inset: 0;
        pointer-events: none;
      }
      .annotation-capture.active {
        pointer-events: auto;
        cursor: crosshair;
      }
      .note {
        position: absolute;
        width: 220px;
        border: 2px solid ${COLOR.noteBorder};
        border-radius: 6px;
        background: ${COLOR.noteBg};
        color: ${COLOR.noteText};
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
        pointer-events: auto;
        overflow: hidden;
      }
      .note.selected {
        border-color: ${COLOR.annotateSelected};
        box-shadow: 0 0 0 2px rgba(251, 113, 133, 0.25), 0 10px 24px rgba(15, 23, 42, 0.28);
      }
      .note-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        background: rgba(250, 204, 21, 0.28);
        border-bottom: 1px solid rgba(133, 77, 14, 0.22);
        cursor: move;
        user-select: none;
      }
      .note-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .note-delete {
        border: 1px solid rgba(133, 77, 14, 0.35);
        background: transparent;
        color: ${COLOR.noteText};
        padding: 2px 6px;
        border-radius: 4px;
        font: inherit;
        font-size: 10px;
        cursor: pointer;
      }
      .note-delete:hover {
        background: rgba(251, 113, 133, 0.14);
        border-color: ${COLOR.annotateSelected};
      }
      .note-body {
        padding: 0;
      }
      .note-body textarea {
        display: block;
        width: 100%;
        min-height: 96px;
        border: 0;
        box-sizing: border-box;
        padding: 8px;
        margin: 0;
        background: transparent;
        color: inherit;
        resize: none;
        outline: none;
        font: inherit;
        font-size: 12px;
        line-height: 1.45;
      }
      .annotation-line {
        fill: none;
        stroke: ${COLOR.annotate};
        stroke-width: 3;
        vector-effect: non-scaling-stroke;
        marker-end: url(#a11yov-arrowhead);
        pointer-events: none;
      }
      .annotation-line.selected {
        stroke: ${COLOR.annotateSelected};
      }
      .annotation-hit {
        fill: none;
        stroke: transparent;
        stroke-width: 16;
        vector-effect: non-scaling-stroke;
        cursor: move;
        pointer-events: stroke;
      }
      .annotation-handle {
        fill: white;
        stroke: ${COLOR.annotateSelected};
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
        cursor: grab;
        pointer-events: all;
      }
      .annotation-preview {
        fill: none;
        stroke: ${COLOR.annotateSelected};
        stroke-width: 2;
        stroke-dasharray: 8 6;
        vector-effect: non-scaling-stroke;
        marker-end: url(#a11yov-arrowhead-selected);
        pointer-events: none;
      }
      .annotation-anchor {
        fill: ${COLOR.annotateSelected};
        pointer-events: none;
      }
    </style>
    <div class="layer" id="layer"></div>
    <svg class="layer annotation-svg" id="annotation-svg" aria-hidden="true"></svg>
    <div class="annotation-html" id="annotation-html"></div>
    <div class="annotation-capture" id="annotation-capture" aria-hidden="true"></div>
    <div class="toolbar" id="toolbar"></div>
    <div class="agent-launcher" id="agent-launcher"></div>
    <div class="mobile-dock" id="mobile-dock"></div>
    <div class="mobile-modebar" id="mobile-modebar"></div>
    <div class="mobile-sheet-backdrop" id="mobile-sheet-backdrop"></div>
    <div class="mobile-sheet" id="mobile-sheet"></div>
  `;

  const layer = shadow.getElementById('layer');
  const annotationSvg = shadow.getElementById('annotation-svg');
  const annotationHtml = shadow.getElementById('annotation-html');
  const annotationCapture = shadow.getElementById('annotation-capture');
  const toolbar = shadow.getElementById('toolbar');
  const agentLauncher = shadow.getElementById('agent-launcher');
  const mobileDock = shadow.getElementById('mobile-dock');
  const mobileModebar = shadow.getElementById('mobile-modebar');
  const mobileSheetBackdrop = shadow.getElementById('mobile-sheet-backdrop');
  const mobileSheet = shadow.getElementById('mobile-sheet');
