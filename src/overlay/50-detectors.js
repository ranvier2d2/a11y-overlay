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
        confidence: 'high',
        tag,
        role,
        control,
        nameSource: labelMeta.source,
        visibleLabel: hasVisibleLabel ? labelMeta.label : '',
        placeholder,
        titleText,
        required,
        text: labelMeta.label,
        summary: `${control} naming`,
        whyFlagged: 'This form control has a persistent accessible name.',
        evidence: [
          { label: 'Control', value: control },
          { label: 'Name source', value: labelMeta.source },
          { label: 'Visible label', value: hasVisibleLabel ? labelMeta.label : '' },
          { label: 'Placeholder', value: placeholder },
          { label: 'Title', value: titleText },
          { label: 'Required', value: required || 'No' }
        ],
        sources: [
          {
            label: 'WAI Forms Tutorial: Labels',
            url: 'https://www.w3.org/WAI/tutorials/forms/labels/',
            type: 'standard'
          }
        ],
        suggestedFix: 'No action needed unless the visible label and accessible name diverge.'
      };

      if (labelMeta.source === 'missing') {
        color = COLOR.alt;
        label = `Missing label · ${control}`;
        opts = { thick: true, fill: 'rgba(251,113,133,0.12)', labelInvert: true };
        meta.kind = 'form-label-missing';
        meta.findingType = 'standard';
        meta.severity = 'error';
        meta.rule = 'WCAG 3.3.2 Labels or Instructions';
        meta.summary = `${control} missing label`;
        meta.whyFlagged = 'This form control has no accessible label or instruction bound to it.';
        meta.sources = [
          {
            label: 'WCAG 3.3.2 Labels or Instructions',
            url: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions',
            type: 'standard'
          },
          {
            label: 'WAI Forms Tutorial: Labels',
            url: 'https://www.w3.org/WAI/tutorials/forms/labels/',
            type: 'standard'
          }
        ];
        meta.suggestedFix = 'Add a visible label or bind an accessible name with label, aria-labelledby, or aria-label.';
      } else if (labelMeta.source === 'placeholder-only' || labelMeta.source === 'title-only') {
        color = '#fbbf24';
        label = `${labelMeta.source === 'placeholder-only' ? 'Placeholder-only' : 'Title-only'} · ${control}`;
        opts = { thick: true, dashed: true, fill: 'rgba(251,191,36,0.12)' };
        meta.kind = 'form-label-weak';
        meta.findingType = 'advisory';
        meta.severity = 'warning';
        meta.rule = 'Advisory: prefer a persistent label over placeholder/title-only naming';
        meta.summary = `${control} relies on weak naming`;
        meta.whyFlagged = labelMeta.source === 'placeholder-only'
          ? 'This form control relies on placeholder text instead of a persistent label.'
          : 'This form control relies on title text instead of a persistent label.';
        meta.sources = [
          {
            label: 'WAI Forms Tutorial: Labels',
            url: 'https://www.w3.org/WAI/tutorials/forms/labels/',
            type: 'standard'
          },
          {
            label: 'ARIA APG Names and Descriptions',
            url: 'https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/',
            type: 'advisory'
          }
        ];
        meta.suggestedFix = 'Prefer a persistent visible label over placeholder-only or title-only naming.';
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
          x: box.w < minSize ? box.x + ((box.w - minSize) / 2) : box.x,
          y: box.h < minSize ? box.y + ((box.h - minSize) / 2) : box.y,
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
              confidence: 'high',
              tag,
              role,
              text: textSnippet(name),
              size: `${Math.round(box.w)} × ${Math.round(box.h)} CSS px`,
              requiredSize: '24 × 24 CSS px',
              rule: 'WCAG 2.5.8 Target Size (Minimum)',
              spacing: 'Fails spacing relief against adjacent interactive target',
              profile: 'Web default',
              summary: 'Interactive target fails WCAG minimum size',
              whyFlagged: 'This interactive target is smaller than 24 × 24 CSS px and does not qualify for the spacing exception.',
              evidence: [
                { label: 'Target size', value: `${Math.round(box.w)} × ${Math.round(box.h)} CSS px` },
                { label: 'Required minimum', value: '24 × 24 CSS px' },
                { label: 'Adjacent overlap', value: 'Yes' },
                { label: 'Accessible name', value: textSnippet(name) }
              ],
              sources: [
                {
                  label: 'WCAG 2.5.8 Target Size (Minimum)',
                  url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum',
                  type: 'standard'
                }
              ],
              suggestedFix: 'Increase the tappable area to at least 24 × 24 CSS px or add enough spacing to satisfy the exception.'
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
            confidence: 'high',
            tag,
            role,
            text: textSnippet(name),
            size: `${Math.round(box.w)} × ${Math.round(box.h)} CSS px`,
            requiredSize: firstThreshold.size === lastThreshold.size
              ? `${firstThreshold.size} × ${firstThreshold.size} CSS px`
              : `${firstThreshold.size}–${lastThreshold.size} CSS px`,
            rule: failedProfiles.map((item) => item.rule).join(' + '),
            spacing: 'Advisory profile ignores WCAG spacing exception',
            profile: failedProfiles.map((item) => item.profile).join(' + '),
            summary: 'Interactive target misses advisory touch size',
            whyFlagged: 'This interactive target passes or is outside WCAG minimum logic, but it is smaller than the selected platform touch target guidance.',
            evidence: [
              { label: 'Target size', value: `${Math.round(box.w)} × ${Math.round(box.h)} CSS px` },
              { label: 'Selected profile', value: failedProfiles.map((item) => item.profile).join(' + ') },
              { label: 'Advisory minimum', value: firstThreshold.size === lastThreshold.size
                ? `${firstThreshold.size} × ${firstThreshold.size} CSS px`
                : `${firstThreshold.size}–${lastThreshold.size} CSS px` },
              { label: 'Accessible name', value: textSnippet(name) }
            ],
            sources: failedProfiles.map((item) => ({
              label: item.rule,
              url: item.profile === 'Apple 44pt'
                ? 'https://developer.apple.com/design/tips/'
                : 'https://developer.android.com/design/ui/mobile/guides/foundations/accessibility',
              type: 'advisory'
            })),
            suggestedFix: 'Increase the tappable area if this surface is intended for touch-first use.'
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
      const hasAlt = el.hasAttribute('alt');
      const altText = textSnippet(el.getAttribute('alt'), 160);
      const role = roleOf(el) || 'img';
      const src = el.getAttribute('src') || '';
      const sourceType = 'img';
      const interactiveContext = imageInteractiveContext(el);
      const nearbyText = nearbyImageText(el);
      const decorativeMarkers = imageDecorativeMarkers(el).join(' · ');
      const box = rect(el);

      let kind = '';
      let findingType = 'standard';
      let severity = 'pass';
      let confidence = 'high';
      let label = '';
      let color = COLOR.heading;
      let opts = { dashed: true, fill: 'rgba(34,211,238,0.08)' };
      let summary = '';
      let whyFlagged = '';
      let suggestedFix = '';
      let showInCanvas = false;
      let altState = '';

      if (el.getAttribute('role') === 'presentation') {
        kind = 'img-presentation';
        altState = hasAlt ? (altText ? 'present' : 'empty') : 'missing';
        summary = 'Image is explicitly presentational';
        whyFlagged = 'This image is marked as presentation, so assistive technologies should ignore it.';
        suggestedFix = 'No action needed if this image is purely decorative.';
        showInCanvas = false;
      } else if (el.getAttribute('aria-hidden') === 'true') {
        kind = 'img-aria-hidden';
        altState = hasAlt ? (altText ? 'present' : 'empty') : 'missing';
        summary = 'Image is hidden from assistive technology';
        whyFlagged = 'This image is hidden with aria-hidden=\"true\", so it should not contribute content to the accessible experience.';
        suggestedFix = 'No action needed if the image is truly decorative or redundant.';
        showInCanvas = false;
      } else if (!hasAlt) {
        kind = 'alt-missing';
        altState = 'missing';
        severity = 'error';
        label = 'MISSING alt';
        color = COLOR.alt;
        opts = { thick: true, fill: 'rgba(251,113,133,0.15)', labelInvert: true };
        summary = 'Image is missing alt text';
        whyFlagged = 'This visible image has no alt attribute, so assistive technologies receive no text alternative.';
        suggestedFix = 'Add a meaningful alt value, or use alt=\"\" for a truly decorative image.';
        showInCanvas = true;
      } else if (altText) {
        kind = 'alt-present';
        altState = 'present';
        summary = 'Image provides alt text';
        whyFlagged = 'This visible image already exposes a text alternative through its alt attribute.';
        suggestedFix = 'No action needed unless the alt text is inaccurate or redundant.';
        showInCanvas = false;
      } else {
        altState = 'empty';
        const suspicious =
          !!interactiveContext ||
          (box.w >= 160 && box.h >= 120) ||
          (!nearbyText && decorativeMarkers.split(' · ').filter(Boolean).length < 2);

        if (suspicious) {
          kind = 'alt-empty-suspicious';
          findingType = 'advisory';
          severity = 'warning';
          confidence = 'medium';
          label = 'EMPTY alt ?';
          color = '#fbbf24';
          opts = { thick: true, dashed: true, fill: 'rgba(251,191,36,0.12)' };
          summary = 'Image uses empty alt but may carry content';
          whyFlagged = 'This image uses alt=\"\" but it appears to carry page content rather than decoration.';
          suggestedFix = 'Confirm the image is decorative. If it carries meaning, replace alt=\"\" with a meaningful text alternative.';
          showInCanvas = true;
        } else {
          kind = 'alt-empty-decorative';
          severity = 'pass';
          confidence = 'medium';
          summary = 'Image uses empty alt and looks decorative';
          whyFlagged = 'This image uses alt=\"\" and the surrounding signals suggest it may be decorative or redundant.';
          suggestedFix = 'No action needed if the image is decorative. Revisit only if it conveys content.';
          showInCanvas = false;
        }
      }

      out.push({
        el,
        color,
        label,
        opts,
        meta: {
          kind,
          sliceKey: 'alt',
          findingType,
          severity,
          confidence,
          tag: 'img',
          role,
          src,
          sourceType,
          showInCanvas,
          inspectOnly: !showInCanvas,
          altState,
          altText,
          interactiveContext,
          nearbyText,
          decorativeMarkers,
          summary,
          whyFlagged,
          evidence: [
            { label: 'Alt state', value: altState },
            { label: 'Alt text', value: altText },
            { label: 'Role', value: role },
            { label: 'Image source', value: src },
            { label: 'Image size', value: `${Math.round(box.w)} × ${Math.round(box.h)} CSS px` },
            { label: 'Interactive context', value: interactiveContext || 'none' },
            { label: 'Nearby text', value: nearbyText || 'none' },
            { label: 'Decorative markers', value: decorativeMarkers || 'none' }
          ],
          sources: [
            {
              label: 'WAI Images Tutorial: Decorative Images',
              url: 'https://www.w3.org/WAI/tutorials/images/decorative/',
              type: 'standard'
            },
            {
              label: 'WAI Images Decision Tree',
              url: 'https://www.w3.org/WAI/tutorials/images/decision-tree/',
              type: kind === 'alt-empty-suspicious' ? 'advisory' : 'standard'
            }
          ],
          suggestedFix
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

  /**
   * @typedef {Object} OverlayReportAction
   * @property {number} priority
   * @property {'fix-now'|'fix-next'|'review'} bucket
   * @property {'Fix now'|'Fix next'|'Review'} bucketLabel
   * @property {string} severity
   * @property {string} sliceKey
   * @property {string} title
   * @property {number} count
   * @property {string} whyItMatters
   * @property {string} suggestedFix
   * @property {string[]} examples
   */

  /**
   * @typedef {Object} OverlayViewportCaptureEvidence
   * @property {string} capturedAt
   * @property {string} filename
   * @property {string} sourceUrl
   * @property {string} mimeType
   * @property {boolean} includedInBundle
   * @property {string} [captureError]
   */

  /**
   * @typedef {Object} OverlayReportData
   * @property {number} schemaVersion
   * @property {string} overlayVersion
   * @property {string} generatedAt
   * @property {{title: string, url: string, viewport: {width: number, height: number}}} document
   * @property {{scope: 'active'|'all', layerMode: string, touchProfile: string, presetId: string, presetLabel: string, enabledSlices: Record<string, boolean>}} audit
   * @property {{total: number, severity: Record<string, number>, findingType: Record<string, number>, slices: Record<string, number>}} summary
   * @property {OverlayReportAction[]} actions
   * @property {{notes: OverlayAnnotationNote[], arrows: OverlayAnnotationArrow[]}} annotations
   * @property {{viewportCapture?: OverlayViewportCaptureEvidence}} [evidence]
   * @property {Array<OverlayDetectionRecord & {color: string, visibleInCanvas: boolean, inspectorRows: Array<{key: string, value: string}>}>} findings
   */

  function collectFindingEntries() {
    return [
      ...scanLandmarks(),
      ...scanHeadings(),
      ...scanInteract(),
      ...scanForms(),
      ...scanTargets(),
      ...scanAlt(),
      ...scanRepeats(),
      ...scanFocus()
    ];
  }

  function collectDetections() {
    return collectFindingEntries().map((entry, index) => detectionRecord(entry, index));
  }

  function serializeReportFinding(entry, index) {
    const selection = {
      el: entry.el,
      meta: { ...(entry.meta || {}) },
      label: entry.label || '',
      color: entry.color || '#e7e5e4'
    };
    const detection = detectionRecord(entry, index);
    return {
      ...detection,
      color: entry.color || '',
      visibleInCanvas: entry.meta && entry.meta.showInCanvas !== false,
      inspectorRows: inspectorRowsForSelection(selection).map(([key, value]) => ({ key, value }))
    };
  }

  function summarizeFindings(findings) {
    const summary = {
      total: findings.length,
      severity: {},
      findingType: {},
      slices: {}
    };

    findings.forEach((finding) => {
      const severity = finding.meta && finding.meta.severity ? String(finding.meta.severity) : 'unspecified';
      const findingType = finding.meta && finding.meta.findingType ? String(finding.meta.findingType) : 'unspecified';
      const sliceKey = finding.meta && finding.meta.sliceKey ? String(finding.meta.sliceKey) : 'unknown';
      summary.severity[severity] = (summary.severity[severity] || 0) + 1;
      summary.findingType[findingType] = (summary.findingType[findingType] || 0) + 1;
      summary.slices[sliceKey] = (summary.slices[sliceKey] || 0) + 1;
    });

    return summary;
  }

  function reportScopeEntries(scope = 'active') {
    const entries = collectFindingEntries();
    if (scope === 'all') return entries;
    return entries.filter((entry) => {
      const sliceKey = entry.meta && entry.meta.sliceKey;
      return sliceKey ? sliceVisible(sliceKey) : true;
    });
  }

  function severityRank(severity) {
    switch (severity) {
      case 'error': return 0;
      case 'warning': return 1;
      case 'unspecified': return 2;
      case 'pass': return 3;
      default: return 2;
    }
  }

  function actionBucketFor(meta) {
    const severity = String(meta && meta.severity ? meta.severity : 'unspecified');
    const findingType = String(meta && meta.findingType ? meta.findingType : 'unspecified');
    if (severity === 'error') {
      return { bucket: 'fix-now', bucketLabel: 'Fix now' };
    }
    if (severity === 'warning' && findingType === 'standard') {
      return { bucket: 'fix-next', bucketLabel: 'Fix next' };
    }
    return { bucket: 'review', bucketLabel: 'Review' };
  }

  function actionBucketRank(bucket) {
    switch (bucket) {
      case 'fix-now': return 0;
      case 'fix-next': return 1;
      case 'review': return 2;
      default: return 3;
    }
  }

  function buildActionPlan(findings) {
    const groups = new Map();

    findings.forEach((finding) => {
      const meta = finding.meta || {};
      const severity = String(meta.severity || 'unspecified');
      if (severity === 'pass' || severity === 'unspecified') return;

      const title = String(meta.summary || finding.label || finding.kind || 'Review finding');
      const suggestedFix = String(meta.suggestedFix || 'Review this finding in context.');
      const whyItMatters = String(meta.whyFlagged || title);
      const sliceKey = String(meta.sliceKey || 'unknown');
      const bucket = actionBucketFor(meta);
      const key = [bucket.bucket, severity, sliceKey, title, suggestedFix].join('::');

      if (!groups.has(key)) {
        groups.set(key, {
          bucket: bucket.bucket,
          bucketLabel: bucket.bucketLabel,
          severity,
          sliceKey,
          title,
          count: 0,
          whyItMatters,
          suggestedFix,
          examples: []
        });
      }

      const group = groups.get(key);
      group.count += 1;
      const example = String(finding.label || finding.kind || '').trim();
      if (example && group.examples.length < 3 && !group.examples.includes(example)) {
        group.examples.push(example);
      }
    });

    return Array.from(groups.values())
      .sort((a, b) => {
        const bucketDelta = actionBucketRank(a.bucket) - actionBucketRank(b.bucket);
        if (bucketDelta !== 0) return bucketDelta;
        const severityDelta = severityRank(a.severity) - severityRank(b.severity);
        if (severityDelta !== 0) return severityDelta;
        if (b.count !== a.count) return b.count - a.count;
        return a.title.localeCompare(b.title);
      })
      .map((action, index) => ({
        priority: index + 1,
        ...action
      }));
  }

  function buildReportData(opts = {}) {
    const scope = opts.scope === 'all' ? 'all' : 'active';
    const entries = reportScopeEntries(scope);
    const findings = entries.map((entry, index) => serializeReportFinding(entry, index));
    const presetId = activePresetId();
    /** @type {OverlayReportData} */
    return {
      schemaVersion: REPORT_SCHEMA_VERSION,
      overlayVersion: VERSION,
      generatedAt: new Date().toISOString(),
      document: {
        title: document.title,
        url: normalizedPageUrl(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      audit: {
        scope,
        layerMode: state.layerMode,
        touchProfile: state.touchProfile,
        presetId: presetId || '',
        presetLabel: activePresetLabel(),
        enabledSlices: serializeSlices()
      },
      summary: summarizeFindings(findings),
      actions: buildActionPlan(findings),
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
        }))
      },
      findings
    };
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function serializeJsonForScript(value) {
    return JSON.stringify(value, null, 2)
      .replace(/</g, '\\u003c')
      .replace(/-->/g, '--\\>');
  }

  function buildViewportCaptureEvidence(screenshot, captureError = '') {
    if (!screenshot && !captureError) return undefined;
    return {
      capturedAt: new Date().toISOString(),
      filename: screenshot && screenshot.filename ? screenshot.filename : '',
      sourceUrl: screenshot && screenshot.sourceUrl ? screenshot.sourceUrl : normalizedPageUrl(),
      mimeType: 'image/png',
      includedInBundle: !!(screenshot && screenshot.dataUrl),
      captureError: captureError || undefined
    };
  }

  function renderActionItems(actions) {
    if (!actions || !actions.length) {
      return '<li>No fixes needed in the selected scope.</li>';
    }
    return actions.map((action) => `
      <li>
        <strong>P${action.priority} · ${escapeHtml(action.title)}</strong> <span class="muted">(${action.count})</span><br>
        <span class="muted">${escapeHtml(action.whyItMatters)}</span><br>
        <span>${escapeHtml(action.suggestedFix)}</span>
        ${action.examples && action.examples.length
          ? `<br><span class="muted">Examples: ${escapeHtml(action.examples.join(' | '))}</span>`
          : ''}
      </li>
    `).join('');
  }

  function renderActionBuckets(actions) {
    if (!actions || !actions.length) {
      return '<section><h3>Action Plan</h3><ul><li>No fixes needed in the selected scope.</li></ul></section>';
    }

    const bucketOrder = [
      { key: 'fix-now', label: 'Fix now' },
      { key: 'fix-next', label: 'Fix next' },
      { key: 'review', label: 'Review' }
    ];

    return bucketOrder.map((bucket) => {
      const bucketActions = actions.filter((action) => action.bucket === bucket.key);
      if (!bucketActions.length) return '';
      return `
        <section>
          <h3>${escapeHtml(bucket.label)}</h3>
          <ul>${renderActionItems(bucketActions)}</ul>
        </section>
      `;
    }).join('');
  }

  function renderActionSummary(actions) {
    if (!actions || !actions.length) {
      return '<p class="subtle">No open actions in the selected scope.</p>';
    }

    const counts = {
      'fix-now': 0,
      'fix-next': 0,
      'review': 0
    };

    actions.forEach((action) => {
      if (action && action.bucket && Object.prototype.hasOwnProperty.call(counts, action.bucket)) {
        counts[action.bucket] += action.count || 0;
      }
    });

    return `
      <p class="subtle">
        ${counts['fix-now']} fix${counts['fix-now'] === 1 ? '' : 'es'} now,
        ${counts['fix-next']} fix${counts['fix-next'] === 1 ? '' : 'es'} next,
        ${counts['review']} item${counts['review'] === 1 ? '' : 's'} to review.
      </p>
    `;
  }

  function buildReportHtml(report) {
    const summaryItems = Object.entries(report.summary.severity || {})
      .map(([key, count]) => `<li><strong>${escapeHtml(key)}</strong>: ${count}</li>`)
      .join('');
    const sliceItems = Object.entries(report.summary.slices || {})
      .map(([key, count]) => `<li><strong>${escapeHtml(key)}</strong>: ${count}</li>`)
      .join('');
    const annotationNotes = (report.annotations.notes || [])
      .map((note) => `<li>${escapeHtml(note.text || '(empty note)')} <span class="muted">(${Math.round(note.x)}, ${Math.round(note.y)})</span></li>`)
      .join('');
    const annotationArrows = (report.annotations.arrows || [])
      .map((arrow) => `<li>${escapeHtml(arrow.id)} <span class="muted">(${Math.round(arrow.x1)}, ${Math.round(arrow.y1)}) → (${Math.round(arrow.x2)}, ${Math.round(arrow.y2)})</span></li>`)
      .join('');
    const actionSummary = renderActionSummary(report.actions || []);
    const actionBuckets = renderActionBuckets(report.actions || []);
    const findingCards = report.findings.map((finding) => {
      const meta = finding.meta || {};
      const rows = (finding.inspectorRows || [])
        .map((row) => `<div class="row"><dt>${escapeHtml(row.key)}</dt><dd>${escapeHtml(row.value)}</dd></div>`)
        .join('');
      return `
        <article class="card">
          <div class="meta">
            <span class="pill severity-${escapeHtml(meta.severity || 'unspecified')}">${escapeHtml(meta.severity || 'unspecified')}</span>
            <span class="pill type-${escapeHtml(meta.findingType || 'unspecified')}">${escapeHtml(meta.findingType || 'unspecified')}</span>
            <span class="pill">${escapeHtml(meta.sliceKey || 'unknown')}</span>
          </div>
          <h2>${escapeHtml(finding.label || finding.kind)}</h2>
          <p class="subtle">${escapeHtml(meta.summary || meta.whyFlagged || '')}</p>
          <dl>${rows}</dl>
        </article>
      `;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.document.title)} · a11y-overlay report</title>
  <style>
    :root { color-scheme: dark; --bg:#0c0a09; --panel:#151210; --line:#292524; --text:#e7e5e4; --muted:#a8a29e; --lime:#a3e635; --cyan:#22d3ee; --amber:#f59e0b; --rose:#fb7185; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    main { max-width:1100px; margin:0 auto; padding:24px; display:grid; gap:16px; }
    section, article, details { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:16px; }
    h1, h2, h3 { margin:0 0 10px; }
    h1 { font-size:24px; }
    h2 { font-size:16px; }
    h3 { font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:var(--cyan); }
    p, ul { margin:0; }
    ul { padding-left:18px; }
    .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); }
    .meta { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
    .pill { border:1px solid var(--line); padding:2px 8px; border-radius:999px; font-size:11px; color:var(--muted); }
    .severity-error { color:var(--rose); border-color:var(--rose); }
    .severity-warning { color:var(--amber); border-color:var(--amber); }
    .severity-pass { color:var(--lime); border-color:var(--lime); }
    .type-standard { color:var(--cyan); border-color:var(--cyan); }
    .type-advisory { color:var(--amber); border-color:var(--amber); }
    .type-heuristic { color:#a78bfa; border-color:#a78bfa; }
    .subtle, .muted, summary { color:var(--muted); }
    summary { cursor:pointer; }
    dl { margin:0; display:grid; gap:8px; }
    .row { display:grid; grid-template-columns:140px 1fr; gap:10px; padding-top:8px; border-top:1px solid rgba(68,64,60,0.45); }
    dt { color:var(--muted); text-transform:uppercase; font-size:10px; letter-spacing:0.06em; }
    dd { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>a11y-overlay report</h1>
      <div class="meta">
        <span class="pill">${escapeHtml(report.document.title || 'Untitled page')}</span>
        <span class="pill">${escapeHtml(report.audit.scope)} scope</span>
        <span class="pill">${escapeHtml(report.audit.layerMode)}</span>
        <span class="pill">${escapeHtml(report.audit.touchProfile)}</span>
        <span class="pill">${escapeHtml(report.audit.presetLabel || 'Custom')}</span>
      </div>
      <p class="subtle">${escapeHtml(report.document.url)}<br>${escapeHtml(report.generatedAt)}</p>
      ${actionSummary}
    </section>
    <div class="grid">
      ${actionBuckets}
      <section>
        <h3>Severity</h3>
        <ul>${summaryItems || '<li>No findings</li>'}</ul>
      </section>
      <section>
        <h3>Slices</h3>
        <ul>${sliceItems || '<li>No active slices</li>'}</ul>
      </section>
      <section>
        <h3>Annotations</h3>
        <ul>${annotationNotes || '<li>No notes</li>'}</ul>
        <ul style="margin-top:10px;">${annotationArrows || '<li>No arrows</li>'}</ul>
      </section>
    </div>
    ${findingCards
      ? `<details>
          <summary>Detailed findings (${report.findings.length})</summary>
          <div class="grid" style="margin-top:16px;">${findingCards}</div>
        </details>`
      : '<section><p class="subtle">No findings in the selected scope.</p></section>'}
  </main>
</body>
</html>`;
  }

  function buildAuditBundleHtml(report, screenshot = null) {
    const summaryItems = Object.entries(report.summary.severity || {})
      .map(([key, count]) => `<li><strong>${escapeHtml(key)}</strong>: ${count}</li>`)
      .join('');
    const sliceItems = Object.entries(report.summary.slices || {})
      .map(([key, count]) => `<li><strong>${escapeHtml(key)}</strong>: ${count}</li>`)
      .join('');
    const viewportEvidence = report.evidence && report.evidence.viewportCapture
      ? report.evidence.viewportCapture
      : null;
    const actionSummary = renderActionSummary(report.actions || []);
    const actionBuckets = renderActionBuckets(report.actions || []);
    const screenshotMeta = viewportEvidence
      ? [
          viewportEvidence.filename ? `<li><strong>File</strong>: ${escapeHtml(viewportEvidence.filename)}</li>` : '',
          viewportEvidence.sourceUrl ? `<li><strong>Source</strong>: ${escapeHtml(viewportEvidence.sourceUrl)}</li>` : '',
          viewportEvidence.capturedAt ? `<li><strong>Captured</strong>: ${escapeHtml(viewportEvidence.capturedAt)}</li>` : '',
          viewportEvidence.captureError ? `<li><strong>Capture note</strong>: ${escapeHtml(viewportEvidence.captureError)}</li>` : ''
        ].filter(Boolean).join('')
      : '<li>No viewport capture metadata</li>';
    const findingCards = report.findings.map((finding) => {
      const meta = finding.meta || {};
      const rows = (finding.inspectorRows || [])
        .map((row) => `<div class="row"><dt>${escapeHtml(row.key)}</dt><dd>${escapeHtml(row.value)}</dd></div>`)
        .join('');
      return `
        <article class="card">
          <div class="meta">
            <span class="pill severity-${escapeHtml(meta.severity || 'unspecified')}">${escapeHtml(meta.severity || 'unspecified')}</span>
            <span class="pill type-${escapeHtml(meta.findingType || 'unspecified')}">${escapeHtml(meta.findingType || 'unspecified')}</span>
            <span class="pill">${escapeHtml(meta.sliceKey || 'unknown')}</span>
          </div>
          <h2>${escapeHtml(finding.label || finding.kind)}</h2>
          <p class="subtle">${escapeHtml(meta.summary || meta.whyFlagged || '')}</p>
          <dl>${rows}</dl>
        </article>
      `;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.document.title)} · a11y-overlay audit bundle</title>
  <style>
    :root { color-scheme: dark; --bg:#0c0a09; --panel:#151210; --line:#292524; --text:#e7e5e4; --muted:#a8a29e; --lime:#a3e635; --cyan:#22d3ee; --amber:#f59e0b; --rose:#fb7185; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    main { max-width:1160px; margin:0 auto; padding:24px; display:grid; gap:16px; }
    section, article, details { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:16px; }
    h1, h2, h3 { margin:0 0 10px; }
    h1 { font-size:24px; }
    h2 { font-size:16px; }
    h3 { font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:var(--cyan); }
    p, ul, pre { margin:0; }
    ul { padding-left:18px; }
    .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); }
    .meta { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
    .pill { border:1px solid var(--line); padding:2px 8px; border-radius:999px; font-size:11px; color:var(--muted); }
    .severity-error { color:var(--rose); border-color:var(--rose); }
    .severity-warning { color:var(--amber); border-color:var(--amber); }
    .severity-pass { color:var(--lime); border-color:var(--lime); }
    .type-standard { color:var(--cyan); border-color:var(--cyan); }
    .type-advisory { color:var(--amber); border-color:var(--amber); }
    .type-heuristic { color:#a78bfa; border-color:#a78bfa; }
    .subtle, .muted, summary { color:var(--muted); }
    .evidence-image { display:block; width:100%; height:auto; border-radius:6px; border:1px solid var(--line); background:#000; }
    .empty-evidence { min-height:200px; display:grid; place-items:center; border:1px dashed var(--line); border-radius:6px; color:var(--muted); }
    dl { margin:0; display:grid; gap:8px; }
    .row { display:grid; grid-template-columns:140px 1fr; gap:10px; padding-top:8px; border-top:1px solid rgba(68,64,60,0.45); }
    dt { color:var(--muted); text-transform:uppercase; font-size:10px; letter-spacing:0.06em; }
    dd { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
    pre { white-space:pre-wrap; overflow-wrap:anywhere; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>a11y-overlay audit bundle</h1>
      <div class="meta">
        <span class="pill">${escapeHtml(report.document.title || 'Untitled page')}</span>
        <span class="pill">${escapeHtml(report.audit.scope)} scope</span>
        <span class="pill">${escapeHtml(report.audit.layerMode)}</span>
        <span class="pill">${escapeHtml(report.audit.touchProfile)}</span>
        <span class="pill">${escapeHtml(report.audit.presetLabel || 'Custom')}</span>
      </div>
      <p class="subtle">${escapeHtml(report.document.url)}<br>${escapeHtml(report.generatedAt)}</p>
      ${actionSummary}
    </section>
    <div class="grid">
      ${actionBuckets}
      <section>
        <h3>Severity</h3>
        <ul>${summaryItems || '<li>No findings</li>'}</ul>
      </section>
      <section>
        <h3>Slices</h3>
        <ul>${sliceItems || '<li>No active slices</li>'}</ul>
      </section>
      <section>
        <h3>Viewport Evidence</h3>
        <ul>${screenshotMeta}</ul>
      </section>
    </div>
    <section>
      <h3>Captured Viewport</h3>
      ${screenshot && screenshot.dataUrl
        ? `<img class="evidence-image" src="${escapeHtml(screenshot.dataUrl)}" alt="Viewport capture evidence">`
        : '<div class="empty-evidence">Viewport capture was not available in this context.</div>'}
    </section>
    ${findingCards
      ? `<details>
          <summary>Detailed findings (${report.findings.length})</summary>
          <div class="grid" style="margin-top:16px;">${findingCards}</div>
        </details>`
      : '<section><p class="subtle">No findings in the selected scope.</p></section>'}
    <details>
      <summary>Embedded Report JSON</summary>
      <pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
    </details>
    <script type="application/json" id="a11y-overlay-report-data">${serializeJsonForScript(report)}</script>
  </main>
</body>
</html>`;
  }

  async function getViewportCapture() {
    if (!EXTENSION_RUNTIME) return null;
    const response = await EXTENSION_RUNTIME.sendMessage({
      type: GET_VIEWPORT_CAPTURE_MESSAGE
    });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : 'Viewport capture failed.');
    }
    return response;
  }

  function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadReport(format = 'json', opts = {}) {
    const report = buildReportData(opts);
    const stem = reportFileStem();
    if (format === 'html') {
      downloadTextFile(`${stem}-report.html`, buildReportHtml(report), 'text/html;charset=utf-8');
      setExportNotice('HTML report downloaded', 'success');
      return report;
    }
    downloadTextFile(`${stem}-report.json`, JSON.stringify(report, null, 2), 'application/json;charset=utf-8');
    setExportNotice('JSON report downloaded', 'success');
    return report;
  }

  async function downloadAuditBundle(opts = {}) {
    const report = buildReportData(opts);
    let screenshot = null;
    let captureError = '';

    try {
      screenshot = await getViewportCapture();
    } catch (error) {
      captureError = error && error.message ? error.message : String(error);
    }

    const viewportCapture = buildViewportCaptureEvidence(screenshot, captureError);
    if (viewportCapture) {
      report.evidence = { viewportCapture };
    }

    const stem = reportFileStem();
    downloadTextFile(
      `${stem}-audit-bundle.html`,
      buildAuditBundleHtml(report, screenshot),
      'text/html;charset=utf-8'
    );

    setExportNotice(
      screenshot && screenshot.dataUrl
        ? 'Audit bundle downloaded with viewport evidence'
        : 'Audit bundle downloaded without viewport capture',
      'success'
    );

    return report;
  }
