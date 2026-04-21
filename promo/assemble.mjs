import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { promoConfig, getCutOrThrow, getProfileOrThrow } from './config.mjs';
import { parsePromoArgs } from './lib/cli.mjs';
import { concatVideos } from './lib/ffmpeg.mjs';
import { ensureCleanDir, ensureDir, writeJson } from './lib/fs.mjs';

function isDirectRun(importMetaUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}

function formatTimestamp(totalSeconds) {
  const wholeMilliseconds = Math.round(totalSeconds * 1000);
  const hours = Math.floor(wholeMilliseconds / 3_600_000);
  const minutes = Math.floor((wholeMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((wholeMilliseconds % 60_000) / 1000);
  const milliseconds = wholeMilliseconds % 1000;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ].join(':') + `.${String(milliseconds).padStart(3, '0')}`;
}

function buildWebVtt(sceneManifests) {
  const lines = ['WEBVTT', ''];
  let currentTime = 0;
  let cueIndex = 1;

  for (const scene of sceneManifests) {
    if (!scene.subtitle) {
      currentTime += scene.durationSeconds;
      continue;
    }
    lines.push(String(cueIndex));
    lines.push(`${formatTimestamp(currentTime)} --> ${formatTimestamp(currentTime + scene.durationSeconds)}`);
    lines.push(scene.subtitle);
    lines.push('');
    currentTime += scene.durationSeconds;
    cueIndex += 1;
  }

  return `${lines.join('\n')}\n`;
}

function buildVoiceover(sceneManifests) {
  return sceneManifests
    .filter((scene) => scene.voiceover)
    .map((scene, index) => `${index + 1}. ${scene.voiceover}`)
    .join('\n');
}

async function readSceneManifest(profileName, sceneId) {
  const manifestPath = path.join(promoConfig.outputDir, profileName, 'scenes', sceneId, 'scene.json');
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

export async function assembleCuts({
  profileName = 'draft',
  cutIds = [],
  verbose = false
} = {}) {
  getProfileOrThrow(profileName);
  const selectedCutIds = cutIds.length ? cutIds : Object.keys(promoConfig.cuts);
  const outputRoot = path.join(promoConfig.outputDir, profileName, 'cuts');
  await ensureDir(outputRoot);

  const manifests = [];
  for (const cutId of selectedCutIds) {
    const cut = getCutOrThrow(cutId);
    const sceneManifests = [];
    for (const sceneId of cut.sceneIds) {
      sceneManifests.push(await readSceneManifest(profileName, sceneId));
    }

    const cutDir = path.join(outputRoot, cutId);
    await ensureCleanDir(cutDir);

    const videoPath = path.join(cutDir, `${cutId}.mp4`);
    await concatVideos({
      inputPaths: sceneManifests.map((scene) => scene.clipPath),
      outputPath: videoPath
    });

    const captionsPath = path.join(cutDir, `${cutId}.vtt`);
    await writeFile(captionsPath, buildWebVtt(sceneManifests), 'utf8');

    const voiceoverPath = path.join(cutDir, `${cutId}-voiceover.txt`);
    await writeFile(voiceoverPath, `${buildVoiceover(sceneManifests)}\n`, 'utf8');

    const storyPath = path.join(cutDir, `${cutId}-story.md`);
    const storyLines = [
      `# ${cut.title}`,
      '',
      ...sceneManifests.map((scene) => `- \`${scene.id}\` (${scene.durationSeconds.toFixed(2)}s): ${scene.subtitle}`)
    ];
    await writeFile(storyPath, `${storyLines.join('\n')}\n`, 'utf8');

    const manifest = {
      id: cutId,
      title: cut.title,
      profile: profileName,
      output: {
        videoPath,
        captionsPath,
        voiceoverPath,
        storyPath
      },
      scenes: sceneManifests.map((scene) => ({
        id: scene.id,
        title: scene.title,
        durationSeconds: scene.durationSeconds,
        clipPath: scene.clipPath,
        subtitle: scene.subtitle
      }))
    };
    await writeJson(path.join(cutDir, 'cut.json'), manifest);
    manifests.push(manifest);

    if (verbose) {
      console.log(`assembled ${cutId}: ${videoPath}`);
    }
  }

  return manifests;
}

async function main() {
  const args = parsePromoArgs();
  if (args.list) {
    console.log('Cuts:', Object.keys(promoConfig.cuts).join(', '));
    return;
  }

  const manifests = await assembleCuts(args);
  console.log(`Assembled ${manifests.length} promo cut(s) for profile "${args.profileName}".`);
}

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
