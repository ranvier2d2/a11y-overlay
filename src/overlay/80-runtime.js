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
    '?': () => { toggleHelpSurface(); },
    '/': () => { toggleHelpSurface(); }
  };

  function toggleHelpSurface() {
    if (isMobileOverlayViewport()) {
      toggleMobileSheet('more', { detent: 'peek' });
      return;
    }
    state.helpOpen = !state.helpOpen;
  }

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

  function overlayTextEntryActive() {
    return !!annotations.editingNoteId || isEditableNode(getDeepActiveElement(shadow));
  }

  function isInteractivePageTarget(node) {
    if (!node || typeof node.closest !== 'function') return false;
    return !!node.closest(
      'a,button,input,textarea,select,summary,label,[role="button"],[role="link"],[role="textbox"],[contenteditable=""],[contenteditable="true"]'
    );
  }

  function handleHotkey(e) {
    // don't hijack typing
    if (overlayTextEntryActive() || isEditableEventTarget(e)) return;
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
      if (isMobileOverlayViewport() && state.mobileSheetOpen) {
        closeMobileSheet();
        e.preventDefault();
        return;
      }
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
  function syncEditingNoteSoon() {
    requestAnimationFrame(() => {
      syncEditingNoteFromFocus();
    });
  }

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
    shadow.addEventListener('focusin', syncEditingNoteFromFocus, true);
    shadow.addEventListener('focusout', syncEditingNoteSoon, true);
  }

  const allowedMessageSource = window.parent && window.parent !== window ? window.parent : null;

  // allow parent frame to forward keys via postMessage
  function onMessage(e) {
    if (!allowedMessageSource || e.source !== allowedMessageSource) return;
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
    shadow.removeEventListener('focusin', syncEditingNoteFromFocus, true);
    shadow.removeEventListener('focusout', syncEditingNoteSoon, true);
    window.removeEventListener('message', onMessage);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (exportNoticeTimer) { clearTimeout(exportNoticeTimer); exportNoticeTimer = 0; }
    if (sessionPersistTimer) { clearTimeout(sessionPersistTimer); sessionPersistTimer = 0; }
    host.remove();
    window.__a11yOverlayInstalled = null;
  }

  function getAutomationContract() {
    return {
      contractVersion: AUTOMATION_CONTRACT_VERSION,
      overlayVersion: VERSION,
      reportSchemaVersion: REPORT_SCHEMA_VERSION,
      methods: {
        toggle: { args: ['sliceKey'] },
        toggleHelp: { args: [] },
        collectDetections: { args: [], returns: 'OverlayDetectionRecord[]' },
        buildReport: { args: ['format', 'opts'], returns: 'OverlayReportData | string' },
        buildAuditBundle: { args: ['opts'], returns: 'string' },
        downloadReport: { args: ['format', 'opts'], returns: 'OverlayReportData | undefined' },
        downloadAuditBundle: { args: ['opts'], returns: 'Promise<OverlayReportData>' },
        exportPng: { args: ['target'], returns: 'Promise<void>' },
        getAutomationContract: { args: [], returns: 'object' },
        listPresets: { args: [], returns: 'OverlayPreset[]' },
        applyPreset: { args: ['presetId', 'opts'], returns: 'boolean' },
        setAnnotationMode: { args: ['mode'], returns: 'void' },
        setLayerMode: { args: ['mode'], returns: 'void' },
        saveSession: { args: [], returns: 'Promise<OverlaySessionSnapshot>' },
        clearSavedSession: { args: [], returns: 'Promise<void>' },
        getSessionSnapshot: { args: [], returns: 'OverlaySessionSnapshot' },
        render: { args: [], returns: 'void' },
        teardown: { args: [], returns: 'void' }
      },
      capabilities: {
        extensionRuntime: CAN_EXPORT_FROM_EXTENSION,
        viewportCapture: CAN_EXPORT_FROM_EXTENSION
      },
      presets: PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        description: preset.description,
        layerMode: preset.layerMode,
        touchProfile: preset.touchProfile,
        enabledSlices: { ...(preset.enabledSlices || {}) }
      })),
      slices: SLICES.map((slice) => ({
        key: slice.key,
        label: slice.label,
        findingType: slice.findingType,
        minLayer: slice.minLayer
      }))
    };
  }

  // ---------- api ----------
  /**
   * Public automation and operator API exposed to pages, bookmarklets, and
   * browser-driving agents once the overlay installs successfully.
   */
  window.__a11yOverlayInstalled = {
    toggleHelp() { toggleHelpSurface(); render(); },
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
    buildReport(format = 'json', opts = {}) {
      const normalizedFormat = format === 'html' ? 'html' : 'json';
      return normalizedFormat === 'html'
        ? buildReportHtml(buildReportData(opts))
        : buildReportData(opts);
    },
    buildAuditBundle(opts = {}) {
      return buildAuditBundleHtml(buildReportData(opts));
    },
    downloadReport,
    downloadAuditBundle,
    exportPng,
    getAutomationContract,
    listPresets() {
      return PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        description: preset.description,
        layerMode: preset.layerMode,
        touchProfile: preset.touchProfile,
        enabledSlices: { ...(preset.enabledSlices || {}) }
      }));
    },
    applyPreset,
    setAnnotationMode,
    setLayerMode(mode) {
      if (applyLayerMode(mode)) render();
    },
    saveSession() {
      return persistOverlaySessionNow();
    },
    clearSavedSession() {
      return clearPersistedSession();
    },
    getSessionSnapshot() {
      return serializeOverlaySession();
    },
    annotations,
    teardown,
    state,
    render
  };

    bindHotkeys();

    // initial paint
    render();
    loadPersistedSettings()
      .catch(() => {})
      .then(() => loadPersistedSession())
      .then((restored) => {
        if (restored) render();
      });
  }

  install();
})();
