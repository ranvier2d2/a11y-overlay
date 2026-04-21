/*
 * a11y-overlay.js — live element / component highlighter
 *
 * Toggles (keyboard-only UI):
 *   ?    — show/hide help
 *   L    — Landmarks (header, nav, main, section, footer, aside, form, article)
 *   H    — Headings outline (h1–h6)
 *   I    — Interactive (a, button, input, textarea, select, [role=button], [tabindex])
 *   M    — Forms / labeling audit
 *   T    — Interactive targets smaller than 24×24 CSS px without spacing relief
 *   A    — Visible imgs missing alt
 *   R    — Repeating components (siblings with matching DOM signature)
 *   F    — Focus / tab order (numbered badges)
 *   D    — Depth hierarchy (nested outline colors per DOM depth)
 *   G    — Grid (implicit block boundaries of every block-level element)
 *   N    — Place one note
 *   W    — Place one arrow
 *   V    — Deselect / exit placement
 *   X    — Kill overlay
 *
 * Install: <script src="a11y-overlay.js"></script>   OR use the bookmarklet.
 *
 * No DOM nodes or stylesheets on the host page are modified. All overlay chrome
 * lives inside a shadow root attached to a fixed-position host <div> appended
 * to <html>. Renders are RAF-throttled and fire on scroll / resize / mutation.
 */
