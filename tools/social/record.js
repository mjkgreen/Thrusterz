// Records a vertical (1080×1920) reel of real gameplay: the game itself, in a
// browser, flying a mission's scripted proof (tools/proofs.js). Burns play at
// real speed; coasts speed up so the whole flight fits the target length.
// A hook line sits over the opening, and an end card closes the clip.
//   node tools/social/record.js <levelId> <out.mp4> [--hook "text"] [--seconds 24]
//        [--end "Play free · thrusterz.com"] [--keep-frames]
// Also writes <out>.jpg, a cover frame taken mid-flight.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const cap = require('../store/capture.js');

const FPS = 30;
// Upright and not a phone, so the game doesn't turn itself sideways.
cap.DEVICES.reel = { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5 };

function args() {
  const a = process.argv.slice(2), o = { seconds: 24, end: 'Play free · thrusterz.com' };
  o.id = a.shift(); o.out = a.shift();
  while (a.length) {
    const k = a.shift();
    if (k === '--hook') o.hook = a.shift();
    else if (k === '--seconds') o.seconds = +a.shift();
    else if (k === '--end') o.end = a.shift();
    else if (k === '--keep-frames') o.keep = true;
    else if (k === '--preview') o.preview = +a.shift();   // contact sheet of every Nth frame, no video
  }
  if (!o.id || !o.out) { console.error('usage: record.js <levelId> <out.mp4> [--hook text] [--seconds n]'); process.exit(1); }
  return o;
}

// In the page: fly the whole proof once and note when the engine fires.
function timeline(id) {
  const AP = window.__AP, P = window.__PROOFS[id];
  const { LEVELS } = window.Levels;
  const L = LEVELS.find(x => x.id === id);
  const burns = [];
  const Mission = window.Flight.Mission, adv = Mission.prototype.advance;
  Mission.prototype.advance = function (dt, c) {
    const t0 = this.t;
    adv.call(this, dt, c);
    if (this.thrusting || (c && c.rotate)) {
      const last = burns[burns.length - 1];
      if (last && t0 - last[1] < 0.5) last[1] = this.t; else burns.push([t0, this.t]);
    }
  };
  let r;
  try { r = AP.fly(L, P.script(P.p, AP), P.opts || {}); } finally { Mission.prototype.advance = adv; }
  const events = (r.m.events || []).filter(e => e.type === 'goal' || e.type === 'deploy' || e.type === 'drop' || e.type === 'pickup').map(e => e.t);
  return { burns, events, tEnd: r.m.t, status: r.m.status, name: L.name };
}

// Sim time at each video frame. Busy moments (burns, goals) play at 1×;
// the rest at a speed chosen so the flight lasts about `seconds`.
function pace(tl, seconds) {
  const busy = tl.burns.map(([a, b]) => [a - 0.6, b + 0.6]).concat(tl.events.map(t => [t - 1, t + 1]));
  const isBusy = (t) => busy.some(([a, b]) => t >= a && t <= b);
  const step = 0.05, n = Math.ceil(tl.tEnd / step);
  let busyT = 0;
  for (let i = 0; i < n; i++) if (isBusy(i * step)) busyT += step;
  const flight = Math.max(4, seconds - 3.5);   // leave room for the end card
  // Busy time at 1× (but squeezed if it alone overruns), coasts at speed s.
  const busyRate = Math.max(1, busyT / (flight * 0.6));
  const s = Math.min(400, Math.max(1, (tl.tEnd - busyT) / Math.max(0.5, flight - busyT / busyRate)));
  const times = [];
  let t = 1e-3, v = 1;   // not 0: stage() reads tMax 0 as "fly it all"
  while (t < tl.tEnd) {
    times.push(t);
    const want = isBusy(t) ? busyRate : s;
    v = v + (want - v) * (want > v ? 0.08 : 0.35);  // ease up slowly, brake fast
    t += v / FPS;
  }
  times.push(tl.tEnd);
  return { times, speed: s };
}

// In the page: hide what doesn't belong in a reel and add the overlay layer.
function dress(hook) {
  const st = document.createElement('style');
  st.textContent = `
    /* Only what tells the story: fuel, stage, cargo, orbit, time and warp. */
    #topbtns, #toast, .gauge.throttle, #gyro-row, #clock > div:nth-child(3) { display: none !important; }
    #reel-hook { position: fixed; left: 24px; right: 24px; top: 19%; z-index: 99; text-align: center;
      font: 800 30px/1.15 var(--sans); color: #fff; letter-spacing: 0.01em;
      text-shadow: 0 2px 14px rgba(0,0,0,.9), 0 0 2px #000; transition: opacity .3s; }
    #reel-hook b { color: #7cf7d4; }
    #reel-end { position: fixed; inset: 0; z-index: 100; display: none; flex-direction: column; align-items: center;
      justify-content: center; gap: 18px; background: rgba(6,10,20,.82); color: #fff; text-align: center; }
    #reel-end .logo { font: 900 52px/1 var(--sans); letter-spacing: .04em; }
    #reel-end .logo span { color: #7cf7d4; }
    #reel-end .tag { font: 600 20px/1.3 var(--sans); color: #cfd8e8; max-width: 320px; }
    #reel-end .cta { font: 700 18px/1 var(--mono); color: #0b1020; background: #7cf7d4; padding: 12px 18px; border-radius: 12px; }`;
  document.head.appendChild(st);
  const h = document.createElement('div'); h.id = 'reel-hook'; h.innerHTML = hook || ''; document.body.appendChild(h);
  const e = document.createElement('div'); e.id = 'reel-end';
  e.innerHTML = '<div class="logo">THRUSTER<span>Z</span></div><div class="tag">Real orbital mechanics. One tank of fuel.</div><div class="cta"></div>';
  document.body.appendChild(e);
}

