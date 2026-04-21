import { centerOnSelector, openDemo, useDemoStackedLayout } from './helpers.mjs';

export default {
  id: 'json-report',
  title: 'JSON report',
  subtitle: 'Build a structured JSON report from the live runtime state.',
  voiceover: 'Build a structured JSON report from the live runtime state.',
  async run({ page, baseUrl, hold }) {
    await openDemo(page, baseUrl);
    await useDemoStackedLayout(page);
    await page.getByRole('button', { name: 'Build JSON report' }).click();
    await centerOnSelector(page, '#report-title');
    await page.waitForFunction(() => {
      const output = document.getElementById('reportOutput');
      return !!output && output.textContent.includes('"summary"') && output.textContent.includes('"actions"');
    });
    await hold(1800);
    return {
      route: '/demo.html',
      focus: 'report-json'
    };
  }
};
