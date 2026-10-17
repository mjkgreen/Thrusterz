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
// frame), close in at up to vMax, and only fire when the drift is worth a
// burn (dead band `db` k/s). Runs until pred (or the mission ends).
const park = (gi, opt, pred) => {
  const o = Object.assign({ k: 0.04, vMax: 0.6, db: 0.08, off: [0, 0] }, opt);
  return { control: (m, c) => {
    if (m.status !== 'flying' || (pred && pred(m, c))) return { done: true };
    const g = m.level.goals[gi], P = m.goalPoint(g), s = m.ship, sys = m.sys;
    let ux = 1, uy = 0;
    if (g.lagrange) { const b = sys.byId[g.lagrange.body], i = b.index, p = b.parent; const rx = sys.px[i] - sys.px[p], ry = sys.py[i] - sys.py[p], r = Math.hypot(rx, ry); ux = rx / r; uy = ry / r; }
    const tx = P.x + o.off[0] * ux - o.off[1] * uy, ty = P.y + o.off[0] * uy + o.off[1] * ux;
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(o.vMax, o.k * d);
    const ex = P.vx + sp * dx / d - s.vx, ey = P.vy + sp * dy / d - s.vy, e = Math.hypot(ex, ey);
    if (c.burning ? e < 0.02 : e < o.db) { c.burning = false; return { thrust: false, angle: null, dt: 0.1 }; }
    c.burning = true;
    return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
  } };
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
// Has goal gi been completed?
const doneGoal = (gi) => (m) => m.goalIndex > gi;

// ------------------------------------------------------------------ levels

// 1 · Night Watch: Lamp and Vesper, the L2 hold taught gently.
const NW = [
  { id: 'lamp', name: 'Lamp', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.1, at: 550, dose: 8 } },
  { id: 'vesper', name: 'Vesper', gm: 1000, radius: 22, color: '#6f86b8', orbit: { parent: 'lamp', a: 550, phase: 0 } },
];
const NW_K = l2Scale(NW, 'vesper');

const levels = [
  {
    id: 'nightwatch',
    name: 'Night Watch',
    intro: 'Behind Vesper, in the dark cone of its shadow, is its L2 point: the marker that keeps pace with Vesper as it goes round Lamp. You are coasting just beyond it, and nothing can stay out here on its own: you are already drifting away, and the drift grows. Brake back toward the marker, match its speed, and keep station with small taps whenever your path starts to curl away. Then let go and fall into a low orbit: Vesper pulls you down its night side, so round off at the bottom.',
    objective: 'Hold within 8 k of Vesper\'s L2 (moving with it to within 0.25 k/s) for 40 s, then orbit Vesper between 30 and 50 k from its centre.',
    teaches: 'Keep station at L2',
    bodies: NW,
    ship: ship({ start: nearPoint(NW, 'vesper', NW_K, 25, 0, 0, 0), heading: 'retrograde', dv: 4, accel: 0.6 }),
    goals: [
      { type: 'hold', lagrange: { body: 'vesper', lead: 0, scale: NW_K }, r: 8, relVel: 0.25, hold: 40, label: 'L2' },
      { type: 'orbit', body: 'vesper', rMin: 30, rMax: 50, label: 'Low orbit' },
    ],
    par: 1.2, bounds: 3000, tMax: 400, predict: 120, view: { x: 680, y: 0, span: 260 },
  },
];

const proofs = {
  nightwatch: {
    // Close in on the marker and keep station (aiming a little off it), then
    // nudge sunward to fall in and round off at the bottom.
    // p: park aim error out/ahead (k), nudge (k/s), when to round off (k from centre).
    p: [0, 0, 0.3, 40], scale: [0, 0, 0.05, 3], tol: [3, 3, 0.04, 2], opts: { turn: true, turnRate: 0.4 },
    script: (p, AP) => [
      park(0, { off: [p[0], p[1]] }, doneGoal(0)),
      ...held(AP, 'in', 'vesper', (m) => m.dvUsed() >= (m._dv0 || 0) + p[2]),
      { coast: (m) => { const o = AP.orb(m, 'vesper'); return o.r < p[3] || (!o.rising && o.r < 60 && false); } },
      { burn: 'retro', rel: 'vesper', until: (m) => AP.orb(m, 'vesper').ap <= 48 },
    ],
  },
};

const fails = {
  nightwatch: [
    { name: 'coast and watch', steps: () => [] },
  ],
};

module.exports = { levels, proofs, fails, l2Scale, nearPoint };
