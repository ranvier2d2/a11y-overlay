import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  OverlayLiveClient,
  DEFAULT_SCRIPT_PATH,
  DEFAULT_GLOBAL_NAME,
  DEFAULT_TIMEOUT_MS
} from './overlay-client-live.mjs';

const DEFAULT_REPORT_TEMPLATE = `# Accessibility Audit Report

## Executive Summary

- **Target:** {{target_name}}
- **Primary URL or route:** {{primary_url}}
- **Audit date:** {{audit_date}}
- **Audit mode:** {{audit_mode}}
- **Overall summary:** {{overall_summary}}

### Top findings

1. {{top_finding_1}}
2. {{top_finding_2}}
3. {{top_finding_3}}

### Recommended fix order

1. {{fix_order_1}}
2. {{fix_order_2}}
3. {{fix_order_3}}

## Scope of Review

- **Audited surfaces:** {{audited_surfaces}}
- **Excluded surfaces:** {{excluded_surfaces}}
- **Desktop viewport:** {{desktop_viewport}}
- **Mobile viewport:** {{mobile_viewport}}
- **Auth or pairing state:** {{auth_state}}
- **Sample strategy:** {{sample_strategy}}

## Methodology

- **Overlay version:** {{overlay_version}}
- **Report schema version:** {{report_schema_version}}
- **Preset(s) used:** {{presets_used}}
- **Layer mode:** {{layer_mode}}
- **Touch profile:** {{touch_profile}}
- **Browser and OS:** {{browser_and_os}}
- **Manual interactions performed:** {{manual_interactions}}
- **Artifact set produced:** {{artifact_set}}

### Method notes

{{method_notes}}

## Results Summary

### Counts by severity

- **Total findings:** {{total_findings}}
- **Errors:** {{error_count}}
- **Warnings:** {{warning_count}}
- **Pass / informational counts if relevant:** {{pass_or_info_counts}}

### Counts by slice

- {{slice_summary}}

### Counts by finding type

- {{finding_type_summary}}

## Prioritized Remediation Plan

### Fix now

- {{fix_now_items}}

### Fix next

- {{fix_next_items}}

### Review

- {{review_items}}

## Detailed Findings

### Finding 1: {{finding_title_1}}

- **Severity:** {{finding_severity_1}}
- **Type:** {{finding_type_1}}
- **Affected page or route:** {{finding_route_1}}
- **Affected element or component:** {{finding_target_1}}
- **Why flagged:** {{finding_why_1}}
- **Evidence:** {{finding_evidence_1}}
- **Standards or source links:** {{finding_sources_1}}
- **Suggested remediation:** {{finding_fix_1}}

### Finding 2: {{finding_title_2}}

- **Severity:** {{finding_severity_2}}
- **Type:** {{finding_type_2}}
- **Affected page or route:** {{finding_route_2}}
- **Affected element or component:** {{finding_target_2}}
- **Why flagged:** {{finding_why_2}}
- **Evidence:** {{finding_evidence_2}}
- **Standards or source links:** {{finding_sources_2}}
- **Suggested remediation:** {{finding_fix_2}}

### Additional findings

{{additional_findings}}

## Evidence and Artifacts

- **Artifact index:** {{artifact_index}}
- **Desktop HTML evidence bundle:** {{desktop_html_bundle}}
- **Mobile HTML evidence bundle:** {{mobile_html_bundle}}
- **Desktop screenshot:** {{desktop_screenshot}}
- **Mobile screenshot:** {{mobile_screenshot}}
- **Machine-readable JSON report:** {{json_report}}
- **Annotations / callouts:** {{annotation_artifacts}}

## Limitations and Confidence

### Limitations

- {{limitation_1}}
- {{limitation_2}}
- {{limitation_3}}

### Confidence notes

{{confidence_notes}}

## Standards Posture

This document is a **Website Accessibility Audit Report** based on the tested routes, states, and artifacts above. Unless explicitly stated otherwise, it is **not** a formal accessibility conformance claim, VPAT, or ACR.
`;

const DEFAULT_REPORT_TEMPLATE_CANDIDATES = [
  new URL('../plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/assets/templates/accessibility-audit-report.md', import.meta.url),
  new URL('./assets/templates/accessibility-audit-report.md', import.meta.url)
];

/**
 * Thin Playwright-facing wrapper over the injected overlay runtime.
 *
 * The runtime remains the source of truth for semantic context and evidence.
 * Playwright remains the executor for navigation, clicks, typing, and screenshots.
 */
