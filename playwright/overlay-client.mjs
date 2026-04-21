import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_GLOBAL_NAME = '__a11yOverlayInstalled';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_SCRIPT_PATH = fileURLToPath(new URL('../a11y-overlay.js', import.meta.url));

/**
 * @typedef {{
 *   contractVersion?: number,
 *   methods?: Record<string, unknown>,
 *   capabilities?: Record<string, boolean>,
 *   presets?: Array<{ id: string, label?: string }>,
 *   slices?: Array<{ key: string, label?: string }>
 * }} OverlayContract
 */

/**
 * @typedef {{
 *   title?: string,
 *   url?: string
 * }} OverlayPageMetadata
 */

/**
 * Thin Playwright-facing wrapper over the injected overlay runtime.
 *
 * The runtime remains the source of truth for semantic context and evidence.
 * Playwright remains the executor for navigation, clicks, typing, and screenshots.
 */
export class OverlayClient {
  /**
   * @param {{
   *   globalName?: string,
   *   scriptPath?: string,
   *   defaultTimeoutMs?: number
   * }} [options]
   */
  constructor(options = {}) {
    this.globalName = options.globalName || DEFAULT_GLOBAL_NAME;
    this.scriptPath = options.scriptPath || DEFAULT_SCRIPT_PATH;
    this.defaultTimeoutMs = Number.isFinite(options.defaultTimeoutMs)
      ? options.defaultTimeoutMs
      : DEFAULT_TIMEOUT_MS;
  }

