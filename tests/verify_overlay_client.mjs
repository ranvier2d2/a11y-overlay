import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OverlayClient, DEFAULT_SCRIPT_PATH } from '../playwright/overlay-client.mjs';
import { OverlayLiveClient } from '../playwright/overlay-client-live.mjs';

class FakeRuntime {
  constructor() {
    this.appliedPreset = '';
    this.layerMode = 'conformance';
    this.annotationMode = 'idle';
    this.uiState = {
      uiMode: 'human',
      toolbarOpen: true,
      helpOpen: true,
      settingsOpen: false,
      captureUiHidden: false,
      mobileSheetOpen: false,
      mobileSheetTab: 'layers',
      mobileSheetDetent: 'medium'
    };
    this.notes = [];
    this.arrows = [];
    this.uiTransitions = [];
    this.getAutomationContract = this.getAutomationContract.bind(this);
    this.getUiState = this.getUiState.bind(this);
    this.listPresets = this.listPresets.bind(this);
    this.configureUi = this.configureUi.bind(this);
    this.applyPreset = this.applyPreset.bind(this);
    this.buildReport = this.buildReport.bind(this);
    this.buildAuditBundle = this.buildAuditBundle.bind(this);
    this.collectDetections = this.collectDetections.bind(this);
    this.setLayerMode = this.setLayerMode.bind(this);
    this.setAnnotationMode = this.setAnnotationMode.bind(this);
    this.addNote = this.addNote.bind(this);
    this.addArrow = this.addArrow.bind(this);
    this.saveSession = this.saveSession.bind(this);
    this.clearSavedSession = this.clearSavedSession.bind(this);
    this.getSessionSnapshot = this.getSessionSnapshot.bind(this);
  }

  getAutomationContract() {
    return {
      contractVersion: 1,
      reportSchemaVersion: 1,
      methods: {
        getAutomationContract: {},
        getUiState: {},
        listPresets: {},
        configureUi: {},
        applyPreset: {},
        setLayerMode: {},
        setAnnotationMode: {},
        addNote: {},
        addArrow: {},
        saveSession: {},
        clearSavedSession: {},
        getSessionSnapshot: {},
        buildReport: {},
        buildAuditBundle: {},
        collectDetections: {}
      },
      capabilities: {
        extensionRuntime: false,
        viewportCapture: false
      },
      presets: [{ id: 'agent-capture', label: 'Agent' }]
    };
  }

  listPresets() {
    return [{ id: 'agent-capture', label: 'Agent' }];
  }

  getUiState() {
    return { ...this.uiState };
  }

  configureUi(options = {}) {
    this.uiTransitions.push(options);
    this.uiState = {
      ...this.uiState,
      ...options
    };
    return this.getUiState();
  }

  applyPreset(presetId, options = {}) {
    this.appliedPreset = presetId;
    if (options.ui) {
      this.configureUi(options.ui);
    }
    return true;
  }

  setLayerMode(mode) {
    this.layerMode = mode;
  }

  setAnnotationMode(mode) {
    this.annotationMode = mode;
  }

  addNote(point, text = '') {
    const note = { id: `note-${this.notes.length + 1}`, x: point.x, y: point.y, text };
    this.notes.push(note);
    return note;
  }

