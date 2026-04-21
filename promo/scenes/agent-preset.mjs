import { openDemo } from './helpers.mjs';

export default {
  id: 'agent-preset',
  title: 'Agent preset',
  subtitle: 'Apply the dense capture preset that turns on the full runtime surface.',
  voiceover: 'Apply the dense capture preset that turns on the full runtime surface.',
  async run({ page, baseUrl, hold }) {
    await openDemo(page, baseUrl);
    await page.getByRole('button', { name: 'Apply agent preset' }).click();
    await page.waitForFunction(() => {
      const title = document.getElementById('statusTitle');
      return !!title && title.textContent.includes('Agent preset applied');
    });
    await hold(1500);
    return {
      route: '/demo.html',
      focus: 'preset-button'
    };
  }
};
