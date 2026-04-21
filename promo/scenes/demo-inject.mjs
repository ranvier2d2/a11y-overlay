import { gotoRoute, waitForDemoReady } from './helpers.mjs';

export default {
  id: 'demo-inject',
  title: 'Demo injection',
  subtitle: 'Inject the runtime and wait for the proof surface to settle.',
  voiceover: 'Inject the runtime and wait for the proof surface to settle.',
  async run({ page, baseUrl, hold }) {
    await gotoRoute(page, baseUrl, '/demo.html');
    await page.locator('#statusPill').waitFor({ state: 'visible' });
    await waitForDemoReady(page);
    await hold(1500);
    return {
      route: '/demo.html',
      focus: 'status-card'
    };
  }
};
