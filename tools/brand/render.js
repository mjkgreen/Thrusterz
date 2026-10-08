// Renders the app icons and the social share card from icon.svg and og.html.
//   node tools/brand/render.js
// Needs Playwright with Chromium available.
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const root = path.join(__dirname, '..', '..');
const out = (f) => path.join(root, 'img', f);

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const svg = require('fs').readFileSync(path.join(root, 'icon.svg'), 'utf8');
  // Square icons at each size the platforms ask for.
  // [size, file, padding, solid background]. iOS shows transparent corners as black, so its icon is solid.
  for (const [size, file, pad, solid] of [[32, 'favicon-32.png', 0, false], [180, 'apple-touch-icon.png', 0, true], [192, 'icon-192.png', 0, false], [512, 'icon-512.png', 0, false], [512, 'icon-maskable-512.png', 0.1, true]]) {
    await page.setViewportSize({ width: size, height: size });
    // Maskable icons need the art inside the central safe zone on a full-bleed background.
    const inner = size * (1 - 2 * pad);
    await page.setContent(`<html><body style="margin:0;background:${solid ? '#0b0f24' : 'transparent'}">
      <div style="width:${inner}px;height:${inner}px;margin:${size * pad}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: out(file), omitBackground: !solid });
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('file://' + path.join(__dirname, 'og.html'));
  await page.waitForTimeout(1500); // fonts
  await page.screenshot({ path: out('og-image.png') });
  await browser.close();
  console.log('wrote img/: favicon-32, apple-touch-icon, icon-192, icon-512, icon-maskable-512, og-image');
})();
