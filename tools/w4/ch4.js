// World 4 · Chapter 4 · Deep Gravity: neutron stars and black holes (strong
// gravity, `pw`, and event horizons) combined with radiation and the toolbox.
'use strict';
const { ship, C } = require('../../js/levels.js');
const Phys = require('../../js/physics.js');

const NEUTRON = '#e4dcff';

// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };
// Speed relative to a body.
const speed = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.vx - m.sys.vx[i], s.vy - m.sys.vy[i]); };

// Energy about a strong-gravity body (its pull is gm / (r - pw)²): above
// zero you are on your way out for good.
const pwEnergy = (m, id) => { const b = m.sys.byId[id]; const r = dist(m, id), v = speed(m, id); return v * v / 2 - b.gm / (r - (b.pw || 0)); };

// Tor: a planet whose day matches a 70 k orbit, so a ship there hangs over
// one spot (geostationary).
// Kern Watch: the strong-gravity circular rate at 900 k, and where and when
// a good whirl meets the gate (it passes HS_LAG s later).
const HS_N = Math.sqrt(40000 * 900) / (870 * 900), HS_GATE_ANG = Math.atan2(-822, 366), HS_T = 353, HS_LAG = 10;
// Slingshot Drop: Vigil Station's rate at 560 k, and where and when a good
// capture tops out (it gets there SD_LAG s after you).
const SD_N = Math.sqrt(40000 * 460) / (435 * 460), SD_ANG = -1.81, SD_T = 125, SD_LAG = 10;
// Retro Whirl: where and when a good return passes closest to Halo.
const RW_ANG = 3.0, RW_MEET = 590;


const HF_BACK = -Math.PI / 2;
const TOR_GM = 2000, GEO = 70, TOR_SPIN = Math.sqrt(TOR_GM / (GEO * GEO * GEO));

