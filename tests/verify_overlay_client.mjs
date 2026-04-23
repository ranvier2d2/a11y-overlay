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
      helpOpen: true,
      settingsOpen: false,
      mobileSheetOpen: false,
      mobileSheetTab: 'layers',
      mobileSheetDetent: 'medium'
    };
    this.notes = [];
    this.arrows = [];
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
        url: 'https://example.test/demo'
      },
      audit: {
        scope: options.scope,
        presetId: this.appliedPreset || '',
        presetLabel: this.appliedPreset ? 'Agent' : 'Custom'
      },
      summary: {
        total: 1
      },
      findings: [
        {
          id: 'target-too-small-1',
          kind: 'target-too-small'
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
  constructor(runtime) {
    this.runtime = runtime;
    this.installed = false;
    this.scriptTags = [];
    this.screenshots = [];
    this.url = 'https://example.test/demo';
    this.title = 'Fixture Page';
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
    this.screenshots.push(options);
    return Buffer.from('fake-image');
  }

  #withWindow(fn) {
    const previousWindow = global.window;
    const previousDocument = global.document;
    global.window = this.installed ? { __a11yOverlayInstalled: this.runtime, location: { href: this.url } } : { location: { href: this.url } };
    global.document = { title: this.title };
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
    helpOpen: false
  });
  assert.equal(configured.uiMode, 'agent');
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
      fullPage: true,
      mobileFullPage: false,
      reportContext: {
        target_name: 'Fixture App',
        audit_mode: 'audit-local-web',
        browser_and_os: 'Playwright + fake target'
      }
    });

    assert.equal(path.dirname(result.artifactIndexPath), dir);
    assert.equal(path.dirname(result.reportMarkdownPath), dir);
    assert.equal(path.basename(result.desktop.htmlBundlePath), 'desktop.html');
    assert.equal(path.basename(result.desktop.jsonReportPath), 'desktop.json');
    assert.equal(path.basename(result.desktop.screenshotPath), 'desktop.jpg');
    assert.equal(path.basename(result.mobile.htmlBundlePath), 'mobile.html');
    assert.equal(path.basename(result.mobile.jsonReportPath), 'mobile.json');
    assert.equal(path.basename(result.mobile.screenshotPath), 'mobile.jpg');

    const artifactIndex = JSON.parse(await readFile(result.artifactIndexPath, 'utf8'));
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
    assert.match(reportMarkdown, /\*\*Artifact index:\*\* artifact-index\.json/);
    assert.match(reportMarkdown, /desktop\.html/);
    assert.match(reportMarkdown, /mobile\.html/);

    assert.equal(desktopTarget.screenshots.length, 1);
    assert.equal(desktopTarget.screenshots[0].path, result.desktop.screenshotPath);
    assert.equal(desktopTarget.screenshots[0].type, 'jpeg');

    assert.equal(mobileTarget.screenshots.length, 1);
    assert.equal(mobileTarget.screenshots[0].path, result.mobile.screenshotPath);
    assert.equal(mobileTarget.screenshots[0].fullPage, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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

async function main() {
  await verifyInjectAndDelegation(OverlayClient);
  await verifyInjectAndDelegation(OverlayLiveClient);
  await verifyForceInjectIsIdempotent();
  await verifyFailurePackageWrite();
  await verifyBuildReportAndBundleToFile();
  await verifyWriteAuditArtifactSet();
  await verifyUnavailableMethodError();
  await verifyAdditionalFindingsFormatting();
  await verifyAsyncFrameScreenshotResolution();
  console.log('overlay client verification passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
