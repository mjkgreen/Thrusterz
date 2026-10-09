// Renders the iOS app icon (1024×1024, opaque, square: iOS rounds the corners
// itself) and the launch screen images from icon.svg.
//   node tools/brand/render-ios.js
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const root = path.join(__dirname, '..', '..');
const assets = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets');

(async () => {
  const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8').replace('rx="112"', 'rx="0"');
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(`<html><body style="margin:0;background:#05060d">${svg.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`);
  await page.screenshot({ path: path.join(assets, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), omitBackground: false });
  // Launch screen: the logo small and centred on the game's background, so the
  // jump into the menu is seamless.
  await page.setViewportSize({ width: 2732, height: 2732 });
  const mark = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8').replace('<svg ', '<svg width="520" height="520" ');
  await page.setContent(`<html><body style="margin:0;width:2732px;height:2732px;background:#05060d;display:flex;align-items:center;justify-content:center">${mark}</body></html>`);
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await page.screenshot({ path: path.join(assets, 'Splash.imageset', f) });
  }
  await browser.close();
  console.log('iOS icon and splash written');
})();
