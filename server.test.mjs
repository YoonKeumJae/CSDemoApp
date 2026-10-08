import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';
async function withApp(options, run) {
  const server = createApp(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('missing configuration returns useful error and UI loads', async () => {
  await withApp({ endpoint: '' }, async base => {
    assert.equal((await fetch(base)).status, 200);
    const response = await fetch(`${base}/api/token`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /COPILOT_TOKEN_ENDPOINT/);
  });
});
test('broker exposes only conversation token and regional domain', async () => {
  await withApp({ endpoint: 'https://example.com/token', domain: 'https://europe.directline.botframework.com', fetcher: async () => new Response(JSON.stringify({ token: 'test-token', extra: 'private' })) }, async base => {
    const response = await fetch(`${base}/api/token`, { method: 'POST' });
    assert.deepEqual(await response.json(), { token: 'test-token', domain: 'https://europe.directline.botframework.com/v3/directline' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});
test('cross-origin requests and wrong method are rejected', async () => {
  await withApp({}, async base => {
    assert.equal((await fetch(`${base}/api/token`, { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403);
    assert.equal((await fetch(`${base}/api/token`, { method: 'POST', headers: { Origin: 'null' } })).status, 403);
    assert.equal((await fetch(`${base}/api/token`)).status, 405);
  });
});
test('secret is exchanged server-side and never returned', async () => {
  await withApp({ secret: 'private-key', fetcher: async (url, options) => {
    assert.equal(url, 'https://directline.botframework.com/v3/directline/tokens/generate');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer private-key');
    return new Response(JSON.stringify({ token: 'conversation-token' }));
  } }, async base => {
    const response = await fetch(`${base}/api/token`, { method: 'POST' });
    assert.ok(!(await response.text()).includes('private-key'));
  });
});
test('upstream errors do not leak endpoint or credentials', async () => {
  await withApp({ endpoint: 'https://example.com/token?secret=private', fetcher: async () => { throw new Error('private'); } }, async base => {
    const response = await fetch(`${base}/api/token`, { method: 'POST' });
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('private'));
  });
});
