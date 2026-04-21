import { gotoRoute } from './helpers.mjs';

export default {
  id: 'privacy-page',
  title: 'Privacy page',
  subtitle: 'Runs locally, with no analytics and no remote code.',
  voiceover: 'Runs locally, with no analytics and no remote code.',
  async run({ page, baseUrl, hold }) {
    await gotoRoute(page, baseUrl, '/privacy.html');
    await page.locator('h1').waitFor({ state: 'visible' });
    await hold(1800);
    return {
      route: '/privacy.html',
      focus: 'privacy'
    };
  }
};
