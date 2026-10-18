'use strict';
// World 4 · Chapter 3 · Shadow Lanes: hanging in a planet's L2 shadow while
// it orbits a star, planets on elliptical orbits, and timing the hop from one
// planet's shadow to the next. See tools/w4/README.md ("Redesign v3").
//
// L2 sits behind a planet, inside its umbra: the star is a disc, so the umbra
// narrows behind the planet (its half-width at L2 is about
// Rc − (k − 1)(Rs − Rc), the same at any distance from the star, since the
// L2 point and the umbra both scale with it). L2 is unstable: a coasting ship
// drifts off, so holding there costs small corrections. On an elliptical orbit
// the L2 point keeps the same scale k (the pulsating L2 of the elliptic
// three-body problem), but it races and the drift grows fast near periapsis,
// and the sunlight outside the shadow is far hotter there.
const { ship, C } = require('../../js/levels.js');
const Phys = require('../../js/physics.js');

// ---------------------------------------------------------------- geometry

// L2 (or L1) of body `id` in a set of body definitions, as the lagrange
// goal's `scale` (a multiple of the star-to-planet distance): the point on
// the star-planet line where the pull of both (with the star's wobble about
// the barycentre) is exactly what co-rotating needs. Solved on a circular
// copy of the orbit; the same scale is the L2 of an elliptical orbit too.
function l2Scale(defs, id, inner) {
  const circ = defs.map((d) => (d.orbit ? Object.assign({}, d, { orbit: Object.assign({}, d.orbit, { e: 0 }) }) : d));
  const sys = new Phys.System(circ), b = sys.byId[id], P = sys.bodies[b.parent];
  sys.update(0);
  const n = b.orbit.n, a = [0, 0];
  const err = (k) => {
    const x = sys.px[P.index] + (sys.px[b.index] - sys.px[P.index]) * k, y = sys.py[P.index] + (sys.py[b.index] - sys.py[P.index]) * k;
    sys.accel(x, y, 0, a);
    // centripetal toward the barycentre of the star and planet
    const bx = sys.nx[P.index], by = sys.ny[P.index], rx = x - bx, ry = y - by, r = Math.hypot(rx, ry);
    return (a[0] * rx + a[1] * ry) / r + n * n * r; // > 0: gravity too weak here
  };
  let lo = inner ? 0.6 : 1.0005, hi = inner ? 0.9995 : 1.8;
  for (let it = 0; it < 80; it++) {
    const k = (lo + hi) / 2, e = err(k);
    if (inner ? e > 0 : e < 0) lo = k; else hi = k;
  }
  return +((lo + hi) / 2).toFixed(5);
}

// A start near goal-style point (scale k of `id`'s distance from its star),
// offset `out` k further out and `ahead` k along the orbit, moving with the
// point plus (vOut, vAhead) k/s: e.g. drifting in a planet's shadow.
function nearPoint(defs, id, k, out, ahead, vOut, vAhead, t) {
  const sys = new Phys.System(defs), b = sys.byId[id], i = b.index, p = b.parent;
  sys.update(t || 0);
  const rx = sys.px[i] - sys.px[p], ry = sys.py[i] - sys.py[p], r = Math.hypot(rx, ry), ux = rx / r, uy = ry / r;
  const kk = k + out / r;
  const x = sys.px[p] + rx * kk - uy * ahead, y = sys.py[p] + ry * kk + ux * ahead;
  // co-moving with the star-planet line (its rotation and its stretching)
  const wx = sys.vx[i] - sys.vx[p], wy = sys.vy[i] - sys.vy[p];
  const om = (rx * wy - ry * wx) / (r * r), rdot = (rx * wx + ry * wy) / r;
  const qx = x - sys.px[p], qy = y - sys.py[p];
  const vx = sys.vx[p] + qx * rdot / r - om * qy + ux * vOut - uy * vAhead;
  const vy = sys.vy[p] + qy * rdot / r + om * qx + uy * vOut + ux * vAhead;
  const f = (v) => +v.toFixed(4);
  return { free: { x: f(x), y: f(y), vx: f(vx), vy: f(vy) } };
}

// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };
// Distance from the ship to goal gi's point, and the point.
const gp = (m, gi) => m.goalPoint(m.level.goals[gi]);
const dGoal = (m, gi) => { const P = gp(m, gi); return Math.hypot(P.x - m.ship.x, P.y - m.ship.y); };
// Planet's distance from its star (or a body from its parent).
const rOf = (m, id) => { const sys = m.sys; sys.update(m.t); const b = sys.byId[id], i = b.index, p = b.parent; return Math.hypot(sys.px[i] - sys.px[p], sys.py[i] - sys.py[p]); };

// Coast with the nose held still (no side thrusters spent chasing a target).
const hold = (pred) => ({ control: (m, c) => pred(m, c) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });

// Keep station on goal gi's moving point the way a player does: aim at where
// you think the marker is (off by `off` = [out, ahead] k in the planet's
// frame), wanting to close in at up to vMax; once the velocity is off by more
// than the dead band `db` k/s, make one tap: turn to the error (off by `aim`
// rad), and burn the error's size times (1 + `over`), then coast again.
// Runs until pred (or the mission ends).
const park = (gi, opt, pred) => {
  const o = Object.assign({ k: 0.04, vMax: 0.5, db: 0.1, off: [0, 0], aim: 0, over: 0 }, opt);
  return { control: (m, c) => {
    if (m.status !== 'flying' || (pred && pred(m, c))) return { done: true };
    const g = m.level.goals[gi], P = m.goalPoint(g), s = m.ship, sys = m.sys;
    if (c.tap) {
      if (m.dvUsed() - c.tap.dv0 < c.tap.dv && m.stageSpec && m.stageSpec.fuel > 1e-9) return { thrust: true, angle: c.tap.a, tol: 0.08 };
      c.tap = null;
    }
    let ux = 1, uy = 0;
    if (g.lagrange) { const b = sys.byId[g.lagrange.body], i = b.index, p = b.parent; const rx = sys.px[i] - sys.px[p], ry = sys.py[i] - sys.py[p], r = Math.hypot(rx, ry); ux = rx / r; uy = ry / r; }
    else if (g.body) { const i = sys.byId[g.body].index, p = sys.bodies[i].parent; if (p != null) { const rx = sys.px[i] - sys.px[p], ry = sys.py[i] - sys.py[p], r = Math.hypot(rx, ry); ux = rx / r; uy = ry / r; } }
    const tx = P.x + o.off[0] * ux - o.off[1] * uy, ty = P.y + o.off[0] * uy + o.off[1] * ux;
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(o.vMax, o.k * d);
    const ex = P.vx + sp * dx / d - s.vx, ey = P.vy + sp * dy / d - s.vy, e = Math.hypot(ex, ey);
    if (e < o.db) return { thrust: false, angle: null, dt: 0.1 };
    c.tap = { a: Math.atan2(ey, ex) + o.aim, dv: e * (1 + o.over), dv0: m.dvUsed() };
    return { thrust: false, angle: c.tap.a, dt: 1 / 60 };
  } };
};
// The first move toward goal gi's marker, by eye: one burn to set off toward
// it at closing speed vc (aim off by `aim`, burn off by `over`), coast until
// within `near` k (or the gap stops closing), then keep station with taps.
const approach = (gi, vc, near, err, popt, pred) => {
  let a = null, dv = 0, dv0 = 0;
  const e = Object.assign({ aim: 0, over: 0 }, err);
  return [
    { fn: (m) => {
      const P = gp(m, gi), s = m.ship, dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy) || 1;
      const ex = P.vx + vc * dx / d - s.vx, ey = P.vy + vc * dy / d - s.vy;
      a = Math.atan2(ey, ex) + e.aim; dv = Math.hypot(ex, ey) * (1 + e.over); dv0 = m.dvUsed();
    } },
    { burn: () => a, until: (m) => m.dvUsed() - dv0 >= dv },
    { coast: (m, c) => { const d = dGoal(m, gi), r = d < near || (c.dl != null && d > c.dl + 0.05); c.dl = d; return r; } },
    park(gi, popt, pred),
  ];
};
// Close in on a body and match its velocity (as park, for a station).
const meet = (id, k, vMax) => ({ control: (m, c) => {
  if (m.status !== 'flying' || m.goalIndex > (c.g0 == null ? (c.g0 = m.goalIndex) : c.g0)) return { done: true };
  const sys = m.sys; sys.update(m.t);
  const i = sys.byId[id].index, s = m.ship;
  const dx = sys.px[i] - s.x, dy = sys.py[i] - s.y, d = Math.hypot(dx, dy) || 1;
  const sp = Math.min(vMax, k * d);
  const ex = sys.vx[i] + sp * dx / d - s.vx, ey = sys.vy[i] + sp * dy / d - s.vy;
  if (Math.hypot(ex, ey) < (c.burning ? 0.02 : 0.06)) { c.burning = false; return { thrust: false, angle: null, dt: 0.05 }; }
  c.burning = true;
  return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
} });
// A burn held in the direction dir gives as it starts: flip once, then hold.
const held = (AP, dir, rel, until) => {
  let a = null;
  return [{ fn: (m) => { a = null; m._dv0 = m.dvUsed(); } }, { burn: (m) => (a == null ? (a = AP.aim(m, dir, rel)) : a), until }];
};
// Closest approach of a coasting state to goal gi's point within H s:
// { d, t } (as the closest approach marker shows it).
function closest(m, gi, st, H) {
  const g = m.level.goals[gi];
  const p = Phys.predict(m.sys, st, m.t, H, { maxSteps: 4000, dtMax: 1 });
  let best = { d: Infinity, t: m.t };
  for (let i = 0; i < p.ts.length; i++) {
    const q = m.goalPoint(g, p.ts[i]), d = Math.hypot(p.xs[i] - q.x, p.ys[i] - q.y);
    if (d < best.d) best = { d, t: p.ts[i] };
  }
  m.sys.update(m.t);
  return best;
}
// A mid-course correction the way a player makes one: nudge until the
// closest approach marker reads near zero. Finds the nudge (a small Δv
// vector) that zeroes the predicted miss, then burns it with the player's
// errors (aim off by err.aim rad, size off by err.over).
const fix = (gi, H, err) => {
  let a = 0, dv = 0, dv0 = 0;
  const e = Object.assign({ aim: 0, over: 0 }, err);
  return [
    { fn: (m) => {
      const s = m.ship, miss = (ux, uy) => closest(m, gi, { x: s.x, y: s.y, vx: s.vx + ux, vy: s.vy + uy }, H).d;
      let ux = 0, uy = 0, f = miss(0, 0);
      for (let it = 0; it < 6; it++) {
        const h = 0.02, fx = miss(ux + h, uy), fy = miss(ux, uy + h);
        const gx = (fx - f) / h, gy = (fy - f) / h, g2 = gx * gx + gy * gy;
        if (g2 < 1e-9) break;
        // the miss distance is about linear in the nudge: step to its zero
        let k = f / g2, nx = ux - k * gx, ny = uy - k * gy, nf = miss(nx, ny);
        while (nf > f && k > 1e-4) { k /= 2; nx = ux - k * gx; ny = uy - k * gy; nf = miss(nx, ny); }
        if (nf >= f) break;
        ux = nx; uy = ny; f = nf;
      }
      a = Math.atan2(uy, ux) + e.aim; dv = Math.hypot(ux, uy) * (1 + e.over); dv0 = m.dvUsed();
    } },
    { burn: () => a, until: (m) => m.dvUsed() - dv0 >= dv },
  ];
};
// A hop from one shadow to the next, as a player flies it: keep station on
// goal g0's point until time T, push off (aim off prograde about `center`,
// Δv), after tf s fix the aim on the closest approach marker, coast until
// within `brake` k of goal g1's point (or the closest approach), then match
// its speed and keep station there.
// q: { T, dir, dv, tf, fa, fo, brake, vc, near, ta, to } (fa/fo: the fix's
// aim and size errors, ta/to: the taps').
const hop = (AP, g0, g1, center, q, pred) => [
  park(g0, { aim: q.ta, over: q.to }, (m) => m.goalIndex > g0 && m.t >= q.T),
  ...held(AP, q.dir, center, (m) => m.dvUsed() >= m._dv0 + q.dv),
  { wait: q.tf },
  ...fix(g1, 200, { aim: q.fa, over: q.fo }),
  { coast: (m, c) => { const d = dGoal(m, g1), r = d < q.brake || (c.dl != null && d > c.dl); c.dl = d; return r; } },
  ...approach(g1, q.vc, q.near, {}, { aim: q.ta, over: q.to }, pred),
];
// Proof parameters of a hop, in order, with honest tolerances.
const HOP_KEYS = ['T', 'dir', 'dv', 'tf', 'fa', 'fo', 'brake', 'vc', 'near', 'ta', 'to'];
const HOP_TOL = [2, 0.06, 0.1, 3, 0.06, 0.15, 4, 0.1, 2, 0.1, 0.15];
const HOP_SCALE = [3, 0.1, 0.1, 3, 0, 0, 5, 0.1, 2, 0, 0];
const hopQ = (p, k) => { const q = {}; HOP_KEYS.forEach((key, i) => { q[key] = p[(k || 0) + i]; }); return q; };
// Has goal gi been completed?
const doneGoal = (gi) => (m) => m.goalIndex > gi;

