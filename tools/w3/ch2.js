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
    par: 3, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 760 },
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
    par: 4, bounds: 2500, tMax: 1500, predict: 220, view: { x: 0, y: 0, span: 1000 },
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
];

const proofs = {
  asteroidrun: {
    p: [51, 290, 285], scale: [3, 10, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
    ],
  },
};

proofs.debriscloud = {
  p: [80, 400], scale: [3, 10],
  script: (p, AP) => [
    { wait: p[0] },
    { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
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
