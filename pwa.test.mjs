import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from './server.mjs';

test('manifest stays within local and Pages deployment scopes', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  const html = await readFile('public/index.html', 'utf8');
  assert.match(html, /rel="manifest" href="\.\/manifest.webmanifest"/);
  for (const base of ['http://127.0.0.1:3000/', 'https://yoonkeumjae.github.io/CSDemoApp/']) {
    const manifestUrl = new URL('./manifest.webmanifest', base);
    for (const key of ['id', 'start_url', 'scope']) assert.equal(new URL(manifest[key], manifestUrl).href, base);
  }
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = await readFile(`public/${icon.src}`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable' && icon.sizes === '512x512'));
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
    for (const icon of manifest.icons) {
      const response = await fetch(new URL(icon.src, `${base}/manifest.webmanifest`));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
