// Packs the whole game into one self-contained HTML file for the native app:
// scripts and styles inlined, fonts and images as data URIs.
//   npm run build:mobile   → mobile/assets/game/game.html
// The mobile app runs this automatically before every start and EAS build.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const dataUri = (f, type) => `data:${type};base64,${fs.readFileSync(path.join(root, f)).toString('base64')}`;

let html = read('index.html');

// Things a bundled page doesn't need: web manifest, favicons, social cards.
html = html.replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n?/g, '')
  .replace(/<meta (property="og:|name="twitter:)[^>]*>\n?/g, '');

// Stylesheets, with url(...) references made into data URIs.
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  const dir = path.dirname(href);
  const css = read(href).replace(/url\(([^)]+)\)/g, (m, u) => {
    const file = path.join(dir, u.replace(/['"]/g, ''));
    if (/^data:|^https?:/.test(u)) return m;
    const type = file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    return `url(${dataUri(file, type)})`;
  });
  return `<style>\n${css}\n</style>`;
});

// Scripts. ("</script" can't appear inside an inline script.)
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);

// Images referenced from the page.
html = html.replace(/src="(icon\.svg)"/g, (_, f) => `src="${dataUri(f, 'image/svg+xml')}"`);

const leftovers = html.match(/(src|href)="(?!data:|https?:|#|privacy\.html|support\.html)[^"]+"/g);
if (leftovers) { console.error('Unbundled references:', leftovers); process.exit(1); }

const out = path.join(root, 'mobile', 'assets', 'game', 'game.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`mobile/assets/game/game.html: ${(html.length / 1024).toFixed(0)} KB`);
