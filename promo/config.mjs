import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sceneList, sceneMap } from './scenes/index.mjs';

const PROMO_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(PROMO_DIR, '..');

export const promoConfig = {
  projectRoot: PROJECT_ROOT,
  outputDir: path.join(PROJECT_ROOT, 'output', 'promo'),
  browser: {
    channel: 'chrome',
    headless: true,
    defaultTimeoutMs: 15000,
    launchOptions: {
      args: ['--force-color-profile=srgb']
    }
  },
  profiles: {
    draft: {
      label: 'Draft',
      viewport: { width: 1600, height: 900 },
      videoSize: { width: 1600, height: 900 },
      holdScale: 0.85
    },
    final: {
      label: 'Final',
      viewport: { width: 1920, height: 1080 },
      videoSize: { width: 1920, height: 1080 },
      holdScale: 1
    }
  },
  scenes: sceneList,
  sceneMap,
  cuts: {
    agent: {
      title: 'Agent promo',
      sceneIds: ['landing-hero', 'demo-inject', 'agent-preset', 'contract-panel', 'json-report', 'html-report']
    },
    human: {
      title: 'Human promo',
      sceneIds: ['landing-hero', 'human-slices', 'install-card', 'privacy-page']
    }
  }
};

export function getProfileOrThrow(profileName) {
  const profile = promoConfig.profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown promo profile "${profileName}". Expected one of: ${Object.keys(promoConfig.profiles).join(', ')}.`);
  }
  return profile;
}

export function getSceneOrThrow(sceneId) {
  const scene = promoConfig.sceneMap[sceneId];
  if (!scene) {
    throw new Error(`Unknown promo scene "${sceneId}". Expected one of: ${promoConfig.scenes.map((entry) => entry.id).join(', ')}.`);
  }
  return scene;
}

export function getCutOrThrow(cutId) {
  const cut = promoConfig.cuts[cutId];
  if (!cut) {
    throw new Error(`Unknown promo cut "${cutId}". Expected one of: ${Object.keys(promoConfig.cuts).join(', ')}.`);
  }
  return cut;
}

export function resolveSceneIds({ sceneIds = [], cutIds = [] } = {}) {
  if (!sceneIds.length && !cutIds.length) {
    return promoConfig.scenes.map((scene) => scene.id);
  }

  const ordered = [];
  const seen = new Set();
  const push = (sceneId) => {
    if (seen.has(sceneId)) return;
    seen.add(sceneId);
    ordered.push(sceneId);
  };

  for (const sceneId of sceneIds) push(getSceneOrThrow(sceneId).id);
  for (const cutId of cutIds) {
    for (const sceneId of getCutOrThrow(cutId).sceneIds) push(sceneId);
  }
  return ordered;
}
