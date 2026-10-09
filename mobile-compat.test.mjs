import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('chat connects without AbortSignal.timeout and clears timers on every outcome', async () => {
  const source = await readFile('public/app.js', 'utf8');
  for (const outcome of ['success', 'network-error', 'timeout']) {
    const elements = new Map();
    const select = selector => {
      if (!elements.has(selector)) elements.set(selector, { addEventListener() {} });
      return elements.get(selector);
    };
    let timerCallback, cleared = 0, rendered = false;
    const context = {
      document: { querySelector: select },
      window: { addEventListener() {}, WebChat: {
        createDirectLine: () => ({ connectionStatus$: { subscribe: () => ({ unsubscribe() {} }) } }),
        renderWebChat: () => { rendered = true; }
      } },
      AbortController, AbortSignal: {},
      crypto: { randomUUID: () => 'test-id' },
      setTimeout: (callback, ms) => { assert.equal(ms, 20000); timerCallback = callback; return 1; },
      clearTimeout: id => { assert.equal(id, 1); cleared++; },
      fetch: async (url, options) => {
        assert.equal(options.credentials, 'omit');
        assert.ok(options.signal instanceof AbortSignal);
        if (outcome === 'network-error') throw new Error('network-error');
        if (outcome === 'timeout') {
          timerCallback();
          assert.equal(options.signal.aborted, true);
          throw new Error('timeout');
        }
        return { ok: true, json: async () => ({ token: 'test-token' }) };
      }
    };
    runInNewContext(source, context);
    await runInNewContext('connect()', context);
    assert.equal(cleared, 1);
    assert.equal(rendered, outcome === 'success');
    assert.equal(select('#connect').disabled, false);
    if (outcome !== 'success') assert.equal(select('#notice-text').textContent, outcome);
  }
});
