function buildUrl(baseUrl, route) {
  return new URL(route.replace(/^\//, ''), `${baseUrl}/`).toString();
}

export async function gotoRoute(page, baseUrl, route) {
  await page.goto(buildUrl(baseUrl, route), { waitUntil: 'load' });
}

export async function injectCaptureStyle(page, css, id = 'promo-capture-style') {
  await page.evaluate(
    ({ cssText, styleId }) => {
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.textContent = cssText;
    },
    {
      cssText: css,
      styleId: id
    }
  );
}

export async function waitForDemoReady(page) {
  await page.locator('#statusPill.ready').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const status = document.getElementById('summaryStatus');
    return !!status && status.textContent.toLowerCase().includes('ready');
  });
}

export async function openDemo(page, baseUrl) {
  await gotoRoute(page, baseUrl, '/demo.html');
  await waitForDemoReady(page);
}

export async function useDemoStackedLayout(page) {
  await injectCaptureStyle(
    page,
    `
      .hero,
      .layout {
        grid-template-columns: 1fr !important;
      }

      .hero {
        gap: 16px !important;
      }

      .frame-card,
      .stack {
        max-width: 100% !important;
      }
    `,
    'promo-demo-stacked-layout'
  );
}

export async function centerOnSelector(page, selector) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.evaluate((targetSelector) => {
    document.querySelector(targetSelector)?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'instant'
    });
  }, selector);
}

export async function openReferenceWithOverlay(page, baseUrl, overlayClient) {
  await gotoRoute(page, baseUrl, '/reference.html');
  await page.locator('body').waitFor({ state: 'visible' });
  await overlayClient.inject(page);
  await page.waitForFunction(() => !!window.__a11yOverlayInstalled);
  await page.mouse.click(40, 40);
}

export async function applyRuntimePreset(page, overlayClient, presetId) {
  await overlayClient.applyPreset(page, presetId, { announce: false });
  await page.evaluate(() => window.__a11yOverlayInstalled.render());
}