export class OverlayClient extends OverlayLiveClient {
  /**
   * Build a report and persist it to disk.
   *
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {{
   *   filePath?: string,
   *   dir?: string,
   *   fileName?: string,
   *   format?: 'json' | 'html',
   *   scope?: 'active' | 'all'
   * }} [options]
   * @returns {Promise<{filePath: string, format: 'json' | 'html', report: object | string}>}
   */
  async buildReportToFile(target, options = {}) {
    const format = options.format === 'html' ? 'html' : 'json';
    const report = await this.buildReport(target, format, { scope: options.scope === 'active' ? 'active' : 'all' });
    const filePath = this._resolveOutputPath(options, {
      defaultBaseName: format === 'html' ? 'report' : 'report',
      extension: format === 'html' ? '.html' : '.json'
    });

    await mkdir(path.dirname(filePath), { recursive: true });
    const contents = format === 'html'
      ? String(report)
      : `${JSON.stringify(report, null, 2)}\n`;
    await writeFile(filePath, contents, 'utf8');

    return { filePath, format, report };
  }

  /**
   * Build an audit bundle and persist it to disk.
   *
   * @param {import('playwright').Page | import('playwright').Frame} target
   * @param {{
   *   filePath?: string,
   *   dir?: string,
   *   fileName?: string,
   *   scope?: 'active' | 'all'
   * }} [options]
   * @returns {Promise<{filePath: string, auditBundleHtml: string}>}
   */
  async buildAuditBundleToFile(target, options = {}) {
    const auditBundleHtml = await this.buildAuditBundle(target, {
      scope: options.scope === 'active' ? 'active' : 'all'
    });
    const filePath = this._resolveOutputPath(options, {
      defaultBaseName: 'audit-bundle',
      extension: '.html'
    });

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, String(auditBundleHtml), 'utf8');

