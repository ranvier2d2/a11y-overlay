import { gotoRoute, injectCaptureStyle } from './helpers.mjs';

export default {
  id: 'landing-hero',
  title: 'Landing hero',
  subtitle: 'Give browser agents context before they click.',
  voiceover: 'Give browser agents context before they click.',
  async run({ page, baseUrl, hold }) {
    await gotoRoute(page, baseUrl, '/landing.html');
    await page.locator('#hero-title').waitFor({ state: 'visible' });
    await injectCaptureStyle(
      page,
      `
        #hero-title {
          font-size: clamp(2.6rem, 5.4vw, 4.6rem) !important;
          max-width: 13ch !important;
        }

        .hero {
          min-height: 72svh !important;
          background-position: center top !important;
        }

        .hero-copy {
          padding-bottom: 36px !important;
        }
      `,
      'promo-landing-hero-style'
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await hold(1600);
    return {
      route: '/landing.html',
      focus: 'hero'
    };
  }
};
