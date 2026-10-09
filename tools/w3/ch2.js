// World 3 · Chapter 2 · Weaving: threading through moving objects in gravity.
'use strict';
const { ship, C, belt } = require('../../js/levels.js');

const rock = (id, parent, a, phase, radius) => ({
  id, name: 'Asteroid', kind: 'rock', gm: 0, radius, color: C.rock, noRail: true, orbit: { parent, a, phase },
});

// Debris clouds sharing one orbit, evenly spaced: keep-out zones around small rocks.
const cloudRing = (parent, n, a, phase0, keepOut) => Array.from({ length: n }, (_, k) => ({
  id: 'cloud' + k, name: 'Debris Cloud', kind: 'rock', gm: 0, radius: 5, color: C.rock, noRail: k > 0, keepOut,
  orbit: { parent, a, phase: phase0 + k * 2 * Math.PI / n },
}));

// Zero-G guidance (from tools/proofs.js): fly toward (x, y) at speed V until
// done(m), burning only along the velocity error when it is worth fixing.
function goTo(x, y, V, done) {
  return {
    control: (m, ctx) => {
      if (done(m)) return { done: true };
      const s = m.ship, dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy) || 1;
      const ex = V * dx / d - s.vx, ey = V * dy / d - s.vy, e = Math.hypot(ex, ey);
      if (ctx.burning ? e < 0.04 : e < 0.3) { ctx.burning = false; return { thrust: false, angle: null, dt: 0.1 }; }
      ctx.burning = true;
      return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
    },
  };
}
// Zero-G stop: coast in, flip to retrograde once, brake to a crawl, drift the rest.
function dockAt(x, y, flip) {
  return {
    control: (m, ctx) => {
      if (m.status !== 'flying') return { done: true };
      const s = m.ship, d = Math.hypot(x - s.x, y - s.y), v = Math.hypot(s.vx, s.vy);
      if (!ctx.braking && d < v * flip + v * v / 1.6 + 10) ctx.braking = true;
      if (!ctx.braking || v < 0.3) return { thrust: false, angle: ctx.braking ? Math.atan2(-s.vy, -s.vx) : null, dt: 0.1 };
      return { thrust: true, angle: Math.atan2(-s.vy, -s.vx), tol: 0.08 };
    },
  };
}

// Close Quarters: the depot's starting angle.
const DEPOT = +(process.env.DP || 1.6);

// Rendezvous with a moving body: steer the velocity toward the body's
// velocity plus a slow approach (k per unit distance, capped at vMax),
// burning only when the error is worth fixing.
function approach(id, k, vMax) {
  return {
    control: (m, ctx) => {
      if (m.status !== 'flying') return { done: true };
      const sys = m.sys; sys.update(m.t);
      const i = sys.byId[id].index, s = m.ship;
      const dx = sys.px[i] - s.x, dy = sys.py[i] - s.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(vMax, k * d);
      const ex = sys.vx[i] + sp * dx / d - s.vx, ey = sys.vy[i] + sp * dy / d - s.vy, e = Math.hypot(ex, ey);
      if (ctx.burning ? e < 0.02 : e < 0.15) { ctx.burning = false; return { thrust: false, angle: null, dt: 0.1 }; }
      ctx.burning = true;
      return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
    },
  };
}
const distTo = (m, id) => {
  m.sys.update(m.t);
  const i = m.sys.byId[id].index;
  return Math.hypot(m.ship.x - m.sys.px[i], m.ship.y - m.sys.py[i]);
};

