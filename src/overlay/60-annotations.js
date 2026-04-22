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
    scheduleSessionPersist();
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
    if (isMobileOverlayViewport()) {
      state.mobileSheetTab = 'inspect';
      state.mobileSheetOpen = true;
    }
    scheduleSessionPersist();
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
    scheduleSessionPersist();
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
    scheduleSessionPersist();
    render();
  }

  function renderHud() {
    renderToolbar();
    if (isMobileOverlayViewport()) {
      const help = shadow.querySelector('.help');
      if (help) help.remove();
      const settings = shadow.querySelector('.settings');
      if (settings) settings.remove();
      const inspectorPanel = shadow.querySelector('.inspector');
      if (inspectorPanel) inspectorPanel.remove();
      renderMobileSheet();
      return;
    }
    mobileSheetBackdrop.classList.remove('open');
    mobileSheetBackdrop.onclick = null;
    mobileSheet.classList.remove('open');
    mobileSheet.innerHTML = '';
    renderHelp();
    renderSettings();
    renderInspector();
  }

  function renderMobileSheet() {
    mobileSheetBackdrop.classList.remove('open');
    mobileSheetBackdrop.onclick = null;
    mobileSheet.classList.remove('open');
    mobileSheet.innerHTML = '';
    if (!state.mobileSheetOpen) return;

    const titles = {
      'layers': 'Layers',
      'inspect': 'Inspect',
      'annotate': 'Annotate',
      'more': 'More'
    };

    mobileSheetBackdrop.classList.add('open');
    mobileSheetBackdrop.onclick = (e) => {
      e.stopPropagation();
      state.mobileSheetOpen = false;
      renderHud();
    };
    mobileSheet.classList.add('open');

    const head = document.createElement('div');
    head.className = 'mobile-sheet-head';

    const titleWrap = document.createElement('div');
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `Overlay · ${activePresetLabel()}`;
    titleWrap.appendChild(eyebrow);

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = titles[state.mobileSheetTab] || 'Overlay';
    titleWrap.appendChild(title);
    head.appendChild(titleWrap);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'mobile-sheet-close';
    close.textContent = '×';
    close.title = 'Close panel';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      state.mobileSheetOpen = false;
      renderHud();
    });
    head.appendChild(close);
    mobileSheet.appendChild(head);

    const appendSection = (sectionTitle, subtleText) => {
      const section = document.createElement('section');
      section.className = 'mobile-sheet-section';
      if (sectionTitle) {
        const h = document.createElement('h4');
        h.textContent = sectionTitle;
        section.appendChild(h);
      }
      if (subtleText) {
        const subtle = document.createElement('div');
        subtle.className = 'subtle';
        subtle.textContent = subtleText;
        section.appendChild(subtle);
      }
      mobileSheet.appendChild(section);
      return section;
    };

    const appendAction = (grid, { label, meta = '', on = false, tone = '', click }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-action' + (on ? ' on' : '');
      if (tone) {
        button.style.borderColor = tone;
        if (on) {
          button.style.background = tone;
          button.style.color = '#0c0a09';
        }
      }
      button.innerHTML = `<span class="label">${label}</span>${meta ? `<span class="meta">${meta}</span>` : ''}`;
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        click();
      });
      grid.appendChild(button);
      return button;
    };

    if (state.mobileSheetTab === 'layers') {
      const modeSection = appendSection(
        'Audit mode',
        `Preset ${activePresetLabel()} · touch profile ${currentTouchProfileLabel()}.`
      );
      const modeGrid = document.createElement('div');
      modeGrid.className = 'mobile-grid';
      appendAction(modeGrid, {
        label: 'Conformance',
        meta: 'Standards and advisory slices',
        on: state.layerMode === 'conformance',
        tone: '#e7e5e4',
        click: () => {
          if (applyLayerMode('conformance', { announce: true })) render();
        }
      });
      appendAction(modeGrid, {
        label: 'Review',
        meta: 'Enables heuristic slices',
        on: state.layerMode === 'review',
        tone: '#a3e635',
        click: () => {
          if (applyLayerMode('review', { announce: true })) render();
        }
      });
      modeSection.appendChild(modeGrid);

      const presetSection = appendSection('Workflow presets', 'Apply a fixed layer, slice, and target-profile mix.');
      const presetGrid = document.createElement('div');
      presetGrid.className = 'mobile-grid';
      PRESETS.forEach((preset) => {
        appendAction(presetGrid, {
          label: preset.label,
          meta: preset.description,
          on: activePresetId() === preset.id,
          tone: preset.id === 'mobile' ? '#38bdf8' : '#22d3ee',
          click: () => { applyPreset(preset.id); }
        });
      });
      presetSection.appendChild(presetGrid);

      const sliceSection = appendSection('Slices', 'Turn individual overlays on and off.');
      const sliceGrid = document.createElement('div');
      sliceGrid.className = 'mobile-grid';
      SLICES.forEach((slice) => {
        const visibleActive = sliceVisible(slice.key);
        const reviewOnly = slice.minLayer === 'review' && state.layerMode !== 'review';
        appendAction(sliceGrid, {
          label: slice.label,
          meta: reviewOnly ? `${slice.kbd} · review only` : slice.kbd,
          on: visibleActive,
          tone: slice.color,
          click: () => {
            if (toggleSliceState(slice.key)) render();
          }
        });
      });
      sliceSection.appendChild(sliceGrid);

      const targetSection = appendSection('Touch profile', 'WCAG 24×24 stays standard. Platform profiles add advisory findings.');
      const targetGrid = document.createElement('div');
      targetGrid.className = 'mobile-grid';
      [
        { key: 'web-default', label: 'Web default' },
        { key: 'apple-44pt', label: 'Apple 44pt' },
        { key: 'android-48dp', label: 'Android 48dp' },
        { key: 'both', label: 'Apple + Android' }
      ].forEach((option) => {
        appendAction(targetGrid, {
          label: option.label,
          on: state.touchProfile === option.key,
          tone: '#f59e0b',
          click: () => { setTouchProfile(option.key); }
        });
      });
      targetSection.appendChild(targetGrid);
      return;
    }

    if (state.mobileSheetTab === 'inspect') {
      const selection = inspector.selection;
      if (!selection || !selection.el || !selection.el.isConnected || !isVisible(selection.el)) {
        inspector.selection = null;
        const empty = appendSection('', '');
        const msg = document.createElement('div');
        msg.className = 'mobile-empty';
        msg.textContent = 'Tap any badge or label on the page to open a receipt-style inspector for that finding.';
        empty.appendChild(msg);
        return;
      }

      const intro = appendSection('', '');
      const rows = document.createElement('div');
      rows.className = 'mobile-inspector-rows';

      const headline = document.createElement('div');
      headline.className = 'mobile-empty';
      headline.textContent = `${selection.label || selection.meta.kind} · ${selection.meta.kind}`;
      intro.appendChild(headline);

      inspectorRowsForSelection(selection).forEach(([key, value]) => {
        const row = document.createElement('div');
        row.className = 'mobile-inspector-row';
        row.innerHTML = `<div class="key">${key}</div><div class="value">${value}</div>`;
        rows.appendChild(row);
      });
      intro.appendChild(rows);

      const actions = appendSection('Selection', 'Tap another badge or label to switch context.');
      const actionGrid = document.createElement('div');
      actionGrid.className = 'mobile-grid one';
      appendAction(actionGrid, {
        label: 'Clear selection',
        meta: 'Dismiss the current inspector target',
        tone: '#38bdf8',
        click: () => { clearInspectorSelection(); }
      });
      actions.appendChild(actionGrid);
      return;
    }

    if (state.mobileSheetTab === 'annotate') {
      const annotateSection = appendSection(
        'Annotation tools',
        editingAnnotationLabel() || selectedAnnotationLabel() || modeLabel() || 'Place notes and arrows, then return to the page to position them.'
      );
      const actionGrid = document.createElement('div');
      actionGrid.className = 'mobile-grid';
      appendAction(actionGrid, {
        label: 'Note',
        meta: 'Tap the page once to place',
        on: annotations.mode === 'note',
        tone: COLOR.noteBorder,
        click: () => {
          state.mobileSheetOpen = false;
          setAnnotationMode('note');
        }
      });
      appendAction(actionGrid, {
        label: 'Arrow',
        meta: annotations.pendingArrowStart ? 'Tap the end point' : 'Tap start, then end',
        on: annotations.mode === 'arrow',
        tone: COLOR.annotate,
        click: () => {
          state.mobileSheetOpen = false;
          setAnnotationMode('arrow');
        }
      });
      appendAction(actionGrid, {
        label: 'Deselect',
        meta: 'Exit placement and clear selection',
        on: annotations.mode === 'idle' && !annotations.selected,
        tone: '#38bdf8',
        click: () => {
          deselectAnnotations();
          state.mobileSheetTab = 'annotate';
          state.mobileSheetOpen = true;
          render();
        }
      });
      appendAction(actionGrid, {
        label: 'Delete selected',
        meta: annotations.selected ? 'Remove current note or arrow' : 'Nothing selected',
        tone: '#fb7185',
        click: () => {
          if (removeSelectedAnnotation()) {
            state.mobileSheetTab = 'annotate';
            state.mobileSheetOpen = true;
            render();
          }
        }
      });
      annotateSection.appendChild(actionGrid);
      return;
    }

    const exportSection = appendSection(
      'Export',
      state.exportNotice || 'Capture the current audit scope and viewport evidence.'
    );
    const exportGrid = document.createElement('div');
    exportGrid.className = 'mobile-grid';
    if (CAN_EXPORT_FROM_EXTENSION) {
      appendAction(exportGrid, {
        label: 'Copy PNG',
        meta: 'Focused copy window',
        tone: '#eab308',
        click: () => { openCopyWindow(); }
      });
      appendAction(exportGrid, {
        label: 'Save PNG',
        meta: 'Save viewport evidence',
        tone: '#eab308',
        click: () => { exportPng('download'); }
      });
    }
    appendAction(exportGrid, {
      label: 'JSON',
      meta: 'Current audit scope',
      tone: '#60a5fa',
      click: () => { downloadReport('json'); }
    });
    appendAction(exportGrid, {
      label: 'HTML',
      meta: 'Readable audit receipt',
      tone: '#60a5fa',
      click: () => { downloadReport('html'); }
    });
    appendAction(exportGrid, {
      label: 'Bundle',
      meta: 'Report + viewport evidence',
      tone: '#a78bfa',
      click: async () => {
        if (state.exportBusy) return;
        state.exportBusy = true;
        renderHud();
        try {
          await downloadAuditBundle();
        } catch (error) {
          setExportNotice(formatExportError(error), 'error');
        } finally {
          state.exportBusy = false;
          renderHud();
        }
      }
    });
    exportSection.appendChild(exportGrid);

    const helpSection = appendSection('Quick help', `Mode ${state.layerMode === 'review' ? 'Review' : 'Conformance'} · ${currentTouchProfileLabel()}.`);
    const helpRows = document.createElement('div');
    helpRows.className = 'mobile-inspector-rows';
    [
      ['Tap badge', 'Open the inspector receipt for that finding.'],
      ['L / H / I / M / T / A', 'Toggle structural and audit slices.'],
      ['R / F / D / G', 'Review and depth-oriented slices.'],
      ['N / W / V', 'Note, arrow, or deselect placement.'],
      ['Del / Backspace', 'Delete the selected note or arrow.'],
      ['X', 'Remove the overlay entirely.']
    ].forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'mobile-inspector-row';
      row.innerHTML = `<div class="key">${key}</div><div class="value">${value}</div>`;
      helpRows.appendChild(row);
    });
    helpSection.appendChild(helpRows);

    const exitSection = appendSection('Overlay', 'Mobile keeps one expanded surface at a time so the page stays readable.');
    const exitGrid = document.createElement('div');
    exitGrid.className = 'mobile-grid one';
    appendAction(exitGrid, {
      label: 'Remove overlay',
      meta: 'Close everything and tear down',
      tone: '#fb7185',
      click: () => { teardown(); }
    });
    exitSection.appendChild(exitGrid);
  }

  function renderSettings() {
    const existing = shadow.querySelector('.settings');
    if (existing) existing.remove();
    if (!state.settingsOpen) return;

    const activePreset = activePresetId();
    const panel = document.createElement('div');
    panel.className = 'settings';

    const title = document.createElement('h4');
    title.textContent = 'Audit settings';
    panel.appendChild(title);

    const subtle = document.createElement('div');
    subtle.className = 'subtle';
    subtle.textContent = `Preset · ${activePresetLabel()} · touch profile ${currentTouchProfileLabel()}.`;
    panel.appendChild(subtle);

    const presetTitle = document.createElement('h4');
    presetTitle.textContent = 'Workflow presets';
    panel.appendChild(presetTitle);

    const presetSubtle = document.createElement('div');
    presetSubtle.className = 'subtle';
    presetSubtle.textContent = 'Apply a named audit workflow with a fixed layer, slice, and target-profile mix.';
    panel.appendChild(presetSubtle);

    const presetGrid = document.createElement('div');
    presetGrid.className = 'seg';
    PRESETS.forEach((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'segbtn' + (activePreset === preset.id ? ' on' : '');
      button.textContent = preset.label;
      button.title = preset.description;
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        applyPreset(preset.id);
      });
      presetGrid.appendChild(button);
    });
    panel.appendChild(presetGrid);

    const targetTitle = document.createElement('h4');
    targetTitle.textContent = 'Target settings';
    panel.appendChild(targetTitle);

    const targetSubtle = document.createElement('div');
    targetSubtle.className = 'subtle';
    targetSubtle.textContent = 'WCAG 24×24 stays standard. Apple and Android profiles add advisory findings.';
    panel.appendChild(targetSubtle);

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
    meta.textContent = `Active preset · ${activePresetLabel()} · profile ${currentTouchProfileLabel()} · mode ${state.layerMode}`;
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
    if (
      (!prev && nextSelection) ||
      (prev && !nextSelection) ||
      (prev && nextSelection && (prev.type !== nextSelection.type || prev.id !== nextSelection.id))
    ) {
      scheduleSessionPersist();
    }
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
    scheduleSessionPersist();
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
    scheduleSessionPersist();
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
    scheduleSessionPersist();
    renderHud();
    renderAnnotations();
    return true;
  }

  function stopDragging() {
    if (!dragState) return;
    const didDrag = dragState;
    window.removeEventListener('pointermove', handleGlobalPointerMove, true);
    window.removeEventListener('pointerup', stopDragging, true);
    dragState = null;
    if (didDrag) scheduleSessionPersist();
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
      visible.setAttribute('marker-end', selected ? 'url(#a11yov-arrowhead-selected)' : 'url(#a11yov-arrowhead)');
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
        scheduleSessionPersist();
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
        scheduleSessionPersist();
      });
      textarea.addEventListener('focus', () => {
        selectAnnotation('note', note.id, { render: false });
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
