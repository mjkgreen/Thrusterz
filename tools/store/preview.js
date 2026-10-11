// App Store app previews: the game itself flying scripted proofs, recorded
// frame by frame on a virtual clock (smooth 30 fps whatever the machine),
// then encoded with ffmpeg.
//   node tools/store/preview.js [outDir] [iphone|ipad]   (default store/previews, both)
// Writes preview-iphone.mp4 (1920×886) and preview-ipad.mp4 (1600×1200):
// H.264, 30 fps, under 30 s, with a silent stereo track.
'use strict';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FPS = 30;
const DEVICES = {
  iphone: { viewport: { width: 960, height: 443 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, out: [1920, 886] },
  ipad: { viewport: { width: 1100, height: 825 }, deviceScaleFactor: 1600 / 1100, isMobile: true, hasTouch: true, out: [1600, 1200] },
};
// Each segment: a mission's proof from sim time `from` to `to` at a warp
// (index into 1, 2, 5, 10, 25…), then `hold` seconds more (e.g. the win screen).
const SEGMENTS = [
  { id: 'satellite', from: 0, to: 14, warp: 1, caption: 'Launch on real orbital physics' },
  { id: 'asteroidrun', from: 40, to: 75, warp: 2, caption: 'Weave through asteroid fields' },
  { id: 'test-wormhole', from: 70, to: 104, warp: 2, caption: 'Bend the rules' },
  { id: 'apollo', from: 386, to: 420, warp: 2, hold: 2.2, caption: 'Land on the Moon' },
];

// Before the game loads: a clock and animation frames we advance by hand.
function virtualClock() {
  let vt = 0, cbs = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (f) => { cbs.push(f); return cbs.length; };
  window.cancelAnimationFrame = () => {};
  window.__frame = (ms) => { vt += ms; const q = cbs; cbs = []; for (const f of q) f(vt); };
  try { localStorage.setItem('thrusterz.welcomed', '1'); } catch (e) { /* ignore */ }
}

// In the page: CommonJS loader for the autopilot and proofs (as capture.js),
// plus a generator version of AP.fly that yields after every physics step.
function installLoader() {
  const globals = { 'js/levels.js': 'Levels', 'js/flight.js': 'Flight', 'js/physics.js': 'Phys', 'js/dmath.js': 'DMath', 'js/replay.js': 'Replay' };
  const cache = {};
  const resolve = (from, p) => {
    const parts = from.split('/').slice(0, -1);
    for (const s of p.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); }
    const f = parts.join('/');
    return f.endsWith('.js') ? f : f + '.js';
  };
  const load = (file) => {
    for (const k in globals) if (file.endsWith(k)) return window[globals[k]];
    if (cache[file]) return cache[file].exports;
    const x = new XMLHttpRequest(); x.open('GET', '/' + file, false); x.send();
    let src = x.responseText;
    if (file.endsWith('tools/autopilot.js')) {
      const a = src.indexOf('function fly('), b = src.indexOf('\nmodule.exports');
      const gen = src.slice(a, b).replace('function fly(', 'function* flyGen(')
        .replace('const m = new Mission(level);', 'const m = new Mission(level); yield m;')
        .replace('m.advance(dt, { thrust, throttle: 1, rotate: rot });', 'm.__adv(dt, { thrust, throttle: 1, rotate: rot }); yield m;');
      src += '\n' + gen + '\nmodule.exports.flyGen = flyGen;';
    }
    const module = { exports: {} }; cache[file] = module;
    new Function('module', 'exports', 'require', src)(module, module.exports, (p) => load(resolve(file, p)));
    return module.exports;
  };
  window.__AP = load('tools/autopilot.js');
  window.__PROOFS = load('tools/proofs.js');
  const Mission = window.Flight.Mission;
  Mission.prototype.__adv = Mission.prototype.advance;
  const style = document.createElement('style');
  // No coaching hints, and no leaderboard line on the result (the autopilot's
  // flight isn't a recorded run, so it would say it couldn't be verified).
  style.textContent = `#coach, #res-online { display: none !important; }
    #pv-cap { position: fixed; left: 50%; top: 24%; transform: translateX(-50%); z-index: 50; pointer-events: none;
      font: 800 28px "Exo 2", system-ui, sans-serif; color: #fff; letter-spacing: 0.01em; white-space: nowrap;
      padding: 10px 22px; border-radius: 999px; background: rgba(5, 6, 13, 0.62); border: 1px solid rgba(124, 247, 212, 0.35);
      opacity: 0; transition: none; }`;
  document.head.appendChild(style);
  const cap = document.createElement('div'); cap.id = 'pv-cap'; document.body.appendChild(cap);
}

