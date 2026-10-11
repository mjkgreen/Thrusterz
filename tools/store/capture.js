// Renders real game frames for the App Store: flies a mission's scripted
// proof (tools/proofs.js) in the page up to a chosen moment, hands that state
// to the game and screenshots it at a device's exact pixel size.
//   node tools/store/capture.js <outDir> [device] [levelId:t[:warp] ...]
// device: iphone63 (2622×1206, 6.3", the required iPhone size), iphone
// (2868×1320, 6.9") or ipad (2752×2064, 13"). Used by
// tools/store/make.js; on its own it writes raw frames for picking moments.
'use strict';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const fs = require('fs');
const path = require('path');

const DEVICES = {
  iphone63: { viewport: { width: 874, height: 402 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  iphone: { viewport: { width: 956, height: 440 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  // A slightly smaller page drawn at a higher density, so the game isn't
  // zoomed out to specks on the big screen (still exactly 2752×2064).
  ipad: { viewport: { width: 1100, height: 825 }, deviceScaleFactor: 2752 / 1100, isMobile: true, hasTouch: true },
};

// In the page: a tiny CommonJS loader so tools/autopilot.js and the proofs run
// against the game's own Flight/Levels/Phys objects.
function installLoader() {
  const globals = { 'js/levels.js': 'Levels', 'js/flight.js': 'Flight', 'js/physics.js': 'Phys', 'js/dmath.js': 'DMath', 'js/replay.js': 'Replay' };
  const cache = {};
  const resolve = (from, p) => {
    const parts = from.split('/').slice(0, -1);
    for (const s of p.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); }
    let f = parts.join('/');
    if (!f.endsWith('.js')) f += '.js';
    return f;
  };
  const load = (file) => {
    for (const k in globals) if (file.endsWith(k)) return window[globals[k]];
    if (cache[file]) return cache[file].exports;
    const x = new XMLHttpRequest(); x.open('GET', '/' + file, false); x.send();
    const module = { exports: {} }; cache[file] = module;
    new Function('module', 'exports', 'require', x.responseText)(module, module.exports, (p) => load(resolve(file, p)));
    return module.exports;
  };
  window.__AP = load('tools/autopilot.js');
  window.__PROOFS = load('tools/proofs.js');
}

// In the page: fly level `id` to sim time t, recording the trail, and show it.
function stage(id, t, warp, opts) {
  const T = window.Thrusterz, S = T.state, AP = window.__AP, P = window.__PROOFS[id];
  const { LEVELS } = window.Levels;
  const i = LEVELS.findIndex(L => L.id === id);
  T.startLevel(i);
  ['gate', 'coach', 'welcome', 'help'].forEach(x => { const e = document.getElementById(x); if (e) e.classList.add('hidden'); });
  const trail = [];
  const Mission = window.Flight.Mission, adv = Mission.prototype.advance;
  Mission.prototype.advance = function (dt, c) {
    adv.call(this, dt, c);
    const last = trail[trail.length - 1];
    if (!last || this.t - last.t > 0.2) trail.push({ t: this.t, x: this.ship.x, y: this.ship.y });
    this.__thrust = c && c.thrust; this.__rot = c && c.rotate;
  };
  let r;
  try { r = AP.fly(LEVELS[i], P.script(P.p, AP), Object.assign({}, P.opts, { tMax: t })); }
  finally { Mission.prototype.advance = adv; }
  const m = r.m;
  S.mission = m; S.trail = trail.slice(-1500); S.predDirty = true; S.warp = warp || 0;
  S.eventsSeen = m.events ? m.events.length : 0;
  if (opts && opts.thrust) S.forceThrust = true;
  return { t: m.t, status: m.status, goal: m.goalIndex };
}

async function open(device, opts) {
  opts = opts || {};
  const server = require('../dev-server.js');
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage(Object.assign({}, DEVICES[device]));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // A returning pilot with a name: no welcome prompt.
  await page.addInitScript((progress) => {
    try {
      localStorage.setItem('thrusterz.welcomed', '1');
      if (progress) localStorage.setItem('thrusterz.progress.v1', progress);
    } catch (e) { /* ignore */ }
  }, opts.progress ? JSON.stringify(opts.progress) : null);
  await page.goto('http://127.0.0.1:' + server.address().port + '/index.html?unlock');
  await page.waitForTimeout(400);
  await page.evaluate(installLoader);
  const close = async () => { await browser.close(); server.close(); };
  return { page, errors, close };
}

// burn: hold the engine for the frame so the flame shows.
async function shot(page, id, t, warp, file, burn) {
  const info = await page.evaluate(([id, t, warp]) => window.__stage(id, t, warp), [id, t, warp]);
  await page.waitForTimeout(250);
  if (burn) { await page.keyboard.down('Space'); await page.waitForTimeout(burn); }
  await page.screenshot({ path: file });
  if (burn) await page.keyboard.up('Space');
  return info;
}

async function setup(page) { await page.evaluate(`window.__stage = ${stage.toString()}`); }

module.exports = { open, setup, shot, DEVICES };

if (require.main === module) {
  (async () => {
    const [out, device = 'iphone', ...specs] = process.argv.slice(2);
    fs.mkdirSync(out, { recursive: true });
    const { page, errors, close } = await open(device);
    await setup(page);
    for (const s of specs) {
      const [id, t, warp, burn] = s.split(':');
      const file = path.join(out, `${device}-${id}-${t}${burn ? '-b' : ''}.png`);
      const info = await shot(page, id, +t, +(warp || 0), file, +(burn || 0));
      console.log(file, JSON.stringify(info));
    }
    if (errors.length) console.log('page errors:', errors.slice(0, 5));
    await close();
  })();
}
