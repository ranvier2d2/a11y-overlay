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
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
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
  `;

  const layer = shadow.getElementById('layer');
  const annotationSvg = shadow.getElementById('annotation-svg');
  const annotationHtml = shadow.getElementById('annotation-html');
  const annotationCapture = shadow.getElementById('annotation-capture');
  const toolbar = shadow.getElementById('toolbar');
