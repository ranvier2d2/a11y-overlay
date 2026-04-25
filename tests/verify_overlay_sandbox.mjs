import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SANDBOX_ROOT = path.join(os.homedir(), '.codex', 'overlay-playwright-runtime', 'sandbox');
const LAUNCH_SESSION_PATH = path.join(SANDBOX_ROOT, 'launch-session.mjs');
const RUNTIME_SCRIPT_PATH = path.resolve('./a11y-overlay.js');

async function ensureSandboxExists() {
  try {
    await access(LAUNCH_SESSION_PATH);
  } catch {
    throw new Error(
      `overlay sandbox not found at ${LAUNCH_SESSION_PATH}. Run bootstrap_operate_sandbox.py first.`
    );
  }
}

/**
 * Runs an end-to-end verification of the overlay sandbox runtime.
 *
 * Starts a temporary HTTP fixture server, launches an overlay sandbox session, performs UI and accessibility
 * verifications (including overlay initialization, annotations, session snapshots, scroll-sliced visual captures,
 * local and authenticated web audits, and a desktop-shell audit), validates generated artifacts, and then
 * tears down the session, server, and temporary output directory.
 */
async function main() {
  await ensureSandboxExists();

  const { createOverlaySandboxSession } = await import(pathToFileURL(LAUNCH_SESSION_PATH).href);
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'overlay-sandbox-'));
  let session;
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');
    const cookieHeader = req.headers.cookie || '';
    const isAuthed = cookieHeader.includes('auth=ok');

    if (requestUrl.pathname === '/login' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`
        <!doctype html>
        <html>
          <head><title>Login Fixture</title></head>
          <body>
            <main style="min-height: 1800px;">
              <h1>Sign in</h1>
              <form method="POST" action="/login">
                <label>Email <input name="email" type="email" /></label>
                <label>Password <input name="password" type="password" /></label>
                <button type="submit">Sign in</button>
              </form>
              <div data-test="login-form-ready">Ready</div>
            </main>
          </body>
        </html>
      `);
      return;
    }

    if (requestUrl.pathname === '/login' && req.method === 'POST') {
      req.resume();
      req.on('end', () => {
        res.writeHead(302, {
          location: '/app',
          'set-cookie': 'auth=ok; Path=/; HttpOnly'
        });
        res.end();
      });
      return;
    }

    if (requestUrl.pathname === '/app') {
      if (!isAuthed) {
        res.writeHead(302, { location: '/login' });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`
        <!doctype html>
        <html>
          <head><title>Sandbox Fixture</title></head>
          <body>
            <main style="min-height: 2600px;">
              <h1 data-test="app-ready">Sandbox fixture</h1>
              <button type="button">Checkout</button>
              <div data-test="account-chip">Signed in</div>
              <section style="margin-top: 1800px;">
                <h2>Lower content</h2>
                <button type="button">Continue</button>
              </section>
            </main>
          </body>
        </html>
      `);
      return;
    }

    if (requestUrl.pathname.startsWith('/routes')) {
      if (!isAuthed) {
        res.writeHead(302, { location: '/login' });
        res.end();
        return;
      }
      const currentPath = requestUrl.pathname;
      const currentLabel = currentPath === '/routes'
        ? 'Queue'
        : currentPath === '/routes/manifests'
          ? 'Manifests'
          : 'Users';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`
        <!doctype html>
        <html>
          <head><title>Sandbox Route Fixture</title></head>
          <body>
            <header>
              <nav data-test="top-nav">
                <a style="display:inline-block;padding:8px 14px" href="/routes" ${currentPath === '/routes' ? 'aria-current="page"' : ''}>Queue</a>
                <a style="display:inline-block;padding:8px 14px" href="/routes/manifests" ${currentPath === '/routes/manifests' ? 'aria-current="page"' : ''}>Manifests</a>
                <a style="display:inline-block;padding:8px 14px" href="/routes/users" ${currentPath === '/routes/users' ? 'aria-current="page"' : ''}>Users</a>
              </nav>
            </header>
            <main>
              <h1 data-test="top-nav-ready">${currentLabel}</h1>
              <button type="button">Primary action</button>
              <section>
                <a href="/routes/jobs/1">Open Job</a>
                <a href="/routes/orders/1">Review</a>
              </section>
            </main>
          </body>
        </html>
      `);
      return;
    }

    if (requestUrl.pathname === '/public-routes') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`
        <!doctype html>
        <html>
          <head>
            <title>Sandbox Public Route Fixture</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: sans-serif; margin: 0; }
              header { padding: 16px; border-bottom: 1px solid #ddd; }
              [role="tablist"] { display: flex; gap: 8px; }
              [data-test="mobile-route-picker"] { display: none; }
              [role="tab"] { padding: 8px 14px; border: 1px solid #ccc; background: white; }
              [role="tab"][aria-selected="true"] { border-color: #333; }
              [role="combobox"] { width: 100%; padding: 8px 14px; text-align: left; }
              [role="listbox"] { border: 1px solid #ccc; background: white; }
              [role="option"] { padding: 8px 14px; }
              main { min-height: 1800px; padding: 16px; }
              @media (max-width: 639px) {
                [data-test="desktop-tabs"] { display: none; }
                [data-test="mobile-route-picker"] { display: block; }
              }
            </style>
          </head>
          <body>
            <header>
              <div data-test="desktop-tabs" role="tablist" aria-label="Public routes">
                <button type="button" role="tab" aria-selected="true">Overview</button>
                <button type="button" role="tab" aria-selected="false">Projects</button>
                <button type="button" role="tab" aria-selected="false">Docs</button>
              </div>
              <div data-test="mobile-route-picker">
                <button type="button" role="combobox" aria-expanded="false" aria-controls="public-route-options">Overview</button>
                <div id="public-route-options" role="listbox" hidden>
                  <button type="button" role="option" aria-selected="true">Overview</button>
                  <button type="button" role="option" aria-selected="false">Projects</button>
                  <button type="button" role="option" aria-selected="false">Docs</button>
                </div>
              </div>
            </header>
            <main>
              <h1>Sandbox public fixture</h1>
              <h2 data-test="public-route-ready">Overview</h2>
              <button type="button" data-test="compact-route-action">Open route</button>
              <section style="margin-top: 1200px;">
                <h3>Lower content</h3>
                <button type="button">Continue</button>
              </section>
            </main>
            <script>
              (() => {
                const routes = {
                  Overview: { title: 'Overview', action: 'Open route', body: 'Overview body' },
                  Projects: { title: 'Projects', action: 'Open projects', body: 'Projects body' },
                  Docs: { title: 'Docs', action: 'Open docs', body: 'Docs body' }
                };
                const heading = document.querySelector('[data-test="public-route-ready"]');
                const action = document.querySelector('[data-test="compact-route-action"]');
                const tabButtons = Array.from(document.querySelectorAll('[role="tab"]'));
                const combo = document.querySelector('[role="combobox"]');
                const listbox = document.querySelector('[role="listbox"]');
                const optionButtons = Array.from(document.querySelectorAll('[role="option"]'));

                const render = (label) => {
                  const route = routes[label];
                  heading.textContent = route.title;
                  action.textContent = route.action;
                  action.setAttribute('aria-label', route.action);
                  tabButtons.forEach((button) => {
                    button.setAttribute('aria-selected', button.textContent.trim() === label ? 'true' : 'false');
                  });
                  optionButtons.forEach((button) => {
                    button.setAttribute('aria-selected', button.textContent.trim() === label ? 'true' : 'false');
                  });
                  combo.textContent = label;
                  combo.setAttribute('aria-expanded', 'false');
                  listbox.hidden = true;
                };

                tabButtons.forEach((button) => {
                  button.addEventListener('click', () => render(button.textContent.trim()));
                });

                combo.addEventListener('click', () => {
                  const expanded = combo.getAttribute('aria-expanded') === 'true';
                  combo.setAttribute('aria-expanded', expanded ? 'false' : 'true');
                  listbox.hidden = expanded;
                });

                optionButtons.forEach((button) => {
                  button.addEventListener('click', () => render(button.textContent.trim()));
                });

                render('Overview');
              })();
            </script>
          </body>
        </html>
      `);
      return;
    }

    if (requestUrl.pathname === '/placement-reflow') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`
        <!doctype html>
        <html>
          <head>
            <title>Placement Reflow Fixture</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: sans-serif; margin: 0; }
              main { padding: 20px; min-height: 1200px; }
              .control-band {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 120px;
              }
              .control-band button {
                height: 28px;
                padding: 0 14px;
                border: 1px solid #bbb;
                background: white;
              }
              .detail-card {
                margin-top: 36px;
                width: 460px;
                min-height: 240px;
                border: 1px solid #ddd;
                background: #fafafa;
              }
            </style>
          </head>
          <body>
            <main>
              <h1>Placement reflow fixture</h1>
              <div class="control-band" data-test="control-band">
                <button type="button" data-test="placement-anchor">Status</button>
                <button type="button" data-test="placement-peer-1">Agent Docs</button>
                <button type="button" data-test="placement-peer-2">AI Chat</button>
                <button type="button" data-test="placement-peer-3">Synergy</button>
              </div>
              <section class="detail-card">
                <h2>Route body</h2>
                <p>Enough free space exists below the crowded control band for a relocated note.</p>
              </section>
            </main>
          </body>
        </html>
      `);
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`
      <!doctype html>
      <html>
        <head><title>Sandbox Fixture</title></head>
        <body>
          <main style="min-height: 2600px;">
            <h1>Sandbox fixture</h1>
            <button type="button">Checkout</button>
            <section style="margin-top: 1800px;">
              <h2>Lower content</h2>
              <button type="button">Continue</button>
            </section>
          </main>
        </body>
      </html>
    `);
  });

  try {
    session = await createOverlaySandboxSession({ headless: true, outputDir });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const url = `${baseUrl}/`;
    const appUrl = `${baseUrl}/app`;
    const loginUrl = `${baseUrl}/login`;

    const page = await session.ensureDesktopPage({ url });
    await session.waitForReady(page, {
      strategy: 'route-match',
      pattern: '127.0.0.1'
    });

    const contract = await session.ensureOverlay(page, {
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      preset: 'agent-capture',
      announce: false
    });
    assert.equal(contract.contractVersion, 2);

    const uiState = await session.liveClient.getUiState(page);
    assert.equal(uiState.uiMode, 'agent');
    assert.equal(uiState.toolbarOpen, false);
    assert.equal(uiState.helpOpen, false);
    assert.equal(uiState.mobileSheetOpen, false);

    const report = await session.buildJsonReport(page, { scope: 'all' });
    assert.equal(report.document.title, 'Sandbox Fixture');

    const note = await session.annotateNote(page, {
      x: 120,
      y: 120,
      text: 'Smoke note'
    });
    assert.equal(note.text, 'Smoke note');

    const snapshot = await session.saveSession(page);
    assert.ok(snapshot.annotations?.notes?.length >= 1);

    await session.liveClient.configureUi(page, {
      toolbarOpen: true,
      helpOpen: true,
      settingsOpen: true
    });

    const visualEvidence = await session.captureVisualEvidence(page, {
      type: 'jpeg',
      captureMode: 'scroll-slices',
      scrollSettlingMs: 0
    });
    assert.equal(visualEvidence.mode, 'scroll-slices');
    assert.ok(visualEvidence.captures.length > 1);
    assert.match(path.basename(visualEvidence.captures[1].path), /^overlay-shot-\d+-02\.jpg$/);
    const restoredUiState = await session.liveClient.getUiState(page);
    assert.equal(restoredUiState.captureUiHidden, false);
    assert.equal(restoredUiState.toolbarOpen, true);
    assert.equal(restoredUiState.helpOpen, true);
    assert.equal(restoredUiState.settingsOpen, true);

    const nestedFullPageEvidence = await session.captureVisualEvidence(page, {
      path: path.join(outputDir, 'nested', 'shots', 'fullpage.jpg'),
      type: 'jpeg',
      fullPage: true
    });
    assert.equal(nestedFullPageEvidence.mode, 'full-page');
    assert.equal(nestedFullPageEvidence.captures.length, 1);
    assert.equal(path.basename(nestedFullPageEvidence.primaryPath), 'fullpage.jpg');
    await access(nestedFullPageEvidence.primaryPath);

    const audit = await session.auditLocalWeb({
      url,
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      readiness: {
        strategy: 'selector-visible',
        selector: 'button'
      },
      reportContext: {
        target_name: 'Sandbox Fixture',
        audit_mode: 'audit-local-web'
      }
    });

    assert.ok(audit.artifacts.reportMarkdownPath);
    assert.ok(audit.artifacts.reportHtmlPath);
    assert.equal(path.basename(audit.artifacts.desktop.htmlBundlePath), 'desktop.html');
    assert.equal(path.basename(audit.artifacts.desktop.jsonReportPath), 'desktop.json');
    assert.equal(path.basename(audit.artifacts.desktop.screenshotPath), 'desktop.jpg');
    assert.ok(audit.artifacts.desktop.screenshotPaths.length > 1);
    assert.equal(path.basename(audit.artifacts.desktop.screenshotPaths[1]), 'desktop-02.jpg');
    assert.equal(path.basename(audit.artifacts.mobile.htmlBundlePath), 'mobile.html');
    assert.equal(path.basename(audit.artifacts.mobile.jsonReportPath), 'mobile.json');
    assert.equal(path.basename(audit.artifacts.mobile.screenshotPath), 'mobile.jpg');
    assert.ok(audit.artifacts.mobile.screenshotPaths.length > 1);
    assert.equal(path.basename(audit.artifacts.mobile.screenshotPaths[1]), 'mobile-02.jpg');

    const reportMarkdown = await readFile(audit.artifacts.reportMarkdownPath, 'utf8');
    const reportHtml = await readFile(audit.artifacts.reportHtmlPath, 'utf8');
    assert.match(reportMarkdown, /# Accessibility Audit Report/);
    assert.match(reportMarkdown, /\*\*Target:\*\* Sandbox Fixture/);
    assert.match(reportMarkdown, /### Counts by tested surface/);
    assert.match(reportMarkdown, /desktop-02\.jpg/);
    assert.match(reportMarkdown, /mobile-02\.jpg/);
    assert.match(reportHtml, /Sandbox Fixture/);
    assert.match(reportHtml, /Narrative HTML report/);

    const authedAudit = await session.auditAuthenticatedWeb({
      url: appUrl,
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      auth: {
        mode: 'form-fill',
        url: loginUrl,
        fields: [
          { label: 'Email', value: 'person@example.com' },
          { label: 'Password', value: 'secret' }
        ],
        submit: {
          role: 'button',
          name: 'Sign in'
        }
      },
      authValidation: {
        postAuthUrl: '/app',
        readySelector: '[data-test="account-chip"]',
        forbiddenSelector: '[data-test="login-error"]'
      },
      readiness: {
        strategy: 'selector-visible',
        selector: '[data-test="app-ready"]'
      },
      reportContext: {
        target_name: 'Sandbox Auth Fixture'
      }
    });

    assert.equal(path.basename(authedAudit.auth.authStatePath), 'auth-state.json');
    const authStateJson = JSON.parse(await readFile(authedAudit.auth.authStatePath, 'utf8'));
    assert.ok(Array.isArray(authStateJson.cookies));
    assert.ok(authStateJson.cookies.some((cookie) => cookie.name === 'auth'));

    const authReportMarkdown = await readFile(authedAudit.artifacts.reportMarkdownPath, 'utf8');
    assert.match(authReportMarkdown, /\*\*Target:\*\* Sandbox Auth Fixture/);
    assert.match(authReportMarkdown, /\*\*Audit mode:\*\* audit-authenticated-web/);
    assert.ok(authedAudit.artifacts.reportHtmlPath);

    const desktopShellAudit = await session.auditDesktopShell({
      desktopPage: authedAudit.desktopPage,
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      readiness: {
        strategy: 'selector-visible',
        selector: '[data-test="app-ready"]'
      },
      reportContext: {
        target_name: 'Sandbox Shell Fixture'
      }
    });

    const desktopShellReportMarkdown = await readFile(desktopShellAudit.artifacts.reportMarkdownPath, 'utf8');
    assert.match(desktopShellReportMarkdown, /\*\*Target:\*\* Sandbox Shell Fixture/);
    assert.match(desktopShellReportMarkdown, /\*\*Audit mode:\*\* audit-desktop-shell/);
    assert.ok(desktopShellAudit.artifacts.reportHtmlPath);

    await authedAudit.desktopPage.goto(`${baseUrl}/routes`, { waitUntil: 'domcontentloaded' });
    const topNavAudit = await session.auditDesktopTopNavRoutes({
      desktopPage: authedAudit.desktopPage,
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      readiness: {
        strategy: 'selector-visible',
        selector: '[data-test="top-nav-ready"]'
      },
      routeReadiness: {
        strategy: 'selector-visible',
        selector: '[data-test="top-nav-ready"]'
      },
      artifactDir: path.join(outputDir, 'top-nav-routes'),
      desktop: {
        captureMode: 'viewport',
        screenshotType: 'jpeg',
        screenshotTimeoutMs: 4321
      },
      routeWalker: {
        navScopeSelectors: ['[data-test="top-nav"]'],
        routeSettlingMs: 0
      },
      reportContext: {
        target_name: 'Sandbox Route Fixture'
      }
    });

    assert.equal(topNavAudit.routes.length, 3);
    assert.deepEqual(topNavAudit.routes.map((route) => route.text), ['Queue', 'Manifests', 'Users']);
    assert.ok(topNavAudit.results.every((result) => !result.error));
    assert.ok(topNavAudit.results.every((result) => result.artifacts?.desktop?.screenshotPath));
    assert.ok(topNavAudit.results.every((result) => result.artifacts.desktop.screenshotPath.endsWith('.jpg')));
    const topNavReportMarkdown = await readFile(topNavAudit.results[0].artifacts.reportMarkdownPath, 'utf8');
    assert.match(topNavReportMarkdown, /\*\*Audit mode:\*\* audit-desktop-top-nav-routes/);

    const responsiveRouteAudit = await session.auditResponsiveRouteSet({
      url: `${baseUrl}/public-routes`,
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      desktopReadiness: {
        strategy: 'selector-visible',
        selector: '[role="tablist"]'
      },
      mobileReadiness: {
        strategy: 'selector-visible',
        selector: '[role="combobox"]'
      },
      artifactDir: path.join(outputDir, 'responsive-routes'),
      desktop: {
        captureMode: 'viewport',
        screenshotType: 'jpeg',
        screenshotTimeoutMs: 5432
      },
      mobile: {
        captureMode: 'viewport',
        screenshotType: 'jpeg',
        screenshotTimeoutMs: 6543
      },
      desktopNavigator: {
        kind: 'tabs',
        scopeSelectors: ['[data-test="desktop-tabs"]']
      },
      mobileNavigator: {
        kind: 'combobox-options'
      },
      reportContext: {
        target_name: 'Sandbox Responsive Route Fixture'
      }
    });

    assert.deepEqual(responsiveRouteAudit.routes.map((route) => route.text), ['Overview', 'Projects', 'Docs']);
    assert.ok(responsiveRouteAudit.results.every((result) => !result.error));
    assert.ok(responsiveRouteAudit.results.every((result) => result.artifacts?.desktop?.screenshotPath));
    assert.ok(responsiveRouteAudit.results.every((result) => result.artifacts?.mobile?.screenshotPath));
    assert.ok(responsiveRouteAudit.results.every((result) => result.artifacts.desktop.screenshotPath.endsWith('.jpg')));
    assert.ok(responsiveRouteAudit.results.every((result) => result.artifacts.mobile.screenshotPath.endsWith('.jpg')));
    const responsiveRouteReportMarkdown = await readFile(responsiveRouteAudit.results[0].artifacts.reportMarkdownPath, 'utf8');
    assert.match(responsiveRouteReportMarkdown, /\*\*Audit mode:\*\* audit-responsive-route-set/);
    assert.match(responsiveRouteReportMarkdown, /placement-review\.json/);
    const responsiveRouteArtifactIndex = JSON.parse(await readFile(responsiveRouteAudit.results[0].artifacts.artifactIndexPath, 'utf8'));
    assert.equal(responsiveRouteArtifactIndex.placementReview, 'placement-review.json');

    const placementPage = await session.ensureDesktopPage({ url: `${baseUrl}/placement-reflow` });
    await session.ensureOverlay(placementPage, {
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      preset: 'agent-capture',
      announce: false
    });
    const placementAnchor = await placementPage.locator('[data-test="placement-anchor"]').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom)
      };
    });

    const placementText = 'Status stays compact in this crowded control band and should reflow away from sibling controls.';
    const baselinePlacement = await session.planViewportSafeNotePlacement(placementPage, {
      anchor: placementAnchor,
      text: placementText,
      label: 'Status',
      prefer: ['right', 'below', 'left', 'above'],
      reviewPlacement: false,
      approvalMode: 'auto'
    });
    assert.equal(baselinePlacement.accepted.side, 'right');
    assert.equal(baselinePlacement.accepted.review.reviewed, false);
    assert.equal(baselinePlacement.confidence, 'medium');
    assert.equal(baselinePlacement.approval.requiresPreview, true);
    assert.equal(baselinePlacement.approval.rationale, 'trust-but-verify');

    const reviewedPlacement = await session.planViewportSafeNotePlacement(placementPage, {
      anchor: placementAnchor,
      text: placementText,
      label: 'Status',
      prefer: ['right', 'below', 'left', 'above'],
      reviewPlacement: true,
      approvalMode: 'auto'
    });
    assert.equal(reviewedPlacement.accepted.side, 'below');
    assert.equal(reviewedPlacement.accepted.review.reviewed, true);
    assert.equal(reviewedPlacement.accepted.review.retried, true);
    assert.deepEqual(reviewedPlacement.accepted.review.rejectedSides, ['right']);
    assert.deepEqual(reviewedPlacement.accepted.review.issues, []);
    assert.equal(reviewedPlacement.confidence, 'medium');
    assert.equal(reviewedPlacement.approval.requiresPreview, true);
    assert.equal(reviewedPlacement.approval.rationale, 'trust-but-verify');

    const snapshotBeforePreview = await session.getSessionSnapshot(placementPage);
    const preview = await session.previewPlannedAnnotation(placementPage, {
      plan: reviewedPlacement,
      filePath: path.join(outputDir, 'placement-preview.jpg'),
      type: 'jpeg'
    });
    assert.equal(preview.confidence, 'medium');
    assert.equal(preview.approval.requiresPreview, true);
    assert.equal(path.basename(preview.screenshotPath), 'placement-preview.jpg');
    assert.equal(path.basename(preview.previewImagePath), 'placement-preview-flat.jpg');
    assert.equal(path.basename(preview.htmlPath), 'placement-preview.html');
    assert.equal(path.basename(preview.jsonPath), 'placement-preview.json');
    const previewHtml = await readFile(preview.htmlPath, 'utf8');
    assert.match(previewHtml, /Confidence: medium/);
    assert.match(previewHtml, /Requires preview: yes/);
    const snapshotAfterPreview = await session.getSessionSnapshot(placementPage);
    assert.equal((snapshotAfterPreview.annotations.notes || []).length, (snapshotBeforePreview.annotations.notes || []).length);
    assert.equal((snapshotAfterPreview.annotations.arrows || []).length, (snapshotBeforePreview.annotations.arrows || []).length);

    const previousReviewQueuePath = process.env.CODEX_OVERLAY_REVIEW_QUEUE_PATH;
    process.env.CODEX_OVERLAY_REVIEW_QUEUE_PATH = path.join(outputDir, 'overlay-review-queue.jsonl');
    let review;
    try {
      review = await session.reviewPlannedAnnotation(placementPage, {
        plan: reviewedPlacement,
        filePath: path.join(outputDir, 'placement-review.jpg'),
        type: 'jpeg'
      });
    } finally {
      if (previousReviewQueuePath === undefined) {
        delete process.env.CODEX_OVERLAY_REVIEW_QUEUE_PATH;
      } else {
        process.env.CODEX_OVERLAY_REVIEW_QUEUE_PATH = previousReviewQueuePath;
      }
    }
    assert.equal(review.requiresVisualReview, true);
    assert.equal(review.shouldAutoAccept, false);
    assert.equal(review.suggestedNextAction, 'inspect-preview');
    assert.equal(review.inspectionTargetPath, review.previewArtifacts.previewImagePath);
    assert.equal(path.basename(review.previewArtifacts.screenshotPath), 'placement-review.jpg');
    assert.equal(path.basename(review.previewArtifacts.previewImagePath), 'placement-review-flat.jpg');
    assert.equal(path.basename(review.previewArtifacts.htmlPath), 'placement-review.html');
    assert.equal(path.basename(review.previewArtifacts.jsonPath), 'placement-review.json');
    assert.equal(path.basename(review.descriptorPath), 'placement-review-review.json');
    const reviewDescriptor = JSON.parse(await readFile(review.descriptorPath, 'utf8'));
    assert.equal(reviewDescriptor.requiresVisualReview, true);
    assert.equal(reviewDescriptor.suggestedNextAction, 'inspect-preview');
    assert.equal(path.basename(reviewDescriptor.inspectionTargetPath), 'placement-review-flat.jpg');

    await session.clearSavedSession(placementPage);
    const annotatedPlacement = await session.annotateNoteNearAnchor(placementPage, {
      anchor: placementAnchor,
      text: placementText,
      prefer: ['right', 'below', 'left', 'above'],
      reviewPlacement: true,
      approvalMode: 'auto'
    });
    assert.equal(annotatedPlacement.side, 'below');
    assert.equal(annotatedPlacement.review.retried, true);
    assert.equal(annotatedPlacement.plan.approval.requiresPreview, true);
    const placementSnapshot = await session.getSessionSnapshot(placementPage);
    const placedNote = placementSnapshot.annotations.notes.at(-1);
    assert.equal(placedNote.text, placementText);
    assert.ok(Math.abs(placedNote.x - annotatedPlacement.point.x) <= 16);
    assert.ok(Math.abs(placedNote.y - annotatedPlacement.point.y) <= 16);

    await authedAudit.desktopPage.goto(appUrl, { waitUntil: 'domcontentloaded' });

    const reusedAudit = await session.auditAuthenticatedWeb({
      url: appUrl,
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      auth: {
        mode: 'reuse-existing-session'
      },
      authValidation: {
        postAuthUrl: '/app',
        readySelector: '[data-test="account-chip"]'
      },
      readiness: {
        strategy: 'selector-visible',
        selector: '[data-test="app-ready"]'
      },
      reportContext: {
        target_name: 'Sandbox Reuse Fixture'
      }
    });

    const reuseReportMarkdown = await readFile(reusedAudit.artifacts.reportMarkdownPath, 'utf8');
    assert.match(reuseReportMarkdown, /\*\*Target:\*\* Sandbox Reuse Fixture/);
    assert.ok(reusedAudit.artifacts.reportHtmlPath);

    const manualAuth = await session.beginManualAuthSession({
      url: loginUrl,
      readiness: {
        strategy: 'selector-visible',
        selector: '[data-test="login-form-ready"]'
      }
    });
    await manualAuth.desktopPage.getByLabel('Email').fill('manual@example.com');
    await manualAuth.desktopPage.getByLabel('Password').fill('secret');
    await manualAuth.desktopPage.getByRole('button', { name: 'Sign in' }).click();
    await manualAuth.desktopPage.waitForSelector('[data-test="account-chip"]', { state: 'visible' });

    const resumedAudit = await session.resumeAuthenticatedAudit({
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      authValidation: {
        readySelector: '[data-test="account-chip"]'
      },
      readiness: {
        strategy: 'selector-visible',
        selector: '[data-test="app-ready"]'
      },
      reportContext: {
        target_name: 'Sandbox Manual Auth Fixture'
      }
    });

    const resumedReportMarkdown = await readFile(resumedAudit.artifacts.reportMarkdownPath, 'utf8');
    assert.match(resumedReportMarkdown, /\*\*Target:\*\* Sandbox Manual Auth Fixture/);
    assert.match(resumedReportMarkdown, /\*\*Auth or pairing state:\*\* manual-auth-session/);
    assert.ok(resumedAudit.artifacts.reportHtmlPath);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (session) {
      await session.close();
    }
    await rm(outputDir, { recursive: true, force: true });
  }

  console.log('overlay sandbox verification passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
