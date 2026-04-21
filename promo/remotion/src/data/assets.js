import {staticFile} from 'remotion';

const asset = (path) => staticFile(`/remotion-assets/${path}`);

export const stills = {
  landingHero: asset('stills/landing-hero.png'),
  landingFull: asset('stills/landing-full.png'),
  githubOverlayDefault: asset('stills/github-overlay-default.png'),
  githubOverlayFocus: asset('stills/github-overlay-focus.png'),
  referenceOverlayProof: asset('stills/reference-overlay-proof.png'),
  demoSummaryProof: asset('stills/demo-summary-proof.png'),
  agentAudit: asset('stills/agent-overlay-landing-audit.png'),
};

export const clips = {
  landingHero: asset('clips/landing-hero.webm'),
  demoInject: asset('clips/demo-inject.webm'),
  agentPreset: asset('clips/agent-preset.webm'),
  contractPanel: asset('clips/contract-panel.webm'),
  jsonReport: asset('clips/json-report.webm'),
  htmlReport: asset('clips/html-report.webm'),
  humanSlices: asset('clips/human-slices.webm'),
  installCard: asset('clips/install-card.webm'),
  privacyPage: asset('clips/privacy-page.webm'),
};

export const posters = {
  landingHero: asset('clips/landing-hero-poster.png'),
  demoInject: asset('clips/demo-inject-poster.png'),
  agentPreset: asset('clips/agent-preset-poster.png'),
  contractPanel: asset('clips/contract-panel-poster.png'),
  jsonReport: asset('clips/json-report-poster.png'),
  htmlReport: asset('clips/html-report-poster.png'),
  humanSlices: asset('clips/human-slices-poster.png'),
  installCard: asset('clips/install-card-poster.png'),
  privacyPage: asset('clips/privacy-page-poster.png'),
};
