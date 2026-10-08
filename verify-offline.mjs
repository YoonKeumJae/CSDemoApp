import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const offlineCookies = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/CSDemoApp\//, '/');
  res.setHeader('Cache-Control', 'no-store');
  if (path === '/api/config') { res.setHeader('Content-Type', 'application/json'); return res.end('{"agentName":"Test","configured":false}'); }
  if (['/private.html', '/login', '/api/private'].includes(path)) {
    res.setHeader('Content-Type', 'text/html'); return res.end('<h1>USER_PRIVATE_CONTENT</h1>');
  }
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (!['index.html', 'sw.js', 'register-sw.js', 'offline.html', 'style.css', 'app.js', 'manifest.webmanifest'].includes(name)) { res.statusCode = 404; return res.end(); }
  if (name === 'offline.html') offlineCookies.push(req.headers.cookie);
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(await readFile(`public/${name}`));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  for (const prefix of ['/', '/CSDemoApp/']) {
    const base = `http://127.0.0.1:${server.address().port}${prefix}`;
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.addCookies([{ name: 'session', value: 'private', url: base }]);
    const page = await context.newPage();
    await page.goto(base);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const initial = await page.evaluate(async () => ({ scope: (await navigator.serviceWorker.getRegistration()).scope, registrations: (await navigator.serviceWorker.getRegistrations()).length }));
    assert.equal(initial.scope, base);
    assert.equal(initial.registrations, 1);
    await page.goto(`${base}private.html`);
    assert.match(await page.textContent('body'), /USER_PRIVATE_CONTENT/);
    await page.evaluate(async base => { await fetch(`${base}api/private`); await fetch(`${base}login`); }, base);
    await context.setOffline(true);
    await page.goto(`${base}unvisited-page`);
    assert.match(await page.textContent('body'), /인터넷 연결을 확인/);
    await page.reload();
    assert.match(await page.textContent('body'), /인터넷 연결을 확인/);
    assert.equal(await page.evaluate(async base => { try { await fetch(`${base}api/private`); return 'unexpected response'; } catch { return 'network failure'; } }, base), 'network failure');
    const cacheContents = await page.evaluate(async () => {
      const name = (await caches.keys()).find(name => name.endsWith(':v1'));
      const cache = await caches.open(name);
      const requests = await cache.keys();
      return Promise.all(requests.map(async request => ({ url: request.url, body: await (await cache.match(request)).text() })));
    });
    assert.equal(cacheContents.length, 1);
    assert.equal(cacheContents[0].url, `${base}offline.html`);
    assert.ok(!cacheContents[0].body.includes('USER_PRIVATE_CONTENT'));
    await context.setOffline(false);
    await page.goto(base);
    assert.ok(await page.locator('#connect').count());
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 1);
    console.log(`PASS ${prefix}: single registration, offline navigation/reload, private/API exclusion, network recovery`);
    await context.close();
  }
  assert.ok(offlineCookies.length >= 2);
  assert.ok(offlineCookies.every(cookie => cookie === undefined));
  console.log('PASS offline precache requests omit session cookies');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