// ------------------------------------------------------------------ levels

// 1 · Night Watch: Lamp and Vesper, the L2 hold taught gently.
const NW = [
  { id: 'lamp', name: 'Lamp', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.05, at: 550, dose: 4 } },
  { id: 'vesper', name: 'Vesper', gm: 1000, radius: 12, color: '#6f86b8', orbit: { parent: 'lamp', a: 550, phase: 0 } },
];
const NW_K = l2Scale(NW, 'vesper');

// 2 · Close Pass: Hale on a circular orbit, Wend on an ellipse whose
// perihelion swings it in toward Hale.
const CP_N = Math.sqrt(40000 / 800 ** 3);
const CP = [
  { id: 'pyre', name: 'Pyre', gm: 40000, radius: 50, color: C.sun2, kind: 'star', radiation: { rate: 0.05, at: 550, dose: 99 } },
  { id: 'hale', name: 'Hale', gm: 300, radius: 10, color: C.grey, orbit: { parent: 'pyre', a: 500, phase: 0 } },
  { id: 'wend', name: 'Wend', gm: 400, radius: 12, color: C.tan, orbit: { parent: 'pyre', a: 800, e: 0.25, argp: 2.5, phase: -CP_N * 140, reflex: false } },
];
const CP_KH = l2Scale(CP, 'hale'), CP_KW = l2Scale(CP, 'wend');