  /**
   * Inject the runtime into a Playwright page or frame.
   *
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {{
   *   force?: boolean,
   *   scriptPath?: string,
   *   scriptUrl?: string,
   *   scriptContent?: string,
   *   timeoutMs?: number
   * }} [options]
   * @returns {Promise<OverlayContract>}
   */
  async inject(target, options = {}) {
    const installed = await this.isInstalled(target);

    if (!installed) {
      const tagOptions = this._scriptTagOptions(options);
      await target.addScriptTag(tagOptions);
    }

    await this.waitForRuntime(target, { timeoutMs: options.timeoutMs });
    return this.getContract(target);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @returns {Promise<boolean>}
   */
  async isInstalled(target) {
    return target.evaluate(
      ({ globalName }) => !!window[globalName],
      { globalName: this.globalName }
    );
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {{ timeoutMs?: number }} [options]
   * @returns {Promise<void>}
   */
  async waitForRuntime(target, options = {}) {
    const timeoutMs = this._timeout(options.timeoutMs);
    await target.waitForFunction(
      ({ globalName }) => !!window[globalName],
      { globalName: this.globalName },
      { timeout: timeoutMs }
    );
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @returns {Promise<OverlayContract>}
   */
  async getContract(target) {
    return this._evaluateRuntimeMethod(target, 'getAutomationContract', []);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {string} methodName
   * @returns {Promise<boolean>}
   */
  async hasMethod(target, methodName) {
    const contract = await this.getContract(target);
    return !!(contract && contract.methods && contract.methods[methodName]);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {string} capabilityName
   * @returns {Promise<boolean>}
   */
  async hasCapability(target, capabilityName) {
    const contract = await this.getContract(target);
    return !!(contract && contract.capabilities && contract.capabilities[capabilityName]);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @returns {Promise<Array<object>>}
   */
  async collectDetections(target) {
    return this._evaluateRuntimeMethod(target, 'collectDetections', []);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {'json' | 'html'} [format]
   * @param {object} [options]
   * @returns {Promise<object | string>}
   */
  async buildReport(target, format = 'json', options = {}) {
    return this._evaluateRuntimeMethod(target, 'buildReport', [format, options]);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {object} [options]
   * @returns {Promise<string>}
   */
  async buildAuditBundle(target, options = {}) {
    return this._evaluateRuntimeMethod(target, 'buildAuditBundle', [options]);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @returns {Promise<Array<object>>}
   */
  async listPresets(target) {
    return this._evaluateRuntimeMethod(target, 'listPresets', []);
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {string} presetId
   * @param {object} [options]
   * @returns {Promise<boolean>}
   */
  async applyPreset(target, presetId, options = {}) {
    return this._evaluateRuntimeMethod(target, 'applyPreset', [presetId, options]);
  }

  /**
   * Proxy to a future runtime readiness primitive when available.
   *
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @returns {Promise<object>}
   */
  async getReadyState(target) {
    return this._evaluateRuntimeMethod(target, 'getReadyState', []);
  }

  /**
   * Proxy to a future runtime readiness primitive when available.
   *
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async waitForStableState(target, options = {}) {
    return this._evaluateRuntimeMethod(target, 'waitForStableState', [options]);
  }

  /**
   * Capture the current runtime state plus a Playwright screenshot.
   *
   * This keeps Playwright as the screenshot source, which is the right path
   * for the primary buyer even when extension capture is unavailable.
   *
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {{
   *   scope?: 'active' | 'all',
   *   includeHtmlReport?: boolean,
   *   includeAuditBundle?: boolean,
   *   screenshotPage?: import('playwright').Page,
   *   screenshotPath?: string,
   *   screenshotType?: 'png' | 'jpeg',
   *   fullPage?: boolean,
   *   includeScreenshotBytes?: boolean
   * }} [options]
   * @returns {Promise<{
   *   generatedAt: string,
   *   page: OverlayPageMetadata,
   *   contract: OverlayContract,
   *   report: object,
   *   htmlReport?: string,
   *   auditBundleHtml?: string,
   *   screenshot?: {
   *     type: 'png' | 'jpeg',
   *     fullPage: boolean,
   *     path?: string,
   *     bytes?: Buffer
   *   }
   * }>}
   */
  async collectFailurePackage(target, options = {}) {
    const scope = options.scope === 'active' ? 'active' : 'all';
    const includeHtmlReport = options.includeHtmlReport !== false;
    const includeAuditBundle = options.includeAuditBundle !== false;

    const [contract, report, htmlReport, auditBundleHtml, pageMeta] = await Promise.all([
      this.getContract(target),
      this.buildReport(target, 'json', { scope }),
      includeHtmlReport ? this.buildReport(target, 'html', { scope }) : Promise.resolve(undefined),
      includeAuditBundle ? this.buildAuditBundle(target, { scope }) : Promise.resolve(undefined),
      this._readPageMetadata(target)
    ]);

    const screenshot = await this._captureScreenshot(target, options);

    return {
      generatedAt: new Date().toISOString(),
      page: pageMeta,
      contract,
      report,
      ...(htmlReport ? { htmlReport } : {}),
      ...(auditBundleHtml ? { auditBundleHtml } : {}),
      ...(screenshot ? { screenshot } : {})
    };
  }

  /**
   * Persist a Playwright-native failure package to disk.
   *
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {{
   *   dir: string,
   *   scope?: 'active' | 'all',
   *   includeHtmlReport?: boolean,
   *   includeAuditBundle?: boolean,
   *   screenshotPage?: import('playwright').Page,
   *   screenshotType?: 'png' | 'jpeg',
   *   fullPage?: boolean
   * }} options
   * @returns {Promise<{
   *   dir: string,
   *   manifestPath: string,
   *   contractPath: string,
   *   reportPath: string,
   *   htmlReportPath?: string,
   *   auditBundlePath?: string,
   *   screenshotPath?: string
   * }>}
   */
  async writeFailurePackage(target, options) {
    if (!options || !options.dir) {
      throw new Error('writeFailurePackage requires a target directory via options.dir.');
    }

    const dir = options.dir;
    await mkdir(dir, { recursive: true });

    const screenshotType = options.screenshotType === 'jpeg' ? 'jpeg' : 'png';
    const screenshotExtension = screenshotType === 'jpeg' ? 'jpg' : 'png';
    const screenshotBaseName = options.fullPage === false ? 'viewport' : 'fullpage';
    const screenshotPath = path.join(dir, `${screenshotBaseName}.${screenshotExtension}`);

    const failurePackage = await this.collectFailurePackage(target, {
      ...options,
      screenshotPath,
      screenshotType,
      includeScreenshotBytes: false
    });

    const contractPath = path.join(dir, 'contract.json');
    const reportPath = path.join(dir, 'report.json');
    const manifestPath = path.join(dir, 'manifest.json');
    const htmlReportPath = failurePackage.htmlReport ? path.join(dir, 'report.html') : '';
    const auditBundlePath = failurePackage.auditBundleHtml ? path.join(dir, 'audit-bundle.html') : '';

    const writes = [
      writeFile(contractPath, `${JSON.stringify(failurePackage.contract, null, 2)}\n`, 'utf8'),
      writeFile(reportPath, `${JSON.stringify(failurePackage.report, null, 2)}\n`, 'utf8')
    ];
    if (failurePackage.htmlReport) {
      writes.push(writeFile(htmlReportPath, failurePackage.htmlReport, 'utf8'));
    }
    if (failurePackage.auditBundleHtml) {
      writes.push(writeFile(auditBundlePath, failurePackage.auditBundleHtml, 'utf8'));
    }
    await Promise.all(writes);

    const manifest = {
      generatedAt: failurePackage.generatedAt,
      page: failurePackage.page,
      files: {
        contract: path.basename(contractPath),
        report: path.basename(reportPath),
        ...(htmlReportPath ? { htmlReport: path.basename(htmlReportPath) } : {}),
        ...(auditBundlePath ? { auditBundle: path.basename(auditBundlePath) } : {}),
        ...(failurePackage.screenshot ? { screenshot: path.basename(screenshotPath) } : {})
      }
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    return {
      dir,
      manifestPath,
      contractPath,
      reportPath,
      ...(htmlReportPath ? { htmlReportPath } : {}),
      ...(auditBundlePath ? { auditBundlePath } : {}),
      ...(failurePackage.screenshot ? { screenshotPath } : {})
    };
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {string} methodName
   * @param {Array<unknown>} args
   * @returns {Promise<any>}
   */
  async _evaluateRuntimeMethod(target, methodName, args) {
    return target.evaluate(
      ({ globalName, methodName, args }) => {
        const runtime = window[globalName];
        if (!runtime) {
          throw new Error(`Overlay runtime "${globalName}" is not installed.`);
        }
        const method = runtime[methodName];
        if (typeof method !== 'function') {
          throw new Error(`Overlay runtime method "${methodName}" is not available in this build.`);
        }
        return method.apply(runtime, args);
      },
      {
        globalName: this.globalName,
        methodName,
        args
      }
    );
  }

  /**
   * @param {{
   *   scriptPath?: string,
   *   scriptUrl?: string,
   *   scriptContent?: string
   * }} options
   * @returns {{ path?: string, url?: string, content?: string }}
   */
  _scriptTagOptions(options) {
    if (options.scriptContent) {
      return { content: options.scriptContent };
    }
    if (options.scriptUrl) {
      return { url: options.scriptUrl };
    }
    return { path: options.scriptPath || this.scriptPath };
  }

  /**
   * @param {number | undefined} timeoutMs
   * @returns {number}
   */
  _timeout(timeoutMs) {
    return Number.isFinite(timeoutMs) ? Number(timeoutMs) : this.defaultTimeoutMs;
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @returns {Promise<OverlayPageMetadata>}
   */
  async _readPageMetadata(target) {
    return target.evaluate(() => ({
      title: document.title || '',
      url: window.location.href || ''
    }));
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {{
   *   screenshotPage?: import('playwright').Page,
   *   screenshotPath?: string,
   *   screenshotType?: 'png' | 'jpeg',
   *   fullPage?: boolean,
   *   includeScreenshotBytes?: boolean
   * }} options
   * @returns {Promise<{
   *   type: 'png' | 'jpeg',
   *   fullPage: boolean,
   *   path?: string,
   *   bytes?: Buffer
   * } | undefined>}
   */
  async _captureScreenshot(target, options = {}) {
    const screenshotTarget = this._resolveScreenshotPage(target, options.screenshotPage);
    if (!screenshotTarget || typeof screenshotTarget.screenshot !== 'function') {
      return undefined;
    }

    const type = options.screenshotType === 'jpeg' ? 'jpeg' : 'png';
    const fullPage = options.fullPage !== false;
    const bytes = await screenshotTarget.screenshot({
      type,
      fullPage,
      ...(options.screenshotPath ? { path: options.screenshotPath } : {})
    });

    return {
      type,
      fullPage,
      ...(options.screenshotPath ? { path: options.screenshotPath } : {}),
      ...(options.includeScreenshotBytes === false ? {} : { bytes })
    };
  }

  /**
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {import('playwright').Page | undefined} explicitPage
   * @returns {import('playwright').Page | undefined}
   */
  _resolveScreenshotPage(target, explicitPage) {
    if (explicitPage) return explicitPage;
    if (target && typeof target.screenshot === 'function') return target;
    if (target && typeof target.page === 'function') return target.page();
    return undefined;
  }
}

/**
 * @param {ConstructorParameters<typeof OverlayClient>[0]} [options]
 * @returns {OverlayClient}
 */
export function createOverlayClient(options) {
  return new OverlayClient(options);
}

export { DEFAULT_SCRIPT_PATH, DEFAULT_GLOBAL_NAME, DEFAULT_TIMEOUT_MS };
