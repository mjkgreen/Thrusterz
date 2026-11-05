// Portrait App Store art: screenshots, an app preview and the product-page headers.
//   node tools/store/vertical.js [shots|preview|header ...] [--out dir]   (default store/vertical, all three)
// Screenshots (1206×2622 for 6.3", 1179×2556 for 6.1"): the game's own renderer
// drawing one moment full-bleed, a headline above it, and the real sideways
// iPhone screen of that same moment as a phone below (the game plays in
// landscape on iPhone, so buyers see exactly what they get).
// Preview (886×1920, 30 fps, H.264 with a silent stereo track, under 30 s):
// real flights, each frame flown by the mission's proof (tools/proofs.js).
// Headers (5244×2950, 3840×1646): scenes without text; the App Store lays
// the app's name and Get button over the lower left.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const cap = require('./capture.js');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.join(__dirname, '../..');
const HIDE_HUD = '#hud, #coach, #toast, #alert, #edge-alert, #gate { display: none !important; }';
const W4 = '#c8a8ff', W2 = '#b4f06a', W3 = '#ffaa5a', MINT = '#7cf7d4', PINK = '#f78cff', GOLD = '#ffd166';

// In upload order: the first three show in search results.
const SHOTS = [
  { kind: 'fly', id: 'apollo', t: 20, burn: 300, eyebrow: 'Real orbital physics', color: MINT, title: 'Every planet<br>pulls on you', sub: 'One engine, two thrusters, real gravity' },
  { kind: 'fly', id: 'nofly', t: 50, eyebrow: 'Live trajectory', color: MINT, title: 'See your path<br>before you burn', sub: 'Line up the perfect nudge' },
  { kind: 'fly', id: 'beacon', t: 62, eyebrow: 'World 4 · Pulsar', color: W4, title: 'Hide from<br>the beam', sub: 'Duck into a moon’s shadow' },
  { kind: 'fly', id: 'granddeploy', t: 150, eyebrow: 'World 2 · Payloads', color: W2, title: 'Deploy satellites,<br>drop stages', sub: 'Plan where every piece ends up' },
  { kind: 'fly', id: 'asteroidrun', t: 40, eyebrow: 'World 3 · No-Fly Zones', color: W3, title: 'Weave through<br>asteroid fields', sub: 'Every turn costs fuel' },
  { kind: 'fly', id: 'widdershins', t: 120, eyebrow: 'World 4 · Pulsar', color: W4, title: 'Turn against<br>the sweep', sub: 'Radiation beams, storms and belts' },
  { kind: 'menu', eyebrow: 'From first launch to grand tours', color: MINT, title: '124 missions,<br>five worlds', sub: 'Training teaches you as you fly' },
  { kind: 'result', id: 'satellite', eyebrow: 'Fuel is your score', color: GOLD, title: 'Earn three stars', sub: 'Then race other pilots' },
];
const SHOT_SIZES = [{ name: 'iphone63', w: 1206, h: 2622 }, { name: 'iphone61', w: 1179, h: 2556 }];

// Preview: [mission, from, to (sim s), video seconds, caption].
const PREVIEW = [
  ['satellite', 0, 40, 4.5, 'Launch on real orbital physics'],
  ['nofly', 25, 75, 4, 'See your path before you burn'],
  ['asteroidrun', 22, 52, 4, 'Weave through asteroid fields'],
  ['granddeploy', 115, 175, 4, 'Deploy satellites, drop stages'],
  ['beacon', 2, 140, 5, 'Hide from the pulsar’s beam'],
  ['widdershins', 5, 200, 4.5, 'Outrun the radiation'],
];

const HEADERS = [
  { file: 'header-5244x2950.png', w: 5244, h: 2950, vp: [874, 492], dpr: 6, scene: { id: 'beacon', t: 62 } },
  { file: 'header-3840x1646.png', w: 3840, h: 1646, vp: [960, 412], dpr: 4, scene: { id: 'beacon', t: 62 } },
  { file: 'header-alt-5244x2950.png', w: 5244, h: 2950, vp: [874, 492], dpr: 6, scene: { id: 'apollo', t: 20, burn: 300 } },
  { file: 'header-alt-3840x1646.png', w: 3840, h: 1646, vp: [960, 412], dpr: 4, scene: { id: 'apollo', t: 20, burn: 300 } },
];

// Some progress so the menu looks lived in (as tools/store/make.js).
function progress() {
  const { LEVELS } = require('../../js/levels.js');
  const stars = {}; let unlocked = 0;
  LEVELS.forEach((L, i) => {
    if (L.test) return;
    if (!L.world || L.world <= 2) { stars[L.id] = [3, 3, 2, 3, 1][i % 5]; unlocked = i; }
    else if (L.world === 3 && i % 3) { stars[L.id] = [3, 2][i % 2]; unlocked = i; }
  });
  return { unlocked: unlocked + 1, stars, best: {}, score: {} };
}