    return { filePath, auditBundleHtml: String(auditBundleHtml) };
  }

  /**
   * Write a stable audit artifact set for desktop and optional mobile runs.
   *
   * @param {import('playwright').Page | import('playwright').Frame} desktopTarget
   * @param {{
   *   dir: string,
   *   scope?: 'active' | 'all',
   *   mobileTarget?: import('playwright').Page | import('playwright').Frame,
   *   screenshotPage?: import('playwright').Page,
   *   mobileScreenshotPage?: import('playwright').Page,
   *   screenshotType?: 'png' | 'jpeg',
   *   fullPage?: boolean,
   *   mobileFullPage?: boolean,
   *   includeContract?: boolean,
   *   includeJsonReports?: boolean,
   *   reportTemplatePath?: string,
   *   reportContext?: Record<string, string>
   * }} options
   * @returns {Promise<{
   *   dir: string,
   *   artifactIndexPath: string,
   *   reportMarkdownPath: string,
   *   contractPath?: string,
   *   desktop: { jsonReportPath?: string, htmlBundlePath: string, screenshotPath?: string },
   *   mobile?: { jsonReportPath?: string, htmlBundlePath: string, screenshotPath?: string }
   * }>}
   */
  async writeAuditArtifactSet(desktopTarget, options) {
    if (!options || !options.dir) {
      throw new Error('writeAuditArtifactSet requires a target directory via options.dir.');
    }

    const dir = options.dir;
    const scope = options.scope === 'active' ? 'active' : 'all';
    const screenshotType = options.screenshotType === 'png' ? 'png' : 'jpeg';
    const screenshotExt = screenshotType === 'png' ? 'png' : 'jpg';
    await mkdir(dir, { recursive: true });

    const desktopReport = await this.buildReport(desktopTarget, 'json', { scope });
    const desktopBundlePath = path.join(dir, 'desktop.html');
    const desktopJsonPath = path.join(dir, 'desktop.json');
    const desktopScreenshotPath = path.join(dir, `desktop.${screenshotExt}`);

    await this.buildAuditBundleToFile(desktopTarget, {
      filePath: desktopBundlePath,
      scope
    });

    if (options.includeJsonReports !== false) {
      await writeFile(desktopJsonPath, `${JSON.stringify(desktopReport, null, 2)}\n`, 'utf8');
    }

    const desktopScreenshot = await this._captureScreenshot(desktopTarget, {
      screenshotPage: options.screenshotPage,
      screenshotPath: desktopScreenshotPath,
      screenshotType,
      fullPage: options.fullPage,
      includeScreenshotBytes: false
    });

    const desktop = {
      jsonReportPath: options.includeJsonReports === false ? undefined : desktopJsonPath,
      htmlBundlePath: desktopBundlePath,
      screenshotPath: desktopScreenshot ? desktopScreenshotPath : undefined
    };

    let mobile;
    let mobileReport;
    if (options.mobileTarget) {
      mobileReport = await this.buildReport(options.mobileTarget, 'json', { scope });
      const mobileBundlePath = path.join(dir, 'mobile.html');
      const mobileJsonPath = path.join(dir, 'mobile.json');
      const mobileScreenshotPath = path.join(dir, `mobile.${screenshotExt}`);

      await this.buildAuditBundleToFile(options.mobileTarget, {
        filePath: mobileBundlePath,
        scope
      });

      if (options.includeJsonReports !== false) {
        await writeFile(mobileJsonPath, `${JSON.stringify(mobileReport, null, 2)}\n`, 'utf8');
      }

      const mobileScreenshot = await this._captureScreenshot(options.mobileTarget, {
        screenshotPage: options.mobileScreenshotPage,
        screenshotPath: mobileScreenshotPath,
        screenshotType,
        fullPage: options.mobileFullPage,
        includeScreenshotBytes: false
      });

      mobile = {
        jsonReportPath: options.includeJsonReports === false ? undefined : mobileJsonPath,
        htmlBundlePath: mobileBundlePath,
        screenshotPath: mobileScreenshot ? mobileScreenshotPath : undefined
      };
    }

    let contractPath;
    const contract = options.includeContract === false ? undefined : await this.getContract(desktopTarget);
    if (contract) {
      contractPath = path.join(dir, 'contract.json');
      await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
    }

    const artifactIndexPath = path.join(dir, 'artifact-index.json');
    const reportMarkdownPath = path.join(dir, 'report.md');

    const artifactIndex = {
      generatedAt: new Date().toISOString(),
      scope,
      desktop: {
        htmlBundle: path.basename(desktop.htmlBundlePath),
        ...(desktop.jsonReportPath ? { reportJson: path.basename(desktop.jsonReportPath) } : {}),
        ...(desktop.screenshotPath ? { screenshot: path.basename(desktop.screenshotPath) } : {})
      },
      ...(mobile ? {
        mobile: {
          htmlBundle: path.basename(mobile.htmlBundlePath),
          ...(mobile.jsonReportPath ? { reportJson: path.basename(mobile.jsonReportPath) } : {}),
          ...(mobile.screenshotPath ? { screenshot: path.basename(mobile.screenshotPath) } : {})
        }
      } : {}),
      ...(contractPath ? { contract: path.basename(contractPath) } : {})
    };
    await writeFile(artifactIndexPath, `${JSON.stringify(artifactIndex, null, 2)}\n`, 'utf8');

    const reportMarkdown = await this._renderAuditMarkdown({
      templatePath: options.reportTemplatePath,
      reportContext: options.reportContext || {},
      artifactIndexPath,
      desktopReport,
      desktop,
      mobileReport,
      mobile
    });
    await writeFile(reportMarkdownPath, reportMarkdown, 'utf8');

    return {
      dir,
      artifactIndexPath,
      reportMarkdownPath,
      ...(contractPath ? { contractPath } : {}),
      desktop,
      ...(mobile ? { mobile } : {})
    };
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

  _resolveOutputPath(options, defaults) {
    if (options.filePath) return options.filePath;
    if (!options.dir) {
      throw new Error('Expected either options.filePath or options.dir.');
    }
    const fileName = options.fileName || `${defaults.defaultBaseName}${defaults.extension}`;
    return path.join(options.dir, fileName);
  }

  async _renderAuditMarkdown({
    templatePath,
    reportContext,
    artifactIndexPath,
    desktopReport,
    desktop,
    mobileReport,
    mobile
  }) {
    const template = await this._loadReportTemplate(templatePath);
    const desktopSummary = desktopReport?.summary || {};
    const mobileSummary = mobileReport?.summary || {};
    const actions = Array.isArray(desktopReport?.actions) ? desktopReport.actions : [];
    const topFindings = (desktopReport?.findings || []).slice(0, 3);
    const groupedActions = {
      fixNow: actions.filter((action) => action.bucket === 'fix-now'),
      fixNext: actions.filter((action) => action.bucket === 'fix-next'),
      review: actions.filter((action) => action.bucket === 'review')
    };

    const values = {
      target_name: reportContext.target_name || desktopReport?.document?.title || 'Untitled target',
      primary_url: reportContext.primary_url || desktopReport?.document?.url || '',
      audit_date: reportContext.audit_date || new Date().toISOString(),
      audit_mode: reportContext.audit_mode || (mobileReport ? 'desktop-and-mobile' : 'desktop-only'),
      overall_summary: reportContext.overall_summary || this._defaultOverallSummary(desktopReport, mobileReport),
      top_finding_1: topFindings[0] ? this._formatFindingSummary(topFindings[0]) : 'No major finding recorded.',
      top_finding_2: topFindings[1] ? this._formatFindingSummary(topFindings[1]) : 'No second high-priority finding recorded.',
      top_finding_3: topFindings[2] ? this._formatFindingSummary(topFindings[2]) : 'No third high-priority finding recorded.',
      fix_order_1: groupedActions.fixNow[0] ? this._formatAction(groupedActions.fixNow[0]) : 'No fix-now item recorded.',
      fix_order_2: groupedActions.fixNext[0] ? this._formatAction(groupedActions.fixNext[0]) : 'No fix-next item recorded.',
      fix_order_3: groupedActions.review[0] ? this._formatAction(groupedActions.review[0]) : 'No review bucket item recorded.',
      audited_surfaces: reportContext.audited_surfaces || this._defaultAuditedSurfaces(desktopReport, mobileReport),
      excluded_surfaces: reportContext.excluded_surfaces || 'Not explicitly excluded in this run.',
      desktop_viewport: this._formatViewport(desktopReport),
      mobile_viewport: mobileReport ? this._formatViewport(mobileReport) : 'No mobile pass captured.',
      auth_state: reportContext.auth_state || 'Not specified.',
      sample_strategy: reportContext.sample_strategy || 'Flow-based sampled audit of the tested surfaces.',
      overlay_version: desktopReport?.overlayVersion || 'Unknown',
      report_schema_version: desktopReport?.schemaVersion != null ? String(desktopReport.schemaVersion) : 'Unknown',
      presets_used: this._formatPresets(desktopReport, mobileReport),
      layer_mode: desktopReport?.audit?.layerMode || 'Unknown',
      touch_profile: this._formatTouchProfiles(desktopReport, mobileReport),
      browser_and_os: reportContext.browser_and_os || 'Not recorded by the client helper.',
      manual_interactions: reportContext.manual_interactions || 'Not specified.',
      artifact_set: this._formatArtifactSetList(desktop, mobile, artifactIndexPath),
      method_notes: reportContext.method_notes || 'Generated from overlay runtime report data and Playwright screenshots.',
      total_findings: String((desktopSummary.total || 0) + (mobileSummary.total || 0)),
      error_count: String((desktopSummary.severity?.error || 0) + (mobileSummary.severity?.error || 0)),
      warning_count: String((desktopSummary.severity?.warning || 0) + (mobileSummary.severity?.warning || 0)),
      pass_or_info_counts: this._formatPassInfoCounts(desktopSummary, mobileSummary),
      slice_summary: this._formatCountMap(this._mergeCountMaps(desktopSummary.slices, mobileSummary.slices)),
      finding_type_summary: this._formatCountMap(this._mergeCountMaps(desktopSummary.findingType, mobileSummary.findingType)),
      fix_now_items: this._formatActionList(groupedActions.fixNow),
      fix_next_items: this._formatActionList(groupedActions.fixNext),
      review_items: this._formatActionList(groupedActions.review),
      finding_title_1: topFindings[0]?.label || topFindings[0]?.kind || 'No recorded finding',
      finding_severity_1: topFindings[0]?.meta?.severity || 'n/a',
      finding_type_1: topFindings[0]?.meta?.findingType || 'n/a',
      finding_route_1: desktopReport?.document?.url || '',
      finding_target_1: topFindings[0] ? this._formatFindingTarget(topFindings[0]) : 'n/a',
      finding_why_1: topFindings[0]?.meta?.whyFlagged || topFindings[0]?.meta?.summary || 'n/a',
      finding_evidence_1: topFindings[0] ? this._formatFindingEvidence(topFindings[0]) : 'n/a',
      finding_sources_1: topFindings[0] ? this._formatFindingSources(topFindings[0]) : 'n/a',
      finding_fix_1: topFindings[0]?.meta?.suggestedFix || 'n/a',
      finding_title_2: topFindings[1]?.label || topFindings[1]?.kind || 'No recorded finding',
      finding_severity_2: topFindings[1]?.meta?.severity || 'n/a',
      finding_type_2: topFindings[1]?.meta?.findingType || 'n/a',
      finding_route_2: desktopReport?.document?.url || '',
      finding_target_2: topFindings[1] ? this._formatFindingTarget(topFindings[1]) : 'n/a',
      finding_why_2: topFindings[1]?.meta?.whyFlagged || topFindings[1]?.meta?.summary || 'n/a',
      finding_evidence_2: topFindings[1] ? this._formatFindingEvidence(topFindings[1]) : 'n/a',
      finding_sources_2: topFindings[1] ? this._formatFindingSources(topFindings[1]) : 'n/a',
      finding_fix_2: topFindings[1]?.meta?.suggestedFix || 'n/a',
      additional_findings: this._formatAdditionalFindings((desktopReport?.findings || []).slice(2)),
      artifact_index: path.basename(artifactIndexPath),
      desktop_html_bundle: path.basename(desktop.htmlBundlePath),
      mobile_html_bundle: mobile ? path.basename(mobile.htmlBundlePath) : 'No mobile HTML bundle.',
      desktop_screenshot: desktop.screenshotPath ? path.basename(desktop.screenshotPath) : 'No desktop screenshot.',
      mobile_screenshot: mobile?.screenshotPath ? path.basename(mobile.screenshotPath) : 'No mobile screenshot.',
      json_report: this._formatJsonReportArtifacts(desktop, mobile),
      annotation_artifacts: this._formatAnnotationArtifacts(desktopReport, mobileReport),
      limitation_1: reportContext.limitation_1 || 'This report reflects the tested routes and states only.',
      limitation_2: reportContext.limitation_2 || 'Automated and heuristic findings do not by themselves prove formal conformance.',
      limitation_3: reportContext.limitation_3 || 'Assistive technology validation may still require manual follow-up.',
      confidence_notes: reportContext.confidence_notes || 'Confidence is highest for standards-backed findings with explicit evidence and lower for heuristic findings requiring contextual review.'
    };

    return `${this._fillTemplate(template, values).trim()}\n`;
  }

  async _loadReportTemplate(templatePath) {
    if (templatePath) {
      return readFile(templatePath, 'utf8');
    }
    for (const candidate of DEFAULT_REPORT_TEMPLATE_CANDIDATES) {
      try {
        return await readFile(candidate, 'utf8');
      } catch {}
    }
    return DEFAULT_REPORT_TEMPLATE;
  }

  _fillTemplate(template, values) {
    return Object.entries(values).reduce(
      (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value ?? '')),
      template
    );
  }

  _defaultOverallSummary(desktopReport, mobileReport) {
    const desktopTotal = desktopReport?.summary?.total || 0;
    const mobileTotal = mobileReport?.summary?.total || 0;
    if (mobileReport) {
      return `Desktop run returned ${desktopTotal} findings and mobile run returned ${mobileTotal} findings in the sampled surfaces.`;
    }
    return `Desktop run returned ${desktopTotal} findings in the sampled surfaces.`;
  }

  _defaultAuditedSurfaces(desktopReport, mobileReport) {
    const surfaces = [];
    if (desktopReport?.document?.url) surfaces.push(`Desktop: ${desktopReport.document.url}`);
    if (mobileReport?.document?.url) surfaces.push(`Mobile: ${mobileReport.document.url}`);
    return surfaces.join(' | ') || 'Not specified.';
  }

  _formatViewport(report) {
    const viewport = report?.document?.viewport;
    if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
      return 'Unknown viewport';
    }
    return `${viewport.width}x${viewport.height}`;
  }

  _formatPresets(desktopReport, mobileReport) {
    const labels = new Set();
    if (desktopReport?.audit?.presetLabel) labels.add(desktopReport.audit.presetLabel);
    if (mobileReport?.audit?.presetLabel) labels.add(mobileReport.audit.presetLabel);
    return Array.from(labels).join(', ') || 'Custom';
  }

  _formatTouchProfiles(desktopReport, mobileReport) {
    const profiles = new Set();
    if (desktopReport?.audit?.touchProfile) profiles.add(desktopReport.audit.touchProfile);
    if (mobileReport?.audit?.touchProfile) profiles.add(mobileReport.audit.touchProfile);
    return Array.from(profiles).join(', ') || 'Unknown';
  }

  _formatArtifactSetList(desktop, mobile, artifactIndexPath) {
    const items = [path.basename(artifactIndexPath), path.basename(desktop.htmlBundlePath)];
    if (desktop.screenshotPath) items.push(path.basename(desktop.screenshotPath));
    if (desktop.jsonReportPath) items.push(path.basename(desktop.jsonReportPath));
    if (mobile) {
      items.push(path.basename(mobile.htmlBundlePath));
      if (mobile.screenshotPath) items.push(path.basename(mobile.screenshotPath));
      if (mobile.jsonReportPath) items.push(path.basename(mobile.jsonReportPath));
    }
    return items.join(', ');
  }

  _formatPassInfoCounts(desktopSummary, mobileSummary) {
    const pass = (desktopSummary.severity?.pass || 0) + (mobileSummary.severity?.pass || 0);
    const unspecified = (desktopSummary.severity?.unspecified || 0) + (mobileSummary.severity?.unspecified || 0);
    return `Pass: ${pass}; Unspecified: ${unspecified}`;
  }

  _mergeCountMaps(first = {}, second = {}) {
    const merged = { ...first };
    for (const [key, value] of Object.entries(second || {})) {
      merged[key] = (merged[key] || 0) + value;
    }
    return merged;
  }

  _formatCountMap(countMap) {
    const entries = Object.entries(countMap || {});
    if (!entries.length) return 'No counts recorded.';
    return entries.map(([key, count]) => `${key}: ${count}`).join('; ');
  }

  _formatAction(action) {
    return action ? `${action.title} (${action.count})` : 'No action recorded.';
  }

  _formatActionList(actions) {
    if (!actions || !actions.length) return 'No items recorded.';
    return actions.map((action) => `${action.title} (${action.count})`).join('; ');
  }

  _formatFindingSummary(finding) {
    const severity = finding?.meta?.severity ? `[${finding.meta.severity}] ` : '';
    return `${severity}${finding?.label || finding?.kind || 'Unnamed finding'}`;
  }

  _formatFindingTarget(finding) {
    const rows = Array.isArray(finding?.inspectorRows) ? finding.inspectorRows : [];
    const targetRow = rows.find((row) => row.key === 'Path' || row.key === 'Tag' || row.key === 'Role');
    return targetRow ? String(targetRow.value) : String(finding?.label || finding?.kind || 'Unknown target');
  }

  _formatFindingEvidence(finding) {
    const rows = Array.isArray(finding?.inspectorRows) ? finding.inspectorRows : [];
    const evidenceRow = rows.find((row) => row.key === 'Evidence');
    return evidenceRow ? String(evidenceRow.value) : 'No evidence row recorded.';
  }

  _formatFindingSources(finding) {
    const rows = Array.isArray(finding?.inspectorRows) ? finding.inspectorRows : [];
    const sourceRow = rows.find((row) => row.key === 'Source');
    return sourceRow ? String(sourceRow.value) : 'No explicit source links recorded.';
  }

  _formatAdditionalFindings(findings) {
    if (!findings || !findings.length) return 'No additional findings summarized.';
    return findings
      .slice(0, 10)
      .map((finding, index) => `${index + 3}. ${this._formatFindingSummary(finding)}`)
      .join('\n');
  }

  _formatJsonReportArtifacts(desktop, mobile) {
    const items = [];
    if (desktop.jsonReportPath) items.push(path.basename(desktop.jsonReportPath));
    if (mobile?.jsonReportPath) items.push(path.basename(mobile.jsonReportPath));
    return items.join(', ') || 'No JSON reports written.';
  }

  _formatAnnotationArtifacts(desktopReport, mobileReport) {
    const desktopNotes = desktopReport?.annotations?.notes?.length || 0;
    const desktopArrows = desktopReport?.annotations?.arrows?.length || 0;
    const mobileNotes = mobileReport?.annotations?.notes?.length || 0;
    const mobileArrows = mobileReport?.annotations?.arrows?.length || 0;
    return `Desktop notes: ${desktopNotes}, desktop arrows: ${desktopArrows}, mobile notes: ${mobileNotes}, mobile arrows: ${mobileArrows}`;
  }
}

export function createOverlayClient(options) {
  return new OverlayClient(options);
}

export { DEFAULT_SCRIPT_PATH, DEFAULT_GLOBAL_NAME, DEFAULT_TIMEOUT_MS };
