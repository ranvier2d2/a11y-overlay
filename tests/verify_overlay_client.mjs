import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OverlayClient, DEFAULT_SCRIPT_PATH } from '../playwright/overlay-client.mjs';

class FakeRuntime {
  constructor() {
    this.appliedPreset = '';
    this.getAutomationContract = this.getAutomationContract.bind(this);
    this.listPresets = this.listPresets.bind(this);
    this.applyPreset = this.applyPreset.bind(this);
    this.buildReport = this.buildReport.bind(this);
    this.buildAuditBundle = this.buildAuditBundle.bind(this);
    this.collectDetections = this.collectDetections.bind(this);
  }

  getAutomationContract() {
    return {
      contractVersion: 1,
      reportSchemaVersion: 1,
      methods: {
        getAutomationContract: {},
        listPresets: {},
        applyPreset: {},
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

  applyPreset(presetId) {
    this.appliedPreset = presetId;
    return true;
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

async function verifyInjectAndDelegation() {
  const runtime = new FakeRuntime();
  const target = new FakeTarget(runtime);
  const client = new OverlayClient();

  const contract = await client.inject(target);
  assert.equal(contract.contractVersion, 1);
  assert.equal(target.scriptTags.length, 1);
  assert.equal(target.scriptTags[0].path, DEFAULT_SCRIPT_PATH);

  const presets = await client.listPresets(target);
  assert.equal(presets[0].id, 'agent-capture');

  const applied = await client.applyPreset(target, 'agent-capture', { announce: false });
  assert.equal(applied, true);

  const detections = await client.collectDetections(target);
  assert.deepEqual(detections, [{ id: 'heading-1', kind: 'heading' }]);

  const report = await client.buildReport(target, 'json', { scope: 'all' });
  assert.equal(report.audit.scope, 'all');
  assert.equal(report.audit.presetId, 'agent-capture');
}

async function verifyForceInjectIsIdempotent() {
  const runtime = new FakeRuntime();
  const target = new FakeTarget(runtime);
  target.installed = true;
  const client = new OverlayClient();

  const contract = await client.inject(target, { force: true });
  assert.equal(contract.contractVersion, 1);
  assert.equal(target.scriptTags.length, 0);
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

async function main() {
  await verifyInjectAndDelegation();
  await verifyForceInjectIsIdempotent();
  await verifyFailurePackageWrite();
  await verifyUnavailableMethodError();
  console.log('overlay client verification passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
