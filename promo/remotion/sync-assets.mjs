import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, '..', '..');
const sourceDir = path.join(repoRoot, 'promo', 'remotion-assets');
const publicDir = path.join(repoRoot, 'public');
const targetDir = path.join(publicDir, 'remotion-assets');

if (!existsSync(sourceDir)) {
  console.error(`Missing asset pack: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(publicDir, {recursive: true});
rmSync(targetDir, {recursive: true, force: true});
cpSync(sourceDir, targetDir, {recursive: true});

console.log(`Synced Remotion assets to ${path.relative(repoRoot, targetDir)}`);