const levels = [
  {
    id: 'asteroidrun',
    name: 'Asteroid Run',
    intro: 'TODO',
    objective: 'Fly through Gates 1 and 2, then orbit Terra between 270 and 330.',
    teaches: 'Weaving through orbiting rocks',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ...belt('terra', 16, 180, 260, 23, 'rock'),
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 110, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1 }),
    goals: [
      { type: 'reach', x: -35, y: 162, r: 25, label: 'Gate 1' },
      { type: 'reach', x: -174, y: 151, r: 25, label: 'Gate 2' },
      { type: 'orbit', body: 'terra', rMin: 280, rMax: 320 },
    ],
    par: 5.5, bounds: 2000, tMax: 600, predict: 200, view: { x: 0, y: 0, span: 760 },
  },
  {
    id: 'debriscloud',
    name: 'Debris Cloud',
    intro: 'TODO',
    objective: 'Impact Luna without entering any debris cloud.',
    teaches: 'Timing a transfer through a gap',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 2.4 } },
      ...cloudRing('terra', 8, 250, 0.25, 52),
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0 } }, heading: 'prograde', dv: 5, accel: 1 }),
    goals: [{ type: 'hit', body: 'luna' }],
    par: 3.1, bounds: 2500, tMax: 1000, predict: 220, view: { x: 0, y: 0, span: 1000 },
  },
  {
    id: 'detour',
    name: 'Detour',
    intro: 'TODO',
    objective: 'Collect the fuel canister without entering the keep-out zone, then impact Luna.',
    teaches: 'Is the detour worth the fuel?',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'canister', name: 'Fuel', gm: 0, radius: 7, color: '#ffb35a', kind: 'fuel', pickup: true, dv: 5, orbit: { parent: 'terra', a: 220, phase: 1.6 } },
      { id: 'tanker', name: 'Tanker', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 22, orbit: { parent: 'canister', a: 32, n: Math.sqrt(20000 / 220 ** 3), phase: 1.6 + Math.PI } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 100, angle: 0 } }, heading: 'prograde', dv: 3.5, accel: 1 }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 400, rMax: 460 }],
    par: 4, bounds: 2500, tMax: 600, predict: 220, view: { x: 0, y: 0, span: 1000 },
  },
  {
    id: 'sentryfield',
    name: 'Sentry Field',
    intro: 'Zero gravity, and a field of sentries you may not come near: two stand still, one circles. The survey beacon has to go to the marker in the middle of the closed zone, where you can\'t follow. Line up so your path runs through the marker, drop the beacon (E), then steer clear of the zone and stop at the depot. Turning costs propellant you don\'t have much of.',
    objective: 'Drop the beacon into the marked spot inside the closed zone, then park beside the depot (within 25, relative speed under 0.6) without entering any keep-out zone.',
    teaches: 'Zero-G · keep-out zones · drops',
    zeroG: true,
    bodies: [
      { id: 'depot', name: 'Depot', gm: 1e-6, radius: 6, color: C.station, kind: 'station', x: 900, y: 0 },
      { id: 'closed', name: 'Closed Zone', gm: 0, radius: 3, color: '#ff8a8a', kind: 'station', keepOut: 90, x: 450, y: 0 },
      { id: 'sentryA', name: 'Sentry A', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 55, x: 250, y: 200 },
      { id: 'sentryB', name: 'Sentry B', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 55, x: 650, y: -200 },
      { id: 'sentryC', name: 'Sentry C', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 45, orbit: { parent: 'depot', a: 170, n: 0.03, phase: 2.2 } },
    ],
    ship: ship({ start: { free: { x: 0, y: 0 } }, heading: 0, dv: 7, accel: 1, rcs: { fuel: 5 }, cargo: [{ id: 'beacon', name: 'Beacon', mass: 0.2 }] }),
    goals: [
      { type: 'reach', body: 'closed', craft: 'beacon', r: 15, label: 'Survey mark' },
      { type: 'rendezvous', body: 'depot', dist: 25, relVel: 0.6 },
    ],
    par: 5.5, bounds: 2500, tMax: 1500, predict: 250, view: { x: 450, y: 0, span: 1200 }, startCam: 'overview',
  },
  {
    id: 'closequarters',
    name: 'Close Quarters',
    intro: 'TODO',
    objective: 'Rendezvous with the depot (within 15, relative speed under 0.5) without entering either guard\'s keep-out zone.',
    teaches: 'Rendezvous from below',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'depot', name: 'Depot', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 260, phase: DEPOT } },
      { id: 'guardA', name: 'Guard A', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: +(process.env.KO || 35), orbit: { parent: 'terra', a: 260, phase: DEPOT + +(process.env.GS || 0.21) } },
      { id: 'guardB', name: 'Guard B', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: +(process.env.KO || 35), orbit: { parent: 'terra', a: 260, phase: DEPOT - +(process.env.GS || 0.21) } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 150, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1 }),
    goals: [{ type: 'rendezvous', body: 'depot', dist: 15, relVel: 0.5 }],
    par: 4, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 800 },
  },
];

