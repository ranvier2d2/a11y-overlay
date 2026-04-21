import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

import { OverlayClient } from '../playwright/overlay-client.mjs';
import { promoConfig, getProfileOrThrow, getSceneOrThrow, resolveSceneIds } from './config.mjs';
import { parsePromoArgs } from './lib/cli.mjs';
import { probeDurationSeconds } from './lib/ffmpeg.mjs';
import { ensureCleanDir, ensureDir, writeJson } from './lib/fs.mjs';
import { startLocalServer } from './lib/local-server.mjs';

function isDirectRun(importMetaUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}

export async function captureScenes({
  profileName = 'draft',
  sceneIds = [],
  cutIds = [],
  verbose = false
} = {}) {
  const profile = getProfileOrThrow(profileName);
  const resolvedSceneIds = resolveSceneIds({ sceneIds, cutIds });
  const outputRoot = path.join(promoConfig.outputDir, profileName);
  const scenesRoot = path.join(outputRoot, 'scenes');

  await ensureDir(scenesRoot);

  const server = await startLocalServer(promoConfig.projectRoot);
  const browser = await chromium.launch({
    channel: promoConfig.browser.channel,
    headless: promoConfig.browser.headless,
    ...promoConfig.browser.launchOptions
  });

  try {
    const manifests = [];
    for (const sceneId of resolvedSceneIds) {
      const scene = getSceneOrThrow(sceneId);
      const manifest = await captureScene({
        scene,
        browser,
        baseUrl: server.baseUrl,
        profile,
        profileName,
        scenesRoot,
        verbose
      });
      manifests.push(manifest);
    }
    return {
      profileName,
      baseUrl: server.baseUrl,
      scenes: manifests
    };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function captureScene({
  scene,
  browser,
  baseUrl,
  profile,
  profileName,
  scenesRoot,
  verbose
}) {
  const sceneDir = path.join(scenesRoot, scene.id);
  const clipDir = path.join(sceneDir, 'raw-video');
  await ensureCleanDir(sceneDir);
  await ensureDir(clipDir);

  const context = await browser.newContext({
    viewport: profile.viewport,
    reducedMotion: 'reduce',
    recordVideo: {
      dir: clipDir,
      size: profile.videoSize
    }
  });
  context.setDefaultTimeout(promoConfig.browser.defaultTimeoutMs);
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true
  });

  const page = await context.newPage();
  const overlayClient = new OverlayClient();
  const consoleMessages = [];
  page.on('console', (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text()
    });
  });

  const hold = (milliseconds) => page.waitForTimeout(Math.round(milliseconds * profile.holdScale));
  const startedAt = new Date().toISOString();
  const video = page.video();
  let tracePath = '';
  let rawVideoPath = '';

  try {
    const result = (await scene.run({
      page,
      baseUrl,
      hold,
      overlayClient,
      profile,
      profileName,
      sceneDir,
      verbose
    })) || {};

    const posterPath = path.join(sceneDir, 'poster.png');
    await page.screenshot({ path: posterPath });

    tracePath = path.join(sceneDir, 'trace.zip');
    await context.tracing.stop({ path: tracePath });
    await context.close();

    rawVideoPath = await video.path();
    const clipPath = path.join(sceneDir, `clip${path.extname(rawVideoPath) || '.webm'}`);
    await rename(rawVideoPath, clipPath);

    const durationSeconds = await probeDurationSeconds(clipPath);
    const manifest = {
      id: scene.id,
      title: scene.title,
      subtitle: scene.subtitle,
      voiceover: scene.voiceover,
      profile: profileName,
      startedAt,
      completedAt: new Date().toISOString(),
      route: result.route || '',
      focus: result.focus || '',
      clipPath,
      posterPath,
      tracePath,
      durationSeconds,
      consoleMessages
    };
    await writeJson(path.join(sceneDir, 'scene.json'), manifest);
    await writeFile(path.join(sceneDir, 'console.json'), `${JSON.stringify(consoleMessages, null, 2)}\n`, 'utf8');

    if (verbose) {
      console.log(`captured ${scene.id}: ${durationSeconds.toFixed(2)}s`);
    }

    return manifest;
  } catch (error) {
    try {
      tracePath = tracePath || path.join(sceneDir, 'trace.zip');
      await context.tracing.stop({ path: tracePath });
    } catch {}
    try {
      await context.close();
    } catch {}
    if (video) {
      try {
        rawVideoPath = await video.path();
      } catch {}
    }
    const failure = {
      id: scene.id,
      title: scene.title,
      profile: profileName,
      startedAt,
      failedAt: new Date().toISOString(),
      error: error && error.message ? error.message : String(error),
      tracePath,
      rawVideoPath,
      consoleMessages
    };
    await writeJson(path.join(sceneDir, 'scene-error.json'), failure);
    throw error;
  }
}

async function main() {
  const args = parsePromoArgs();
  if (args.list) {
    console.log('Scenes:', promoConfig.scenes.map((scene) => scene.id).join(', '));
    console.log('Cuts:', Object.keys(promoConfig.cuts).join(', '));
    return;
  }

  const result = await captureScenes(args);
  console.log(`Captured ${result.scenes.length} promo scenes for profile "${result.profileName}".`);
}

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