// 2 · Perihelion: Wend on an ellipse, a few seconds before its closest
// pass by Pyre; its umbra is thin and the sunlight there is fierce.
const PH_N = Math.sqrt(40300 / 600 ** 3);
const PH = [
  { id: 'pyre', name: 'Pyre', gm: 40000, radius: 50, color: C.sun2, kind: 'star', radiation: { rate: 0.3, at: 550, dose: 99 } },
  { id: 'wend', name: 'Wend', gm: 300, radius: 9, color: C.tan, orbit: { parent: 'pyre', a: 600, e: 0.4, argp: 0, phase: -PH_N * 30 } },
  { id: 'sprig', name: 'Sprig', gm: 0, radius: 3, color: C.rock, orbit: { parent: 'wend', a: 30, phase: 0 } },
];
const PH_K = l2Scale(PH, 'wend');

// 3 · Between Sweeps: Corax, a pulsar, with Tarn and Skerry on circular
// orbits; the hop crosses open space where the beams sweep.
const BS = [
  { id: 'corax', name: 'Corax', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 1, at: 500, dose: 99, beam: { width: 0.3, period: 70, phase: 0 } } },
  { id: 'tarn', name: 'Tarn', gm: 300, radius: 10, color: C.blue, orbit: { parent: 'corax', a: 480, phase: 0 } },
  { id: 'skerry', name: 'Skerry', gm: 300, radius: 10, color: C.ice, orbit: { parent: 'corax', a: 640, phase: 0.6, reflex: false } },
];
const BS_KT = l2Scale(BS, 'tarn'), BS_KS = l2Scale(BS, 'skerry');