(function () {
  function install() {
    if (window.__a11yOverlayInstalled) {
      window.__a11yOverlayInstalled.toggleHelp();
      return;
    }

    // Support early agent-side injection via addInitScript().
    if (!document.documentElement || !document.body) {
      window.addEventListener('DOMContentLoaded', install, { once: true });
      return;
    }

  // ---------- constants ----------
  const NS = 'a11yov';
  const Z = 2147483000;
  const VERSION = '0.1.13';
  const TOUCH_PROFILE_STORAGE_KEY = 'a11y-overlay-touch-profile';

  const COLOR = {
    landmark: '#f59e0b',    // amber
    heading:  '#22d3ee',    // cyan
    interact: '#a3e635',    // lime
    form:     '#14b8a6',    // teal
    target:   '#f97316',    // orange
    alt:      '#fb7185',    // rose (error)
    repeat:   '#a78bfa',    // violet
    focus:    '#60a5fa',    // blue
    grid:     '#64748b',    // slate — neutral, low-contrast grid
    noteBg:   '#fef08a',
    noteBorder: '#facc15',
    noteText: '#422006',
    annotate: '#f97316',
    annotateSelected: '#fb7185',
    depth0:   '#94a3b8',
    depth1:   '#38bdf8',
    depth2:   '#34d399',
    depth3:   '#fbbf24',
    depth4:   '#f472b6',
    depth5:   '#c084fc'
  };

  const LANDMARK_TAGS = ['header','nav','main','section','footer','aside','form','article'];
  const HEADING_SEL = 'h1,h2,h3,h4,h5,h6';
  const INTERACT_SEL = 'a[href],button,input,textarea,select,[role=button],[role=link],[tabindex]:not([tabindex="-1"])';

  // display values that participate in block-level layout (grid view cares about these)
  const BLOCK_DISPLAYS = new Set([
    'block', 'flex', 'grid', 'inline-block', 'inline-flex', 'inline-grid',
    'flow-root', 'list-item', 'table', 'table-row', 'table-cell', 'table-row-group',
    'table-header-group', 'table-footer-group', 'table-column', 'table-column-group',
    'table-caption'
  ]);
  function getExtensionRuntime() {
    try {
      if (typeof chrome !== 'object' || !chrome || !chrome.runtime) {
        return null;
      }
      if (
        typeof chrome.runtime.getManifest !== 'function' ||
        typeof chrome.runtime.sendMessage !== 'function'
      ) {
        return null;
      }
      if (!chrome.runtime.id || !chrome.runtime.getManifest()) {
        return null;
      }
      return chrome.runtime;
    } catch (_error) {
      return null;
    }
  }

  const EXTENSION_RUNTIME = getExtensionRuntime();
  const CAN_EXPORT_FROM_EXTENSION = !!EXTENSION_RUNTIME;
  const EXPORT_MESSAGE = 'a11y-overlay-export-png';
  const OPEN_EXPORT_WINDOW_MESSAGE = 'a11y-overlay-open-export-window';
  const EXPORT_NOTICE_MS = 2800;

  // elements that are mostly noise in a grid view
  const GRID_SKIP = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'BR', 'HR']);

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
        padding: 8px;
      }
      .note-body textarea {
        display: block;
        width: 100%;
        min-height: 96px;
        border: 0;
        padding: 0;
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

  // ---------- state ----------
  const state = {
    layerMode: 'conformance',
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
    helpOpen: true,
    settingsOpen: false,
    exportBusy: false,
    exportNotice: '',
    exportNoticeTone: 'muted',
    touchProfile: 'web-default'
  };
  let exportNoticeTimer = 0;
  let annotationCounter = 0;
  let dragState = null;
  const inspector = {
    selection: null
  };
  const annotations = {
    mode: 'idle',
    selected: null,
    editingNoteId: null,
    pendingArrowStart: null,
    pendingArrowPreview: null,
    notes: [],
    arrows: []
  };
  const SLICES = [
    { key: 'landmark', kbd: 'L', label: 'Landmarks', color: COLOR.landmark, minLayer: 'conformance', findingType: 'standard' },
    { key: 'heading',  kbd: 'H', label: 'Headings',  color: COLOR.heading,  minLayer: 'conformance', findingType: 'standard' },
    { key: 'interact', kbd: 'I', label: 'Interact',  color: COLOR.interact, minLayer: 'conformance', findingType: 'standard' },
    { key: 'form',     kbd: 'M', label: 'Forms',     color: COLOR.form,     minLayer: 'conformance', findingType: 'mixed' },
    { key: 'target',   kbd: 'T', label: 'Targets',   color: COLOR.target,   minLayer: 'conformance', findingType: 'standard' },
    { key: 'alt',      kbd: 'A', label: 'Img alt',   color: COLOR.alt,      minLayer: 'conformance', findingType: 'standard' },
    { key: 'repeat',   kbd: 'R', label: 'Repeats',   color: COLOR.repeat,   minLayer: 'review',      findingType: 'heuristic' },
    { key: 'focus',    kbd: 'F', label: 'Tab order', color: COLOR.focus,    minLayer: 'conformance', findingType: 'standard' },
    { key: 'depth',    kbd: 'D', label: 'Depth',     color: COLOR.depth1,   minLayer: 'review',      findingType: 'heuristic' },
    { key: 'grid',     kbd: 'G', label: 'Grid',      color: COLOR.grid,     minLayer: 'review',      findingType: 'heuristic' }
  ];
  const SLICE_BY_KEY = Object.fromEntries(SLICES.map((slice) => [slice.key, slice]));

  // ---------- utils ----------
  function rect(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function intersectsRect(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function textSnippet(value, max = 80) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function escapeCssIdent(value) {
    if (typeof CSS === 'object' && CSS && typeof CSS.escape === 'function') {
      return CSS.escape(String(value));
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function getSliceMeta(sliceKey) {
    return SLICE_BY_KEY[sliceKey] || null;
  }

  function currentTouchProfileLabel() {
    const labels = {
      'web-default': 'Web default',
      'apple-44pt': 'Apple 44pt',
      'android-48dp': 'Android 48dp',
      'both': 'Apple + Android'
    };
    return labels[state.touchProfile] || 'Web default';
  }

  function formatFindingType(value) {
    if (value === 'standard') return 'Standard';
    if (value === 'advisory') return 'Advisory';
    if (value === 'heuristic') return 'Heuristic';
    if (value === 'mixed') return 'Mixed';
    return '';
  }

  function sliceAvailableInMode(sliceOrKey, layerMode = state.layerMode) {
    const meta = typeof sliceOrKey === 'string' ? getSliceMeta(sliceOrKey) : sliceOrKey;
    if (!meta) return false;
    return meta.minLayer !== 'review' || layerMode === 'review';
  }

  function sliceVisible(sliceKey) {
    return !!state[sliceKey] && sliceAvailableInMode(sliceKey);
  }

  function selectionVisibleInMode(selection, layerMode = state.layerMode) {
    const sliceKey = selection && selection.meta ? selection.meta.sliceKey : '';
    if (!sliceKey) return true;
    return sliceAvailableInMode(sliceKey, layerMode);
  }

  function clearIncompatibleInspectorSelection(layerMode = state.layerMode) {
    if (!inspector.selection || selectionVisibleInMode(inspector.selection, layerMode)) {
      return false;
    }
    inspector.selection = null;
    return true;
  }

  function queueToolbarNotice(message, tone = 'muted') {
    state.exportNotice = message;
    state.exportNoticeTone = tone;
    clearExportNoticeLater();
  }

  function getStorageArea() {
    try {
      if (typeof chrome === 'object' && chrome && chrome.storage && chrome.storage.local) {
        return chrome.storage.local;
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  async function loadPersistedSettings() {
    const storage = getStorageArea();
    let nextProfile = 'web-default';
    try {
      if (storage && typeof storage.get === 'function') {
        const stored = await storage.get([TOUCH_PROFILE_STORAGE_KEY]);
        nextProfile = stored[TOUCH_PROFILE_STORAGE_KEY] || nextProfile;
      } else if (typeof localStorage !== 'undefined') {
        nextProfile = localStorage.getItem(TOUCH_PROFILE_STORAGE_KEY) || nextProfile;
      }
    } catch (_error) {
      nextProfile = 'web-default';
    }

    if (nextProfile !== state.touchProfile) {
      state.touchProfile = nextProfile;
      render();
    }
  }

  async function persistTouchProfile(value) {
    const storage = getStorageArea();
    if (storage && typeof storage.set === 'function') {
      await storage.set({ [TOUCH_PROFILE_STORAGE_KEY]: value });
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOUCH_PROFILE_STORAGE_KEY, value);
    }
  }

  function setTouchProfile(value) {
    if (!value || value === state.touchProfile) return;
    state.touchProfile = value;
    persistTouchProfile(value).catch(() => {});
    queueToolbarNotice(`Touch profile: ${currentTouchProfileLabel()}`, 'mode');
    render();
  }

  function applyLayerMode(nextMode, opts = {}) {
    const { announce = false } = opts;
    if (!nextMode || nextMode === state.layerMode) return false;
    state.layerMode = nextMode;
    clearIncompatibleInspectorSelection(nextMode);
    if (announce) {
      queueToolbarNotice(
        nextMode === 'review' ? 'Review mode enabled' : 'Conformance mode enabled',
        'mode'
      );
    }
    return true;
  }

  function toggleSliceState(sliceKey) {
    const meta = getSliceMeta(sliceKey);
    if (!meta) return false;
    const requiresReview = meta.minLayer === 'review';
    if (requiresReview && state.layerMode !== 'review') {
      applyLayerMode('review', { announce: true });
      if (state[sliceKey]) {
        return true;
      }
    }
    state[sliceKey] = !state[sliceKey];
    return true;
  }

  function accessibleNameOf(el) {
    if (!el || el.nodeType !== 1) return '';
    const labelledBy = el.getAttribute && el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const value = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((node) => textSnippet(node.textContent, 120))
        .join(' ');
      if (value) return value;
    }
    const direct = [
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('alt'),
      el.value,
      el.getAttribute && el.getAttribute('placeholder'),
      el.textContent
    ];
    for (const candidate of direct) {
      const value = textSnippet(candidate, 120);
      if (value) return value;
    }
    return '';
  }

  function formControlKind(el) {
    if (!el || !el.tagName) return '';
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return `input[${type}]`;
    }
    return tag;
  }

  function labelTextFromNodes(nodes) {
    return Array.from(new Set(
      (nodes || [])
        .map((node) => textSnippet(node && node.textContent, 120))
        .filter(Boolean)
    )).join(' · ');
  }

  function associatedLabelMeta(el) {
    if (!el || !el.tagName) {
      return { source: '', label: '' };
    }

    const ariaLabelledby = (el.getAttribute('aria-labelledby') || '').trim();
    if (ariaLabelledby) {
      const refs = ariaLabelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      const label = labelTextFromNodes(refs);
      if (label) return { source: 'aria-labelledby', label };
    }

    const id = el.getAttribute('id');
    if (id) {
      const explicitLabels = Array.from(document.querySelectorAll(`label[for="${escapeCssIdent(id)}"]`));
      const label = labelTextFromNodes(explicitLabels);
      if (label) return { source: 'label[for]', label };
    }

    const wrappingLabel = typeof el.closest === 'function' ? el.closest('label') : null;
    if (wrappingLabel) {
      const label = textSnippet(wrappingLabel.textContent, 120);
      if (label) return { source: 'label wrapper', label };
    }

    const ariaLabel = textSnippet(el.getAttribute('aria-label'), 120);
    if (ariaLabel) return { source: 'aria-label', label: ariaLabel };

    const title = textSnippet(el.getAttribute('title'), 120);
    if (title) return { source: 'title-only', label: title };

    const placeholder = textSnippet(el.getAttribute('placeholder'), 120);
    if (placeholder) return { source: 'placeholder-only', label: placeholder };

    return { source: 'missing', label: '' };
  }

  function shortDomPath(el, maxParts = 4) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    let current = el;
    while (current && current.nodeType === 1 && parts.length < maxParts) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }
      const cls = current.className && typeof current.className === 'string'
        ? current.className.trim().split(/\s+/)[0]
        : '';
      if (cls) part += `.${cls}`;
      parts.unshift(part);
      current = current.parentElement;
      if (current === document.body) {
        parts.unshift('body');
        break;
      }
    }
    return parts.join(' > ');
  }

  function childStructureSummary(el) {
    if (!el || el.nodeType !== 1) return '';
    const children = Array.from(el.children || []);
    if (!children.length) return '';
    const names = children.slice(0, 5).map((child) => child.tagName.toLowerCase());
    const more = children.length > names.length ? ` +${children.length - names.length}` : '';
    return `${el.tagName.toLowerCase()} > ${names.join(', ')}${more}`;
  }

  function stateFlagsOf(el) {
    if (!el || el.nodeType !== 1) return [];
    const flags = [];
    if (el.matches && el.matches(':disabled')) flags.push('disabled');
    if (el.matches && el.matches(':checked')) flags.push('checked');
    const attrs = [
      ['aria-expanded', 'expanded'],
      ['aria-selected', 'selected'],
      ['aria-current', 'current'],
      ['aria-pressed', 'pressed'],
      ['aria-invalid', 'invalid'],
      ['aria-required', 'required'],
      ['aria-disabled', 'disabled']
    ];
    attrs.forEach(([attr, label]) => {
      const value = el.getAttribute && el.getAttribute(attr);
      if (value && value !== 'false') flags.push(value === 'true' ? label : `${label}=${value}`);
    });
    return Array.from(new Set(flags));
  }

  function inspectorRowsForSelection(selection) {
    if (!selection || !selection.el || !selection.meta) return [];
    const { el, meta } = selection;
    const rows = [];
    const sliceMeta = meta.sliceKey ? getSliceMeta(meta.sliceKey) : null;
    const findingType = formatFindingType(meta.findingType || (sliceMeta && sliceMeta.findingType) || '');
    const tag = meta.tag || (el.tagName ? el.tagName.toLowerCase() : '');
    const role = meta.role || roleOf(el);
    const name = accessibleNameOf(el);
    const text = textSnippet(el.textContent, 120);
    const flags = stateFlagsOf(el);
    const path = shortDomPath(el);
    const structure = childStructureSummary(el);

    if (findingType) rows.push(['Type', findingType]);
    if (sliceMeta && sliceMeta.label) rows.push(['Slice', sliceMeta.label]);
    rows.push(['Kind', meta.kind]);
    if (meta.severity) rows.push(['Severity', String(meta.severity).toUpperCase()]);
    if (tag) rows.push(['Tag', tag]);
    if (role) rows.push(['Role', role]);
    if (name) rows.push(['Name', name]);
    if (flags.length) rows.push(['State', flags.join(' · ')]);
    if (meta.kind === 'target-too-small' && meta.size) rows.push(['Size', meta.size]);
    if (meta.kind === 'target-too-small' && meta.requiredSize) rows.push(['Required', meta.requiredSize]);
    if (meta.kind === 'target-too-small' && meta.rule) rows.push(['Rule', meta.rule]);
    if (meta.kind === 'target-too-small' && meta.spacing) rows.push(['Spacing', meta.spacing]);
    if (meta.kind === 'target-too-small' && meta.profile) rows.push(['Profile', meta.profile]);
    if ((meta.kind === 'form-label' || meta.kind === 'form-label-missing' || meta.kind === 'form-label-weak') && meta.control) rows.push(['Control', meta.control]);
    if ((meta.kind === 'form-label' || meta.kind === 'form-label-missing' || meta.kind === 'form-label-weak') && meta.nameSource) rows.push(['Name source', meta.nameSource]);
    if ((meta.kind === 'form-label' || meta.kind === 'form-label-missing' || meta.kind === 'form-label-weak') && meta.visibleLabel) rows.push(['Visible label', meta.visibleLabel]);
    if ((meta.kind === 'form-label' || meta.kind === 'form-label-missing' || meta.kind === 'form-label-weak') && meta.placeholder) rows.push(['Placeholder', meta.placeholder]);
    if ((meta.kind === 'form-label' || meta.kind === 'form-label-missing' || meta.kind === 'form-label-weak') && meta.titleText) rows.push(['Title', meta.titleText]);
    if ((meta.kind === 'form-label' || meta.kind === 'form-label-missing' || meta.kind === 'form-label-weak') && meta.required) rows.push(['Required', meta.required]);
    if ((meta.kind === 'form-label' || meta.kind === 'form-label-missing' || meta.kind === 'form-label-weak') && meta.rule) rows.push(['Rule', meta.rule]);
    if (meta.kind === 'heading' && meta.level) rows.push(['Level', `h${meta.level}`]);
    if (meta.kind === 'focus') {
      rows.push(['Tab', `#${meta.order}${meta.tabindex > 0 ? ` · tabindex=${meta.tabindex}` : ''}`]);
    }
    if (meta.kind === 'repeat') {
      rows.push(['Repeat', `${meta.groupSize} siblings · item ${meta.indexInGroup}`]);
    }
    if (meta.href) rows.push(['Href', meta.href]);
    if (meta.kind === 'alt-missing' && meta.src) rows.push(['Source', meta.src]);
    if (meta.className) rows.push(['Class', `.${meta.className}`]);
    if (path) rows.push(['Path', path]);
    if (structure) rows.push(['Structure', structure]);
    if (text && text !== name) rows.push(['Text', text]);
    return rows;
  }

  function nextAnnotationId(prefix) {
    annotationCounter += 1;
    return `${prefix}-${annotationCounter}`;
  }

  function docPointFromEvent(e) {
    return {
      x: e.clientX + window.scrollX,
      y: e.clientY + window.scrollY
    };
  }

  function viewportPoint(x, y) {
    return {
      x: x - window.scrollX,
      y: y - window.scrollY
    };
  }

  function findNote(id) {
    return annotations.notes.find((note) => note.id === id) || null;
  }

  function findArrow(id) {
    return annotations.arrows.find((arrow) => arrow.id === id) || null;
  }

  function clampNoteY(value) {
    return Math.max(8, value);
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    // skip anything inside our own shadow host
    if (el === host || (host.contains && host.contains(el))) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
    return true;
  }

  function signature(el, depth = 2) {
    // shallow DOM signature: tag > child tags (recursive, limited)
    if (!el || el.nodeType !== 1) return '';
    const kids = Array.from(el.children).slice(0, 6);
    const ksig = depth > 0 ? kids.map(k => signature(k, depth - 1)).join(',') : kids.map(k => k.tagName).join(',');
    return `${el.tagName}[${ksig}]`;
  }

  function makeMark(r, color, opts = {}) {
    const el = document.createElement('div');
    el.className = 'mark';
    if (opts.inspectable) el.classList.add('inspectable');
    if (opts.inspected) el.classList.add('inspected');
    el.style.left = r.x + 'px';
    el.style.top = r.y + 'px';
    el.style.width = r.w + 'px';
    el.style.height = r.h + 'px';
    el.style.outline = `${opts.thick ? 2 : 1}px ${opts.dashed ? 'dashed' : opts.dotted ? 'dotted' : 'solid'} ${color}`;
    el.style.outlineOffset = opts.offset != null ? opts.offset + 'px' : '0';
    if (opts.opacity != null) el.style.opacity = String(opts.opacity);
    if (opts.fill) el.style.background = opts.fill;
    if (opts.label) {
      const t = document.createElement('span');
      t.className = 'tag' + (opts.labelBottom ? ' bottom' : '') + (opts.labelQuiet ? ' quiet' : '');
      t.textContent = opts.label;
      if (!opts.labelQuiet) t.style.background = color;
      if (opts.labelInvert) t.style.color = 'white';
      if (opts.onInspect) {
        t.title = 'Inspect this element';
        t.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
        });
        t.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onInspect();
        });
      }
      el.appendChild(t);
    }
    if (opts.badge) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.style.background = color;
      b.textContent = opts.badge;
      b.style.top = '-9px';
      b.style.left = '-9px';
      if (opts.onInspect) {
        b.title = 'Inspect this element';
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
        });
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onInspect();
        });
      }
      el.appendChild(b);
    }
    return el;
  }

  function roleOf(el) {
    const r = el.getAttribute && el.getAttribute('role');
    if (r) return r;
    const tag = el.tagName.toLowerCase();
    const map = {
      nav: 'navigation', main: 'main', header: 'banner', footer: 'contentinfo',
      aside: 'complementary', section: 'region', form: 'form', article: 'article',
      a: 'link', button: 'button', input: 'textbox', textarea: 'textbox',
      select: 'listbox', img: 'img', ul: 'list', ol: 'list', li: 'listitem'
    };
    return map[tag] || '';
  }

  function detectionRecord(entry, index) {
    const box = rect(entry.el);
    return {
      id: `${entry.meta.kind}-${index + 1}`,
      kind: entry.meta.kind,
      label: entry.label || '',
      rect: {
        x: box.x + window.scrollX,
        y: box.y + window.scrollY,
        w: box.w,
        h: box.h,
        cx: box.x + window.scrollX + (box.w / 2),
        cy: box.y + window.scrollY + (box.h / 2)
      },
      meta: { ...(entry.meta || {}) }
    };
  }

  // ---------- detectors ----------
  function scanLandmarks() {
    const out = [];
    LANDMARK_TAGS.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => {
        if (!isVisible(el)) return;
        const role = roleOf(el);
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/)[0]
          : '';
        out.push({
          el,
          color: COLOR.landmark,
          label: `<${tag}>${role ? ' · ' + role : ''}${cls}`,
          opts: { thick: true, fill: 'rgba(245,158,11,0.05)' },
          meta: {
            kind: 'landmark',
            sliceKey: 'landmark',
            findingType: 'standard',
            tag,
            role,
            className: cls ? cls.slice(1) : '',
            text: textSnippet(el.textContent)
          }
        });
      });
    });
    return out;
  }

  function scanHeadings() {
    const out = [];
    let prevLevel = 0;
    document.querySelectorAll(HEADING_SEL).forEach(el => {
      if (!isVisible(el)) return;
      const lvl = el.tagName.toLowerCase();
      const levelNum = parseInt(lvl.slice(1), 10);
      const jumped = prevLevel > 0 && levelNum > prevLevel + 1;
      out.push({
        el,
        color: jumped ? COLOR.alt : COLOR.heading,
        label: jumped
          ? `${lvl} jump from h${prevLevel} · ${(el.textContent || '').trim().slice(0, 32)}`
          : `${lvl} · ${(el.textContent || '').trim().slice(0, 40)}`,
        opts: jumped ? { thick: true, fill: 'rgba(251,113,133,0.12)', labelInvert: true } : {},
        meta: {
          kind: 'heading',
          sliceKey: 'heading',
          findingType: 'standard',
          level: levelNum,
          tag: lvl,
          text: textSnippet(el.textContent)
        }
      });
      prevLevel = levelNum;
    });
    return out;
  }

  function scanInteract() {
    const out = [];
    document.querySelectorAll(INTERACT_SEL).forEach(el => {
      if (!isVisible(el)) return;
      const tag = el.tagName.toLowerCase();
      const role = roleOf(el);
      const txt = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 30);
      out.push({
        el, color: COLOR.interact,
        label: `${tag}${role && role !== tag ? '[' + role + ']' : ''}${txt ? ' · ' + txt : ''}`,
        opts: { dashed: true },
        meta: {
          kind: 'interactive',
          sliceKey: 'interact',
          findingType: 'standard',
          tag,
          role,
          text: textSnippet(txt),
          ariaLabel: textSnippet(el.getAttribute('aria-label') || ''),
          href: tag === 'a' ? (el.getAttribute('href') || '') : ''
        }
      });
    });
    return out;
  }

  function scanForms() {
    const out = [];
    const formSelector = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
      'textarea',
      'select'
    ].join(',');

    document.querySelectorAll(formSelector).forEach((el) => {
      if (!isVisible(el)) return;

      const tag = el.tagName.toLowerCase();
      const role = roleOf(el);
      const control = formControlKind(el);
      const labelMeta = associatedLabelMeta(el);
      const placeholder = textSnippet(el.getAttribute('placeholder'), 120);
      const titleText = textSnippet(el.getAttribute('title'), 120);
      const required = el.matches('[required],[aria-required="true"]') ? 'Yes' : '';
      const hasVisibleLabel = labelMeta.source === 'label[for]' || labelMeta.source === 'label wrapper' || labelMeta.source === 'aria-labelledby';

      let color = COLOR.form;
      let label = `${labelMeta.source || 'name'} · ${control}`;
      let opts = { dashed: true, fill: 'rgba(20,184,166,0.08)' };
      const meta = {
        kind: 'form-label',
        sliceKey: 'form',
        findingType: 'standard',
        severity: 'pass',
        tag,
        role,
        control,
        nameSource: labelMeta.source,
        visibleLabel: hasVisibleLabel ? labelMeta.label : '',
        placeholder,
        titleText,
        required,
        text: labelMeta.label
      };

      if (labelMeta.source === 'missing') {
        color = COLOR.alt;
        label = `Missing label · ${control}`;
        opts = { thick: true, fill: 'rgba(251,113,133,0.12)', labelInvert: true };
        meta.kind = 'form-label-missing';
        meta.findingType = 'standard';
        meta.severity = 'error';
        meta.rule = 'WCAG 3.3.2 Labels or Instructions';
      } else if (labelMeta.source === 'placeholder-only' || labelMeta.source === 'title-only') {
        color = '#fbbf24';
        label = `${labelMeta.source === 'placeholder-only' ? 'Placeholder-only' : 'Title-only'} · ${control}`;
        opts = { thick: true, dashed: true, fill: 'rgba(251,191,36,0.12)' };
        meta.kind = 'form-label-weak';
        meta.findingType = 'advisory';
        meta.severity = 'warning';
        meta.rule = 'Advisory: prefer a persistent label over placeholder/title-only naming';
      }

      out.push({
        el,
        color,
        label,
        opts,
        meta
      });
    });

    return out;
  }

  function scanTargets() {
    const out = [];
    const candidates = Array.from(document.querySelectorAll(INTERACT_SEL)).filter(isVisible);
    const boxes = candidates.map((el) => ({ el, box: rect(el) }));
    const minSize = 24;
    const advisoryThresholds = [];
    if (state.touchProfile === 'apple-44pt' || state.touchProfile === 'both') {
      advisoryThresholds.push({ size: 44, rule: 'Apple touch target guidance', profile: 'Apple 44pt' });
    }
    if (state.touchProfile === 'android-48dp' || state.touchProfile === 'both') {
      advisoryThresholds.push({ size: 48, rule: 'Android touch target guidance', profile: 'Android 48dp' });
    }

    boxes.forEach(({ el, box }) => {
      const standardMiss = box.w < minSize || box.h < minSize;
      const tag = el.tagName.toLowerCase();
      const role = roleOf(el);
      const name = textSnippet(el.getAttribute('aria-label') || el.textContent || el.value || '', 30);

      if (standardMiss) {
        const reliefBox = {
          x: box.x + ((box.w - minSize) / 2),
          y: box.y + ((box.h - minSize) / 2),
          w: Math.max(box.w, minSize),
          h: Math.max(box.h, minSize)
        };

        const blockedByNeighbor = boxes.some((other) => {
          if (other.el === el) return false;
          return intersectsRect(reliefBox, other.box);
        });

        if (blockedByNeighbor) {
          out.push({
            el,
            color: COLOR.target,
            label: `${Math.round(box.w)}×${Math.round(box.h)} target${name ? ` · ${name}` : ''}`,
            opts: { thick: true, fill: 'rgba(249,115,22,0.12)', labelInvert: true },
            meta: {
              kind: 'target-too-small',
              sliceKey: 'target',
              findingType: 'standard',
              severity: 'error',
              tag,
              role,
              text: textSnippet(name),
              size: `${Math.round(box.w)} × ${Math.round(box.h)} CSS px`,
              requiredSize: '24 × 24 CSS px',
              rule: 'WCAG 2.5.8 Target Size (Minimum)',
              spacing: 'Fails spacing relief against adjacent interactive target',
              profile: 'Web default'
            }
          });
          return;
        }
      }

      const failedProfiles = advisoryThresholds.filter((threshold) => box.w < threshold.size || box.h < threshold.size);
      if (failedProfiles.length) {
        const firstThreshold = failedProfiles[0];
        const lastThreshold = failedProfiles[failedProfiles.length - 1];
        out.push({
          el,
          color: '#fbbf24',
          label: `${Math.round(box.w)}×${Math.round(box.h)} advisory${name ? ` · ${name}` : ''}`,
          opts: { thick: true, dashed: true, fill: 'rgba(251,191,36,0.12)' },
          meta: {
            kind: 'target-too-small',
            sliceKey: 'target',
            findingType: 'advisory',
            severity: 'warning',
            tag,
            role,
            text: textSnippet(name),
            size: `${Math.round(box.w)} × ${Math.round(box.h)} CSS px`,
            requiredSize: firstThreshold.size === lastThreshold.size
              ? `${firstThreshold.size} × ${firstThreshold.size} CSS px`
              : `${firstThreshold.size}–${lastThreshold.size} CSS px`,
            rule: failedProfiles.map((item) => item.rule).join(' + '),
            spacing: 'Advisory profile ignores WCAG spacing exception',
            profile: failedProfiles.map((item) => item.profile).join(' + ')
          }
        });
      }
    });

    return out;
  }

  function scanAlt() {
    const out = [];
    document.querySelectorAll('img').forEach(el => {
      if (!isVisible(el)) return;
      if (el.hasAttribute('alt')) return;
      if (el.getAttribute('role') === 'presentation') return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      out.push({
        el, color: COLOR.alt,
        label: 'MISSING alt',
        opts: { thick: true, fill: 'rgba(251,113,133,0.15)', labelInvert: true },
        meta: {
          kind: 'alt-missing',
          sliceKey: 'alt',
          findingType: 'standard',
          tag: 'img',
          src: el.getAttribute('src') || ''
        }
      });
    });
    return out;
  }

  function scanRepeats() {
    // Groups of 3+ siblings sharing a DOM signature.
    const out = [];
    const palette = ['#a78bfa','#f472b6','#fbbf24','#34d399','#38bdf8','#fb923c'];
    let colorIdx = 0;
    const parents = new Set();
    document.querySelectorAll('*').forEach(el => {
      if (host.contains && host.contains(el)) return;
      if (el.children.length >= 3) parents.add(el);
    });
    parents.forEach(parent => {
      const groups = new Map();
      Array.from(parent.children).forEach(child => {
        if (!isVisible(child)) return;
        const sig = signature(child, 2);
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(child);
      });
      groups.forEach((kids) => {
        if (kids.length < 3) return;
        const color = palette[colorIdx++ % palette.length];
        kids.forEach((k, i) => {
          out.push({
            el: k, color,
            label: `×${kids.length} · ${k.tagName.toLowerCase()} #${i + 1}`,
            opts: { dashed: true, labelBottom: i > 0 },
            meta: {
              kind: 'repeat',
              sliceKey: 'repeat',
              findingType: 'heuristic',
              tag: k.tagName.toLowerCase(),
              groupSize: kids.length,
              indexInGroup: i + 1
            }
          });
        });
      });
    });
    return out;
  }

  function scanFocus() {
    // numbered in tab order (natural DOM order among focusables with non-negative tabindex)
    const out = [];
    const focusables = Array.from(
      document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')
    ).filter(isVisible);
    // Sort: positive tabindex first (by value), then natural order
    const positive = focusables.filter(e => {
      const t = parseInt(e.getAttribute('tabindex') || '0', 10);
      return t > 0;
    }).sort((a, b) => {
      return parseInt(a.getAttribute('tabindex') || '0', 10) - parseInt(b.getAttribute('tabindex') || '0', 10);
    });
    const natural = focusables.filter(e => !positive.includes(e));
    const ordered = [...positive, ...natural];
    ordered.forEach((el, i) => {
      const tabindex = parseInt(el.getAttribute('tabindex') || '0', 10);
      out.push({
        el, color: COLOR.focus,
        label: tabindex > 0 ? `tabindex=${tabindex}` : '',
        opts: {
          dashed: true,
          badge: String(i + 1),
          labelBottom: true,
          labelQuiet: tabindex <= 0
        },
        meta: {
          kind: 'focus',
          sliceKey: 'focus',
          findingType: 'standard',
          order: i + 1,
          tabindex,
          tag: el.tagName.toLowerCase(),
          text: textSnippet(el.getAttribute('aria-label') || el.textContent || el.value || '')
        }
      });
    });
    return out;
  }

  function scanDepth() {
    // draw outline for every visible element, tinted by depth
    const out = [];
    const root = document.body;
    if (!root) return out;
    function walk(el, depth) {
      if (depth > 8) return;
      Array.from(el.children).forEach(child => {
        if (!isVisible(child)) return;
        const c = [COLOR.depth0, COLOR.depth1, COLOR.depth2, COLOR.depth3, COLOR.depth4, COLOR.depth5][Math.min(depth, 5)];
        out.push({ el: child, color: c, opts: { offset: -1 } });
        walk(child, depth + 1);
      });
    }
    walk(root, 0);
    return out;
  }

  function scanGrid() {
    // Draw a faint dotted boundary around every visible block-level box.
    // This exposes the implicit layout "grid" — every container, row, cell, etc.
    const out = [];
    const root = document.body;
    if (!root) return out;
    // TreeWalker is ~10× faster than querySelectorAll('*') + filter for this kind of sweep
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (GRID_SKIP.has(node.tagName)) return NodeFilter.FILTER_REJECT;
        if (host.contains && host.contains(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) {
      if (!isVisible(n)) continue;
      const cs = getComputedStyle(n);
      if (!BLOCK_DISPLAYS.has(cs.display)) continue;
      // draw only if the element is big enough to be meaningful
      const r = n.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      out.push({
        el: n, color: COLOR.grid,
        label: cs.display,
        opts: { dotted: true, opacity: 0.55, labelQuiet: true }
      });
    }
    return out;
  }

  function collectDetections() {
    return [
      ...scanLandmarks(),
      ...scanHeadings(),
      ...scanInteract(),
      ...scanForms(),
      ...scanTargets(),
      ...scanAlt(),
      ...scanRepeats(),
      ...scanFocus()
    ].map((entry, index) => detectionRecord(entry, index));
  }

  // ---------- annotations ----------
  function modeLabel() {
    if (annotations.mode === 'note') return 'Note: click once to place';
    if (annotations.mode === 'arrow' && annotations.pendingArrowStart) return 'Arrow: click the end point';
    if (annotations.mode === 'arrow') return 'Arrow: click the start point';
    return '';
  }

  function selectedAnnotationLabel() {
    if (!annotations.selected) return '';
    return annotations.selected.type === 'note'
      ? 'Selected note: Delete or Backspace removes it'
      : 'Selected arrow: Delete or Backspace removes it';
  }

  function editingAnnotationLabel() {
    if (!annotations.editingNoteId) return '';
    return 'Typing in note: hotkeys paused';
  }

  function clearInspectorSelection(opts = {}) {
    if (!inspector.selection) return false;
    inspector.selection = null;
    if (opts.render !== false) {
      render();
    }
    return true;
  }

  function selectInspectorEntry(entry) {
    if (!entry || !entry.el || !entry.meta || !entry.meta.kind) return;
    inspector.selection = {
      el: entry.el,
      meta: { ...(entry.meta || {}) },
      label: entry.label || '',
      color: entry.color || '#e7e5e4'
    };
    render();
  }

  function syncEditingNoteFromFocus() {
    const active = getDeepActiveElement(shadow) || getDeepActiveElement(document);
    let nextId = null;
    if (isEditableNode(active) && typeof active.closest === 'function') {
      const noteEl = active.closest('[data-note-id]');
      if (noteEl && noteEl.dataset && noteEl.dataset.noteId) {
        nextId = noteEl.dataset.noteId;
      }
    }
    if (annotations.editingNoteId === nextId) return;
    annotations.editingNoteId = nextId;
    renderHud();
  }

  function clearSelection(opts = {}) {
    if (!annotations.selected) return false;
    annotations.selected = null;
    annotations.editingNoteId = null;
    if (opts.render !== false) {
      renderHud();
      renderAnnotations();
    }
    return true;
  }

  function deselectAnnotations() {
    annotations.mode = 'idle';
    annotations.pendingArrowStart = null;
    annotations.pendingArrowPreview = null;
    annotations.selected = null;
    annotations.editingNoteId = null;
    inspector.selection = null;
    render();
  }

  function renderHud() {
    renderToolbar();
    renderHelp();
    renderSettings();
    renderInspector();
  }

  function renderSettings() {
    const existing = shadow.querySelector('.settings');
    if (existing) existing.remove();
    if (!state.settingsOpen) return;

    const panel = document.createElement('div');
    panel.className = 'settings';

    const title = document.createElement('h4');
    title.textContent = 'Target settings';
    panel.appendChild(title);

    const subtle = document.createElement('div');
    subtle.className = 'subtle';
    subtle.textContent = 'WCAG 24×24 stays standard. Apple and Android profiles add advisory findings.';
    panel.appendChild(subtle);

    const grid = document.createElement('div');
    grid.className = 'seg';
    [
      { key: 'web-default', label: 'Web default' },
      { key: 'apple-44pt', label: 'Apple 44pt' },
      { key: 'android-48dp', label: 'Android 48dp' },
      { key: 'both', label: 'Both' }
    ].forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'segbtn' + (state.touchProfile === option.key ? ' on' : '');
      button.textContent = option.label;
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        setTouchProfile(option.key);
      });
      grid.appendChild(button);
    });
    panel.appendChild(grid);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Active profile · ${currentTouchProfileLabel()}`;
    panel.appendChild(meta);

    shadow.appendChild(panel);
  }

  function renderInspector() {
    const existing = shadow.querySelector('.inspector');
    if (existing) existing.remove();
    const selection = inspector.selection;
    if (!selection || !selection.el || !selection.el.isConnected || !isVisible(selection.el)) {
      inspector.selection = null;
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'inspector';

    const head = document.createElement('div');
    head.className = 'inspector-head';

    const titleWrap = document.createElement('div');
    const eyebrow = document.createElement('div');
    eyebrow.className = 'inspector-eyebrow';
    eyebrow.textContent = 'Selection Inspector';
    eyebrow.style.color = selection.color || '#38bdf8';
    titleWrap.appendChild(eyebrow);

    const title = document.createElement('div');
    title.className = 'inspector-title';
    title.textContent = selection.label || selection.meta.kind;
    titleWrap.appendChild(title);
    head.appendChild(titleWrap);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'inspector-close';
    close.textContent = 'Close';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInspectorSelection();
    });
    head.appendChild(close);
    panel.appendChild(head);

    const body = document.createElement('div');
    body.className = 'inspector-body';
    inspectorRowsForSelection(selection).forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'inspector-row';

      const keyEl = document.createElement('div');
      keyEl.className = 'inspector-key';
      keyEl.textContent = key;
      row.appendChild(keyEl);

      const valueEl = document.createElement('div');
      valueEl.className = 'inspector-value';
      valueEl.textContent = value;
      row.appendChild(valueEl);

      body.appendChild(row);
    });

    const hint = document.createElement('div');
    hint.className = 'inspector-hint';
    hint.textContent = 'Click another label or badge to switch selection.';
    body.appendChild(hint);

    panel.appendChild(body);
    shadow.appendChild(panel);
  }

  function selectAnnotation(type, id, opts = {}) {
    const nextSelection = type && id ? { type, id } : null;
    const prev = annotations.selected;
    annotations.selected = nextSelection;
    if (opts.render !== false) {
      renderAnnotations();
      if (!prev || !nextSelection || prev.type !== nextSelection.type || prev.id !== nextSelection.id) {
        renderHud();
      }
    }
  }

  function setAnnotationMode(mode) {
    const nextMode = annotations.mode === mode ? 'idle' : mode;
    annotations.mode = nextMode;
    annotations.pendingArrowStart = null;
    annotations.pendingArrowPreview = null;
    renderHud();
    renderAnnotations();
  }

  function createNoteAt(point) {
    const id = nextAnnotationId('note');
    annotations.notes.push({
      id,
      x: point.x + 12,
      y: clampNoteY(point.y + 12),
      text: ''
    });
    annotations.mode = 'idle';
    annotations.pendingArrowStart = null;
    annotations.pendingArrowPreview = null;
    annotations.selected = { type: 'note', id };
    annotations.editingNoteId = null;
    renderHud();
    renderAnnotations();
    requestAnimationFrame(() => {
      const field = annotationHtml.querySelector(`[data-note-id="${id}"] textarea`);
      if (field) field.focus();
    });
  }

  function createArrow(start, end) {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    annotations.mode = 'idle';
    annotations.pendingArrowStart = null;
    annotations.pendingArrowPreview = null;
    if (distance < 8) {
      renderHud();
      renderAnnotations();
      return;
    }
    const id = nextAnnotationId('arrow');
    annotations.arrows.push({
      id,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    });
    annotations.selected = { type: 'arrow', id };
    renderHud();
    renderAnnotations();
  }

  function removeSelectedAnnotation() {
    if (!annotations.selected) return false;
    if (annotations.selected.type === 'note') {
      annotations.notes = annotations.notes.filter((note) => note.id !== annotations.selected.id);
    } else if (annotations.selected.type === 'arrow') {
      annotations.arrows = annotations.arrows.filter((arrow) => arrow.id !== annotations.selected.id);
    }
    annotations.selected = null;
    annotations.editingNoteId = null;
    renderHud();
    renderAnnotations();
    return true;
  }

  function stopDragging() {
    if (!dragState) return;
    window.removeEventListener('pointermove', handleGlobalPointerMove, true);
    window.removeEventListener('pointerup', stopDragging, true);
    dragState = null;
  }

  function beginDrag(nextDrag) {
    stopDragging();
    dragState = nextDrag;
    window.addEventListener('pointermove', handleGlobalPointerMove, true);
    window.addEventListener('pointerup', stopDragging, true);
  }

  function handleGlobalPointerMove(e) {
    if (!dragState) return;
    const point = docPointFromEvent(e);
    if (dragState.type === 'note') {
      const note = findNote(dragState.id);
      if (!note) return;
      note.x = point.x - dragState.offsetX;
      note.y = clampNoteY(point.y - dragState.offsetY);
      renderAnnotations();
      e.preventDefault();
      return;
    }

    if (dragState.type === 'arrow-point') {
      const arrow = findArrow(dragState.id);
      if (!arrow) return;
      arrow[dragState.xKey] = point.x;
      arrow[dragState.yKey] = point.y;
      renderAnnotations();
      e.preventDefault();
      return;
    }

    if (dragState.type === 'arrow') {
      const arrow = findArrow(dragState.id);
      if (!arrow) return;
      const dx = point.x - dragState.origin.x;
      const dy = point.y - dragState.origin.y;
      arrow.x1 = dragState.start.x1 + dx;
      arrow.y1 = dragState.start.y1 + dy;
      arrow.x2 = dragState.start.x2 + dx;
      arrow.y2 = dragState.start.y2 + dy;
      renderAnnotations();
      e.preventDefault();
    }
  }

  function beginNoteDrag(note, e) {
    const point = docPointFromEvent(e);
    selectAnnotation('note', note.id, { render: false });
    renderHud();
    beginDrag({
      type: 'note',
      id: note.id,
      offsetX: point.x - note.x,
      offsetY: point.y - note.y
    });
    renderAnnotations();
    e.preventDefault();
    e.stopPropagation();
  }

  function beginArrowPointDrag(arrow, pointKey, e) {
    selectAnnotation('arrow', arrow.id, { render: false });
    renderHud();
    beginDrag({
      type: 'arrow-point',
      id: arrow.id,
      xKey: pointKey === 'start' ? 'x1' : 'x2',
      yKey: pointKey === 'start' ? 'y1' : 'y2'
    });
    renderAnnotations();
    e.preventDefault();
    e.stopPropagation();
  }

  function beginArrowDrag(arrow, e) {
    selectAnnotation('arrow', arrow.id, { render: false });
    renderHud();
    beginDrag({
      type: 'arrow',
      id: arrow.id,
      origin: docPointFromEvent(e),
      start: {
        x1: arrow.x1,
        y1: arrow.y1,
        x2: arrow.x2,
        y2: arrow.y2
      }
    });
    renderAnnotations();
    e.preventDefault();
    e.stopPropagation();
  }

  function renderAnnotations() {
    annotationHtml.innerHTML = '';
    annotationSvg.innerHTML = `
      <defs>
        <marker id="a11yov-arrowhead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${COLOR.annotate}"></path>
        </marker>
        <marker id="a11yov-arrowhead-selected" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${COLOR.annotateSelected}"></path>
        </marker>
      </defs>
    `;

    annotationCapture.classList.toggle('active', annotations.mode === 'note' || annotations.mode === 'arrow');

    annotations.arrows.forEach((arrow) => {
      const start = viewportPoint(arrow.x1, arrow.y1);
      const end = viewportPoint(arrow.x2, arrow.y2);
      const selected = annotations.selected && annotations.selected.type === 'arrow' && annotations.selected.id === arrow.id;

      const visible = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      visible.setAttribute('x1', String(start.x));
      visible.setAttribute('y1', String(start.y));
      visible.setAttribute('x2', String(end.x));
      visible.setAttribute('y2', String(end.y));
      visible.setAttribute('class', `annotation-line${selected ? ' selected' : ''}`);
      if (selected) visible.setAttribute('marker-end', 'url(#a11yov-arrowhead-selected)');
      annotationSvg.appendChild(visible);

      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hit.setAttribute('x1', String(start.x));
      hit.setAttribute('y1', String(start.y));
      hit.setAttribute('x2', String(end.x));
      hit.setAttribute('y2', String(end.y));
      hit.setAttribute('class', 'annotation-hit');
      hit.addEventListener('pointerdown', (e) => beginArrowDrag(arrow, e));
      annotationSvg.appendChild(hit);

      if (selected) {
        [
          { key: 'start', x: start.x, y: start.y },
          { key: 'end', x: end.x, y: end.y }
        ].forEach((handlePoint) => {
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          handle.setAttribute('cx', String(handlePoint.x));
          handle.setAttribute('cy', String(handlePoint.y));
          handle.setAttribute('r', '6');
          handle.setAttribute('class', 'annotation-handle');
          handle.addEventListener('pointerdown', (e) => beginArrowPointDrag(arrow, handlePoint.key, e));
          annotationSvg.appendChild(handle);
        });
      }
    });

    if (annotations.mode === 'arrow' && annotations.pendingArrowStart) {
      const start = viewportPoint(annotations.pendingArrowStart.x, annotations.pendingArrowStart.y);
      const previewSource = annotations.pendingArrowPreview || annotations.pendingArrowStart;
      const end = viewportPoint(previewSource.x, previewSource.y);

      const pending = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      pending.setAttribute('x1', String(start.x));
      pending.setAttribute('y1', String(start.y));
      pending.setAttribute('x2', String(end.x));
      pending.setAttribute('y2', String(end.y));
      pending.setAttribute('class', 'annotation-preview');
      annotationSvg.appendChild(pending);

      const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      anchor.setAttribute('cx', String(start.x));
      anchor.setAttribute('cy', String(start.y));
      anchor.setAttribute('r', '5');
      anchor.setAttribute('class', 'annotation-anchor');
      annotationSvg.appendChild(anchor);
    }

    annotations.notes.forEach((note) => {
      const point = viewportPoint(note.x, note.y);
      const selected = annotations.selected && annotations.selected.type === 'note' && annotations.selected.id === note.id;
      const noteEl = document.createElement('div');
      noteEl.className = `note${selected ? ' selected' : ''}`;
      noteEl.dataset.noteId = note.id;
      noteEl.style.left = `${point.x}px`;
      noteEl.style.top = `${point.y}px`;

      const head = document.createElement('div');
      head.className = 'note-head';
      head.addEventListener('pointerdown', (e) => beginNoteDrag(note, e));

      const title = document.createElement('div');
      title.className = 'note-title';
      title.textContent = 'Note';
      head.appendChild(title);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'note-delete';
      remove.textContent = 'Remove';
      remove.title = 'Delete note';
      remove.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      remove.addEventListener('click', (e) => {
        annotations.notes = annotations.notes.filter((item) => item.id !== note.id);
        if (annotations.selected && annotations.selected.type === 'note' && annotations.selected.id === note.id) {
          annotations.selected = null;
        }
        if (annotations.editingNoteId === note.id) {
          annotations.editingNoteId = null;
        }
        renderHud();
        renderAnnotations();
        e.stopPropagation();
      });
      head.appendChild(remove);
      noteEl.appendChild(head);

      const body = document.createElement('div');
      body.className = 'note-body';
      const textarea = document.createElement('textarea');
      textarea.dataset.noteId = note.id;
      textarea.value = note.text;
      textarea.placeholder = 'Write a UI note...';
      textarea.addEventListener('input', () => {
        note.text = textarea.value;
      });
      textarea.addEventListener('focus', () => {
        annotations.selected = { type: 'note', id: note.id };
        syncEditingNoteFromFocus();
      });
      textarea.addEventListener('blur', () => {
        requestAnimationFrame(() => {
          syncEditingNoteFromFocus();
        });
      });
      body.appendChild(textarea);
      noteEl.appendChild(body);
      annotationHtml.appendChild(noteEl);
    });
  }

  function handleCapturePointerDown(e) {
    if (annotations.mode !== 'note' && annotations.mode !== 'arrow') return;
    const point = docPointFromEvent(e);
    if (annotations.mode === 'note') {
      createNoteAt(point);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!annotations.pendingArrowStart) {
      annotations.pendingArrowStart = point;
      annotations.pendingArrowPreview = point;
      renderHud();
      renderAnnotations();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    createArrow(annotations.pendingArrowStart, point);
    e.preventDefault();
    e.stopPropagation();
  }

  function handleCapturePointerMove(e) {
    if (annotations.mode !== 'arrow' || !annotations.pendingArrowStart) return;
    annotations.pendingArrowPreview = docPointFromEvent(e);
    renderAnnotations();
  }

  function handleCapturePointerLeave() {
    if (annotations.mode !== 'arrow' || !annotations.pendingArrowStart) return;
    annotations.pendingArrowPreview = annotations.pendingArrowStart;
    renderAnnotations();
  }

  annotationCapture.addEventListener('pointerdown', handleCapturePointerDown, true);
  annotationCapture.addEventListener('pointermove', handleCapturePointerMove, true);
  annotationCapture.addEventListener('pointerleave', handleCapturePointerLeave, true);

  // ---------- render ----------
  function clearExportNoticeLater() {
    if (exportNoticeTimer) clearTimeout(exportNoticeTimer);
    exportNoticeTimer = setTimeout(() => {
      exportNoticeTimer = 0;
      state.exportNotice = '';
      state.exportNoticeTone = 'muted';
      render();
    }, EXPORT_NOTICE_MS);
  }

  function setExportNotice(message, tone = 'muted') {
    state.exportNotice = message;
    state.exportNoticeTone = tone;
    render();
    clearExportNoticeLater();
  }

  function formatExportError(error) {
    const message = error && error.message ? error.message : String(error);
    if (/Extension context invalidated/i.test(message)) {
      return 'Extension reloaded. Refresh the page and inject again.';
    }
    if (/No recent export is ready/i.test(message)) {
      return 'Copy window lost its page context. Run Copy PNG again.';
    }
    return message;
  }

  async function exportPng(target) {
    if (target === 'clipboard') {
      await openCopyWindow();
      return;
    }

    if (!EXTENSION_RUNTIME || state.exportBusy) return;
    state.exportBusy = true;

    try {
      const response = await EXTENSION_RUNTIME.sendMessage({
        type: EXPORT_MESSAGE,
        target
      });

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : 'Export failed.');
      }

      setExportNotice(
        target === 'clipboard' ? 'PNG copied to clipboard' : 'PNG save dialog opened',
        'success'
      );
    } catch (error) {
      setExportNotice(
        formatExportError(error),
        'error'
      );
    } finally {
      state.exportBusy = false;
    }
  }

  async function openCopyWindow() {
    if (!EXTENSION_RUNTIME || state.exportBusy) return;
    state.exportBusy = true;

    try {
      const response = await EXTENSION_RUNTIME.sendMessage({
        type: OPEN_EXPORT_WINDOW_MESSAGE
      });

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : 'Could not open the copy window.');
      }

      setExportNotice('Focused copy window opened', 'success');
    } catch (error) {
      setExportNotice(
        formatExportError(error),
        'error'
      );
    } finally {
      state.exportBusy = false;
    }
  }

  function renderToolbar() {
    toolbar.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = 'a11y';
    toolbar.appendChild(title);

    const modeSeg = document.createElement('div');
    modeSeg.className = 'seg';
    [
      { key: 'conformance', label: 'Conf' },
      { key: 'review', label: 'Review' }
    ].forEach((mode) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'segbtn' + (state.layerMode === mode.key ? ' on' : '');
      button.textContent = mode.label;
      button.title = mode.key === 'conformance'
        ? 'Conformance mode: standard and advisory slices'
        : 'Review mode: enables heuristic slices';
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (applyLayerMode(mode.key)) {
          render();
        }
      });
      modeSeg.appendChild(button);
    });
    toolbar.appendChild(modeSeg);

    SLICES.forEach((slice) => {
      const visibleActive = sliceVisible(slice.key);
      const reviewOnly = slice.minLayer === 'review' && state.layerMode !== 'review';
      const b = document.createElement('button');
      b.className = 'tbtn' + (visibleActive ? ' on' : '') + (reviewOnly ? ' review-only' : '');
      b.style.background = visibleActive ? slice.color : 'transparent';
      b.style.borderColor = visibleActive ? slice.color : '';
      b.innerHTML = `<span>${slice.label}</span><span class="kbd">${slice.kbd}</span>`;
      b.title = reviewOnly
        ? `${slice.label} is available in Review mode (${slice.kbd})`
        : `Toggle ${slice.label} (${slice.kbd})`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (toggleSliceState(slice.key)) {
          render();
        }
      });
      toolbar.appendChild(b);
    });

    const sep = document.createElement('span'); sep.className = 'sep'; toolbar.appendChild(sep);
    const help = document.createElement('button');
    help.className = 'tbtn' + (state.helpOpen ? ' on' : '');
    help.style.background = state.helpOpen ? '#e7e5e4' : 'transparent';
    help.style.borderColor = state.helpOpen ? '#e7e5e4' : '';
    help.innerHTML = `<span>?</span>`;
    help.title = 'Toggle help';
    help.addEventListener('click', (e) => { e.stopPropagation(); state.helpOpen = !state.helpOpen; render(); });
    toolbar.appendChild(help);

    const settings = document.createElement('button');
    settings.className = 'tbtn' + (state.settingsOpen ? ' on' : '');
    settings.style.background = state.settingsOpen ? '#22d3ee' : 'transparent';
    settings.style.borderColor = state.settingsOpen ? '#22d3ee' : '';
    settings.innerHTML = '<span>Cfg</span>';
    settings.title = 'Target size settings';
    settings.addEventListener('click', (e) => {
      e.stopPropagation();
      state.settingsOpen = !state.settingsOpen;
      render();
    });
    toolbar.appendChild(settings);

    const annotationSep = document.createElement('span'); annotationSep.className = 'sep'; toolbar.appendChild(annotationSep);
    [
      { mode: 'note', label: 'Note', kbd: 'N', color: COLOR.noteBorder },
      { mode: 'arrow', label: 'Arrow', kbd: 'W', color: COLOR.annotate }
    ].forEach((item) => {
      const button = document.createElement('button');
      button.className = 'tbtn' + (annotations.mode === item.mode ? ' on' : '');
      button.style.background = annotations.mode === item.mode ? item.color : 'transparent';
      button.style.borderColor = annotations.mode === item.mode ? item.color : '';
      button.innerHTML = `<span>${item.label}</span><span class="kbd">${item.kbd}</span>`;
      button.title = `${item.label} mode (${item.kbd})`;
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        setAnnotationMode(item.mode);
      });
      toolbar.appendChild(button);
    });

    const select = document.createElement('button');
    const deselectActive = annotations.mode !== 'idle' || !!annotations.selected;
    select.className = 'tbtn' + (deselectActive ? ' on' : '');
    select.style.background = deselectActive ? '#38bdf8' : 'transparent';
    select.style.borderColor = deselectActive ? '#38bdf8' : '';
    select.innerHTML = '<span>Deselect</span><span class="kbd">V</span>';
    select.title = 'Exit placement mode and clear selection (V)';
    select.addEventListener('click', (e) => {
      e.stopPropagation();
      deselectAnnotations();
    });
    toolbar.appendChild(select);

    if (CAN_EXPORT_FROM_EXTENSION) {
      const exportSep = document.createElement('span'); exportSep.className = 'sep'; toolbar.appendChild(exportSep);

      const copy = document.createElement('button');
      copy.className = 'tbtn';
      copy.innerHTML = '<span>Copy PNG</span><span class="kbd">C</span>';
      copy.title = 'Open the focused copy window for this viewport (C)';
      copy.addEventListener('click', (e) => {
        e.stopPropagation();
        openCopyWindow();
      });
      toolbar.appendChild(copy);

      const save = document.createElement('button');
      save.className = 'tbtn';
      save.innerHTML = '<span>Save PNG</span><span class="kbd">S</span>';
      save.title = 'Save current viewport as PNG (S)';
      save.addEventListener('click', (e) => {
        e.stopPropagation();
        exportPng('download');
      });
      toolbar.appendChild(save);
    }

    const modeStatus = modeLabel();
    if (modeStatus) {
      const status = document.createElement('span');
      status.className = 'status mode';
      status.textContent = modeStatus;
      toolbar.appendChild(status);
    }

    const editingStatus = editingAnnotationLabel();
    if (editingStatus) {
      const status = document.createElement('span');
      status.className = 'status paused';
      status.textContent = editingStatus;
      toolbar.appendChild(status);
    }

    const selectionStatus = selectedAnnotationLabel();
    if (selectionStatus) {
      const status = document.createElement('span');
      status.className = 'status';
      status.textContent = selectionStatus;
      toolbar.appendChild(status);
    }

    if (state.exportNotice) {
      const status = document.createElement('span');
      status.className = `status ${state.exportNoticeTone || 'muted'}`;
      status.textContent = state.exportNotice;
      toolbar.appendChild(status);
    }

    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '×';
    close.title = 'Remove overlay (X)';
    close.addEventListener('click', (e) => { e.stopPropagation(); teardown(); });
    toolbar.appendChild(close);
  }

  function render() {
    renderHud();
    layer.innerHTML = '';
    const marks = [];
    let inspectorMatched = !inspector.selection;
    // Paint order: quieter/denser layers first so louder layers sit on top.
    if (sliceVisible('grid')) marks.push(...scanGrid());
    if (sliceVisible('depth')) marks.push(...scanDepth());
    if (sliceVisible('landmark')) marks.push(...scanLandmarks());
    if (sliceVisible('heading')) marks.push(...scanHeadings());
    if (sliceVisible('interact')) marks.push(...scanInteract());
    if (sliceVisible('form')) marks.push(...scanForms());
    if (sliceVisible('target')) marks.push(...scanTargets());
    if (sliceVisible('repeat')) marks.push(...scanRepeats());
    if (sliceVisible('alt')) marks.push(...scanAlt());
    if (sliceVisible('focus')) marks.push(...scanFocus());

    marks.forEach(m => {
      const r = rect(m.el);
      if (r.w === 0 || r.h === 0) return;
      const inspectable = !!(m.meta && m.meta.kind);
      const inspected = inspectable && !!(
        inspector.selection &&
        inspector.selection.el === m.el &&
        inspector.selection.meta &&
        inspector.selection.meta.kind === m.meta.kind
      );
      if (inspected) inspectorMatched = true;
      const node = makeMark(r, m.color, {
        ...(m.opts || {}),
        label: m.label,
        inspectable,
        inspected,
        onInspect: inspectable ? () => { selectInspectorEntry(m); } : null
      });
      layer.appendChild(node);
    });
    if (!inspectorMatched && inspector.selection) {
      inspector.selection = null;
      renderHud();
    }
    renderAnnotations();
  }

  function renderHelp() {
    const existing = shadow.querySelector('.help');
    if (existing) existing.remove();
    if (!state.helpOpen) return;
    const el = document.createElement('div');
    el.className = 'help';
    el.innerHTML = `
      <h4>overlay · keys</h4>
      <div class="row"><kbd>Mode</kbd><span class="desc">${state.layerMode === 'review' ? 'Review · heuristics visible' : 'Conformance · heuristics hidden'}</span></div>
      <div class="row"><kbd>Touch</kbd><span class="desc">${currentTouchProfileLabel()}</span></div>
      <div class="row ${sliceVisible('landmark') ? 'on' : ''}"><kbd>L</kbd><span class="desc">Landmarks</span></div>
      <div class="row ${sliceVisible('heading')  ? 'on' : ''}"><kbd>H</kbd><span class="desc">Headings (h1–h6)</span></div>
      <div class="row ${sliceVisible('interact') ? 'on' : ''}"><kbd>I</kbd><span class="desc">Interactive</span></div>
      <div class="row ${sliceVisible('form')     ? 'on' : ''}"><kbd>M</kbd><span class="desc">Forms / labeling audit</span></div>
      <div class="row ${sliceVisible('target')   ? 'on' : ''}"><kbd>T</kbd><span class="desc">Targets under 24×24 without spacing relief</span></div>
      <div class="row ${sliceVisible('alt')      ? 'on' : ''}"><kbd>A</kbd><span class="desc">Visible imgs missing alt</span></div>
      <div class="row ${sliceVisible('repeat')   ? 'on' : ''}"><kbd>R</kbd><span class="desc">Repeating components · review</span></div>
      <div class="row ${sliceVisible('focus')    ? 'on' : ''}"><kbd>F</kbd><span class="desc">Tab order</span></div>
      <div class="row ${sliceVisible('depth')    ? 'on' : ''}"><kbd>D</kbd><span class="desc">Depth outline · review</span></div>
      <div class="row ${sliceVisible('grid')     ? 'on' : ''}"><kbd>G</kbd><span class="desc">Grid · block boxes · review</span></div>
      <div class="row ${annotations.mode === 'note' ? 'on' : ''}"><kbd>N</kbd><span class="desc">Place note</span></div>
      <div class="row ${annotations.mode === 'arrow' ? 'on' : ''}"><kbd>W</kbd><span class="desc">Place arrow</span></div>
      <div class="row"><kbd>Click</kbd><span class="desc">Label or badge opens inspector</span></div>
      <div class="row"><kbd>V</kbd><span class="desc">Deselect and exit placement</span></div>
      <div class="row"><kbd>Del</kbd><span class="desc">Delete or Backspace removes selected note or arrow</span></div>
      ${CAN_EXPORT_FROM_EXTENSION ? '<div class="row"><kbd>C</kbd><span class="desc">Open focused copy window</span></div>' : ''}
      ${CAN_EXPORT_FROM_EXTENSION ? '<div class="row"><kbd>S</kbd><span class="desc">Save viewport PNG</span></div>' : ''}
      <div class="row"><kbd>?</kbd><span class="desc">Toggle this help</span></div>
      <div class="row"><kbd>Cfg</kbd><span class="desc">Touch target settings</span></div>
      <div class="row"><kbd>X</kbd><span class="desc">Remove overlay</span></div>
      <div class="meta">v${VERSION} · a11y-overlay</div>
    `;
    shadow.appendChild(el);
  }

  // ---------- throttled re-render on scroll/resize/mutation ----------
  let raf = 0;
  function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; render(); });
  }

  window.addEventListener('scroll', scheduleRender, { passive: true, capture: true });
  window.addEventListener('resize', scheduleRender, { passive: true });

  const mo = new MutationObserver((mutations) => {
    // Ignore mutations that only touch our own shadow host
    for (const m of mutations) {
      if (m.target === host || (host.contains && host.contains(m.target))) continue;
      scheduleRender();
      return;
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });

  // ---------- keys ----------
  const keymap = {
    'l': () => { toggleSliceState('landmark'); },
    'h': () => { toggleSliceState('heading'); },
    'i': () => { toggleSliceState('interact'); },
    'm': () => { toggleSliceState('form'); },
    't': () => { toggleSliceState('target'); },
    'a': () => { toggleSliceState('alt'); },
    'r': () => { toggleSliceState('repeat'); },
    'f': () => { toggleSliceState('focus'); },
    'd': () => { toggleSliceState('depth'); },
    'g': () => { toggleSliceState('grid'); },
    'n': () => { setAnnotationMode('note'); },
    'w': () => { setAnnotationMode('arrow'); },
    'v': () => { deselectAnnotations(); },
    '?': () => { state.helpOpen = !state.helpOpen; },
    '/': () => { state.helpOpen = !state.helpOpen; }
  };

  function isEditableNode(node) {
    if (!node || typeof node !== 'object' || node.nodeType !== 1) return false;
    if (node.isContentEditable) return true;
    return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT';
  }

  function getDeepActiveElement(root) {
    if (!root || !root.activeElement) return null;
    let current = root.activeElement;
    while (current && current.shadowRoot && current.shadowRoot.activeElement) {
      current = current.shadowRoot.activeElement;
    }
    return current;
  }

  function isEditableEventTarget(e) {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
    const nodes = Array.isArray(path) && path.length ? path : [e.target];
    if (nodes.some(isEditableNode)) return true;
    if (isEditableNode(getDeepActiveElement(document))) return true;
    if (isEditableNode(getDeepActiveElement(shadow))) return true;
    return false;
  }

  function isInteractivePageTarget(node) {
    if (!node || typeof node.closest !== 'function') return false;
    return !!node.closest(
      'a,button,input,textarea,select,summary,label,[role="button"],[role="link"],[role="textbox"],[contenteditable=""],[contenteditable="true"]'
    );
  }

  function handleHotkey(e) {
    // don't hijack typing
    if (isEditableEventTarget(e)) return;
    // don't fire on modified combos (Cmd+R, Ctrl+F, etc.)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && annotations.selected) {
      if (removeSelectedAnnotation()) {
        e.preventDefault();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'x') { teardown(); return; }
    if (e.key === 'Escape') {
      deselectAnnotations();
      e.preventDefault();
      return;
    }
    if (CAN_EXPORT_FROM_EXTENSION && k === 'c') { openCopyWindow(); e.preventDefault(); return; }
    if (CAN_EXPORT_FROM_EXTENSION && k === 's') { exportPng('download'); e.preventDefault(); return; }
    const fn = keymap[k] || keymap[e.key];
    if (fn) {
      const beforeMode = annotations.mode;
      fn();
      if (beforeMode === annotations.mode && !['n', 'w', 'v'].includes(k)) {
        render();
      }
      e.preventDefault();
    }
  }

  let hotkeyTarget = null;
  function handleWindowPointerDown(e) {
    if (annotations.mode !== 'idle') return;
    if (!annotations.selected && !inspector.selection) return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
    if (Array.isArray(path) && path.includes(host)) return;
    if (isInteractivePageTarget(e.target)) return;
    const clearedAnnotation = clearSelection({ render: false });
    const clearedInspector = clearInspectorSelection({ render: false });
    if (clearedAnnotation || clearedInspector) {
      render();
    }
  }

  function bindHotkeys() {
    hotkeyTarget = window;
    hotkeyTarget.addEventListener('keydown', handleHotkey, true);
    hotkeyTarget.addEventListener('pointerdown', handleWindowPointerDown, true);
  }

  // allow parent frame to forward keys via postMessage
  function onMessage(e) {
    const d = e.data;
    if (!d || d.__a11yov !== true) return;
    if (d.key) {
      handleHotkey({ key: d.key, target: document.body, preventDefault() {}, stopPropagation() {}, metaKey: false, ctrlKey: false, altKey: false });
    }
  }
  window.addEventListener('message', onMessage);

  function teardown() {
    stopDragging();
    mo.disconnect();
    window.removeEventListener('scroll', scheduleRender, true);
    window.removeEventListener('resize', scheduleRender);
    if (hotkeyTarget) {
      hotkeyTarget.removeEventListener('keydown', handleHotkey, true);
      hotkeyTarget.removeEventListener('pointerdown', handleWindowPointerDown, true);
      hotkeyTarget = null;
    }
    window.removeEventListener('message', onMessage);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (exportNoticeTimer) { clearTimeout(exportNoticeTimer); exportNoticeTimer = 0; }
    host.remove();
    window.__a11yOverlayInstalled = null;
  }

  // ---------- api ----------
  window.__a11yOverlayInstalled = {
    toggleHelp() { state.helpOpen = !state.helpOpen; render(); },
    toggle(key) {
      if (getSliceMeta(key)) {
        if (toggleSliceState(key)) render();
        return;
      }
      if (key in state) {
        state[key] = !state[key];
        render();
      }
    },
    collectDetections,
    exportPng,
    setAnnotationMode,
    setLayerMode(mode) {
      if (applyLayerMode(mode)) render();
    },
    annotations,
    teardown,
    state,
    render
  };

    bindHotkeys();

    // initial paint
    render();
    loadPersistedSettings();
  }

  install();
})();