const levels = [
  {
    id: 'heavystar',
    name: 'Heavy Star',
    intro: 'Kern is a neutron star: no bigger than a moon, but so dense that close in it pulls far harder than any planet. Inside the dashed ring (about 90 k) no orbit is stable, and a pass that dips in there whips you round much further than half a turn. Brake a little at the top of your orbit and watch the dashed path swing round toward the gate as your low point drops; Ash crosses your orbit soon, so don\'t wait around. Kern Watch comes up behind you at the gate, much faster than you: burn toward its marker as it closes and match its speed.',
    objective: 'Whirl round Kern through the gate, then rendezvous with Kern Watch (within 12 k, relative speed under 0.5 k/s).',
    teaches: 'Neutron stars · whirling round',
    bodies: [
      { id: 'kern', name: 'Kern', gm: 40000, radius: 12, pw: 30, color: NEUTRON, kind: 'pulsar' },
      { id: 'ash', name: 'Ash', gm: 60, radius: 18, color: C.rock, orbit: { parent: 'kern', a: 480, phase: -2.35 } },
      // On the true circular orbit at 900 k (strong gravity: a little faster
      // than a plain orbit), the same way round as you, passing the gate HS_LAG s after you.
      { id: 'watch', name: 'Kern Watch', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'kern', a: 900, n: HS_N, phase: HS_GATE_ANG - HS_N * (HS_T + HS_LAG) } },
    ],
    ship: ship({ start: { orbit: { body: 'kern', r: 900, angle: Math.PI, speed: 0.69 } }, heading: 'retrograde', dv: 5.2, accel: 1 }),
    goals: [
      { type: 'reach', x: 366, y: -822, r: 45, label: 'the gate' },
      { type: 'rendezvous', body: 'watch', dist: 12, relVel: 0.5 },
    ],
    par: 4.4, bounds: 4000, tMax: 900, predict: 400, view: { x: 0, y: -100, span: 2200 },
  },
  {
    id: 'needledive',
    name: 'Needle Dive',
    intro: 'You are parked in a geostationary orbit over Tor\'s far side, and the pulsar Spindle turns once in Tor\'s day, so its beams and its moon Wisp are in the same place on every lap: any lap will do. Leave a little before Tor\'s inner side, burning forward until the dashed path dives at Spindle. On the way down, brake until the plunge probe\'s release preview spirals into Spindle, and keep braking until that preview no longer glows: a slow plunge meets a beam at the bottom, a fast one beats it. Drop it (E), then burn prograde to lift your own low point back up, into the narrow band where your path neither glows with the deep beam nor marks Wisp\'s red zone, and burn prograde at the very bottom to get away.',
    objective: 'Pass within 64.8 k of Spindle and drop the probe into it (the probe may take 1 Sv), then get 1800 k away, taking under 5 Sv yourself.',
    teaches: 'Drop in, pull out · dive between sweeps',
    bodies: [
      { id: 'spindle', name: 'Spindle', gm: 40000, radius: 26, pw: 25, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.3, at: 300, dose: 5, beam: { width: 0.3, period: 2 * Math.PI / TOR_SPIN, phase: 3 } } },
      // Wisp goes round once backward for each lap you make round Tor, so it
      // too is in the same place every lap.
      { id: 'wisp', name: 'Wisp', gm: 20, radius: 8, color: C.ice, keepOut: 44, orbit: { parent: 'spindle', a: 213.4, phase: 2.4, dir: -1 } },
      { id: 'tor', name: 'Tor', gm: TOR_GM, radius: 28, spin: TOR_SPIN, color: C.tan, orbit: { parent: 'spindle', a: 1000, phase: 0 } },
    ],
    ship: ship({ start: { orbit: { body: 'tor', r: GEO, angle: 0 } }, heading: 'prograde', dv: 6.4, accel: 2, cargo: [{ id: 'probe', name: 'Plunge probe', mass: 0.2, dose: 1 }] }),
    goals: [
      { type: 'reach', body: 'spindle', r: 64.8, label: 'Needle\'s eye' },
      { type: 'hit', body: 'spindle', craft: 'probe', label: 'Probe into Spindle' },
      { type: 'escape', body: 'spindle', r: 1800 },
    ],
    par: 6.1, bounds: 6000, tMax: 1100, predict: 300, view: { x: 400, y: 0, span: 2600 }, startCam: 'overview',
  },
  {
    id: 'slingdrop',
    name: 'Slingshot Drop',
    intro: 'You are diving past the pulsar Vigil far too fast to stay, carrying a relay probe for deep space. The probe is shielded while it is aboard but takes only 1 Sv once you let it go, and at the bottom of the pass a beam crossing is far more than that: ride through the beam with the probe aboard and release it (E) just after. Then brake at once, deep down where it is cheap, until your dashed path tops out on Vigil Station\'s ring. The station comes up behind you at the top: match its speed and close in before the next sweeps add up, and watch your fuel.',
    objective: 'Send the probe 1100 k from Vigil, then rendezvous with Vigil Station (within 10 k, relative speed under 0.3 k/s), taking under 5.6 Sv yourself.',
    teaches: 'Release at the bottom, out of the beam',
    bodies: [
      { id: 'vigil', name: 'Vigil', gm: 40000, radius: 10, pw: 25, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.3, at: 300, dose: 5.6, beam: { width: 0.3, period: 80, phase: 5.502 } } },
      // On the true circular orbit at 560 k, reaching the top of a good
      // capture SD_LAG s after you.
      { id: 'watch2', name: 'Vigil Station', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'vigil', a: 460, n: SD_N, phase: SD_ANG - SD_N * (SD_T + SD_LAG) } },
    ],
    ship: ship({ start: { free: { x: -487.4, y: -461.6, vx: 9.076, vy: 2.194 } }, heading: Math.PI, dv: 6, accel: 3, cargo: [{ id: 'relay', name: 'Relay probe', mass: 0.2, dose: 1 }] }),
    goals: [
      { type: 'escape', body: 'vigil', craft: 'relay', r: 1100, label: 'Deep space' },
      { type: 'rendezvous', body: 'watch2', dist: 8, relVel: 0.3 },
    ],
    par: 5.8, bounds: 5000, tMax: 600, predict: 300, view: { x: -200, y: -200, span: 2000 }, startCam: 'overview',
  },
  {
    id: 'retrowhirl',
    name: 'Retro Whirl',
    intro: 'Vesper Station circles Halo clockwise, the other way round from you, and flipping your orbit round on the spot would take far more than your tank. The pulsar Lumen spins once for each lap you make round Halo, so its beams point the same way on every lap. Leave a little before Halo\'s inner side, burning forward until the dashed path dives at Lumen, and trim its low point to about 70 k, just inside the dashed unstable ring: the whirl throws you back out toward Halo. On the climb, steer until the path swings round Halo\'s far side about 100 k up, brake there into Vesper\'s direction, and meet Vesper as it comes up behind you. A sloppy whirl leaves Vesper far off, and chasing it round Halo is expensive.',
    objective: 'Orbit Halo clockwise, the way Vesper goes, between 28 and 158 k up, then rendezvous with Vesper (within 12 k, relative speed under 0.5 k/s), taking under 6.9 Sv of radiation.',
    teaches: 'Whirl round to turn round',
    bodies: [
      { id: 'lumen', name: 'Lumen', gm: 40000, radius: 10, pw: 25, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.3, at: 300, dose: 6.9, beam: { width: 0.3, period: 65.8, phase: 2.5 } } },
      { id: 'halo', name: 'Halo', gm: 1000, radius: 22, color: C.purple, orbit: { parent: 'lumen', a: 1000, phase: 0 } },
      // Clockwise at 92 k, coming past the bottom of a good whirl's return just after you.
      { id: 'vesper', name: 'Vesper Station', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'halo', a: 92, phase: -RW_ANG - Math.sqrt(1000 / 92 ** 3) * RW_MEET, dir: -1 } },
    ],
    ship: ship({ start: { orbit: { body: 'halo', r: 48, angle: 0 } }, heading: 'prograde', dv: 10.8, accel: 1 }),
    goals: [
      { type: 'orbit', body: 'halo', rMin: 50, rMax: 180, dir: -1 },
      { type: 'rendezvous', body: 'vesper', dist: 12, relVel: 0.5 },
    ],
    par: 9.8, bounds: 6000, tMax: 1200, predict: 400, view: { x: 300, y: 0, span: 2600 }, startCam: 'overview',
  },
  {
    id: 'horizonfence',
    name: 'Horizon Fence',
    intro: 'You are falling past the black hole Gorge on a line its fence posts were put there to stop: hold course and you fly into a red zone. Your horizon sonde has to fall in, and you have to whirl round inside the fence and out through the gate. Turn your nose toward Gorge (straight up the screen) with the side thrusters and burn until the sonde\'s release preview falls through the horizon, drop it (E), then turn back the other way and burn until your dashed path swings out through the gate. Every turn costs side-thruster propellant, and the hot disc round the hole doses you the deeper your line.',
    objective: 'Drop the sonde through Gorge\'s horizon, then whirl round and fly through the gate (30 k), on 3.6 s of side thrusters, taking under 2.42 Sv of radiation.',
    teaches: 'Drop in, thread inside the fence',
    bodies: [
      { id: 'gorge', name: 'Gorge', gm: 100000, radius: 10, horizon: 40, pw: 40, color: '#1a1020', kind: 'blackhole', radiation: { rate: 0.03, at: 300, dose: 2.42 } },
      { id: 'posta', name: 'Fence Post A', gm: 0, radius: 3, color: C.station, kind: 'station', keepOut: 35, x: 250 * Math.cos(2.618), y: 250 * Math.sin(2.618) },
      { id: 'postb', name: 'Fence Post B', gm: 0, radius: 3, color: C.station, kind: 'station', keepOut: 35, x: -250, y: 0 },
      { id: 'postc', name: 'Fence Post C', gm: 0, radius: 3, color: C.station, kind: 'station', keepOut: 35, x: 250 * Math.cos(-2.618), y: 250 * Math.sin(-2.618) },
    ],
    ship: ship({ start: { free: { x: 1017.4, y: -587.5, vx: -14.75, vy: 0.85 } }, heading: Math.PI, dv: 4.25, accel: 1, rcs: { fuel: 3.6 }, cargo: [{ id: 'sonde', name: 'Horizon sonde', mass: 0.05 }] }),
    goals: [
      { type: 'hit', body: 'gorge', craft: 'sonde', label: 'Sonde into Gorge' },
      { type: 'reach', x: 1126, y: 419, r: 30, label: 'the gate' },
    ],
    par: 4.1, bounds: 5000, tMax: 250, predict: 250, view: { x: 400, y: 0, span: 2200 }, startCam: 'overview',
  },
  {
    id: 'pulsarbinary',
    name: 'Binary',
    intro: 'The black hole Abyss and the pulsar Tock circle each other, and you are caught between them: Tock\'s pull is already twisting your orbit round Abyss, and every lap here adds to your dose as its beams sweep past. Your tank cannot climb out of this well alone. Burn prograde at your low point to throw your high point out to Tock\'s orbit just ahead of Tock: it drags you along, 120° ahead of it, where you hang almost still beside the marker before it flings you out. As you burn, watch the dashed path: stop when it slows to a near halt at the marker. Burn too little or too much and you sweep past it.',
    objective: 'Hang in Tock\'s wake (within 60 k of the marker, moving with it to within 0.8 k/s) for 10 s, then get 1500 k from Abyss, taking under 6 Sv of radiation.',
    teaches: 'Ride a moving pulsar, then slingshot',
    bodies: [
      { id: 'abyss', name: 'Abyss', gm: 40000, radius: 8, horizon: 25, pw: 25, color: '#1a1020', kind: 'blackhole' },
      { id: 'tock', name: 'Tock', gm: 10000, radius: 8, pw: 8, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.5, at: 300, dose: 6, beam: { width: 0.3, period: 60, phase: 0 } }, orbit: { parent: 'abyss', a: 500, phase: 0 } },
    ],
    ship: ship({ start: { conic: { body: 'abyss', pe: 190, e: 0.3, nu: Math.PI, angle: 0 } }, heading: 'prograde', dv: 1.1, accel: 1 }),
    goals: [
      { type: 'hold', lagrange: { body: 'tock', lead: 2.12, scale: 0.975 }, r: 60, relVel: 0.8, hold: 10, label: 'Tock\'s wake' },
      { type: 'escape', body: 'abyss', r: 1500 },
    ],
    par: 0.7, bounds: 6000, tMax: 800, predict: 300, view: { x: 0, y: 0, span: 1800 }, startCam: 'overview',
  },
];

