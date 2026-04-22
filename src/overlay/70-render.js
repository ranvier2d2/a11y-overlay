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
    renderToolbar();

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
      renderToolbar();
    }
  }

  async function openCopyWindow() {
    if (!EXTENSION_RUNTIME || state.exportBusy) return;
    state.exportBusy = true;
    renderToolbar();

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
      renderToolbar();
    }
  }

  function renderToolbar() {
    toolbar.innerHTML = '';
    if (isMobileOverlayViewport()) {
      toolbar.className = 'toolbar mobile';
      mobileDock.innerHTML = '';
      mobileDock.className = 'mobile-dock open';

      const brand = document.createElement('div');
      brand.className = 'mobile-brand';

      const title = document.createElement('span');
      title.className = 'mobile-title';
      title.textContent = 'a11y';
      brand.appendChild(title);

      const summary = document.createElement('div');
      summary.className = 'mobile-summary';

      const eyebrow = document.createElement('div');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = activePresetLabel();
      summary.appendChild(eyebrow);

      const value = document.createElement('div');
      value.className = 'value';
      value.textContent = state.exportNotice || `${state.layerMode === 'review' ? 'Review' : 'Conformance'} · ${currentTouchProfileLabel()}`;
      summary.appendChild(value);
      brand.appendChild(summary);
      toolbar.appendChild(brand);

      const actions = document.createElement('div');
      actions.className = 'mobile-actions';

      const chip = document.createElement('span');
      chip.className = 'mobile-chip';
      chip.textContent = editingAnnotationLabel() || selectedAnnotationLabel() || modeLabel() || 'Overlay active';
      actions.appendChild(chip);

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'mobile-close';
      close.textContent = '×';
      close.title = 'Remove overlay (X)';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        teardown();
      });
      actions.appendChild(close);
      toolbar.appendChild(actions);

      [
        {
          tab: 'layers',
          label: 'Layers',
          icon: 'LY',
          color: '#a3e635',
          meta: activePresetLabel()
        },
        {
          tab: 'inspect',
          label: 'Inspect',
          icon: 'IN',
          color: '#38bdf8',
          meta: inspector.selection ? textSnippet(inspector.selection.label || inspector.selection.meta.kind, 18) : 'Tap badges'
        },
        {
          tab: 'annotate',
          label: 'Annotate',
          icon: 'AN',
          color: '#fb7185',
          meta: annotations.mode !== 'idle' ? titleCase(annotations.mode) : (annotations.selected ? 'Selected' : 'Notes')
        },
        {
          tab: 'more',
          label: 'More',
          icon: '··',
          color: '#e7e5e4',
          meta: state.exportNotice ? textSnippet(state.exportNotice, 18) : 'Help · Export'
        }
      ].forEach((item) => {
        const button = document.createElement('button');
        const isOn = state.mobileSheetOpen && state.mobileSheetTab === item.tab;
        button.type = 'button';
        button.className = 'dockbtn' + (isOn ? ' on' : '');
        if (isOn) {
          button.style.background = item.color;
          button.style.color = '#0c0a09';
        } else {
          button.style.color = item.color;
        }
        button.innerHTML = `<span class="dock-icon">${item.icon}</span><span class="dock-label">${item.label}</span><span class="dock-meta">${item.meta}</span>`;
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const sameTab = state.mobileSheetOpen && state.mobileSheetTab === item.tab;
          state.mobileSheetTab = item.tab;
          state.mobileSheetOpen = !sameTab;
          renderHud();
        });
        mobileDock.appendChild(button);
      });
      return;
    }

    toolbar.className = 'toolbar';
    mobileDock.innerHTML = '';
    mobileDock.className = 'mobile-dock';

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
    settings.title = 'Audit settings and workflow presets';
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

    const reportSep = document.createElement('span'); reportSep.className = 'sep'; toolbar.appendChild(reportSep);

    const jsonReport = document.createElement('button');
    jsonReport.className = 'tbtn';
    jsonReport.innerHTML = '<span>JSON</span>';
    jsonReport.title = 'Download the current audit scope as JSON report';
    jsonReport.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadReport('json');
    });
    toolbar.appendChild(jsonReport);

    const htmlReport = document.createElement('button');
    htmlReport.className = 'tbtn';
    htmlReport.innerHTML = '<span>HTML</span>';
    htmlReport.title = 'Download the current audit scope as HTML report';
    htmlReport.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadReport('html');
    });
    toolbar.appendChild(htmlReport);

    const bundleReport = document.createElement('button');
    bundleReport.className = 'tbtn';
    bundleReport.disabled = state.exportBusy;
    bundleReport.innerHTML = '<span>Bundle</span>';
    bundleReport.title = 'Download report + viewport evidence when extension capture is available';
    bundleReport.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.exportBusy) return;
      state.exportBusy = true;
      renderToolbar();
      try {
        await downloadAuditBundle();
      } catch (error) {
        setExportNotice(formatExportError(error), 'error');
      } finally {
        state.exportBusy = false;
        renderToolbar();
      }
    });
    toolbar.appendChild(bundleReport);

    const modeStatus = modeLabel();
    if (modeStatus) {
      const status = document.createElement('span');
      status.className = 'status mode';
      status.textContent = modeStatus;
      toolbar.appendChild(status);
    }

    const presetStatus = document.createElement('span');
    presetStatus.className = 'status';
    presetStatus.textContent = `Preset: ${activePresetLabel()}`;
    toolbar.appendChild(presetStatus);

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
      if (m.meta && m.meta.showInCanvas === false && !m.meta.inspectOnly) return;
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
        label: m.meta && m.meta.inspectOnly ? '' : m.label,
        inspectable,
        inspected,
        hitbox: !!(m.meta && m.meta.inspectOnly),
        hideOutline: !!(m.meta && m.meta.inspectOnly),
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
      <div class="row ${sliceVisible('alt')      ? 'on' : ''}"><kbd>A</kbd><span class="desc">Image audit</span></div>
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
      <div class="row"><kbd>JSON</kbd><span class="desc">Download the current audit scope as JSON</span></div>
      <div class="row"><kbd>HTML</kbd><span class="desc">Download the current audit scope as HTML</span></div>
      <div class="row"><kbd>Bundle</kbd><span class="desc">Download one HTML bundle with report data and viewport evidence</span></div>
      <div class="row"><kbd>?</kbd><span class="desc">Toggle this help</span></div>
      <div class="row"><kbd>Cfg</kbd><span class="desc">Workflow presets and target settings</span></div>
      <div class="row"><kbd>X</kbd><span class="desc">Remove overlay</span></div>
      <div class="meta">v${VERSION} · a11y-overlay</div>
    `;
    shadow.appendChild(el);
  }