// In the page: start a segment. The game's own loop then drives the flight:
// each tick it asks the mission to advance, and the mission pulls proof steps.
function startSegment(seg) {
  const T = window.Thrusterz, S = T.state, AP = window.__AP, P = window.__PROOFS[seg.id];
  const { LEVELS } = window.Levels;
  const i = LEVELS.findIndex(L => L.id === seg.id);
  T.startLevel(i);
  ['gate', 'help', 'pause', 'result'].forEach(x => document.getElementById(x).classList.add('hidden'));
  const gen = AP.flyGen(LEVELS[i], P.script(P.p, AP), P.opts || {});
  const m = gen.next().value;
  const trail = [];
  const step = () => {
    const r = gen.next();
    const last = trail[trail.length - 1];
    if (!last || m.t - last.t > 0.2) trail.push({ t: m.t, x: m.ship.x, y: m.ship.y });
    return !r.done;
  };
  while (m.t < seg.from && m.status === 'flying' && step()) { /* fast-forward */ }
  // Proof steps can be longer than a game tick (coasting), so pace them
  // against a clock of our own: an overshoot is made up, never compounded.
  let clock = m.t;
  m.advance = function (dt) {
    clock += dt;
    while (this.t < clock - 1e-9 && this.status === 'flying' && step()) { /* proof steps */ }
  };
  S.mission = m; S.trail = trail.slice(-1500); S.predDirty = true; S.warp = seg.warp;
  S.eventsSeen = m.events.length; S.paused = false; S.endHandled = false; S.resultShown = false;
  return m.t;
}

async function record(device, outDir) {
  const D = DEVICES[device];
  const frames = path.join(outDir, 'frames-' + device);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const server = require('../dev-server.js');
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: D.viewport, deviceScaleFactor: D.deviceScaleFactor, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(virtualClock);
  await page.goto('http://127.0.0.1:' + server.address().port + '/index.html?unlock');
  for (let k = 0; k < 20; k++) await page.evaluate(() => window.__frame(16));
  await page.evaluate(installLoader);
  await page.evaluate(`window.__startSegment = ${startSegment.toString()}`);
  let n = 0;
  const dt = 1000 / FPS;
  for (const seg of SEGMENTS) {
    await page.evaluate((seg) => window.__startSegment(seg), seg);
    const warpX = [1, 2, 5, 10, 25, 50, 100][seg.warp];
    const frames0 = Math.round((seg.to - seg.from) / warpX * FPS), total = frames0 + Math.round((seg.hold || 0) * FPS);
    for (let f = 0; f < total; f++) {
      // The caption fades in for the first 2.2 s of the segment.
      const a = f < 6 ? f / 6 : f < 60 ? 1 : f < 72 ? 1 - (f - 60) / 12 : 0;
      await page.evaluate(([ms, cap, a]) => { const c = document.getElementById('pv-cap'); c.textContent = cap; c.style.opacity = a; window.__frame(ms); }, [dt, seg.caption, a]);
      await page.screenshot({ path: path.join(frames, String(n++).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    }
    console.log(device, seg.id, 'frames', total);
  }
  if (errors.length) console.log('page errors:', errors.slice(0, 3));
  await browser.close(); server.close();
  const out = path.join(outDir, `preview-${device}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf', `scale=${D.out[0]}:${D.out[1]}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
    '-preset', 'slow', '-crf', '16', '-r', String(FPS), '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out]);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log(out, (n / FPS).toFixed(1) + ' s');
}

if (require.main === module) {
  (async () => {
    const out = path.resolve(process.argv[2] || path.join(__dirname, '../../store/previews'));
    fs.mkdirSync(out, { recursive: true });
    for (const d of process.argv[3] ? [process.argv[3]] : ['iphone', 'ipad']) await record(d, out);
  })();
}