// Relative velocity of the ship to a body: { x, y, v }.
const relVel = (m, id) => { m.sys.update(m.t); const i = m.sys.byId[id].index, s = m.ship; const x = m.sys.vx[i] - s.vx, y = m.sys.vy[i] - s.vy; return { x, y, v: Math.hypot(x, y) }; };
// Burn to match a body's velocity (nose on the "target" marker) until the
// relative speed is down to `until`.
// (or until it stops falling).
const match = (id, until) => { const c = {}; return { burn: (m) => { const r = relVel(m, id); return Math.atan2(r.y, r.x); }, until: (m) => {
  const v = relVel(m, id).v, stop = v <= until || (c.vl != null && v > c.vl + 0.01);
  c.vl = c.vl == null ? v : Math.min(c.vl, v);
  return stop;
} }; };
// Close in on a body and match its velocity: steer the velocity toward the
// body's own plus a slow approach (k per k of distance, at most vMax).
// Aims for a point 6 k off the body (stations are solid).
const meet = (id, k, vMax) => ({ control: (m, c) => {
  if (m.status !== 'flying' || m.goalIndex > (c.g0 == null ? (c.g0 = m.goalIndex) : c.g0)) return { done: true };
  const sys = m.sys; sys.update(m.t);
  const i = sys.byId[id].index, s = m.ship;
  let dx = sys.px[i] - s.x, dy = sys.py[i] - s.y, d = Math.hypot(dx, dy) || 1;
  dx -= 6 * dx / d; dy -= 6 * dy / d; d = Math.hypot(dx, dy) || 1;
  const sp = Math.min(vMax, k * d);
  const ex = sys.vx[i] + sp * dx / d - s.vx, ey = sys.vy[i] + sp * dy / d - s.vy;
  if (Math.hypot(ex, ey) < (c.burning ? 0.05 : 0.12)) { c.burning = false; return { thrust: false, angle: null, dt: 0.05 }; }
  c.burning = true;
  return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
} });
// Close in by hand: burn until you drift toward the body (aiming p k off it)
// at vClose, coast until within dBrake k (or the closest approach), then
// brake to match it; any miss is cleaned up by meet() on what is left.
const approach = (id, vClose, dBrake, k = 0.03, vMax = 0.6) => {
  const c = {};
  const aimV = (m) => {
    const sys = m.sys; sys.update(m.t);
    const i = sys.byId[id].index, s = m.ship;
    let dx = sys.px[i] - s.x, dy = sys.py[i] - s.y; const d = Math.hypot(dx, dy) || 1;
    dx -= 6 * dx / d; dy -= 6 * dy / d; const e = Math.hypot(dx, dy) || 1;
    return { x: sys.vx[i] + vClose * dx / e - s.vx, y: sys.vy[i] + vClose * dy / e - s.vy };
  };
  return [
    { fn: () => { c.dl = null; c.el = null; } },
    { burn: (m) => { const e = aimV(m); return Math.atan2(e.y, e.x); }, until: (m) => { const e = Math.hypot(aimV(m).x, aimV(m).y), stop = e < 0.05 || (c.el != null && e > c.el + 0.01); c.el = c.el == null ? e : Math.min(c.el, e); return stop; }, max: 6 },
    { coast: (m) => { const r = dist(m, id), done = r <= dBrake || (c.dl != null && r > c.dl); c.dl = r; return done; } },
    match(id, 0.15),
    meet(id, k, vMax),
  ];
};
// Coast until a body is within d k, or at its closest.
const closing = (id, d) => { const c = {}; return { coast: (m) => { const r = dist(m, id), done = r <= d || (c.dl != null && r > c.dl); c.dl = r; return done; } }; };
// Coast until the current goal is done.
const goalDone = (k) => ({ coast: (m) => m.goalIndex >= k });

