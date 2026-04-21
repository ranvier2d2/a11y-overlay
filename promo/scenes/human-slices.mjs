import { applyRuntimePreset, openReferenceWithOverlay } from './helpers.mjs';

export default {
  id: 'human-slices',
  title: 'Human slice tour',
  subtitle: 'Toggle interactives, forms, targets, and tab order on a real page.',
  voiceover: 'Toggle interactives, forms, targets, and tab order on a real page.',
  async run({ page, baseUrl, hold, overlayClient }) {
    await openReferenceWithOverlay(page, baseUrl, overlayClient);
    await applyRuntimePreset(page, overlayClient, 'content');
    await hold(450);
    await page.keyboard.press('I');
    await hold(450);
    await page.keyboard.press('M');
    await hold(450);
    await page.keyboard.press('T');
    await hold(450);
    await page.keyboard.press('F');
    await hold(1200);
    return {
      route: '/reference.html',
      focus: 'human-slices'
    };
  }
};