const proofs = {
  asteroidrun: {
    p: [48.673, 286.436, 279.29], scale: [3, 10, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
    ],
  },
};

proofs.debriscloud = {
  p: [79.78, 304.401], scale: [3, 10],
  script: (p, AP) => [
    { wait: p[0] },
    { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
  ],
};

proofs.detour = {
  p: [3.671, 233.23, 401.255, 7.519, 400.26], scale: [0.2, 4, 10, 5, 10],
  script: (p, AP) => [
    { wait: p[0] },
    { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
    { coast: (m) => m.collected.size > 0 || m.t > 250 },
    { wait: Math.max(0, p[3]) },
    { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[2] },
    { coast: (m) => !AP.orb(m, 'terra').rising },
    { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[4] },
  ],
};

proofs.closequarters = {
  // Hohmann climb timed to arrive under the depot, then brake onto it.
  p: [15, 262, 60, 0.05, 0.6], scale: [3, 5, 15, 0.02, 0.2],
  script: (p, AP) => [
    { wait: p[0] },
    { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
    { coast: (m) => distTo(m, 'depot') < p[2] },
    approach('depot', p[3], p[4]),
  ],
};

proofs.sentryfield = {
  // Head for the survey mark, drop the beacon on the way in, swerve below
  // the closed zone through waypoint (p[1], p[2]), then stop at the depot.
  p: [1.5, 450, -150, 200], scale: [0.3, 40, 20, 30], opts: { turn: true, turnRate: 0.15 },
  script: (p) => [
    goTo(450, 0, p[0], (m) => m.ship.x > 450 - 90 - p[3]),
    { drop: true },
    goTo(p[1], p[2], p[0], (m) => Math.hypot(m.ship.x - p[1], m.ship.y - p[2]) < 40),
    goTo(885, -12, p[0], (m) => Math.hypot(m.ship.x - 885, m.ship.y + 12) < 120),
    dockAt(885, -12, 25),
  ],
};

const fails = {
  detour: [
    // Skip the canister: the tank alone runs dry on the way up.
    { name: 'skip the canister', steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 430 },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 420 },
    ] },
    // The cheap way up to the canister rises right through the tanker's zone.
    { name: 'straight up into the canister', steps: (AP) => proofs.detour.script([3.0, 221, 430, 0, 420], AP) },
  ],
  debriscloud: [
    // The usual Moon Shot: burn at the first launch window.
    { name: 'first window', steps: (AP) => proofs.debriscloud.script([9, 400], AP) },
  ],
  sentryfield: [
    // Straight down the middle: drop on the way and keep going.
    { name: 'straight through', opts: { turn: true, turnRate: 0.15 }, steps: () => [
      goTo(450, 0, 1.5, (m) => m.ship.x > 260),
      { drop: true },
      goTo(885, -12, 1.5, (m) => Math.hypot(m.ship.x - 885, m.ship.y + 12) < 120),
      dockAt(885, -12, 25),
    ] },
  ],
  asteroidrun: [
    { name: 'climb at once', steps: (AP) => proofs.asteroidrun.script([0, 290, 285], AP) },
  ],
};

module.exports = { levels, proofs, fails };
