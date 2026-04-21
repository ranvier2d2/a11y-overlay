import {clips, posters, stills} from './assets.js';

export const FPS = 25;
export const PROMO_WIDTH = 1920;
export const PROMO_HEIGHT = 1080;

const buildCut = (id, cut) => ({
  ...cut,
  id,
  durationInFrames: cut.scenes.reduce((total, scene) => total + scene.frames, 0),
});

export const cuts = {
  agent: buildCut('agent', {
    compositionId: 'AgentPromo',
    audienceLabel: 'For agents',
    eyebrow: 'Overlay Runtime',
    title: 'Context, contract, and evidence before action.',
    summary:
      'A deterministic browser pass that gives an agent something concrete to inspect before it commits to the next step.',
    accent: '#74f1b7',
    backgroundStill: stills.agentAudit,
    highlights: ['Runtime contract', 'Stable waiting', 'Evidence bundle'],
    brandLine: 'Overlay runtime for browser agents',
    scenes: [
      {
        id: 'landing-hero',
        label: 'Context first',
        title: 'Give agents context before they click.',
        body:
          'Start from a page state that can be inspected and replayed, not a blind screenshot and a guess.',
        caption: 'Give browser agents context before they click.',
        frames: 61,
        clipSrc: clips.landingHero,
        posterSrc: posters.landingHero,
        detailStill: stills.githubOverlayFocus,
      },
      {
        id: 'demo-inject',
        label: 'Deterministic boot',
        title: 'Inject the runtime and wait for the proof surface to settle.',
        body:
          'The overlay stabilizes the capture step before the next action starts, so the clip stays repeatable.',
        caption: 'Inject the runtime and wait for the proof surface to settle.',
        frames: 68,
        clipSrc: clips.demoInject,
        posterSrc: posters.demoInject,
        detailStill: stills.demoSummaryProof,
      },
      {
        id: 'agent-preset',
        label: 'Dense capture',
        title: 'Apply the preset that opens the full runtime surface.',
        body:
          'Interactive targets, forms, order, and semantics become visible in one pass without changing the flow.',
        caption: 'Apply the dense capture preset that turns on the full runtime surface.',
        frames: 80,
        clipSrc: clips.agentPreset,
        posterSrc: posters.agentPreset,
        detailStill: stills.githubOverlayDefault,
      },
      {
        id: 'contract-panel',
        label: 'Live contract',
        title: 'Read the live contract instead of guessing what the page exposes.',
        body:
          'The clip keeps the current contract visible while the runtime state changes underneath it.',
        caption: 'Read the live runtime contract instead of guessing what the page exposes.',
        frames: 70,
        clipSrc: clips.contractPanel,
        posterSrc: posters.contractPanel,
        detailStill: stills.referenceOverlayProof,
      },
      {
        id: 'json-report',
        label: 'Machine handoff',
        title: 'Build a structured JSON report from the same runtime state.',
        body:
          'The evidence stays ready for downstream automation without a second pass through the browser.',
        caption: 'Build a structured JSON report from the live runtime state.',
        frames: 74,
        clipSrc: clips.jsonReport,
        posterSrc: posters.jsonReport,
        detailStill: stills.demoSummaryProof,
      },
      {
        id: 'html-report',
        label: 'Readable proof',
        title: 'Turn that runtime state into a readable handoff report.',
        body:
          'The same capture becomes something a human can verify quickly without replaying the session.',
        caption: 'Turn the same runtime state into a readable handoff report.',
        frames: 74,
        clipSrc: clips.htmlReport,
        posterSrc: posters.htmlReport,
        detailStill: stills.referenceOverlayProof,
      },
    ],
  }),
  human: buildCut('human', {
    compositionId: 'HumanPromo',
    audienceLabel: 'For humans',
    eyebrow: 'Overlay Runtime',
    title: 'Local page inspection without a fragile walkthrough.',
    summary:
      'The same deterministic capture path can frame a clean product story for operators, reviewers, and local installs.',
    accent: '#f5d36c',
    backgroundStill: stills.landingFull,
    highlights: ['Visual inspection', 'Preset slices', 'Local privacy'],
    brandLine: 'Overlay runtime for local reviews',
    scenes: [
      {
        id: 'landing-hero',
        label: 'Context first',
        title: 'Give browser agents context before they click.',
        body:
          'The opening scene stays shared so the human story starts from the same truthful capture path.',
        caption: 'Give browser agents context before they click.',
        frames: 61,
        clipSrc: clips.landingHero,
        posterSrc: posters.landingHero,
        detailStill: stills.agentAudit,
      },
      {
        id: 'human-slices',
        label: 'Readable slices',
        title: 'Toggle interactives, forms, targets, and tab order on a real page.',
        body:
          'Each slice stays visible long enough to inspect, compare, and explain without pausing the demo.',
        caption: 'Toggle interactives, forms, targets, and tab order on a real page.',
        frames: 97,
        clipSrc: clips.humanSlices,
        posterSrc: posters.humanSlices,
        detailStill: stills.githubOverlayDefault,
      },
      {
        id: 'install-card',
        label: 'Local path',
        title: 'Show the local extension path without leaving the deterministic demo.',
        body:
          'The install story stays short, direct, and tied to the same page capture instead of a separate setup video.',
        caption: 'Show the local extension path without leaving the deterministic demo.',
        frames: 71,
        clipSrc: clips.installCard,
        posterSrc: posters.installCard,
        detailStill: stills.githubOverlayFocus,
      },
      {
        id: 'privacy-page',
        label: 'Local privacy',
        title: 'Keep the data path local, with no analytics and no remote code.',
        body:
          'The closing shot lands the product promise clearly without switching to a different environment.',
        caption: 'Runs locally, with no analytics and no remote code.',
        frames: 63,
        clipSrc: clips.privacyPage,
        posterSrc: posters.privacyPage,
        detailStill: stills.referenceOverlayProof,
      },
    ],
  }),
};