const proofs = {
  heavystar: {
    // Brake at the top until the speed is p[0]: the low point drops inside
    // the unstable ring and the whirl swings the climb round to the gate.
    // Through the gate, wait for Kern Watch to close to p[1] k (or start to
    // draw away), burn to match it until the relative speed is p[2], then
    // close in.
    p: [3.632, 21, 0.6], scale: [0.03, 3, 0.1], tol: [0.1, 6, 0.1],
    script: (p, AP) => [
      { burn: 'retro', rel: 'kern', until: (m) => speed(m, 'kern') <= p[0] },
      goalDone(1),
      closing('watch', p[1]),
      match('watch', p[2]),
      meet('watch', 0.03, 0.6),
    ],
  },
};

// Closest the coasting path comes to a body within T seconds (what the
// dashed path shows a player), stopping at any impact (except, with
// `through`, with that body itself: how near its middle the path aims).
// Cached briefly.
function closest(m, id, T, through) {
  const c = m._closest || (m._closest = {}), key = id + ':' + T + ':' + !!through;
  if (c[key] && m.t - c[key].t < 0.005 && m.t >= c[key].t) return c[key].d;
  const sys = m.sys, i = sys.byId[id].index, s = { x: m.ship.x, y: m.ship.y, vx: m.ship.vx, vy: m.ship.vy }, bp = [0, 0];
  let t = m.t, best = Infinity;
  while (t < m.t + T) {
    const dt = Phys.coastDt(sys, s, t, 0.01, 1);
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
    sys.posAt(i, t, bp);
    best = Math.min(best, Math.hypot(s.x - bp[0], s.y - bp[1]));
    const hit = Phys.collision(sys, s.x, s.y, t);
    if (hit >= 0 && !(through && hit === i)) break;
  }
  sys.update(m.t);
  c[key] = { t: m.t, d: best };
  return best;
}

