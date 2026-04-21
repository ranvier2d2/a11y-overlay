import { centerOnSelector, openDemo, useDemoStackedLayout } from './helpers.mjs';

export default {
  id: 'html-report',
  title: 'HTML report',
  subtitle: 'Turn the same runtime state into a readable handoff report.',
  voiceover: 'Turn the same runtime state into a readable handoff report.',
  async run({ page, baseUrl, hold }) {
    await openDemo(page, baseUrl);
    await useDemoStackedLayout(page);
    await page.getByRole('button', { name: 'Build HTML report' }).click();
    await centerOnSelector(page, '#report-title');
    await page.waitForFunction(() => {
      const preview = document.getElementById('htmlPreviewLink');
      return !!preview && !preview.hidden;
    });
    await hold(1800);
    return {
      route: '/demo.html',
      focus: 'report-html'
    };
  }
};
