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

/**
 * Invoke the vendor overlay Python script with the provided command-line arguments.
 *
 * @param {string[]} args - Command-line arguments forwarded to the Python script.
 * @param {Object} [options] - Additional options passed to the underlying exec call; `cwd` is set to the repository root by default and can be overridden here.
 * @returns {{stdout: string, stderr: string}} The subprocess result containing `stdout` and `stderr`.
 */
async function runVendor(args, options = {}) {
  return execFileAsync('python3', [SCRIPT_PATH, ...args], {
    cwd: path.resolve('.'),
    ...options
  });
}

/**
 * Verifies that the given filesystem path exists and is accessible.
 *
 * @param {string} filePath - Path to the file or directory to check.
 * @throws {Error} If the path does not exist or is not accessible.
 */
async function assertExists(filePath) {
  await access(filePath);
}

/**
 * Verifies the vendor overlay runtime by exercising three end-to-end scenarios against isolated temporary targets.
 *
 * Runs a compatibility reuse check (identical assets are accepted), a conflict check (divergent target files cause the vendor script to fail with exit code 4), and a temporary mode check (writes a vendor manifest, verifies copied files, then performs cleanup to remove copied files and the manifest). Creates and removes temporary directories for the tests and asserts expected stdout/stderr and filesystem state changes.
 */
async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'overlay-vendor-'));
  const compatibleRoot = path.join(root, 'compatible');
  const conflictRoot = path.join(root, 'conflict');
  const mixedRoot = path.join(root, 'mixed');
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

    // mixed state should not partially copy files before reporting conflicts
    await rm(mixedRoot, { recursive: true, force: true });
    await mkdir(path.join(mixedRoot, 'playwright'), { recursive: true });
    await writeFile(path.join(mixedRoot, 'playwright', 'overlay-client.mjs'), 'stale client\n', 'utf8');

    await assert.rejects(
      () => runVendor(['--target-root', mixedRoot]),
      (error) => {
        assert.equal(error.code, 4);
        assert.match(error.stderr, /target files differ/);
        return true;
      }
    );
    await assert.rejects(() => access(path.join(mixedRoot, 'a11y-overlay.js')));

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
