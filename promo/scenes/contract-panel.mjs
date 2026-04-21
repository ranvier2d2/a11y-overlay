import { centerOnSelector, openDemo, useDemoStackedLayout } from './helpers.mjs';

export default {
  id: 'contract-panel',
  title: 'Automation contract',
  subtitle: 'Read the live runtime contract instead of guessing what the page exposes.',
  voiceover: 'Read the live runtime contract instead of guessing what the page exposes.',
  async run({ page, baseUrl, hold }) {
    await openDemo(page, baseUrl);
    await useDemoStackedLayout(page);
    await centerOnSelector(page, '#contract-title');
    await page.waitForFunction(() => {
      const output = document.getElementById('contractOutput');
      return !!output && output.textContent.includes('agent-capture');
    });
    await hold(1600);
    return {
      route: '/demo.html',
      focus: 'contract'
    };
  }
};