const levels = [
  {
    id: 'nightwatch',
    name: 'Night Watch',
    intro: 'Vesper\'s L2 point is the marker in the dark cone behind it, keeping pace as Vesper goes round Lamp. Climb to it: burn prograde as you come round the day side so the top of your climb lands on the marker (the closest approach readout shows how near you will pass), then brake to match its speed. Nothing stays at L2 on its own, so keep station with small taps whenever your path starts to curl away, and turn sparingly: the side thrusters are short. Then nudge sunward, fall back and brake into a low orbit.',
    objective: 'Hold within 4 k of Vesper\'s L2 (moving with it to within 0.2 k/s) for 60 s, then orbit Vesper between 15 and 35 k from its centre, taking under 4 Sv of radiation, with 19.5 s of side-thruster propellant.',
    teaches: 'Keep station at L2',
    bodies: NW,
    ship: ship({ start: { orbit: { body: 'vesper', r: 30, angle: Math.PI } }, heading: 'prograde', dv: 4.47, accel: 0.6, rcs: { fuel: 19.5 } }),
    goals: [
      { type: 'hold', lagrange: { body: 'vesper', lead: 0, scale: NW_K }, r: 4, relVel: 0.2, hold: 60, label: 'L2' },
      { type: 'orbit', body: 'vesper', rMin: 15, rMax: 35, label: 'Low orbit' },
    ],
    par: 4.1, bounds: 3000, tMax: 400, predict: 150, view: { x: 640, y: 0, span: 320 },
  },
  {
    id: 'perihelion',
    name: 'Perihelion',
    intro: 'TBD',
    objective: 'TBD',
    teaches: 'Elliptical orbits · L2 at perihelion',
    bodies: PH,
    ship: ship({ start: nearPoint(PH, 'wend', PH_K, 10, 0, 0, 0), heading: 'retrograde', dv: 9, accel: 0.8 }),
    goals: [
      { type: 'hold', lagrange: { body: 'wend', lead: 0, scale: PH_K }, r: 5, relVel: 0.3, hold: 30, label: 'L2' },
      { type: 'rendezvous', body: 'sprig', dist: 8, relVel: 0.4, label: 'Sprig' },
    ],
    par: 4, bounds: 3000, tMax: 600, predict: 150, view: { x: 400, y: 0, span: 300 },
  },
  {
    id: 'sweeps',
    name: 'Between Sweeps',
    intro: 'TBD',
    objective: 'TBD',
    teaches: 'Hop between shadows · between sweeps',
    bodies: BS,
    ship: ship({ start: nearPoint(BS, 'tarn', BS_KT, 12, 0, 0, 0), heading: 'prograde', dv: 9, accel: 0.8 }),
    goals: [
      { type: 'hold', lagrange: { body: 'tarn', lead: 0, scale: BS_KT }, r: 6, relVel: 0.25, hold: 15, label: 'Tarn L2' },
      { type: 'hold', lagrange: { body: 'skerry', lead: 0, scale: BS_KS }, r: 8, relVel: 0.3, hold: 10, label: 'Skerry L2' },
    ],
    par: 4, bounds: 3000, tMax: 600, predict: 200, view: { x: 400, y: 300, span: 1000 }, startCam: 'overview',
  },
  {
    id: 'closepass',
    name: 'Close Pass',
    intro: 'TBD',
    objective: 'TBD',
    teaches: 'Elliptical orbits · hop between shadows',
    bodies: CP,
    ship: ship({ start: nearPoint(CP, 'hale', CP_KH, 15, 0, 0, 0), heading: 'prograde', dv: 9, accel: 0.8 }),
    goals: [
      { type: 'hold', lagrange: { body: 'hale', lead: 0, scale: CP_KH }, r: 6, relVel: 0.25, hold: 15, label: 'Hale L2' },
      { type: 'hold', lagrange: { body: 'wend', lead: 0, scale: CP_KW }, r: 8, relVel: 0.3, hold: 10, label: 'Wend L2' },
    ],
    par: 4, bounds: 3000, tMax: 600, predict: 200, view: { x: 400, y: 300, span: 1000 }, startCam: 'overview',
  },
];