// High point of the current path about a strong-gravity body (from its
// energy; Infinity when unbound).
const pwAp = (m, id) => { const E = pwEnergy(m, id), b = m.sys.byId[id]; return E >= 0 ? Infinity : (b.pw || 0) - b.gm / E; };

// Radial speed away from a body (positive: climbing).
const radv = (m, id) => { m.sys.update(m.t); const i = m.sys.byId[id].index, s = m.ship; return ((s.x - m.sys.px[i]) * (s.vx - m.sys.vx[i]) + (s.y - m.sys.py[i]) * (s.vy - m.sys.vy[i])) / dist(m, id); };
// A burn of a set Δv in a direction.
const dvBurn = (dir, rel, amount) => {
  const st = { d0: 0 };
  return [
    { fn: (m) => { st.d0 = m.dvUsed(); } },
    { burn: dir, rel, until: (m) => m.dvUsed() - st.d0 >= amount },
  ];
};

// Burn until pred holds, then keep going for `extra` of Δv (a thumb lets go
// a little late).
const burnPast = (dir, rel, pred, extra) => {
  const st = { d0: null };
  return { burn: dir, rel, until: (m) => { if (st.d0 == null) { if (pred(m)) st.d0 = m.dvUsed(); return false; } return m.dvUsed() - st.d0 >= extra; } };
};

// Time of the first pass over Tor's inner side, and the lap length there
// (Spindle's tide stretches the later laps a little).
const ND_INNER = 44.4, ND_LAP = 89.1;

proofs.needledive = {
  // Leave on lap p[0] (offset p[1] s from the inner side): burn forward
  // until the dashed path dives inside p[2] k. On the way down brake on
  // until the release preview falls into Spindle, and p[3] more; drop the
  // probe, then burn prograde to lift your own low point to p[4]. Just after
  // the bottom (p[5] k out) burn prograde until free, and p[6] more.
  p: [0, -15, 150, 0.6, 62, 70, 0.2], scale: [0, 1, 10, 0.05, 2, 10, 0.1],
  tol: [0, 3, 6, 0.1, 3.4, 20, 0.1],
  script: (p, AP) => [
    { wait: Math.max(0, ND_INNER + Math.round(p[0]) * ND_LAP + p[1]) },
    { burn: 'pro', rel: 'tor', until: (m) => closest(m, 'spindle', 400) <= p[2] },
    { coast: (m) => dist(m, 'spindle') < 800 },
    burnPast('retro', 'spindle', (m) => closest(m, 'spindle', 300) <= 30, Math.max(0, p[3])),
    { drop: true },
    { burn: 'pro', rel: 'spindle', until: (m) => closest(m, 'spindle', 300) >= p[4] },
    { coast: (m) => radv(m, 'spindle') > 0 && dist(m, 'spindle') >= p[5] },
    burnPast('pro', 'spindle', (m) => pwEnergy(m, 'spindle') > 0, p[6]),
  ],
};

