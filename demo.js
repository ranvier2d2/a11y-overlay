(function () {
  const frame = document.getElementById('demoFrame');
  const injectButton = document.getElementById('injectButton');
  const presetButton = document.getElementById('presetButton');
  const refreshButton = document.getElementById('refreshButton');
  const jsonButton = document.getElementById('jsonButton');
  const htmlButton = document.getElementById('htmlButton');
  const bundleButton = document.getElementById('bundleButton');
  const statusPill = document.getElementById('statusPill');
  const statusTitle = document.getElementById('statusTitle');
  const statusMessage = document.getElementById('statusMessage');
  const summaryStatus = document.getElementById('summaryStatus');
  const summaryPreset = document.getElementById('summaryPreset');
  const summaryMode = document.getElementById('summaryMode');
  const summaryTouch = document.getElementById('summaryTouch');
  const countTotal = document.getElementById('countTotal');
  const countStandard = document.getElementById('countStandard');
  const countHeuristic = document.getElementById('countHeuristic');
  const countActions = document.getElementById('countActions');
  const activeSlices = document.getElementById('activeSlices');
  const actionBuckets = document.getElementById('actionBuckets');
  const topActions = document.getElementById('topActions');
  const contractOutput = document.getElementById('contractOutput');
  const reportOutput = document.getElementById('reportOutput');
  const htmlPreviewLink = document.getElementById('htmlPreviewLink');
  const bundleHint = document.getElementById('bundleHint');

  const controller = {
    htmlPreviewUrl: null,
    extensionRuntimeAvailable: false
  };
  window.__demoState = window.__demoState || {};
  window.__demoState.presetApplied = false;

  function setStatus(state, title, message) {
    statusPill.className = `status-pill ${state}`;
    statusPill.textContent = state;
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    summaryStatus.textContent = title;
  }

  function frameWindow() {
    return frame.contentWindow;
  }

  function getApi() {
    const win = frameWindow();
    if (!win || !win.__a11yOverlayInstalled) {
      throw new Error('Overlay runtime is not available in the iframe yet.');
    }
    return win.__a11yOverlayInstalled;
  }

  function revokeHtmlPreview() {
    if (controller.htmlPreviewUrl) {
      URL.revokeObjectURL(controller.htmlPreviewUrl);
      controller.htmlPreviewUrl = null;
    }
    htmlPreviewLink.hidden = true;
    htmlPreviewLink.removeAttribute('href');
  }

  function setBusy(disabled) {
    [injectButton, presetButton, refreshButton, jsonButton, htmlButton, bundleButton].forEach((button) => {
      if (!button.hidden) button.disabled = disabled;
    });
  }

  function runtimeReady() {
    const win = frameWindow();
    return !!(win && win.__a11yOverlayInstalled);
  }

  function waitForRuntime(timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      function check() {
        if (runtimeReady()) {
          resolve(getApi());
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Timed out waiting for the overlay runtime.'));
          return;
        }
        window.setTimeout(check, 60);
      }

      check();
    });
  }

  async function injectOverlay() {
    setBusy(true);
    setStatus('loading', 'Injecting runtime', 'Appending the shipped overlay runtime into the deterministic demo target.');

    try {
      const win = frameWindow();
      const doc = frame.contentDocument;
      if (!win || !doc) {
        throw new Error('The iframe is not ready yet.');
      }

      if (!win.__a11yOverlayInstalled) {
        await new Promise((resolve, reject) => {
          const script = doc.createElement('script');
          script.src = 'a11y-overlay.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error('Could not load a11y-overlay.js into the iframe.'));
          doc.body.appendChild(script);
        });
      }

      await waitForRuntime(5000);
      await applyDemoPreset();
      await syncRuntimeSummary();
      setStatus('ready', 'Runtime ready', 'Overlay runtime injected, agent preset applied, and summary synchronized.');
    } catch (error) {
      setStatus('error', 'Runtime error', error && error.message ? error.message : String(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function applyDemoPreset() {
    const api = getApi();
    const presets = api.listPresets();
    const preferred = presets.find((preset) => preset.id === 'agent-capture');
    if (preferred) {
      api.applyPreset(preferred.id, { announce: false });
      api.render();
      return preferred.id;
    }
    return '';
  }

  function renderChips(container, items, className) {
    container.innerHTML = '';
    items.forEach((item) => {
      const span = document.createElement('span');
      span.className = `chip ${className || ''}`.trim();
      span.textContent = item;
      container.appendChild(span);
    });
    if (!items.length) {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = 'None';
      container.appendChild(span);
    }
  }

  function renderActions(actions) {
    topActions.innerHTML = '';
    if (!actions.length) {
      const li = document.createElement('li');
      li.textContent = 'No action items in the current report scope.';
      topActions.appendChild(li);
      return;
    }

    actions.slice(0, 4).forEach((action) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${action.bucketLabel}</strong>: ${action.title} (${action.count})<br><span class="muted-note">${action.suggestedFix}</span>`;
      topActions.appendChild(li);
    });
  }

  function renderContract(contract) {
    const methodNames = Object.keys(contract.methods || {});
    const compact = {
      contractVersion: contract.contractVersion,
      overlayVersion: contract.overlayVersion,
      reportSchemaVersion: contract.reportSchemaVersion,
      capabilities: contract.capabilities || {},
      methods: methodNames,
      presetIds: (contract.presets || []).map((preset) => preset.id),
      slices: (contract.slices || []).map((slice) => slice.key)
    };
    contractOutput.textContent = JSON.stringify(compact, null, 2);
  }

  async function syncRuntimeSummary() {
    const api = getApi();
    const report = api.buildReport('json', { scope: 'all' });
    const contract = api.getAutomationContract();
    controller.extensionRuntimeAvailable = !!(contract.capabilities && contract.capabilities.extensionRuntime);

    summaryPreset.textContent = report.audit.presetLabel || 'Custom';
    summaryMode.textContent = report.audit.layerMode;
    summaryTouch.textContent = report.audit.touchProfile;
    countTotal.textContent = String(report.summary.total || 0);
    countStandard.textContent = String(report.summary.findingType.standard || 0);
    countHeuristic.textContent = String(report.summary.findingType.heuristic || 0);
    countActions.textContent = String((report.actions || []).length);

    const active = Object.entries(report.audit.enabledSlices || {})
      .filter((entry) => entry[1])
      .map((entry) => entry[0]);
    renderChips(activeSlices, active, 'active');

    const buckets = (report.actions || []).map((action) => `${action.bucketLabel}: ${action.count}`);
    renderChips(actionBuckets, buckets, '');
    (report.actions || []).forEach((action, index) => {
      if (actionBuckets.children[index]) {
        actionBuckets.children[index].classList.add(action.bucket);
      }
    });
    renderActions(report.actions || []);
    renderContract(contract);

    bundleButton.hidden = !controller.extensionRuntimeAvailable;
    bundleHint.textContent = controller.extensionRuntimeAvailable
      ? 'Extension capture detected. Bundle export downloads a report with viewport evidence.'
      : 'Bundle export stays hidden because extension capture is not available in this demo context.';

    return { report, contract };
  }

  async function showJsonReport() {
    setBusy(true);
    try {
      const api = getApi();
      const report = api.buildReport('json', { scope: 'all' });
      reportOutput.textContent = JSON.stringify(report, null, 2);
      revokeHtmlPreview();
      setStatus('ready', 'JSON report ready', 'The deterministic target produced a structured runtime report.');
    } catch (error) {
      setStatus('error', 'Report error', error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function showHtmlPreviewLink() {
    setBusy(true);
    try {
      const api = getApi();
      const html = api.buildReport('html', { scope: 'all' });
      revokeHtmlPreview();
      controller.htmlPreviewUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      htmlPreviewLink.href = controller.htmlPreviewUrl;
      htmlPreviewLink.hidden = false;
      reportOutput.textContent = 'HTML report is ready. Use the preview link above to open the document in a new tab.';
      setStatus('ready', 'HTML report ready', 'The runtime generated a readable report document from the same contract-backed state.');
    } catch (error) {
      setStatus('error', 'Report error', error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function downloadBundle() {
    setBusy(true);
    try {
      const api = getApi();
      await api.downloadAuditBundle({ scope: 'all' });
      reportOutput.textContent = 'Audit bundle download triggered from the iframe runtime.';
      setStatus('ready', 'Bundle download triggered', 'The runtime requested an audit bundle with extension-backed capture.');
    } catch (error) {
      setStatus('error', 'Bundle error', error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  frame.addEventListener('load', () => {
    revokeHtmlPreview();
    contractOutput.textContent = 'Waiting for runtime contract…';
    reportOutput.textContent = 'No report generated yet.';
    activeSlices.innerHTML = '';
    actionBuckets.innerHTML = '';
    topActions.innerHTML = '';
    bundleButton.hidden = true;
    window.__demoState.presetApplied = false;
    setStatus('loading', 'Frame loaded', 'Attempting automatic injection and runtime synchronization.');
    injectOverlay().catch(() => {});
  });

  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
    revokeHtmlPreview();
    contractOutput.textContent = 'Waiting for runtime contract…';
    reportOutput.textContent = 'No report generated yet.';
    activeSlices.innerHTML = '';
    actionBuckets.innerHTML = '';
    topActions.innerHTML = '';
    bundleButton.hidden = true;
    setStatus('loading', 'Frame loaded', 'Attempting automatic injection and runtime synchronization.');
    injectOverlay().catch(() => {});
  }

  injectButton.addEventListener('click', () => {
    injectOverlay().catch(() => {});
  });
  presetButton.addEventListener('click', async () => {
    setBusy(true);
    window.__demoState.presetApplied = false;
    try {
      const presetId = await applyDemoPreset();
      await syncRuntimeSummary();
      window.__demoState.presetApplied = true;
      setStatus('ready', 'Agent preset applied', presetId ? `Preset "${presetId}" is active in the iframe runtime.` : 'No agent preset was available to apply.');
    } catch (error) {
      window.__demoState.presetApplied = false;
      setStatus('error', 'Preset error', error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  });
  refreshButton.addEventListener('click', async () => {
    setBusy(true);
    try {
      await syncRuntimeSummary();
      setStatus('ready', 'Summary refreshed', 'Latest report, action buckets, and contract snapshot loaded from the iframe runtime.');
    } catch (error) {
      setStatus('error', 'Refresh error', error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  });
  jsonButton.addEventListener('click', () => {
    showJsonReport().catch(() => {});
  });
  htmlButton.addEventListener('click', () => {
    showHtmlPreviewLink().catch(() => {});
  });
  bundleButton.addEventListener('click', () => {
    downloadBundle().catch(() => {});
  });
})();