const proofs = {
  nightwatch: {
    // Close in on the marker and keep station (aiming a little off it), then
    // climb to the parking orbit and round off at the top.
    // p: park aim error out/ahead (k), aim off prograde (rad), Δv of the escape burn.
    // p: park aim error out/ahead (k), high point of the climb, low point
    // to round off to, tap aim error (rad), tap over/undershoot, closing speed of
    // the first burn (k/s), distance to start the taps (k), first burn aim, over.
    p: [0, 0, 0, 0.072, 0, 0, 0.772, 14.777, 0, 0, 30.348, 3.036, 87.141], scale: [0, 0, 0, 0.1, 0, 0, 0.1, 3, 0, 0, 1, 1, 4], tol: [1.5, 1.5, 0, 0.04, 0.1, 0.15, 0.1, 2, 0.06, 0.04, 1.4, 2, 4.4], opts: { turn: true, turnRate: 0.4 },
    script: (p, AP) => [
      { wait: p[11] },
      { burn: 'pro', rel: 'vesper', until: (m) => AP.orb(m, 'vesper').ap >= p[12] },
      { coast: (m, c) => { const d = dGoal(m, 0), r = d < 25 || (c.dl != null && d > c.dl); c.dl = d; return r; } },
      ...approach(0, p[6], p[7], { aim: p[8], over: p[9] }, { off: [p[0], p[1]], aim: p[4], over: p[5] }, doneGoal(0)),
      ...held(AP, 'in', 'vesper', (m) => m.dvUsed() >= m._dv0 + p[3]),
      { coast: (m) => AP.orb(m, 'vesper').rising },
      { burn: 'retro', rel: 'vesper', until: (m) => AP.orb(m, 'vesper').ap <= p[10] },
    ],
  },
  perihelion: {
    // Close in on L2 and keep station through perihelion, then drop in to
    // meet Sprig as it comes round.
    // p: closing speed, distance to start the taps, then the hop (HOP_KEYS).
    p: [0.4, 4, 100, 3.14, 0.3, 10, 0, 0, 10, 0.3, 3, 0, 0], scale: [0.1, 1, ...HOP_SCALE], tol: [0.1, 2, ...HOP_TOL], opts: { turn: true, turnRate: 0.4 },
    script: (p, AP) => [
      ...approach(0, p[0], p[1], {}, { aim: p[11], over: p[12] }, doneGoal(0)),
      ...hop(AP, 0, 1, 'wend', hopQ(p, 2)),
    ],
  },
  sweeps: {
    // p: the hop (see HOP_KEYS).
    p: [68.147, -1.603, 0.001, 0, 0, 0, 26.648, 0.221, 3.257, 0, 0], scale: HOP_SCALE, tol: HOP_TOL, opts: { turn: true, turnRate: 0.4 },
    script: (p, AP) => hop(AP, 0, 1, 'corax', hopQ(p)),
  },
  closepass: {
    // Keep station at Hale's L2 until Wend swings in, push off, fix the aim
    // on the way with the closest approach marker, then brake as you reach
    // Wend's L2 and keep station there.
    // p: when to leave, aim off prograde (rad), Δv of the push, closing
    // speed, distance to start the taps, tap aim error, tap over/undershoot,
    // when to correct (s after the push), correction aim error, over,
    // distance to brake at (k).
    p: [78, -2.4, 1.35, 0.5, 6, 0, 0, 10, 0, 0, 25], scale: [3, 0.1, 0.1, 0.1, 2, 0, 0, 3, 0, 0, 5], tol: [2, 0.06, 0.1, 0.1, 2, 0.1, 0.15, 3, 0.06, 0.15, 4], opts: { turn: true, turnRate: 0.4 },
    script: (p, AP) => [
      park(0, { aim: p[5], over: p[6] }, (m) => m.goalIndex > 0 && m.t >= p[0]),
      ...held(AP, p[1], 'pyre', (m) => m.dvUsed() >= m._dv0 + p[2]),
      { wait: p[7] },
      ...fix(1, 150, { aim: p[8], over: p[9] }),
      { coast: (m, c) => { const d = dGoal(m, 1), r = d < p[10] || (c.dl != null && d > c.dl); c.dl = d; return r; } },
      ...approach(1, p[3], p[4], {}, { aim: p[5], over: p[6] }),
    ],
  },

};

const fails = {
  nightwatch: [
    { name: 'coast and watch', steps: () => [] },
    { name: 'climb from under the night side', opts: proofs.nightwatch.opts, steps: (AP) => { const p = proofs.nightwatch.p.slice(); p[11] += 16; return proofs.nightwatch.script(p, AP); } },
    { name: 'match the marker once and let it ride', opts: proofs.nightwatch.opts, steps: (AP) => {
      const p = proofs.nightwatch.p, s = proofs.nightwatch.script(p, AP);
      return [s[0], s[1], s[2], s[3], s[4], s[5], park(0, { db: 99 }, doneGoal(0)), ...s.slice(7)];
    } },
  ],
};

module.exports = { levels, proofs, fails, l2Scale, nearPoint };
