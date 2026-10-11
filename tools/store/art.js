// App Store header and search-result artwork: a real game scene with the HUD
// hidden and no text (the App Store lays the name and Get button over it).
//   node tools/store/art.js [outDir]      (default store/art)
'use strict';
const fs = require('fs');
const path = require('path');
const cap = require('./capture.js');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

// Each: output size, the page size and density that renders it (cropped to
// the exact size afterwards), and the scene.
const ART = [
  { file: 'header-5244x2950.png', w: 5244, h: 2950, vp: [1748, 984], dpr: 3, scene: { id: 'apollo', t: 20, burn: 300 } },
  { file: 'header-3840x1646.png', w: 3840, h: 1646, vp: [1280, 549], dpr: 3, scene: { id: 'apollo', t: 20, burn: 300 } },
  { file: 'search-5244x2950.png', w: 5244, h: 2950, vp: [1748, 984], dpr: 3, scene: { id: 'granddeploy', t: 150 } },
  { file: 'search-3840x2560.png', w: 3840, h: 2560, vp: [1280, 854], dpr: 3, scene: { id: 'granddeploy', t: 150 } },
  { file: 'search-1920x1280.png', w: 1920, h: 1280, vp: [1280, 854], dpr: 1.5, scene: { id: 'granddeploy', t: 150 } },
];

async function main() {
  const out = path.resolve(process.argv[2] || path.join(__dirname, '../../store/art'));
  fs.mkdirSync(out, { recursive: true });
  for (const a of ART) {
    cap.DEVICES.art = { viewport: { width: a.vp[0], height: a.vp[1] }, deviceScaleFactor: a.dpr, isMobile: false, hasTouch: false };
    const { page, errors, close } = await cap.open('art');
    await cap.setup(page);
    await page.addStyleTag({ content: '#hud, #toast, #coach, #gate { display: none !important; }' });
    const tmp = path.join(out, '.raw.png');
    await cap.shot(page, a.scene.id, a.scene.t, 0, tmp, a.scene.burn);
    if (errors.length) console.log(a.file, 'page errors:', errors.slice(0, 3));
    await close();
    // Crop the extra pixel or two to the exact size, centred.
    const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const p = await browser.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 });
    const img = fs.readFileSync(tmp).toString('base64');
    await p.setContent(`<body style="margin:0;background:#05060d;overflow:hidden"><img style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)" src="data:image/png;base64,${img}"></body>`);
    await p.screenshot({ path: path.join(out, a.file) });
    await browser.close();
    fs.rmSync(tmp);
    console.log(path.join(out, a.file));
  }
}
main();
