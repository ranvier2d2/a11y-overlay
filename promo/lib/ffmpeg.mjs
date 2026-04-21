import { execFile } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runBinary(command, args) {
  try {
    return await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 16
    });
  } catch (error) {
    const detail = error.stderr || error.stdout || error.message;
    throw new Error(`${command} failed: ${detail}`.trim());
  }
}

export async function probeDurationSeconds(filePath) {
  const { stdout } = await runBinary('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath
  ]);
  const durationSeconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(durationSeconds)) {
    throw new Error(`Could not read a numeric duration from ffprobe for ${filePath}.`);
  }
  return durationSeconds;
}

export async function concatVideos({ inputPaths, outputPath }) {
  const concatListPath = `${outputPath}.concat.txt`;
  const concatFile = inputPaths
    .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
    .join('\n');

  await writeFile(concatListPath, `${concatFile}\n`, 'utf8');
  try {
    await runBinary('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath
    ]);
  } finally {
    await rm(concatListPath, { force: true });
  }

  return outputPath;
}