  addArrow(start, end) {
    const arrow = { id: `arrow-${this.arrows.length + 1}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    this.arrows.push(arrow);
    return arrow;
  }

  saveSession() {
    return this.getSessionSnapshot();
  }

  clearSavedSession() {
    this.notes = [];
    this.arrows = [];
  }

  getSessionSnapshot() {
    return {
      layerMode: this.layerMode,
      annotationMode: this.annotationMode,
      notes: [...this.notes],
      arrows: [...this.arrows]
    };
  }

  buildReport(format, options) {
    if (format === 'html') {
      return `<html><body>scope:${options.scope}</body></html>`;
    }
    return {
      document: {
        title: 'Fixture Page',
        url: 'https://example.test/demo',
        viewport: {
          width: 1280,
          height: 720
        }
      },
      audit: {
        scope: options.scope,
        presetId: this.appliedPreset || '',
        presetLabel: this.appliedPreset ? 'Agent' : 'Custom',
        touchProfile: 'both',
        layerMode: this.layerMode
      },
      overlayVersion: '0.1.17',
      schemaVersion: 1,
      summary: {
        total: 5,
        severity: {
          unspecified: 3,
          warning: 2
        },
        findingType: {
          advisory: 2,
          heuristic: 2,
          standard: 1
        },
        slices: {
          target: 2,
          repeat: 2,
          interact: 1
        }
      },
      actions: [
        {
          priority: 1,
          bucket: 'review',
          bucketLabel: 'Review',
          severity: 'warning',
          sliceKey: 'target',
          title: 'Interactive target misses advisory touch size',
          count: 2,
          whyItMatters: 'Controls are shorter than the configured touch guidance.',
          suggestedFix: 'Raise the control height to at least 44px.',
          examples: [
            '131×36 advisory · Get in Touch',
            '94×36 advisory · Overview'
          ]
        }
      ],
      annotations: {
        notes: this.notes.map((note) => ({
          id: note.id,
          x: note.x,
          y: note.y,
          text: note.text || ''
        })),
        arrows: this.arrows.map((arrow) => ({
          id: arrow.id,
          x1: arrow.x1,
          y1: arrow.y1,
          x2: arrow.x2,
          y2: arrow.y2
        }))
      },
      findings: [
        {
          id: 'target-too-small-1',
          kind: 'target-too-small',
          label: '131×36 advisory · Get in Touch',
          meta: {
            severity: 'warning',
            sliceKey: 'target',
            findingType: 'advisory',
            whyFlagged: 'The button is below the advisory touch minimum.',
            suggestedFix: 'Raise the button height to at least 44px.'
          },
          inspectorRows: [
            { key: 'Path', value: 'button.get-in-touch' },
            { key: 'Evidence', value: 'Target size 131×36 CSS px' },
            { key: 'Source', value: 'Apple touch target guidance; Android touch target guidance' }
          ]
        },
        {
          id: 'repeat-1',
          kind: 'repeat-pattern',
          label: 'Repeated compact control pattern',
          meta: {
            sliceKey: 'repeat',
            findingType: 'heuristic',
            summary: 'Repeated compact controls suggest a component-level sizing problem.'
          },
          inspectorRows: [
            { key: 'Path', value: '.compact-card-actions' },
            { key: 'Evidence', value: 'Repeated 24×24 icon buttons across cards' }
          ]
        }
      ]
    };
  }

  buildAuditBundle(options) {
    return `<html><body>bundle:${options.scope}</body></html>`;
  }

  collectDetections() {
    return [{ id: 'heading-1', kind: 'heading' }];
  }
}

class FakeTarget {
  constructor(runtime, options = {}) {
    this.runtime = runtime;
    this.installed = false;
    this.scriptTags = [];
    this.screenshots = [];
    this.url = 'https://example.test/demo';
    this.title = 'Fixture Page';
    this.viewportWidth = options.viewportWidth || 1280;
    this.viewportHeight = options.viewportHeight || 720;
    this.scrollHeight = Math.max(options.scrollHeight || this.viewportHeight, this.viewportHeight);
    this.scrollY = Math.max(0, options.scrollY || 0);
  }

  async addScriptTag(options) {
    this.scriptTags.push(options);
    this.installed = true;
  }

  async waitForFunction(pageFn, arg) {
    return this.#withWindow(() => pageFn(arg));
  }

  async evaluate(pageFn, arg) {
    return this.#withWindow(() => pageFn(arg));
  }

  async screenshot(options) {
    this.screenshots.push({
      ...options,
      scrollY: this.scrollY
    });
    return Buffer.from('fake-image');
  }

  #withWindow(fn) {
    const previousWindow = global.window;
    const previousDocument = global.document;
    const documentElement = {
      clientWidth: this.viewportWidth,
      clientHeight: this.viewportHeight,
      scrollHeight: this.scrollHeight,
      scrollTop: this.scrollY
    };
    const body = {
      clientWidth: this.viewportWidth,
      clientHeight: this.viewportHeight,
      scrollHeight: this.scrollHeight,
      scrollTop: this.scrollY
    };
    const scrollingElement = {
      clientWidth: this.viewportWidth,
      clientHeight: this.viewportHeight,
      scrollHeight: this.scrollHeight,
      scrollTop: this.scrollY
    };
    const windowObject = {
      location: { href: this.url },
      innerWidth: this.viewportWidth,
      innerHeight: this.viewportHeight,
      scrollY: this.scrollY,
      scrollTo: (_x, y) => {
        this.scrollY = Math.max(0, Number(y) || 0);
        scrollingElement.scrollTop = this.scrollY;
        documentElement.scrollTop = this.scrollY;
        body.scrollTop = this.scrollY;
        windowObject.scrollY = this.scrollY;
      }
    };
    if (this.installed) {
      windowObject.__a11yOverlayInstalled = this.runtime;
    }
    global.window = windowObject;
    global.document = {
      title: this.title,
      body,
      documentElement,
      scrollingElement
    };
    try {
      return fn();
    } finally {
      if (previousWindow === undefined) {
        delete global.window;
      } else {
        global.window = previousWindow;
      }
      if (previousDocument === undefined) {
        delete global.document;
      } else {
        global.document = previousDocument;
      }
    }
  }
}

async function verifyInjectAndDelegation(ClientClass = OverlayClient) {
  const runtime = new FakeRuntime();
  const target = new FakeTarget(runtime);
  const client = new ClientClass();

  const contract = await client.inject(target);
  assert.equal(contract.contractVersion, 1);
  assert.equal(target.scriptTags.length, 1);
  assert.equal(target.scriptTags[0].path, DEFAULT_SCRIPT_PATH);

  const presets = await client.listPresets(target);
  assert.equal(presets[0].id, 'agent-capture');

  const configured = await client.configureUi(target, {
    uiMode: 'agent',
    toolbarOpen: false,
    helpOpen: false
  });
  assert.equal(configured.uiMode, 'agent');
  assert.equal(configured.toolbarOpen, false);
  assert.equal(configured.helpOpen, false);

  const applied = await client.applyPreset(target, 'agent-capture', { announce: false });
  assert.equal(applied, true);

  const detections = await client.collectDetections(target);
  assert.deepEqual(detections, [{ id: 'heading-1', kind: 'heading' }]);

  const report = await client.buildReport(target, 'json', { scope: 'all' });
  assert.equal(report.audit.scope, 'all');
  assert.equal(report.audit.presetId, 'agent-capture');

  await client.setLayerMode(target, 'review');
  assert.equal(runtime.layerMode, 'review');

  await client.setAnnotationMode(target, 'note');
  assert.equal(runtime.annotationMode, 'note');

  const note = await client.annotateNote(target, { x: 120, y: 240, text: 'Missing label' });
  assert.equal(note.text, 'Missing label');

  const arrow = await client.annotateArrow(target, { x1: 10, y1: 20, x2: 30, y2: 40 });
  assert.equal(arrow.x2, 30);

  const snapshot = await client.getSessionSnapshot(target);
  assert.equal(snapshot.notes.length, 1);
  assert.equal(snapshot.arrows.length, 1);

  const saved = await client.saveSession(target);
  assert.equal(saved.notes[0].text, 'Missing label');

  await client.clearSavedSession(target);
  const cleared = await client.getSessionSnapshot(target);
  assert.equal(cleared.notes.length, 0);
  assert.equal(cleared.arrows.length, 0);

  const uiState = await client.getUiState(target);
  assert.equal(uiState.uiMode, 'agent');
  assert.equal(uiState.toolbarOpen, false);
  assert.equal(uiState.helpOpen, false);
}

async function verifyForceInjectIsIdempotent() {
  const runtime = new FakeRuntime();
  const target = new FakeTarget(runtime);
  target.installed = true;
  const client = new OverlayClient();

  const contract = await client.inject(target, { force: true });
  assert.equal(contract.contractVersion, 1);
  assert.equal(target.scriptTags.length, 1);
  assert.equal(target.scriptTags[0].path, DEFAULT_SCRIPT_PATH);
}

async function verifyFailurePackageWrite() {
  const runtime = new FakeRuntime();
  runtime.applyPreset('agent-capture');
  const target = new FakeTarget(runtime);
  target.installed = true;

  const client = new OverlayClient();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'overlay-client-'));

  try {
    const result = await client.writeFailurePackage(target, {
      dir,
      scope: 'all',
      includeHtmlReport: true,
      includeAuditBundle: true,
      fullPage: true
    });

    assert.equal(path.dirname(result.reportPath), dir);
    assert.equal(path.dirname(result.contractPath), dir);
    assert.equal(path.dirname(result.manifestPath), dir);
    assert.equal(path.dirname(result.screenshotPath), dir);

    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
    assert.equal(manifest.page.title, 'Fixture Page');
    assert.equal(manifest.files.report, 'report.json');
    assert.equal(manifest.files.contract, 'contract.json');
    assert.equal(manifest.files.htmlReport, 'report.html');
    assert.equal(manifest.files.auditBundle, 'audit-bundle.html');
    assert.equal(manifest.files.screenshot, 'fullpage.png');

    const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
    assert.equal(report.audit.scope, 'all');

    const contract = JSON.parse(await readFile(result.contractPath, 'utf8'));
    assert.equal(contract.contractVersion, 1);

    const htmlReport = await readFile(result.htmlReportPath, 'utf8');
    assert.match(htmlReport, /scope:all/);

    const auditBundle = await readFile(result.auditBundlePath, 'utf8');
    assert.match(auditBundle, /bundle:all/);

    assert.equal(target.screenshots.length, 1);
    assert.equal(target.screenshots[0].path, result.screenshotPath);
    assert.equal(target.screenshots[0].fullPage, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function verifyBuildReportAndBundleToFile() {
  const runtime = new FakeRuntime();
  runtime.applyPreset('agent-capture');
  const target = new FakeTarget(runtime);
  target.installed = true;

  const client = new OverlayClient();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'overlay-client-files-'));

  try {
    const jsonResult = await client.buildReportToFile(target, {
      dir,
      fileName: 'custom-report.json',
      format: 'json',
      scope: 'all'
    });
    const htmlResult = await client.buildReportToFile(target, {
      dir,
      fileName: 'custom-report.html',
      format: 'html',
      scope: 'all'
    });
    const bundleResult = await client.buildAuditBundleToFile(target, {
      dir,
      fileName: 'custom-bundle.html',
      scope: 'all'
    });

    assert.equal(path.basename(jsonResult.filePath), 'custom-report.json');
    assert.equal(path.basename(htmlResult.filePath), 'custom-report.html');
    assert.equal(path.basename(bundleResult.filePath), 'custom-bundle.html');

    const jsonContents = JSON.parse(await readFile(jsonResult.filePath, 'utf8'));
    assert.equal(jsonContents.audit.scope, 'all');

    const htmlContents = await readFile(htmlResult.filePath, 'utf8');
    assert.match(htmlContents, /scope:all/);

    const bundleContents = await readFile(bundleResult.filePath, 'utf8');
    assert.match(bundleContents, /bundle:all/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Verifies that writing a set of audit artifacts produces the expected files and screenshots.
 *
 * Creates desktop and mobile fake runtimes/targets, invokes the client's audit artifact writer
 * to emit bundle/report/screenshot files into a temporary directory, asserts the generated
 * artifact index, report markdown, and screenshot metadata, and removes the temporary directory.
 */
async function verifyWriteAuditArtifactSet() {
  const desktopRuntime = new FakeRuntime();
  desktopRuntime.applyPreset('agent-capture');
  desktopRuntime.addNote({ x: 12, y: 34 }, 'Desktop note');
  desktopRuntime.addArrow({ x: 1, y: 2 }, { x: 3, y: 4 });

  const mobileRuntime = new FakeRuntime();
  mobileRuntime.applyPreset('mobile');

  const desktopTarget = new FakeTarget(desktopRuntime);
  const mobileTarget = new FakeTarget(mobileRuntime);
  desktopTarget.installed = true;
  mobileTarget.installed = true;

  const client = new OverlayClient();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'overlay-client-audit-'));

  try {
    const result = await client.writeAuditArtifactSet(desktopTarget, {
      dir,
      scope: 'all',
      mobileTarget,
      screenshotType: 'jpeg',
      screenshotTimeoutMs: 12345,
      mobileScreenshotTimeoutMs: 23456,
      fullPage: true,
      mobileFullPage: false,
      reportContext: {
        target_name: 'Fixture App',
        audit_mode: 'audit-local-web',
        browser_and_os: 'Playwright + fake target',
        annotation_artifacts: 'Placement review metadata: placement-review.json'
      }
    });

    assert.equal(path.dirname(result.artifactIndexPath), dir);
    assert.equal(path.dirname(result.reportMarkdownPath), dir);
    assert.equal(path.dirname(result.reportHtmlPath), dir);
    assert.equal(path.basename(result.desktop.htmlBundlePath), 'desktop.html');
    assert.equal(path.basename(result.desktop.jsonReportPath), 'desktop.json');
    assert.equal(path.basename(result.desktop.screenshotPath), 'desktop.jpg');
    assert.equal(path.basename(result.mobile.htmlBundlePath), 'mobile.html');
    assert.equal(path.basename(result.mobile.jsonReportPath), 'mobile.json');
    assert.equal(path.basename(result.mobile.screenshotPath), 'mobile.jpg');

    const artifactIndex = JSON.parse(await readFile(result.artifactIndexPath, 'utf8'));
    assert.equal(artifactIndex.reportMarkdown, 'report.md');
    assert.equal(artifactIndex.reportHtml, 'report.html');
    assert.equal(artifactIndex.desktop.htmlBundle, 'desktop.html');
    assert.equal(artifactIndex.desktop.reportJson, 'desktop.json');
    assert.equal(artifactIndex.desktop.screenshot, 'desktop.jpg');
    assert.equal(artifactIndex.mobile.htmlBundle, 'mobile.html');
    assert.equal(artifactIndex.mobile.reportJson, 'mobile.json');
    assert.equal(artifactIndex.mobile.screenshot, 'mobile.jpg');
    assert.equal(artifactIndex.contract, 'contract.json');

    const reportMarkdown = await readFile(result.reportMarkdownPath, 'utf8');
    assert.match(reportMarkdown, /# Accessibility Audit Report/);
    assert.match(reportMarkdown, /\*\*Target:\*\* Fixture App/);
    assert.match(reportMarkdown, /\*\*Surface highlights:\*\*/);
    assert.match(reportMarkdown, /Interactive target misses advisory touch size/);
    assert.match(reportMarkdown, /Raise the control height to at least 44px/);
    assert.match(reportMarkdown, /### Counts by tested surface/);
    assert.match(reportMarkdown, /\*\*Artifact index:\*\* artifact-index\.json/);
    assert.match(reportMarkdown, /report\.html/);
    assert.match(reportMarkdown, /desktop\.html/);
    assert.match(reportMarkdown, /mobile\.html/);
    assert.match(reportMarkdown, /Placement review metadata: placement-review\.json/);

    const reportHtml = await readFile(result.reportHtmlPath, 'utf8');
    assert.match(reportHtml, /<title>Fixture App Accessibility Audit<\/title>/);
    assert.match(reportHtml, /Interactive target misses advisory touch size/);
    assert.match(reportHtml, /Desktop HTML evidence bundle/);
    assert.match(reportHtml, /evidence-carousel/);
    assert.match(reportHtml, /carousel-slide/);
    assert.match(reportHtml, /data-carousel-next/);
    assert.match(reportHtml, /desktop\.jpg/);
    assert.match(reportHtml, /<div[^>]*class="annotation-overlay"[^>]*>/);
    assert.match(reportHtml, /<div[^>]*class="annotation-note"[^>]*>/);
    assert.match(reportHtml, /<span[^>]*class="annotation-note-title"[^>]*>Note<\/span>/);
    assert.match(reportHtml, /<path[^>]*class="annotation-arrow"[^>]*>/);
    assert.match(reportHtml, /Desktop note/);

    assert.equal(desktopTarget.screenshots.length, 1);
    assert.equal(desktopTarget.screenshots[0].path, result.desktop.screenshotPath);
    assert.equal(desktopTarget.screenshots[0].type, 'jpeg');
    assert.equal(desktopTarget.screenshots[0].timeout, 12345);

    assert.equal(mobileTarget.screenshots.length, 1);
    assert.equal(mobileTarget.screenshots[0].path, result.mobile.screenshotPath);
    assert.equal(mobileTarget.screenshots[0].fullPage, false);
    assert.equal(mobileTarget.screenshots[0].timeout, 23456);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Verifies that scroll-slice visual evidence is captured and written to artifacts for desktop and mobile targets.
 *
 * Creates desktop and mobile FakeTarget instances, invokes captureVisualEvidence with captureMode 'scroll-slices',
 * and then writes an audit artifact set. Asserts that multiple capture slices are produced, that the desktop target's
 * scroll position advances during capture, that artifact index entries indicate 'scroll-slices' and include second-slice
 * filenames (e.g. `*-02.jpg`), and that the generated report markdown references those filenames. Uses a temporary
 * directory for output and removes it on completion.
 */
async function verifyScrollAwareVisualEvidence() {
  const runtime = new FakeRuntime();
  runtime.applyPreset('agent-capture');
  const desktopTarget = new FakeTarget(runtime, {
    viewportHeight: 600,
    scrollHeight: 1900
  });
  const mobileTarget = new FakeTarget(runtime, {
    viewportHeight: 640,
    scrollHeight: 2200
  });
  desktopTarget.installed = true;
  mobileTarget.installed = true;

  const client = new OverlayClient();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'overlay-client-scroll-'));

  try {
    const visualEvidence = await client.captureVisualEvidence(desktopTarget, {
      dir,
      fileName: 'desktop-review.jpg',
      screenshotType: 'jpeg',
      captureMode: 'scroll-slices',
      quietMode: true,
      scrollSettlingMs: 0
    });

    assert.equal(visualEvidence.mode, 'scroll-slices');
    assert.ok(visualEvidence.captures.length > 1);
    assert.equal(path.basename(visualEvidence.primaryPath), 'desktop-review.jpg');
    assert.equal(path.basename(visualEvidence.captures[1].path), 'desktop-review-02.jpg');
    assert.equal(desktopTarget.screenshots[0].scrollY, 0);
    assert.ok(desktopTarget.screenshots.at(-1).scrollY > 0);
    assert.ok(runtime.uiTransitions.some((entry) => entry.captureUiHidden === true));
    assert.equal(runtime.uiState.captureUiHidden, false);

    const result = await client.writeAuditArtifactSet(desktopTarget, {
      dir,
      scope: 'all',
      mobileTarget,
      screenshotType: 'jpeg',
      quietMode: true,
      captureMode: 'scroll-slices',
      mobileCaptureMode: 'scroll-slices',
      scrollSettlingMs: 0
    });

    assert.ok(result.desktop.screenshotPaths.length > 1);
    assert.ok(result.mobile.screenshotPaths.length > 1);
    assert.equal(path.basename(result.desktop.screenshotPath), 'desktop.jpg');
    assert.equal(path.basename(result.desktop.screenshotPaths[1]), 'desktop-02.jpg');
    assert.equal(path.basename(result.mobile.screenshotPaths[1]), 'mobile-02.jpg');

    const artifactIndex = JSON.parse(await readFile(result.artifactIndexPath, 'utf8'));
    assert.equal(artifactIndex.desktop.screenshotMode, 'scroll-slices');
    assert.ok(Array.isArray(artifactIndex.desktop.screenshots));
    assert.ok(artifactIndex.desktop.screenshots.length > 1);
    assert.equal(artifactIndex.desktop.screenshots[1], 'desktop-02.jpg');
    assert.equal(artifactIndex.mobile.screenshotMode, 'scroll-slices');
    assert.ok(artifactIndex.mobile.screenshots.length > 1);
    assert.equal(runtime.uiState.captureUiHidden, false);

    const reportMarkdown = await readFile(result.reportMarkdownPath, 'utf8');
    assert.match(reportMarkdown, /desktop-02\.jpg/);
    assert.match(reportMarkdown, /mobile-02\.jpg/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Verifies that OverlayClient.waitForStableState rejects when the method is unavailable.
 *
 * Asserts the call rejects with an error matching `/waitForStableState/`.
 */
function verifySingleSliceScrollPositionReduction() {
  const client = new OverlayClient();
  const positions = client._buildScrollPositions(
    {
      viewportHeight: 600,
      scrollHeight: 1900,
      initialScrollY: 240
    },
    {
      maxSlices: 1,
      startAt: 'current'
    }
  );

  assert.deepEqual(positions, [240]);
}
async function verifyUnavailableMethodError() {
  const runtime = new FakeRuntime();
  const target = new FakeTarget(runtime);
  target.installed = true;
  const client = new OverlayClient();

  await assert.rejects(
    () => client.waitForStableState(target, { quietMs: 300 }),
    /waitForStableState/
  );
}

async function verifyAdditionalFindingsFormatting() {
  const client = new OverlayClient();
  const findings = [
    { label: 'Fourth finding', meta: { severity: 'warning' } },
    { label: 'Fifth finding', meta: { severity: 'error' } }
  ];

  assert.equal(
    client._formatAdditionalFindings(findings, 3),
    '4. [warning] Fourth finding\n5. [error] Fifth finding'
  );
}

async function verifyAsyncFrameScreenshotResolution() {
  const runtime = new FakeRuntime();
  const target = new FakeTarget(runtime);
  target.installed = true;
  const frameLike = {
    async page() {
      return target;
    }
  };
  const client = new OverlayClient();

  const screenshot = await client._captureScreenshot(frameLike, {
    screenshotType: 'png',
    fullPage: false
  });

  assert.equal(screenshot.type, 'png');
  assert.equal(target.screenshots.length, 1);
  assert.equal(target.screenshots[0].fullPage, false);
}

/**
 * Runs the full suite of overlay client verification functions.
 *
 * Executes each verification in sequence and logs "overlay client verification passed" on success.
 */
async function main() {
  await verifyInjectAndDelegation(OverlayClient);
  await verifyInjectAndDelegation(OverlayLiveClient);
  await verifyForceInjectIsIdempotent();
  await verifyFailurePackageWrite();
  await verifyBuildReportAndBundleToFile();
  await verifyWriteAuditArtifactSet();
  await verifyScrollAwareVisualEvidence();
  verifySingleSliceScrollPositionReduction();
  await verifyUnavailableMethodError();
  await verifyAdditionalFindingsFormatting();
  await verifyAsyncFrameScreenshotResolution();
  console.log('overlay client verification passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