// Closest the coasting path comes to a fixed point within T s (as if you
// burned dv more toward angle a first).
function closestPt(m, X, Y, T, dv, a) {
  const sys = m.sys, k = dv || 0, s = { x: m.ship.x, y: m.ship.y, vx: m.ship.vx + k * Math.cos(a || 0), vy: m.ship.vy + k * Math.sin(a || 0) };
  let t = m.t, best = Math.hypot(s.x - X, s.y - Y);
  while (t < m.t + T) {
    const dt = Phys.coastDt(sys, s, t, 0.01, 1);
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
    best = Math.min(best, Math.hypot(s.x - X, s.y - Y));
    if (Phys.collision(sys, s.x, s.y, t) >= 0) break;
  }
  sys.update(m.t);
  return best;
}

// Farthest the coasting path gets from a body within T seconds (the high
// point a player reads off the dashed path).
function farthest(m, id, T) {
  const sys = m.sys, i = sys.byId[id].index, s = { x: m.ship.x, y: m.ship.y, vx: m.ship.vx, vy: m.ship.vy }, bp = [0, 0];
  let t = m.t, best = 0;
  while (t < m.t + T) {
    const dt = Phys.coastDt(sys, s, t, 0.01, 1);
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
    sys.posAt(i, t, bp);
    best = Math.max(best, Math.hypot(s.x - bp[0], s.y - bp[1]));
  }
  sys.update(m.t);
  return best;
}

proofs.slingdrop = {
  // Coast through the beam at the bottom with the probe aboard, release it at
  // p[0] s, then brake at once until the dashed path's high point is p[1] k.
  // Near the top, wait for Vigil Station to close to p[2] k, burn to match
  // it until the relative speed is p[3], then close in.
  // Close in by hand: drift toward it at p[4] k/s, brake p[5] k out.
  p: [58.4, 478, 22.5, 0.55, 0.45, 8], scale: [0.3, 10, 3, 0.1, 0.1, 3], tol: [1.5, 18, 6, 0.1, 0.1, 4],
  script: (p, AP) => [
    { coast: (m) => m.t >= p[0] },
    { drop: true },
    { burn: 'retro', rel: 'vigil', until: (m) => farthest(m, 'vigil', 200) <= p[1] },
    { coast: (m) => radv(m, 'vigil') <= 0.5 },
    closing('watch2', p[2]),
    match('watch2', p[3]),
    ...approach('watch2', p[4], p[5]),
  ],
};

// Where the coasting path next meets a body after `skip` seconds, within T:
// its closest distance and which way round it passes (1 counter-clockwise,
// -1 clockwise). Cached briefly (burns call it every tick).
function encounter(m, id, skip, T) {
  const c = m._enc || (m._enc = {}), key = id + ':' + skip + ':' + T;
  if (c[key] && m.t - c[key].t < 0.02 && m.t >= c[key].t) return c[key].e;
  const sys = m.sys, i = sys.byId[id].index, s = { x: m.ship.x, y: m.ship.y, vx: m.ship.vx, vy: m.ship.vy }, bp = [0, 0], bq = [0, 0];
  let t = m.t, best = Infinity, sense = 0, ux = 0, uy = 0;
  while (t < m.t + T) {
    const dt = Phys.coastDt(sys, s, t, 0.01, 1);
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
    const hit = Phys.collision(sys, s.x, s.y, t);
    if (hit >= 0 && sys.bodies[hit].kind !== 'station') { if (t > m.t + skip) { sys.posAt(i, t, bp); const d = Math.hypot(s.x - bp[0], s.y - bp[1]); if (d < best) { best = d; sense = 0; ux = (s.x - bp[0]) / d; uy = (s.y - bp[1]) / d; } } break; }
    if (t < m.t + skip) continue;
    sys.posAt(i, t, bp);
    const dx = s.x - bp[0], dy = s.y - bp[1], d = Math.hypot(dx, dy);
    if (d < best) {
      best = d; ux = dx / d; uy = dy / d;
      sys.posAt(i, t + 0.01, bq);
      const vx = s.vx - (bq[0] - bp[0]) / 0.01, vy = s.vy - (bq[1] - bp[1]) / 0.01;
      sense = dx * vy - dy * vx > 0 ? 1 : -1;
    }
  }
  sys.update(m.t);
  const e = { d: best, sense, ux, uy };
  c[key] = { t: m.t, e };
  return e;
}