const fontCss = () => fs.readFileSync(path.join(ROOT, 'fonts/fonts.css'), 'utf8').replace(/url\(([^)]+)\)/g, (m, u) =>
  `url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'fonts', u.replace(/['"]/g, ''))).toString('base64')})`);
const b64 = (f) => fs.readFileSync(f).toString('base64');

// One screenshot page at w×h (designed at 1206 wide; k scales it).
function shotPage(s, w, h, hero, phone) {
  const k = w / 1206, px = (v) => Math.round(v * k) + 'px';
  const pw = 1206 - 2 * 64, ph = Math.round(pw * 1206 / 2622);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: #05060d; font-family: "Exo 2", system-ui, sans-serif; color: #dfe6ff; }
  .hero { position: absolute; inset: 0; background: url(data:image/png;base64,${b64(hero)}) center / cover; }
  .shade { position: absolute; inset: 0; background:
    linear-gradient(180deg, rgba(5,6,13,.96) 0%, rgba(5,6,13,.82) 22%, rgba(5,6,13,0) 40%),
    linear-gradient(0deg, rgba(5,6,13,.9) 0%, rgba(5,6,13,0) ${phone ? 34 : 14}%); }
  .copy { position: absolute; left: ${px(84)}; right: ${px(84)}; top: ${px(150)}; }
  .eb { display: inline-block; font: 400 ${px(34)} "JetBrains Mono", monospace; letter-spacing: .14em; text-transform: uppercase; color: ${s.color}; }
  .eb::before { content: ''; display: inline-block; width: ${px(14)}; height: ${px(14)}; border-radius: 50%; background: ${s.color}; box-shadow: 0 0 ${px(18)} ${s.color}; margin-right: ${px(18)}; vertical-align: ${px(4)}; }
  h1 { margin: ${px(26)} 0 0; font-weight: 800; font-size: ${px(128)}; line-height: .98; letter-spacing: -.005em;
    background: linear-gradient(180deg, #fff 0%, #dbe6ff 60%, #a9bcff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { margin-top: ${px(28)}; font-size: ${px(46)}; line-height: 1.3; color: #c4cdee; }
  .phone { position: absolute; left: ${px(64)}; bottom: ${px(120)}; width: ${px(pw)}; height: ${px(ph)}; border-radius: ${px(64)}; background: #0b0d16;
    padding: ${px(16)}; box-sizing: border-box; box-shadow: 0 0 0 ${px(3)} rgba(150,180,255,.28), 0 ${px(40)} ${px(120)} rgba(0,0,0,.8), 0 0 ${px(140)} rgba(124,247,212,.12); }
  .phone img { width: 100%; height: 100%; display: block; border-radius: ${px(50)}; object-fit: cover; }
  .tag { position: absolute; left: 0; right: 0; bottom: ${px(52)}; text-align: center; font: 400 ${px(26)} "JetBrains Mono", monospace; letter-spacing: .16em; text-transform: uppercase; color: #8592b8; }
  </style></head><body><div class="hero"></div><div class="shade"></div>
  <div class="copy"><div class="eb">${s.eyebrow}</div><h1>${s.title}</h1><div class="sub">${s.sub}</div></div>
  <script>{ const h = document.querySelector('h1'); h.style.whiteSpace = 'nowrap'; let z = parseFloat(getComputedStyle(h).fontSize);
    while (h.scrollWidth > h.clientWidth && z > 60) h.style.fontSize = (z -= 2) + 'px'; }</script>
  ${phone ? `<div class="phone"><img src="data:image/png;base64,${b64(phone)}"></div><div class="tag">As you play it on iPhone</div>` : ''}
  </body></html>`;
}

async function shots(out, tmp) {
  // Tall views of each moment, and the real iPhone screen of the same moment.
  cap.DEVICES.tall = { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 };
  const raw = {};
  for (const dev of ['tall', 'iphone63']) {
    const { page, errors, close } = await cap.open(dev, { progress: progress() });
    await cap.setup(page);
    if (dev === 'tall') await page.addStyleTag({ content: HIDE_HUD });
    for (const [i, s] of SHOTS.entries()) {
      if (dev === 'iphone63' && s.kind !== 'fly') continue;
      const file = path.join(tmp, `${dev}-${i}.png`);
      if (s.kind === 'fly') await cap.shot(page, s.id, s.t, 0, file, s.burn);
      else if (s.kind === 'menu') {
        await page.evaluate(() => window.Thrusterz.showMenu());
        // The headline sits where the menu's own logo is.
        await page.addStyleTag({ content: '#menu-top, #menu .brand, #menu .logo, #menu .tagline { visibility: hidden; }' });
        await page.waitForTimeout(700);
        await page.screenshot({ path: file });
      } else {
        await page.addStyleTag({ content: '#hud { display: block !important; }' });
        await page.evaluate((id) => window.__stage(id, 1e6, 0), s.id);
        await page.waitForTimeout(3500);
        // The autopilot's run isn't a recorded one, so leave out the leaderboard line.
        await page.evaluate(() => { const e = document.getElementById('res-online'); if (e) e.style.display = 'none'; });
        await page.screenshot({ path: file });
      }
      (raw[i] = raw[i] || {})[dev] = file;
    }
    if (errors.length) console.log(dev, 'page errors:', errors.slice(0, 3));
    await close();
  }
  const browser = await playwright.chromium.launch();
  for (const S of SHOT_SIZES) {
    const p = await browser.newPage({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: 1 });
    for (const [i, s] of SHOTS.entries()) {
      await p.setContent(shotPage(s, S.w, S.h, raw[i].tall, raw[i].iphone63));
      await p.evaluate(() => document.fonts.ready);
      const file = path.join(out, `screenshot-${S.name}-${S.w}x${S.h}-${String(i + 1).padStart(2, '0')}.png`);
      await p.screenshot({ path: file });
      console.log(file);
    }
    await p.close();
  }
  await browser.close();
}

async function preview(out, tmp) {
  const FPS = 30;
  cap.DEVICES.pv = { viewport: { width: 443, height: 960 }, deviceScaleFactor: 2 };
  const { page, close } = await cap.open('pv');
  await cap.setup(page);
  await page.addStyleTag({ content: HIDE_HUD + `
    #pv-cap { position: fixed; left: 0; right: 0; top: 0; padding: 70px 34px 90px; font: 800 38px/1.08 "Exo 2", sans-serif; color: #dfe6ff;
      background: linear-gradient(rgba(5,6,13,.9), rgba(5,6,13,0)); z-index: 99; pointer-events: none; }` });
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'pv-cap'; document.body.appendChild(d); });
  const dir = path.join(tmp, 'pv');
  fs.mkdirSync(dir);
  let f = 0;
  for (const [id, from, to, secs, caption] of PREVIEW) {
    await page.evaluate((c) => { document.getElementById('pv-cap').textContent = c; }, caption);
    const n = Math.round(secs * FPS);
    for (let j = 0; j < n; j++) {
      const t = from + (to - from) * j / (n - 1);
      const burning = await page.evaluate(([id, t]) => { window.__stage(id, t, 0); return !!window.Thrusterz.state.mission.__thrust; }, [id, t]);
      if (burning) await page.keyboard.down('Space');
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({ path: path.join(dir, `f${String(f++).padStart(5, '0')}.png`) });
      if (burning) await page.keyboard.up('Space');
    }
    console.log('preview', id);
  }
  await close();
  const file = path.join(out, 'preview-886x1920.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf', 'scale=886:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-r', String(FPS),
    '-b:v', '10M', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', file]);
  console.log(file);
}

async function header(out, tmp) {
  for (const a of HEADERS) {
    cap.DEVICES.art = { viewport: { width: a.vp[0], height: a.vp[1] }, deviceScaleFactor: a.dpr };
    const { page, close } = await cap.open('art');
    await cap.setup(page);
    await page.addStyleTag({ content: HIDE_HUD });
    const raw = path.join(tmp, 'header.png');
    await cap.shot(page, a.scene.id, a.scene.t, 0, raw, a.scene.burn);
    await close();
    // Exact size, plus a soft darkening at the lower left where the App Store sets the name.
    const browser = await playwright.chromium.launch();
    const p = await browser.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:#05060d;overflow:hidden">
      <div style="position:absolute;inset:0;background:url(data:image/png;base64,${b64(raw)}) center / cover"></div>
      <div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 0% 100%, rgba(5,6,13,.75), rgba(5,6,13,0) 55%)"></div></body>`);
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(out, a.file) });
    await browser.close();
    console.log(path.join(out, a.file));
  }
}

if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const oi = argv.indexOf('--out');
    const out = path.resolve(oi >= 0 ? argv.splice(oi, 2)[1] : path.join(ROOT, 'store/vertical'));
    const what = argv.length ? argv : ['shots', 'header', 'preview'];
    fs.mkdirSync(out, { recursive: true });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));
    for (const w of what) await ({ shots, preview, header })[w](out, tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
  })();
}
