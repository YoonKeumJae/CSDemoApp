import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { createApp } from './server.mjs';

// Provide the installed Playwright module path when refreshing these assets.
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const server = createApp();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  await mkdir('public/screenshots', { recursive: true });
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    // The install preview shows the same initial state as GitHub Pages.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname === '/') {
        const response = await route.fetch();
        return route.fulfill({ response, body: (await response.text()).replace('<head>', '<head><meta name="static-hosting" content="github-pages">') });
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `public/screenshots/${name}.png` });
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
