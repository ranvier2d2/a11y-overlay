import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
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
  const session = await createOverlaySandboxSession({ headless: true });
  const server = http.createServer((_req, res) => {
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
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/`;

    const page = await session.ensureDesktopPage({ url });

    const contract = await session.ensureOverlay(page, {
      runtimeScriptPath: RUNTIME_SCRIPT_PATH,
      preset: 'agent-capture',
      announce: false
    });
    assert.equal(contract.contractVersion, 1);

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
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await session.close();
  }

  console.log('overlay sandbox verification passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
