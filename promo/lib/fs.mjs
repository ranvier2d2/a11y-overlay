import { mkdir, rm, writeFile } from 'node:fs/promises';

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function ensureCleanDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
  await ensureDir(dirPath);
}

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
