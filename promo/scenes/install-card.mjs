import { centerOnSelector, gotoRoute } from './helpers.mjs';

export default {
  id: 'install-card',
  title: 'Install flow',
  subtitle: 'Show the local extension path without leaving the deterministic demo.',
  voiceover: 'Show the local extension path without leaving the deterministic demo.',
  async run({ page, baseUrl, hold }) {
    await gotoRoute(page, baseUrl, '/demo.html');
    await centerOnSelector(page, '#install');
    await page.locator('#install-title').waitFor({ state: 'visible' });
    await hold(1800);
    return {
      route: '/demo.html#install',
      focus: 'install-card'
    };
  }
};
