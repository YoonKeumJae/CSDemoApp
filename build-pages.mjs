import { mkdir, readFile, writeFile, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
const html = await readFile('public/index.html', 'utf8');
await writeFile('dist/index.html', html.replace('<head>', '<head><meta name="static-hosting" content="github-pages">'));
for (const name of ['app.js', 'style.css', 'manifest.webmanifest']) await copyFile(`public/${name}`, `dist/${name}`);
await cp('public/icons', 'dist/icons', { recursive: true });
await cp('public/screenshots', 'dist/screenshots', { recursive: true });
await writeFile('dist/.nojekyll', '');
console.log('Pages build: static public assets only');
