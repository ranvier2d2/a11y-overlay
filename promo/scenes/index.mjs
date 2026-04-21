import agentPreset from './agent-preset.mjs';
import contractPanel from './contract-panel.mjs';
import demoInject from './demo-inject.mjs';
import htmlReport from './html-report.mjs';
import humanSlices from './human-slices.mjs';
import installCard from './install-card.mjs';
import jsonReport from './json-report.mjs';
import landingHero from './landing-hero.mjs';
import privacyPage from './privacy-page.mjs';

export const sceneList = [
  landingHero,
  demoInject,
  agentPreset,
  contractPanel,
  jsonReport,
  htmlReport,
  humanSlices,
  installCard,
  privacyPage
];

export const sceneMap = Object.fromEntries(sceneList.map((scene) => [scene.id, scene]));
