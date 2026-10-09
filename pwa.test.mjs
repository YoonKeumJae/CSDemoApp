import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from './server.mjs';
import { runInNewContext } from 'node:vm';

test('manifest stays within local and Pages deployment scopes', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  const html = await readFile('public/index.html', 'utf8');
  assert.match(html, /rel="manifest" href="\.\/manifest.webmanifest"/);
  for (const base of ['http://127.0.0.1:3000/', 'https://yoonkeumjae.github.io/CSDemoApp/']) {
    const manifestUrl = new URL('./manifest.webmanifest', base);
    for (const key of ['id', 'start_url', 'scope']) assert.equal(new URL(manifest[key], manifestUrl).href, base);
  }
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.description);
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.dir, 'ltr');
  assert.equal(manifest.prefer_related_applications, false);
  assert.deepEqual(manifest.related_applications, []);
  for (const shortcut of manifest.shortcuts) {
    const target = new URL(shortcut.url, 'https://yoonkeumjae.github.io/CSDemoApp/manifest.webmanifest');
    assert.equal(target.pathname, '/CSDemoApp/');
    assert.match(html, new RegExp(`id="${target.hash.slice(1)}"`));
  }
  assert.ok(manifest.screenshots.some(screenshot => screenshot.form_factor === 'wide'));
  assert.ok(manifest.screenshots.some(screenshot => screenshot.form_factor !== 'wide'));
  for (const icon of [...manifest.icons, ...manifest.screenshots]) {
    const png = await readFile(`public/${icon.src}`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable' && icon.sizes === '512x512'));
});

test('worker registration runs without window.load and preserves existing workers', async () => {
  const source = await readFile('public/register-sw.js', 'utf8');
  const scope = 'https://example.com/CSDemoApp/';
  for (const existing of [undefined, { scope, active: { scriptURL: `${scope}sw.js` } }, { scope, active: { scriptURL: `${scope}other.js` } }, { scope: 'https://example.com/', active: { scriptURL: 'https://example.com/sw.js' } }]) {
    const calls = [];
    runInNewContext(source, {
      URL, console,
      document: { currentScript: { src: `${scope}register-sw.js` } },
      window: { isSecureContext: true },
      navigator: { serviceWorker: {
        getRegistration: async url => { assert.equal(url, scope); return existing; },
        register: async (...args) => calls.push(args)
      } }
    });
    await new Promise(resolve => setImmediate(resolve));
    const ours = !existing || (existing.scope === scope && existing.active.scriptURL === `${scope}sw.js`);
    assert.equal(calls.length, ours ? 1 : 0);
    if (ours) assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), [`${scope}sw.js`, { scope, updateViaCache: 'none' }]);
  }
});

test('local server serves manifest and every icon with correct MIME types', async () => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/manifest.webmanifest`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
    const manifest = await response.json();
    for (const icon of [...manifest.icons, ...manifest.screenshots]) {
      const response = await fetch(new URL(icon.src, `${base}/manifest.webmanifest`));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
