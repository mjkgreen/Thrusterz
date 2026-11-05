// Renders the Instagram launch posts (1080×1350) from instagram.html.
//   node tools/store/capture.js <framesDir> ipad apollo:20:0:300 nofly:50 granddeploy:150 asteroidrun:40 test-horizon:30
//   node tools/brand/instagram.js <framesDir> [outDir]     (default marketing/instagram)
// Needs Playwright with Chromium available.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async () => {
  const frames = path.resolve(process.argv[2] || 'frames');
  const out = path.resolve(process.argv[3] || path.join(__dirname, '../../marketing/instagram'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await playwright.chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'instagram.html') + '?frames=' + encodeURIComponent('file://' + frames));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const posts = await page.$$('.post');
  for (const [i, el] of posts.entries()) {
    const file = path.join(out, `post-${String(i + 1).padStart(2, '0')}.png`);
    await el.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();