// First pass over Halo's inner side, and the lap length there.
const RW_INNER = 35.2, RW_LAP = 70.5;

proofs.retrowhirl = {
  // Leave on lap p[0], p[1] s from the inner side: burn forward until the
  // dashed path dives at Lumen, then on the way down trim the low point to
  // p[2]. On the climb back out, p[3] k from Lumen, steer (p[4] from
  // prograde) until the dashed path swings round Halo's far side; once
  // within 250 k of Halo, nudge the pass sideways until it is p[5] k from
  // Halo, and at that low point brake until the high point is p[6].
  p: [1, -10.94, 68.46, 370, 0.244, 99.75, 113.6, 20.8, 0.43, 8.1], scale: [0, 1, 2, 30, 0.3, 3, 5, 3, 0.1, 3],
  tol: [0, 2, 2.7, 30, 0.06, 4, 6, 6, 0.1, 4],
  script: (p, AP) => [
    { wait: Math.max(0, RW_INNER + Math.round(p[0]) * RW_LAP + p[1]) },
    { burn: 'pro', rel: 'halo', until: (m) => closest(m, 'lumen', 400) <= 150 },
    { coast: (m) => dist(m, 'lumen') < 800 },
    { burn: 'retro', rel: 'lumen', until: (m) => closest(m, 'lumen', 300) <= p[2] },
    { burn: 'pro', rel: 'lumen', until: (m) => closest(m, 'lumen', 300) >= p[2] },
    { coast: (m) => dist(m, 'lumen') < 150 },
    { coast: (m) => dist(m, 'lumen') > p[3] },
    { burn: p[4], rel: 'lumen', max: 4, until: (m) => { const e = encounter(m, 'halo', 0, 700); return e.sense === -1 && Math.abs(e.d - p[5]) <= 40; } },
    { coast: (m) => dist(m, 'halo') < 250 },
    { control: (m) => {
      const e = encounter(m, 'halo', 0, 300);
      if (e.sense === -1 && Math.abs(e.d - p[5]) <= 1.5) return { done: true };
      const out = e.sense === -1 && e.d < p[5] ? 1 : -1;
      return { thrust: true, angle: Math.atan2(out * e.uy, out * e.ux) };
    }, max: 20 },
    { coast: (m) => dist(m, 'halo') < 150 && radv(m, 'halo') > 0 },
    { burn: 'retro', rel: 'halo', until: (m) => { const o = AP.orb(m, 'halo'); return o.bound && o.ap <= p[6]; } },
    goalDone(1),
    // Vesper comes past: wait till it is p[7] k off, match it to 0.3 k/s,
    // then close in by hand (drift at p[8], brake p[9] k out).
    closing('vesper', p[7]),
    match('vesper', 0.3),
    ...approach('vesper', p[8], p[9], 0.08, 1.2),
  ],
};

proofs.horizonfence = {
  // Turn to face Gorge's side of your line (straight up the screen) and burn
  // until the release preview falls through the horizon, and p[0] more; drop
  // the sonde, turn back to prograde and burn until the dashed path passes
  // within p[1] k of the gate's middle, and p[2] more.
  p: [0.05, 5, -0.015], scale: [0.05, 0, 0.02], tol: [0.1, 0, 0.1], opts: { turn: true, turnRate: 0.4 },
  script: (p) => [
    burnPast(() => Math.PI / 2, null, (m) => closest(m, 'gorge', 250) <= 41, Math.max(0, p[0])),
    { drop: true },
    // (p[2] < 0: let go that much early; > 0: that much late)
    (() => { let lo = Infinity; const early = Math.max(0, -p[2]); return burnPast(() => HF_BACK, null, (m) => { const d = closestPt(m, 1126, 419, 250, early, HF_BACK); lo = Math.min(lo, d); return d <= Math.max(1, p[1]) || (lo < 40 && d > lo + 1); }, Math.max(0, p[2])); })(),
  ],
};

// Radial speed sign changes: count the low points passed.
const lowPoints = (id, k) => { let n = 0, prevIn = false; return { fn: () => { n = 0; prevIn = false; }, coast: (m) => { const inn = radv(m, id) < 0; if (prevIn && !inn) n++; prevIn = inn; return n >= k; } }; };

proofs.pulsarbinary = {
  // At the first low point, burn prograde p[0] of Δv: the high point reaches
  // Tock's orbit just as Tock comes by, and you climb to ride along 120°
  // ahead of it, slow enough to hang at the marker; then Tock flings you
  // out. (p[1]: how many seconds after the low point the burn starts.)
  p: [0.66, 1.5], scale: [0.02, 0.5], tol: [0.1, 1.5],
  script: (p) => {
    const lp = lowPoints('abyss', 1);
    return [{ fn: lp.fn }, { coast: lp.coast }, { wait: Math.max(0, p[1] || 0) }, ...dvBurn('pro', 'abyss', p[0])];
  },
};

