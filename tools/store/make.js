// App Store screenshots: real game frames (tools/store/capture.js) with a
// caption above, at the exact sizes App Store Connect asks for.
//   node tools/store/make.js [outDir]        (default store/screenshots)
// Writes iphone-NN.png (2868×1320, 6.9" display) and ipad-NN.png
// (2752×2064, 13" display), in upload order.
'use strict';
const fs = require('fs');
const path = require('path');
const cap = require('./capture.js');

// In order: the first one is what search results show.
const SHOTS = [
  { kind: 'fly', id: 'apollo', t: 20, burn: 300, title: 'Fly by real orbital physics', sub: 'Launch, orbit, slingshot and land' },
  { kind: 'fly', id: 'nofly', t: 50, title: 'See your path before you burn', sub: 'Live trajectory prediction for every move' },
  { kind: 'fly', id: 'granddeploy', t: 150, title: 'Deploy satellites, drop stages', sub: 'Plan where every piece ends up' },
  { kind: 'fly', id: 'longhaul', t: 120, title: 'Thread the no-fly zones', sub: 'Every turn costs fuel' },
  { kind: 'fly', id: 'asteroidrun', t: 40, title: 'Weave through asteroid fields', sub: 'Gravity does the steering' },
  { kind: 'fly', id: 'test-horizon', t: 30, title: 'Black holes and wormholes', sub: 'Experimental levels for the brave' },
  { kind: 'menu', title: '90 missions in three worlds', sub: 'From first launch to grand tours' },
  { kind: 'result', id: 'satellite', title: 'Earn stars, top the leaderboards', sub: 'Every run is checked and replayed' },
];

// Some progress so the menu looks lived in: World 1 and 2 done, World 3 begun.
function progress() {
  const { LEVELS } = require('../../js/levels.js');
  const stars = {}; let k = 0, unlocked = 0;
  LEVELS.forEach((L, i) => {
    if (!L.world || L.world === 1) { stars[L.id] = [3, 3, 2, 3][k++ % 4]; unlocked = i; }
    else if (L.world === 2) { stars[L.id] = [3, 2, 3, 3, 1][k++ % 5]; unlocked = i; }
  });
  const w3 = LEVELS.filter(L => L.world === 3).slice(0, 7);
  w3.forEach((L, j) => { stars[L.id] = [3, 2, 3, 1, 2, 0, 0][j]; if (stars[L.id]) unlocked = LEVELS.indexOf(L); });
  for (const id in stars) if (!stars[id]) delete stars[id];
  return { unlocked: unlocked + 1, stars, best: {}, score: {} };
}

const SIZES = {
  iphone: { w: 2868, h: 1320, capH: 300, imgW: 2150, title: 104, sub: 44 },
  ipad: { w: 2752, h: 2064, capH: 380, imgW: 2200, title: 120, sub: 52 },
};

function page(size, shot, img) {
  const S = SIZES[size], ar = size === 'iphone' ? 1320 / 2868 : 2064 / 2752, imgH = Math.round(S.imgW * ar);
  const top = S.capH, left = Math.round((S.w - S.imgW) / 2);
  const fonts = fs.readFileSync(path.join(__dirname, '../../fonts/fonts.css'), 'utf8').replace(/url\(([^)]+)\)/g, (m, u) =>
    `url(data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, '../../fonts', u.replace(/['"]/g, ''))).toString('base64')})`);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
  html, body { margin: 0; width: ${S.w}px; height: ${S.h}px; overflow: hidden; background: #05060d; }
  .bg { position: absolute; inset: 0; background:
    radial-gradient(1200px 700px at 18% 8%, rgba(79,143,224,0.28), transparent 70%),
    radial-gradient(1100px 800px at 88% 100%, rgba(124,247,212,0.16), transparent 70%),
    radial-gradient(900px 600px at 70% 0%, rgba(170,110,255,0.14), transparent 70%); }
  .cap { position: absolute; left: 0; right: 0; top: 0; height: ${S.capH}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${Math.round(S.sub * 0.45)}px; font-family: "Exo 2", system-ui, sans-serif; }
  .t { font-weight: 800; font-size: ${S.title}px; letter-spacing: 0.01em; line-height: 1;
    background: linear-gradient(180deg, #ffffff 0%, #cfe0ff 55%, #9fb4ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .s { font-weight: 600; font-size: ${S.sub}px; color: #7cf7d4; letter-spacing: 0.02em; }
  .shot { position: absolute; left: ${left}px; top: ${top}px; width: ${S.imgW}px; height: ${imgH}px; border-radius: ${Math.round(S.imgW / 50)}px; overflow: hidden;
    box-shadow: 0 0 0 3px rgba(150,180,255,0.22), 0 40px 120px rgba(0,0,0,0.7), 0 0 160px rgba(79,143,224,0.25); }
  .shot img { width: 100%; height: 100%; display: block; }
  </style></head><body><div class="bg"></div>
  <div class="cap"><div class="t">${shot.title}</div><div class="s">${shot.sub}</div></div>
  <div class="shot"><img src="data:image/png;base64,${img.toString('base64')}"></div></body></html>`;
}

async function capture(device, dir) {
  const { page: p, errors, close } = await cap.open(device, { progress: progress() });
  await cap.setup(p);
  const files = [];
  for (const [i, s] of SHOTS.entries()) {
    const file = path.join(dir, `raw-${device}-${String(i + 1).padStart(2, '0')}.png`);
    if (s.kind === 'fly') await cap.shot(p, s.id, s.t, 0, file, s.burn);
    else if (s.kind === 'menu') {
      await p.evaluate(() => { window.Thrusterz.showMenu(); });
      await p.waitForTimeout(600);
      await p.screenshot({ path: file });
    } else if (s.kind === 'result') {
      await p.evaluate((id) => window.__stage(id, 1e6, 0), s.id);
      await p.waitForTimeout(3500);
      // The autopilot's flight isn't a recorded run, so the leaderboard line
      // would say it couldn't be verified: leave it out of the picture.
      await p.evaluate(() => { document.getElementById('res-online').style.display = 'none'; });
      await p.screenshot({ path: file });
    }
    files.push(file);
  }
  if (errors.length) console.log(device, 'page errors:', errors.slice(0, 3));
  await close();
  return files;
}

async function compose(device, raws, out) {
  let playwright;
  try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
  const S = SIZES[device];
  const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await browser.newPage({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: 1 });
  for (const [i, s] of SHOTS.entries()) {
    await p.setContent(page(device, s, fs.readFileSync(raws[i])));
    await p.evaluate(() => document.fonts.ready);
    const file = path.join(out, `${device}-${String(i + 1).padStart(2, '0')}.png`);
    await p.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
}

if (require.main === module) {
  (async () => {
    const out = path.resolve(process.argv[2] || path.join(__dirname, '../../store/screenshots'));
    const raw = path.join(out, 'raw');
    fs.mkdirSync(raw, { recursive: true });
    for (const device of ['iphone', 'ipad']) {
      const raws = await capture(device, raw);
      await compose(device, raws, out);
    }
  })();
}
