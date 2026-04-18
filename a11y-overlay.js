/*
 * a11y-overlay.js — live element / component highlighter
 *
 * Toggles (keyboard-only UI):
 *   ?    — show/hide help
 *   L    — Landmarks (header, nav, main, section, footer, aside, form, article)
 *   H    — Headings outline (h1–h6)
 *   I    — Interactive (a, button, input, textarea, select, [role=button], [tabindex])
 *   A    — Alt-missing images
 *   R    — Repeating components (siblings with matching DOM signature)
 *   F    — Focus / tab order (numbered badges)
 *   D    — Depth hierarchy (nested outline colors per DOM depth)
 *   G    — Grid (implicit block boundaries of every block-level element)
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

  const COLOR = {
    landmark: '#f59e0b',    // amber
    heading:  '#22d3ee',    // cyan
    interact: '#a3e635',    // lime
    alt:      '#fb7185',    // rose (error)
    repeat:   '#a78bfa',    // violet
    focus:    '#60a5fa',    // blue
    grid:     '#64748b',    // slate — neutral, low-contrast grid
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
    </style>
    <div class="layer" id="layer"></div>
    <div class="toolbar" id="toolbar"></div>
  `;

  const layer = shadow.getElementById('layer');
  const toolbar = shadow.getElementById('toolbar');

  // ---------- state ----------
  const state = {
    landmark: true,
    heading: true,
    interact: false,
    alt: true,
    repeat: false,
    focus: false,
    depth: false,
    grid: false,
    helpOpen: true
  };

  // ---------- utils ----------
  function rect(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
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
      el.appendChild(t);
    }
    if (opts.badge) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.style.background = color;
      b.textContent = opts.badge;
      b.style.top = '-9px';
      b.style.left = '-9px';
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
          opts: { thick: true, fill: 'rgba(245,158,11,0.05)' }
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
        opts: jumped ? { thick: true, fill: 'rgba(251,113,133,0.12)', labelInvert: true } : {}
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
        opts: { dashed: true }
      });
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
        opts: { thick: true, fill: 'rgba(251,113,133,0.15)', labelInvert: true }
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
            opts: { dashed: true, labelBottom: i > 0 }
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

  // ---------- render ----------
  const LAYERS = [
    { key: 'landmark', kbd: 'L', label: 'Landmarks', color: COLOR.landmark },
    { key: 'heading',  kbd: 'H', label: 'Headings',  color: COLOR.heading  },
    { key: 'interact', kbd: 'I', label: 'Interact',  color: COLOR.interact },
    { key: 'alt',      kbd: 'A', label: 'Alt',       color: COLOR.alt      },
    { key: 'repeat',   kbd: 'R', label: 'Repeats',   color: COLOR.repeat   },
    { key: 'focus',    kbd: 'F', label: 'Tab order', color: COLOR.focus    },
    { key: 'depth',    kbd: 'D', label: 'Depth',     color: COLOR.depth1   },
    { key: 'grid',     kbd: 'G', label: 'Grid',      color: COLOR.grid     }
  ];

  function renderToolbar() {
    toolbar.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = 'a11y';
    toolbar.appendChild(title);

    LAYERS.forEach(L => {
      const b = document.createElement('button');
      b.className = 'tbtn' + (state[L.key] ? ' on' : '');
      b.style.background = state[L.key] ? L.color : 'transparent';
      b.style.borderColor = state[L.key] ? L.color : '';
      b.innerHTML = `<span>${L.label}</span><span class="kbd">${L.kbd}</span>`;
      b.title = `Toggle ${L.label} (${L.kbd})`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        state[L.key] = !state[L.key];
        render();
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

    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '×';
    close.title = 'Remove overlay (X)';
    close.addEventListener('click', (e) => { e.stopPropagation(); teardown(); });
    toolbar.appendChild(close);
  }

  function render() {
    layer.innerHTML = '';
    renderToolbar();
    renderHelp();
    const marks = [];
    // Paint order: quieter/denser layers first so louder layers sit on top.
    if (state.grid) marks.push(...scanGrid());
    if (state.depth) marks.push(...scanDepth());
    if (state.landmark) marks.push(...scanLandmarks());
    if (state.heading) marks.push(...scanHeadings());
    if (state.interact) marks.push(...scanInteract());
    if (state.repeat) marks.push(...scanRepeats());
    if (state.alt) marks.push(...scanAlt());
    if (state.focus) marks.push(...scanFocus());

    marks.forEach(m => {
      const r = rect(m.el);
      if (r.w === 0 || r.h === 0) return;
      const node = makeMark(r, m.color, { ...(m.opts || {}), label: m.label });
      layer.appendChild(node);
    });
  }

  function renderHelp() {
    const existing = shadow.querySelector('.help');
    if (existing) existing.remove();
    if (!state.helpOpen) return;
    const el = document.createElement('div');
    el.className = 'help';
    el.innerHTML = `
      <h4>overlay · keys</h4>
      <div class="row ${state.landmark ? 'on' : ''}"><kbd>L</kbd><span class="desc">Landmarks</span></div>
      <div class="row ${state.heading  ? 'on' : ''}"><kbd>H</kbd><span class="desc">Headings (h1–h6)</span></div>
      <div class="row ${state.interact ? 'on' : ''}"><kbd>I</kbd><span class="desc">Interactive</span></div>
      <div class="row ${state.alt      ? 'on' : ''}"><kbd>A</kbd><span class="desc">Alt-missing imgs</span></div>
      <div class="row ${state.repeat   ? 'on' : ''}"><kbd>R</kbd><span class="desc">Repeating components</span></div>
      <div class="row ${state.focus    ? 'on' : ''}"><kbd>F</kbd><span class="desc">Tab order</span></div>
      <div class="row ${state.depth    ? 'on' : ''}"><kbd>D</kbd><span class="desc">Depth outline</span></div>
      <div class="row ${state.grid     ? 'on' : ''}"><kbd>G</kbd><span class="desc">Grid · block boxes</span></div>
      <div class="row"><kbd>?</kbd><span class="desc">Toggle this help</span></div>
      <div class="row"><kbd>X</kbd><span class="desc">Remove overlay</span></div>
      <div class="meta">v0.1 · a11y-overlay</div>
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
    'l': () => { state.landmark = !state.landmark; },
    'h': () => { state.heading = !state.heading; },
    'i': () => { state.interact = !state.interact; },
    'a': () => { state.alt = !state.alt; },
    'r': () => { state.repeat = !state.repeat; },
    'f': () => { state.focus = !state.focus; },
    'd': () => { state.depth = !state.depth; },
    'g': () => { state.grid = !state.grid; },
    '?': () => { state.helpOpen = !state.helpOpen; },
    '/': () => { state.helpOpen = !state.helpOpen; }
  };

  function handleHotkey(e) {
    // don't hijack typing
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.isContentEditable))) return;
    // don't fire on modified combos (Cmd+R, Ctrl+F, etc.)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'x') { teardown(); return; }
    const fn = keymap[k] || keymap[e.key];
    if (fn) { fn(); render(); e.preventDefault(); }
  }

  let hotkeyTarget = null;
  function bindHotkeys() {
    hotkeyTarget = window;
    hotkeyTarget.addEventListener('keydown', handleHotkey, true);
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
    mo.disconnect();
    window.removeEventListener('scroll', scheduleRender, true);
    window.removeEventListener('resize', scheduleRender);
    if (hotkeyTarget) {
      hotkeyTarget.removeEventListener('keydown', handleHotkey, true);
      hotkeyTarget = null;
    }
    window.removeEventListener('message', onMessage);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    host.remove();
    window.__a11yOverlayInstalled = null;
  }

  // ---------- api ----------
  window.__a11yOverlayInstalled = {
    toggleHelp() { state.helpOpen = !state.helpOpen; render(); },
    toggle(key) { if (key in state) { state[key] = !state[key]; render(); } },
    teardown,
    state,
    render
  };

    bindHotkeys();

    // initial paint
    render();
  }

  install();
})();