const fails = {
  pulsarbinary: [
    { name: 'wait and see', steps: () => [] },
    { name: 'escape straight out at the low point', steps: (AP) => { const lp = lowPoints('abyss', 1); return [{ fn: lp.fn }, { coast: lp.coast }, { burn: 'pro', rel: 'abyss', until: () => false }]; } },
    { name: 'leave on the next lap', steps: (AP) => { const lp = lowPoints('abyss', 2); return [{ fn: lp.fn }, { coast: lp.coast }, ...dvBurn('pro', 'abyss', 0.64)]; } },
    { name: 'wait two laps and then go', steps: (AP) => { const lp = lowPoints('abyss', 3); return [{ fn: lp.fn }, { coast: lp.coast }, ...dvBurn('pro', 'abyss', 1.1)]; } },
  ],
  horizonfence: [
    { name: 'hold course', steps: () => [] },
    { name: 'take the wide line outside the fence', opts: { turn: true, turnRate: 0.4 }, steps: () => [{ burn: () => -Math.PI / 2, until: (m) => m.dvUsed() >= 1.1 }] },
    { name: 'dive deeper for a bigger whirl', opts: { turn: true, turnRate: 0.4 }, steps: () => [{ burn: () => Math.PI / 2, until: (m) => m.dvUsed() >= 1.6 }] },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.6 }, steps: (AP) => proofs.horizonfence.script(proofs.horizonfence.p, AP) },
  ],
  retrowhirl: [
    { name: 'flip the orbit round in place', steps: (AP) => [{ burn: 'retro', rel: 'halo', until: (m) => AP.orb(m, 'halo').dir === -1 && AP.orb(m, 'halo').ap >= 60 }] },
    { name: 'dive for the middle of Lumen', steps: (AP) => proofs.retrowhirl.script([1, -11, 45].concat(proofs.retrowhirl.p.slice(3)), AP) },
    { name: 'skim outside the unstable ring', steps: (AP) => proofs.retrowhirl.script([1, -11, 90].concat(proofs.retrowhirl.p.slice(3)), AP) },
    { name: 'leave from the inner side, half a lap late', steps: (AP) => proofs.retrowhirl.script([1, 24].concat(proofs.retrowhirl.p.slice(2)), AP) },
  ],
  slingdrop: [
    { name: 'release the probe at once', steps: (AP) => proofs.slingdrop.script([0, 750], AP) },
    { name: 'release at the bottom, before the beam', steps: (AP) => proofs.slingdrop.script([55.2, 750], AP) },
    { name: 'brake first, then release', steps: (AP) => [{ coast: (m) => m.t >= 56.3 }, { burn: 'retro', rel: 'vigil', until: (m) => farthest(m, 'vigil', 200) <= 750 }, { drop: true }] },
    { name: 'release and fly on with it', steps: (AP) => proofs.slingdrop.script([58.5, 0], AP).slice(0, 2) },
  ],
  needledive: [
    { name: 'let the probe go as soon as its preview falls in', steps: (AP) => proofs.needledive.script([0, -15, 150, 0, 62, 70, 0.2], AP) },
    { name: 'dive for the middle of the eye', steps: (AP) => proofs.needledive.script([0, -15, 150, 0.6, 50, 70, 0.2], AP) },
    { name: 'lift back to 70 k, well clear of the deep beam', steps: (AP) => proofs.needledive.script([0, -15, 150, 0.6, 70, 70, 0.2], AP) },
    { name: 'coast back out after the pass', steps: (AP) => proofs.needledive.script(proofs.needledive.p, AP).slice(0, 6) },
    { name: 'dive in from the far side', steps: (AP) => [{ burn: 'retro', rel: 'tor', until: (m) => m.dvUsed() > 2 && closest(m, 'spindle', 400) <= 85 }, ...proofs.needledive.script(proofs.needledive.p, AP).slice(2)] },
  ],
  heavystar: [
    { name: 'wait for the orbit to swing round', steps: () => [] },
    { name: 'brake hard and dive straight in', steps: (AP) => proofs.heavystar.script([3.2], AP) },
    { name: 'brake on the next lap', steps: (AP) => [{ wait: 420 }, ...proofs.heavystar.script(proofs.heavystar.p, AP)] },
  ],
};

module.exports = { levels, proofs, fails };
