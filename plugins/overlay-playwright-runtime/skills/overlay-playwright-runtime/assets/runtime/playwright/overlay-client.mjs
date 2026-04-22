import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  OverlayLiveClient,
  DEFAULT_SCRIPT_PATH,
  DEFAULT_GLOBAL_NAME,
  DEFAULT_TIMEOUT_MS
} from './overlay-client-live.mjs';

/**
 * Thin Playwright-facing wrapper over the injected overlay runtime.
 *
 * The runtime remains the source of truth for semantic context and evidence.
 * Playwright remains the executor for navigation, clicks, typing, and screenshots.
 */
export class OverlayClient extends OverlayLiveClient {
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
   *   page: { title?: string, url?: string },
   *   contract: object,
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
      this.readPageMetadata(target)
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

  _resolveScreenshotPage(target, explicitPage) {
    if (explicitPage) return explicitPage;
    if (target && typeof target.screenshot === 'function') return target;
    if (target && typeof target.page === 'function') return target.page();
    return undefined;
  }
}

export function createOverlayClient(options) {
  return new OverlayClient(options);
}

export { DEFAULT_SCRIPT_PATH, DEFAULT_GLOBAL_NAME, DEFAULT_TIMEOUT_MS };
