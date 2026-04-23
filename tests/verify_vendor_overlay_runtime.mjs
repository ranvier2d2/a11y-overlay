import assert from 'node:assert/strict';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = path.resolve(
  './plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/scripts/vendor_overlay_runtime.py'
);
const ASSET_ROOT = path.resolve(
  './plugins/overlay-playwright-runtime/skills/overlay-playwright-runtime/assets/runtime'
);

async function runVendor(args, options = {}) {
  return execFileAsync('python3', [SCRIPT_PATH, ...args], {
    cwd: path.resolve('.'),
    ...options
  });
}

async function assertExists(filePath) {
  await access(filePath);
}

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'overlay-vendor-'));
  const compatibleRoot = path.join(root, 'compatible');
  const conflictRoot = path.join(root, 'conflict');
  const tempRoot = path.join(root, 'temporary');

  try {
    // compatibility-aware reuse: identical files should not error
    const compatibleOverlay = path.join(compatibleRoot, 'a11y-overlay.js');
    const compatibleClient = path.join(compatibleRoot, 'playwright', 'overlay-client.mjs');
    await rm(compatibleRoot, { recursive: true, force: true });
    await mkdir(path.dirname(compatibleClient), { recursive: true });
    await copyFile(path.join(ASSET_ROOT, 'a11y-overlay.js'), compatibleOverlay);
    await copyFile(path.join(ASSET_ROOT, 'playwright', 'overlay-client.mjs'), compatibleClient);

    const compatibleRun = await runVendor(['--target-root', compatibleRoot]);
    assert.match(compatibleRun.stdout, /already compatible|reuse compatible/);

    // divergent files should still fail without force
    await rm(conflictRoot, { recursive: true, force: true });
    await mkdir(path.join(conflictRoot, 'playwright'), { recursive: true });
    await writeFile(path.join(conflictRoot, 'a11y-overlay.js'), 'stale runtime\n', 'utf8');
    await writeFile(path.join(conflictRoot, 'playwright', 'overlay-client.mjs'), 'stale client\n', 'utf8');

    await assert.rejects(
      () => runVendor(['--target-root', conflictRoot]),
      (error) => {
        assert.equal(error.code, 4);
        assert.match(error.stderr, /target files differ/);
        return true;
      }
    );

    // temporary mode should write a manifest and cleanup should remove copied files
    const manifestPath = path.join(tempRoot, '.codex', 'overlay-playwright-runtime', 'vendor-manifest.json');
    await rm(tempRoot, { recursive: true, force: true });
    await mkdir(tempRoot, { recursive: true });
    const temporaryRun = await runVendor(['--target-root', tempRoot, '--temporary']);
    assert.match(temporaryRun.stdout, /vendored successfully|write manifest/);

    await assertExists(path.join(tempRoot, 'a11y-overlay.js'));
    await assertExists(path.join(tempRoot, 'playwright', 'overlay-client.mjs'));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.copied.length, 2);

    const cleanupRun = await runVendor(['--target-root', tempRoot, '--cleanup']);
    assert.match(cleanupRun.stdout, /cleanup complete/);
    await assert.rejects(() => access(path.join(tempRoot, 'a11y-overlay.js')));
    await assert.rejects(() => access(path.join(tempRoot, 'playwright', 'overlay-client.mjs')));
    await assert.rejects(() => access(manifestPath));

    console.log('overlay vendor verification passed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
