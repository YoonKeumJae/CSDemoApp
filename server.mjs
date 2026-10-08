import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const files = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']]]);
files.set('/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json; charset=utf-8']);
for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  files.set(`/icons/${name}`, [`icons/${name}`, 'image/png']);
}
export function createApp({ endpoint = process.env.COPILOT_TOKEN_ENDPOINT, secret = process.env.DIRECT_LINE_SECRET, domain = process.env.DIRECT_LINE_DOMAIN || 'https://directline.botframework.com', agentName = process.env.AGENT_NAME || 'Copilot Assistant', fetcher = fetch } = {}) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/api/config' && req.method === 'GET') return json(200, { agentName, configured: Boolean(endpoint || secret) });
    if (path === '/api/token') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(405, { error: 'POST 요청이 필요합니다.' }); }
      // Browser requests must originate from this app. No cross-origin token broker.
      const origin = req.headers.origin;
      let originAllowed = !origin;
      try { if (origin) originAllowed = new URL(origin).host === req.headers.host; } catch { originAllowed = false; }
      if (!originAllowed || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: '허용되지 않는 출처입니다.' });
      if (!endpoint && !secret) return json(503, { error: '.env에 COPILOT_TOKEN_ENDPOINT 또는 DIRECT_LINE_SECRET을 설정해주세요.' });
      try {
        if ((endpoint && new URL(endpoint).protocol !== 'https:') || new URL(domain).protocol !== 'https:') throw new Error('HTTPS required');
        const response = await fetcher(endpoint || `${domain.replace(/\/$/, '')}/v3/directline/tokens/generate`, { method: endpoint ? 'GET' : 'POST', signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Accept: 'application/json', ...(!endpoint ? { Authorization: `Bearer ${secret}` } : {}) } });
        if (!response.ok) return json(502, { error: '에이전트 토큰을 발급하지 못했습니다. 게시 상태와 채널 설정을 확인해주세요.' });
        const data = await response.json();
        if (typeof data.token !== 'string' || !data.token) throw new Error('Invalid token response');
        return json(200, { token: data.token, domain: `${domain.replace(/\/$/, '')}/v3/directline` });
      } catch { return json(502, { error: '에이전트 연결에 실패했습니다. Token Endpoint와 네트워크를 확인해주세요.' }); }
    }
    if (req.method !== 'GET' || !files.has(path)) return json(404, { error: 'Not found' });
    try {
      const [name, type] = files.get(path);
      const content = await readFile(new URL(`./public/${name}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': type }); res.end(content);
    } catch { json(500, { error: '화면을 불러오지 못했습니다.' }); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createApp().listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Copilot web app: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`));
}
