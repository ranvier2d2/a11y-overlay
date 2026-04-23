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
            <main>
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
            <main>
              <h1 data-test="app-ready">Sandbox fixture</h1>
              <button type="button">Checkout</button>
              <div data-test="account-chip">Signed in</div>
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
          <main>
            <h1>Sandbox fixture</h1>
            <button type="button">Checkout</button>
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
    assert.equal(contract.contractVersion, 1);

    const uiState = await session.liveClient.getUiState(page);
    assert.equal(uiState.uiMode, 'agent');
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
    assert.equal(path.basename(audit.artifacts.desktop.htmlBundlePath), 'desktop.html');
    assert.equal(path.basename(audit.artifacts.desktop.jsonReportPath), 'desktop.json');
    assert.equal(path.basename(audit.artifacts.desktop.screenshotPath), 'desktop.jpg');
    assert.equal(path.basename(audit.artifacts.mobile.htmlBundlePath), 'mobile.html');
    assert.equal(path.basename(audit.artifacts.mobile.jsonReportPath), 'mobile.json');
    assert.equal(path.basename(audit.artifacts.mobile.screenshotPath), 'mobile.jpg');

    const reportMarkdown = await readFile(audit.artifacts.reportMarkdownPath, 'utf8');
    assert.match(reportMarkdown, /# Accessibility Audit Report/);
    assert.match(reportMarkdown, /\*\*Target:\*\* Sandbox Fixture/);

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
