// Renders the native app's icons and splash image from icon.svg.
//   node tools/brand/render-mobile.js   → mobile/assets/
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const root = path.join(__dirname, '..', '..');
const out = (f) => path.join(root, 'mobile', 'assets', f);
const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const shot = async (size, body, file, transparent) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${transparent ? 'transparent' : '#05060d'}">${body}</body></html>`);
    await page.screenshot({ path: out(file), omitBackground: !!transparent });
  };
  // App Store icon: square and opaque (iOS rounds the corners itself).
  await shot(1024, svg.replace('rx="112"', 'rx="0"').replace('<svg ', '<svg width="1024" height="1024" '), 'icon.png');
  // Android adaptive icon foreground: the art inside the 66% safe zone.
  await shot(1024, svg.replace('rx="112"', 'rx="0"').replace('<svg ', '<svg width="680" height="680" '), 'icon-foreground.png', true);
  // Splash: the rounded logo on transparent (the splash colour shows around it).
  await shot(1024, svg.replace('<svg ', '<svg width="1024" height="1024" '), 'splash-icon.png', true);
  await browser.close();
  console.log('mobile/assets: icon.png, icon-foreground.png, splash-icon.png');
})();
