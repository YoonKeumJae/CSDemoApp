import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
const html = await readFile('public/index.html', 'utf8');
await writeFile('dist/index.html', html.replace('<head>', '<head><meta name="static-hosting" content="github-pages">'));
for (const name of ['app.js', 'style.css']) await copyFile(`public/${name}`, `dist/${name}`);
await writeFile('dist/.nojekyll', '');
console.log('Pages build: static public assets only');
