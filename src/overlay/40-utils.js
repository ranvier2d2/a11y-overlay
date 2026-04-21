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

  function getPresetMeta(presetId) {
    return PRESET_BY_ID[presetId] || null;
  }

  function activePresetId() {
    const enabledSlices = serializeSlices();
    const match = PRESETS.find((preset) => {
      if (preset.layerMode !== state.layerMode) return false;
      if (preset.touchProfile !== state.touchProfile) return false;
      return SLICES.every((slice) => !!enabledSlices[slice.key] === !!preset.enabledSlices[slice.key]);
    });
    return match ? match.id : '';
  }

  function activePresetLabel() {
    const presetId = activePresetId();
    if (!presetId) return 'Custom';
    const preset = getPresetMeta(presetId);
    return preset ? preset.label : 'Custom';
  }

  function formatFindingType(value) {
    if (value === 'standard') return 'Standard';
    if (value === 'advisory') return 'Advisory';
    if (value === 'heuristic') return 'Heuristic';
    if (value === 'mixed') return 'Mixed';
    return '';
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function slugToken(value, fallback = 'page') {
    const normalized = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || fallback;
  }

  function timestampToken(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('') + '-' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join('');
  }

  function normalizedPageUrl(url = location.href) {
    try {
      const parsed = new URL(url, location.href);
      parsed.hash = '';
      return parsed.toString();
    } catch (_error) {
      return String(url || location.href || '').split('#')[0];
    }
  }

  function pageStorageKey() {
    return `${SESSION_STORAGE_PREFIX}${normalizedPageUrl()}`;
  }

  function reportFileStem() {
    let host = 'page';
    try {
      const parsed = new URL(location.href);
      host = parsed.protocol === 'file:' ? 'local-file' : slugToken(parsed.hostname || 'page', 'page');
    } catch (_error) {
      host = 'page';
    }
    return `a11y-overlay-${host}-${timestampToken()}`;
  }

  function evidenceLine(label, value) {
    const nextValue = textSnippet(value, 240);
    if (!label || !nextValue) return null;
    return `${label}: ${nextValue}`;
  }

  function evidenceBlock(items) {
    return (items || [])
      .map((item) => evidenceLine(item.label, item.value))
      .filter(Boolean)
      .join('\n');
  }

  function sourceBlock(items) {
    return (items || [])
      .map((item) => {
        if (!item || !item.label) return '';
        const sourceType = item.type ? ` (${formatFindingType(item.type) || titleCase(item.type)})` : '';
        return item.url ? `${item.label}${sourceType}\n${item.url}` : `${item.label}${sourceType}`;
      })
      .filter(Boolean)
      .join('\n\n');
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

  async function readPersistedValue(key) {
    const storage = getStorageArea();
    if (storage && typeof storage.get === 'function') {
      const stored = await storage.get([key]);
      return stored[key];
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw);
      } catch (_error) {
        return raw;
      }
    }
    return undefined;
  }

  async function writePersistedValue(key, value) {
    const storage = getStorageArea();
    if (storage && typeof storage.set === 'function') {
      await storage.set({ [key]: value });
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  async function removePersistedValue(key) {
    const storage = getStorageArea();
    if (storage && typeof storage.remove === 'function') {
      await storage.remove([key]);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }

  async function loadPersistedSettings() {
    let nextProfile = 'web-default';
    try {
      const stored = await readPersistedValue(TOUCH_PROFILE_STORAGE_KEY);
      nextProfile = typeof stored === 'string' ? stored : nextProfile;
    } catch (_error) {
      nextProfile = 'web-default';
    }

    if (nextProfile !== state.touchProfile) {
      state.touchProfile = nextProfile;
      render();
    }
  }

  async function persistTouchProfile(value) {
    await writePersistedValue(TOUCH_PROFILE_STORAGE_KEY, value);
  }

  function setTouchProfile(value) {
    if (!value || value === state.touchProfile) return;
    state.touchProfile = value;
    persistTouchProfile(value).catch(() => {});
    scheduleSessionPersist();
    queueToolbarNotice(`Touch profile: ${currentTouchProfileLabel()}`, 'mode');
    render();
  }

  function applySliceMap(enabledSlices) {
    SLICES.forEach((slice) => {
      state[slice.key] = !!(enabledSlices && enabledSlices[slice.key]);
    });
  }

  function applyPreset(presetId, opts = {}) {
    const preset = getPresetMeta(presetId);
    if (!preset) return false;
    const { announce = true } = opts;
    state.layerMode = preset.layerMode;
    state.touchProfile = preset.touchProfile;
    persistTouchProfile(state.touchProfile).catch(() => {});
    applySliceMap(preset.enabledSlices);
    clearIncompatibleInspectorSelection(state.layerMode);
    scheduleSessionPersist();
    if (announce) {
      queueToolbarNotice(`Preset: ${preset.label}`, 'mode');
    }
    render();
    return true;
  }

  function serializeSlices() {
    const enabled = {};
    SLICES.forEach((slice) => {
      enabled[slice.key] = !!state[slice.key];
    });
    return enabled;
  }

  function selectorForElement(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) {
      return `#${escapeCssIdent(el.id)}`;
    }

    const parts = [];
    let current = el;
    while (current && current.nodeType === 1) {
      let part = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((node) => node.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          part += `:nth-of-type(${index})`;
        }
      }
      parts.unshift(part);
      if (!parent || current === document.body || current === document.documentElement) {
        break;
      }
      current = parent;
      if (current.id) {
        parts.unshift(`#${escapeCssIdent(current.id)}`);
        break;
      }
    }
    return parts.join(' > ');
  }

  function resolveElementSelector(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch (_error) {
      return null;
    }
  }

  function serializeInspectorSelection() {
    if (!inspector.selection || !inspector.selection.el || !inspector.selection.el.isConnected) {
      return null;
    }
    const selector = selectorForElement(inspector.selection.el);
    if (!selector) return null;
    return {
      selector,
      meta: { ...(inspector.selection.meta || {}) },
      label: inspector.selection.label || '',
      color: inspector.selection.color || '#e7e5e4'
    };
  }

  function restoreInspectorSelection(serialized) {
    if (!serialized || !serialized.selector) return false;
    const el = resolveElementSelector(serialized.selector);
    if (!el || !isVisible(el) || !selectionVisibleInMode({ meta: serialized.meta || {} })) return false;
    inspector.selection = {
      el,
      meta: { ...(serialized.meta || {}) },
      label: serialized.label || '',
      color: serialized.color || '#e7e5e4'
    };
    return true;
  }

  function serializeOverlaySession() {
    return {
      version: SESSION_STORAGE_VERSION,
      url: normalizedPageUrl(),
      savedAt: new Date().toISOString(),
      layerMode: state.layerMode,
      touchProfile: state.touchProfile,
      enabledSlices: serializeSlices(),
      annotations: {
        notes: annotations.notes.map((note) => ({
          id: note.id,
          x: note.x,
          y: note.y,
          text: note.text || ''
        })),
        arrows: annotations.arrows.map((arrow) => ({
          id: arrow.id,
          x1: arrow.x1,
          y1: arrow.y1,
          x2: arrow.x2,
          y2: arrow.y2
        })),
        selected: annotations.selected ? { ...annotations.selected } : null
      },
      inspector: serializeInspectorSelection()
    };
  }

  function markSessionReady() {
    if (sessionReady) return;
    sessionReady = true;
    const waiters = sessionReadyWaiters;
    sessionReadyWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  function waitForSessionReady() {
    if (sessionReady) return Promise.resolve();
    return new Promise((resolve) => {
      sessionReadyWaiters.push(resolve);
    });
  }

  async function persistOverlaySessionNow() {
    const snapshot = serializeOverlaySession();
    if (!sessionReady) {
      await waitForSessionReady();
    }
    await writePersistedValue(pageStorageKey(), snapshot);
    return snapshot;
  }

  function scheduleSessionPersist() {
    if (!sessionReady) return;
    if (sessionPersistTimer) clearTimeout(sessionPersistTimer);
    sessionPersistTimer = setTimeout(() => {
      sessionPersistTimer = 0;
      persistOverlaySessionNow().catch(() => {});
    }, SESSION_PERSIST_MS);
  }

  async function clearPersistedSession() {
    if (sessionPersistTimer) {
      clearTimeout(sessionPersistTimer);
      sessionPersistTimer = 0;
    }
    await removePersistedValue(pageStorageKey());
  }

  async function loadPersistedSession() {
    try {
      const stored = await readPersistedValue(pageStorageKey());
      if (!stored || stored.version !== SESSION_STORAGE_VERSION) {
        markSessionReady();
        return false;
      }

      if (stored.layerMode === 'conformance' || stored.layerMode === 'review') {
        state.layerMode = stored.layerMode;
      }

      if (
        stored.touchProfile === 'web-default' ||
        stored.touchProfile === 'apple-44pt' ||
        stored.touchProfile === 'android-48dp' ||
        stored.touchProfile === 'both'
      ) {
        state.touchProfile = stored.touchProfile;
      }

      const enabledSlices = stored.enabledSlices || {};
      SLICES.forEach((slice) => {
        if (typeof enabledSlices[slice.key] === 'boolean') {
          state[slice.key] = enabledSlices[slice.key];
        }
      });

      const savedAnnotations = stored.annotations || {};
      annotations.notes = Array.isArray(savedAnnotations.notes)
        ? savedAnnotations.notes.map((note) => ({
          id: restoredAnnotationId(note.id, 'note'),
          x: Number(note.x) || 0,
          y: clampNoteY(Number(note.y) || 0),
          text: String(note.text || '')
        }))
        : [];
      annotations.arrows = Array.isArray(savedAnnotations.arrows)
        ? savedAnnotations.arrows.map((arrow) => ({
          id: restoredAnnotationId(arrow.id, 'arrow'),
          x1: Number(arrow.x1) || 0,
          y1: Number(arrow.y1) || 0,
          x2: Number(arrow.x2) || 0,
          y2: Number(arrow.y2) || 0
        }))
        : [];

      if (
        savedAnnotations.selected &&
        (savedAnnotations.selected.type === 'note' || savedAnnotations.selected.type === 'arrow') &&
        typeof savedAnnotations.selected.id === 'string'
      ) {
        const exists = savedAnnotations.selected.type === 'note'
          ? annotations.notes.some((note) => note.id === savedAnnotations.selected.id)
          : annotations.arrows.some((arrow) => arrow.id === savedAnnotations.selected.id);
        annotations.selected = exists ? { ...savedAnnotations.selected } : null;
      } else {
        annotations.selected = null;
      }

      restoreInspectorSelection(stored.inspector);
      markSessionReady();
      return true;
    } catch (_error) {
      markSessionReady();
      return false;
    }
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
    scheduleSessionPersist();
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
    scheduleSessionPersist();
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
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const inputType = tag === 'input' && el.getAttribute
      ? (el.getAttribute('type') || 'text').toLowerCase()
      : '';
    const valueCanNameControl = tag === 'button' || (
      tag === 'input' &&
      (inputType === 'button' || inputType === 'submit' || inputType === 'reset')
    );
    const direct = [
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('alt'),
      valueCanNameControl ? el.value : '',
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

  function nearbyImageText(el) {
    const parent = el && el.parentElement;
    if (!parent) return '';
    const clone = parent.cloneNode(true);
    if (clone && typeof clone.querySelectorAll === 'function') {
      clone.querySelectorAll('img,picture,svg,video').forEach((node) => node.remove());
    }
    return textSnippet(clone.textContent, 120);
  }

  function imageInteractiveContext(el) {
    if (!el || typeof el.closest !== 'function') return '';
    const interactive = el.closest('a,button,[role="button"],[role="link"]');
    if (!interactive) return '';
    const tag = interactive.tagName ? interactive.tagName.toLowerCase() : 'interactive';
    const name = accessibleNameOf(interactive);
    return name ? `${tag} · ${name}` : tag;
  }

  function imageDecorativeMarkers(el) {
    const markers = [];
    const box = rect(el);
    const nearbyText = nearbyImageText(el);
    const siblingImages = el.parentElement
      ? Array.from(el.parentElement.querySelectorAll(':scope > img')).filter(isVisible).length
      : 0;
    if (box.w <= 48 && box.h <= 48) markers.push('small footprint');
    if (siblingImages > 1) markers.push('repeated sibling images');
    if (nearbyText) markers.push('nearby text present');
    if (!imageInteractiveContext(el)) markers.push('not interactive');
    return markers;
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
    if (meta.confidence) rows.push(['Confidence', String(meta.confidence).toUpperCase()]);
    if (meta.whyFlagged) rows.push(['Why flagged', meta.whyFlagged]);
    if (meta.evidence && meta.evidence.length) rows.push(['Evidence', evidenceBlock(meta.evidence)]);
    if (meta.sources && meta.sources.length) rows.push(['Source', sourceBlock(meta.sources)]);
    if (meta.suggestedFix) rows.push(['Suggested fix', meta.suggestedFix]);
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
    if ((meta.kind || '').startsWith('alt-') || meta.kind === 'img-presentation' || meta.kind === 'img-aria-hidden') {
      if (meta.altState) rows.push(['Alt state', meta.altState]);
      if (meta.altText) rows.push(['Alt text', meta.altText]);
      if (meta.sourceType) rows.push(['Source type', meta.sourceType]);
      if (meta.decorativeMarkers) rows.push(['Decorative markers', meta.decorativeMarkers]);
      if (meta.interactiveContext) rows.push(['Interactive context', meta.interactiveContext]);
      if (meta.nearbyText) rows.push(['Nearby text', meta.nearbyText]);
    }
    if (meta.kind === 'heading' && meta.level) rows.push(['Level', `h${meta.level}`]);
    if (meta.kind === 'focus') {
      rows.push(['Tab', `#${meta.order}${meta.tabindex > 0 ? ` · tabindex=${meta.tabindex}` : ''}`]);
    }
    if (meta.kind === 'repeat') {
      rows.push(['Repeat', `${meta.groupSize} siblings · item ${meta.indexInGroup}`]);
    }
    if (meta.href) rows.push(['Href', meta.href]);
    if (((meta.kind || '').startsWith('alt-') || meta.kind === 'img-presentation' || meta.kind === 'img-aria-hidden') && meta.src) rows.push(['Image src', meta.src]);
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

  function advanceAnnotationCounterFromId(id) {
    const match = String(id || '').match(/^(?:note|arrow)-(\d+)$/);
    if (!match) return;
    annotationCounter = Math.max(annotationCounter, Number(match[1]) || 0);
  }

  function restoredAnnotationId(value, prefix) {
    const id = String(value || nextAnnotationId(prefix));
    advanceAnnotationCounterFromId(id);
    return id;
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
    if (opts.hitbox) el.classList.add('inspect-hit');
    if (opts.hideOutline) el.classList.add('ghost');
    if (opts.inspected) el.classList.add('inspected');
    el.style.left = r.x + 'px';
    el.style.top = r.y + 'px';
    el.style.width = r.w + 'px';
    el.style.height = r.h + 'px';
    el.style.outline = `${opts.thick ? 2 : 1}px ${opts.dashed ? 'dashed' : opts.dotted ? 'dotted' : 'solid'} ${color}`;
    el.style.outlineOffset = opts.offset != null ? opts.offset + 'px' : '0';
    if (opts.opacity != null) el.style.opacity = String(opts.opacity);
    if (opts.fill) el.style.background = opts.fill;
    if (opts.onInspect && opts.hitbox) {
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onInspect();
      });
    }
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

  /**
   * @typedef {Object} OverlayDetectionRecord
   * @property {string} id
   * @property {string} kind
   * @property {string} label
   * @property {{x: number, y: number, w: number, h: number, cx: number, cy: number}} rect
   * @property {Object} meta
   */

  function roleOf(el) {
    const r = el.getAttribute && el.getAttribute('role');
    if (r) return r;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el.getAttribute && (el.getAttribute('type') || '')).toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
      if (type === 'search') return 'searchbox';
      if (type === 'password') return 'password';
      return 'textbox';
    }
    const map = {
      nav: 'navigation', main: 'main', header: 'banner', footer: 'contentinfo',
      aside: 'complementary', section: 'region', form: 'form', article: 'article',
      a: 'link', button: 'button', textarea: 'textbox',
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