// In the page: a camera operator. Follows the ship and zooms so the body that
// matters right now (the current goal's body, else the one the ship is
// falling around) stays in shot, eased from frame to frame. The game's own
// camera only moves while unpaused, and each frame is staged from scratch.
function direct(first) {
  const T = window.Thrusterz, S = T.state, m = S.mission, sys = m.sys, s = m.ship;
  const W = innerWidth, H = innerHeight;
  sys.update(m.t);
  const g = m.currentGoal && m.currentGoal();
  let fi = g && g.body && sys.byId[g.body] ? sys.byId[g.body].index : -1;
  const dom = sys.dominant(s.x, s.y, m.t);
  const far = (i) => Math.hypot(sys.px[i] - s.x, sys.py[i] - s.y);
  // A goal across the solar system would shrink the ship to a dot: frame the
  // local body instead until the goal is close.
  if (fi < 0 || (dom !== fi && far(fi) > 6 * far(dom) + 400)) fi = dom;
  const fx = sys.px[fi], fy = sys.py[fi], fr = sys.bodies[fi].radius || 0;
  const d = Math.hypot(fx - s.x, fy - s.y);
  const span = Math.min(W * 0.86, H * 0.5);       // the clear band between the HUD panels
  const close = Math.min(W, H) / 420 * 1.6, wide = Math.min(W, H) / m.level.view.span * 0.6;
  const want = Math.max(wide, Math.min(close, span / (2 * Math.max(d * 0.62 + fr * 1.15, 60))));
  // Centre between the ship and the body, nudged toward the ship.
  const cx = s.x + (fx - s.x) * 0.42, cy = s.y + (fy - s.y) * 0.42;
  const P = window.__dir = first || !window.__dir ? { x: cx, y: cy, z: want } : window.__dir;
  P.z = Math.exp(Math.log(P.z) + (Math.log(want) - Math.log(P.z)) * 0.1);
  P.x += (cx - P.x) * 0.18; P.y += (cy - P.y) * 0.18;
  const c = S.cam;
  c.follow = false; c.zoom = c.tzoom = P.z;
  // The scene's clear band sits a little above mid-screen.
  c.x = c.tx = P.x; c.y = c.ty = P.y - (H * 0.04) / P.z;
  S.predDirty = true;
}

async function nextFrames(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function record(o) {
  const { page, errors, close } = await cap.open('reel');
  try {
    await cap.setup(page);
    const tl = await page.evaluate(timeline, o.id);
    if (tl.status !== 'won') throw new Error(o.id + ': proof did not win (' + tl.status + ')');
    const { times, speed } = pace(tl, o.seconds);
    await page.evaluate(dress, o.hook);
    await page.evaluate(`window.__direct = ${direct.toString()}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
    const WARPS = [1, 2, 5, 10, 25, 50, 100];
    let f = 0;
    const shoot = async () => page.screenshot({ path: path.join(dir, String(f++).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 94 });
    for (let i = 0; i < times.length; i++) {
      const sp = i ? (times[i] - times[i - 1]) * FPS : 1;
      const w = WARPS.reduce((b, x, k) => Math.abs(Math.log(x / sp)) < Math.abs(Math.log(WARPS[b] / sp)) ? k : b, 0);
      await page.evaluate(([id, t, w, fade, first]) => {
        window.__stage(id, t, w);
        const S = window.Thrusterz.state; S.paused = true;
        window.__direct(first);
        window.Thrusterz.refreshHud();
        document.getElementById('reel-hook').style.opacity = fade;
      }, [o.id, times[i], w, i / FPS < 3.2 ? 1 : 0, i === 0]);
      if (o.preview && i % o.preview) continue;
      await nextFrames(page);
      await shoot();
      if (i === Math.floor(times.length * 0.55)) await page.screenshot({ path: o.out.replace(/\.mp4$/, '') + '.jpg', type: 'jpeg', quality: 90 });
    }
    if (o.preview) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(dir, '*.jpg'), '-vf', 'scale=216:384,tile=8x' + Math.ceil(f / 8), '-frames:v', '1', o.out.replace(/\.mp4$/, '') + '-sheet.jpg']);
      fs.rmSync(dir, { recursive: true, force: true });
      return { sheet: o.out.replace(/\.mp4$/, '') + '-sheet.jpg', frames: f };
    }
    // Hold the finish for a beat, then the end card.
    for (let k = 0; k < FPS * 0.8; k++) await shoot();
    await page.evaluate((end) => { const e = document.getElementById('reel-end'); e.style.display = 'flex'; e.querySelector('.cta').textContent = end; }, o.end);
    await nextFrames(page);
    for (let k = 0; k < FPS * 2.5; k++) await shoot();
    fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
      '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '19',
      '-preset', 'medium', '-movflags', '+faststart', '-r', String(FPS), o.out]);
    if (!o.keep) fs.rmSync(dir, { recursive: true, force: true });
    const info = { level: o.id, name: tl.name, file: o.out, frames: f, seconds: +(f / FPS).toFixed(1), coastSpeed: +speed.toFixed(1), simTime: +tl.tEnd.toFixed(0) };
    if (errors.length) info.pageErrors = errors.slice(0, 5);
    return info;
  } finally { await close(); }
}

module.exports = { record };

if (require.main === module) record(args()).then(i => console.log(JSON.stringify(i))).catch(e => { console.error(e); process.exit(1); });
