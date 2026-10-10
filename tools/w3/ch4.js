// World 3 · Chapter 4 · Zone Drops: probes and spent stages meet keep-out
// zones. Introduces zones closed to everything (zone: 'all'), so where a
// probe or a booster drifts matters as much as where the ship goes.
'use strict';
const { ship, C } = require('../../js/levels.js');
const Phys = require('../../js/physics.js');
const AP_ = require('../autopilot.js');

const AMBER = '#ffb466';
const dist = (m, id) => { m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(m.ship.x - m.sys.px[i], m.ship.y - m.sys.py[i]); };

// Closest the ship's coasting path comes to a body within T seconds (what the
// predicted path and its closest-approach marker show a player).
function closest(m, id, T) {
  // Cached for 0.03 s of mission time: burns call this every tick.
  const c = m._closest || (m._closest = {});
  const key = id + ':' + T;
  if (c[key] && m.t - c[key].t < 0.03 && m.t >= c[key].t) return c[key].d;
  const d = closestNow(m, id, T);
  c[key] = { t: m.t, d };
  return d;
}
function closestNow(m, id, T) {
  const sys = m.sys, i = sys.byId[id].index, s = { x: m.ship.x, y: m.ship.y, vx: m.ship.vx, vy: m.ship.vy }, bp = [0, 0];
  let t = m.t, best = Infinity;
  while (t < m.t + T) {
    const dt = Phys.coastDt(sys, s, t, 0.05, 1);
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
    sys.posAt(i, t, bp);
    best = Math.min(best, Math.hypot(s.x - bp[0], s.y - bp[1]));
    if (Phys.collision(sys, s.x, s.y, t) >= 0) break;
  }
  sys.update(m.t);
  return best;
}

// Coast with the nose held still (no side thrusters spent tracking a target).
const still = (until) => ({ control: (m) => until(m) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });

// Turn to face dir (relative to Terra) and stop there (honest turning only).
function turnTo(dir) {
  return {
    control: (m) => {
      const a = AP_.aim(m, dir, 'terra'), err = AP_.wrap(a - m.ship.angle);
      if (Math.abs(err) < 0.04) return { done: true };
      return { thrust: false, angle: a, dt: 0.1 };
    },
    max: 60,
  };
}

const levels = [
  {
    id: 'cleanzone',
    name: 'Clean Zone',
    intro: 'Haven Station\'s amber zone is closed to everything: your ship, dropped cargo and spent stages. A booster dropped on an orbit that crosses the zone\'s orbit drifts in sooner or later. Climb on the booster, and keep burning it at the top until its whole orbit is above the zone\'s band (watch PE) before you deploy the satellite to finish the job.',
    objective: 'Put the satellite in an orbit between 320 and 380 without your ship or your spent booster entering Haven\'s zone.',
    teaches: 'Zones closed to everything',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'haven', name: 'Haven Station', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 200, phase: 2.0 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 150, angle: 0 } }, heading: 'prograde', stack: [
      { id: 'booster', name: 'Booster', dv: 3.45, accel: 0.8 },
      { name: 'Satellite', dv: 2.6, accel: 0.6, dry: 0.3 },
    ] }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 320, rMax: 380 }],
    par: 4.1, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 840 },
  },
  {
    id: 'shieldedmoon',
    name: 'Shielded Moon',
    intro: 'You are already on a collision course with Luna, and its red keep-out zone for ships is only minutes away. Probes may pass, so drop the probe (E) now, while your path still ends on Luna, then burn sideways until your own path clears the zone. The longer you wait, the bigger the dodge. Brake into an orbit outside the zone to watch the impact.',
    objective: 'Crash the probe into Luna, then orbit Luna between 55 and 110 without entering its keep-out zone.',
    teaches: 'Drop, then dodge a zone',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'luna', name: 'Luna', gm: 2500, radius: 18, color: C.grey, keepOut: 45, orbit: { parent: 'terra', a: 420, phase: 2.4963 } },
    ],
    ship: ship({ start: { conic: { body: 'terra', pe: 90.245, e: 0.6844, nu: 1.4634, angle: 1.226 } }, heading: 'prograde', dv: 3.6, accel: 1, cargo: [{ id: 'probe', name: 'Probe', mass: 0.4 }] }),
    goals: [
      { type: 'hit', body: 'luna', craft: 'probe' },
      { type: 'orbit', body: 'luna', rMin: 55, rMax: 110 },
    ],
    par: 2.4, bounds: 2500, tMax: 600, predict: 200, view: { x: 0, y: 0, span: 1000 },
  },
  {
    id: 'rangesafety',
    name: 'Range Safety',
    intro: 'Your upper stage has to come down, not stay in orbit, but Port Kiri sits under the usual reentry path and its amber zone is closed to everything. Climb on the upper stage, burn it retrograde at the top until its path falls into Terra, then turn prograde and deploy the satellite. Before you deploy, check where the dashed path hits the ground: it must be open sea. When you start the climb decides where that is.',
    objective: 'Bring the upper stage down anywhere outside Port Kiri\'s zone, and put the satellite in an orbit between 220 and 280.',
    teaches: 'Where the stage comes down',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'port', name: 'Port Kiri', gm: 0, radius: 3, color: AMBER, kind: 'station', keepOut: 30, zone: 'all', x: 49.003, y: 9.933 },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 100, angle: 0 } }, heading: 'prograde', stack: [
      { id: 'upper', name: 'Upper stage', dv: 4.8, accel: 0.8 },
      { name: 'Satellite', dv: 6.6, accel: 0.9, dry: 0.3 },
    ] }),
    goals: [
      { type: 'hit', body: 'terra', craft: 'upper', deorbit: true, label: 'Open sea' },
      { type: 'orbit', body: 'terra', rMin: 220, rMax: 280 },
    ],
    par: 8.1, bounds: 2000, tMax: 900, predict: 200, view: { x: 0, y: 0, span: 640 },
  },
  {
    id: 'airdrop',
    name: 'Air Drop',
    intro: 'The survey beacon has to settle inside an amber drop zone that rides its own orbit, and you may not follow it in. Thrown in from a transfer orbit, it just sails through. Round off your orbit a little below the zone\'s, behind it, so you creep up on it slowly. Drop the beacon (E) and it drifts through the marker slowly enough to count. But you are on the same path: leave it at once, down to your working orbit.',
    objective: 'Get the beacon within 20 of the marker, moving slower than 1.5 relative to it, for 8 s; then orbit Terra between 150 and 250 without entering the zone.',
    teaches: 'Drop zones in space',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'mark', name: 'Drop Zone', gm: 0, radius: 3, color: AMBER, kind: 'station', keepOut: 40, zone: 'all', orbit: { parent: 'terra', a: 300, phase: 1.6 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 150, angle: 0 } }, heading: 'prograde', dv: 6.5, accel: 1, cargo: [{ id: 'beacon', name: 'Beacon', mass: 0.2 }] }),
    goals: [
      { type: 'hold', body: 'mark', craft: 'beacon', r: 20, hold: 8, relVel: 1.5, label: 'Marker' },
      { type: 'orbit', body: 'terra', rMin: 150, rMax: 250 },
    ],
    par: 4.1, bounds: 2000, tMax: 900, predict: 200, view: { x: 0, y: 0, span: 760 },
  },
  {
    id: 'twinzones',
    name: 'Twin Zones',
    intro: 'You are already coasting up on a path that runs straight into Station Alpha\'s amber zone, so drop Probe A (E) soon, short of the zone, and burn on toward Beta at once: that burn is also your dodge. Both zones are closed to everything and each lets in only its own probe. Drop Probe B the same way and push a little higher so Beta passes beneath you, then turn round once and brake down to your working orbit. Side-thruster propellant is short: hold still between burns and turn slowly.',
    objective: 'Deliver Probe A to Alpha and Probe B to Beta (each within 12) without any craft entering the wrong zone, then orbit Terra between 100 and 180.',
    teaches: 'Two drops, two closed zones',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'alpha', name: 'Station Alpha', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 210, phase: 1.9106 } },
      { id: 'beta', name: 'Station Beta', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 330, phase: 2.7803 } },
    ],
    ship: ship({ start: { conic: { body: 'terra', pe: 120.048, e: 0.3161, nu: 0.2256, angle: 1.3084 } }, heading: 'prograde', dv: 5.4, accel: 1, rcs: { fuel: 5 }, cargo: [{ id: 'a', name: 'Probe A', mass: 0.25 }, { id: 'b', name: 'Probe B', mass: 0.25 }] }),
    goals: [
      { type: 'reach', body: 'alpha', craft: 'a', r: 12, label: 'Alpha dock' },
      { type: 'reach', body: 'beta', craft: 'b', r: 12, label: 'Beta dock' },
      { type: 'orbit', body: 'terra', rMin: 100, rMax: 180 },
    ],
    par: 3.6, bounds: 2500, tMax: 600, predict: 200, view: { x: 0, y: 0, span: 860 },
  },
  {
    id: 'crossingtraffic',
    name: 'Crossing Traffic',
    intro: 'Your stack is coasting up on a suborbital arc: at the top it starts falling back to Terra, so you have one pass at the top to make orbit. Two guard satellites patrol a long, stretched lane from 85 to 405, and their amber zones are closed to everything, so any spent stage left in orbit here crosses it sooner or later. Let the booster fall back: deploy it now, while its path still ends on Terra, and round off the orbit on the satellite alone. Turn round before the top, not at it. Side-thruster propellant is short, and your nose ends up facing backwards at the top if you leave it alone.',
    objective: 'Put the satellite in an orbit between 300 and 360, with the booster brought down and no craft entering a guard\'s zone.',
    teaches: 'Planned flips · let the booster fall',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'guard1', name: 'Guard 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 25, zone: 'all', orbit: { parent: 'terra', a: 245, e: 0.55, phase: 1.0, argp: 2.0 } },
      { id: 'guard2', name: 'Guard 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 25, zone: 'all', orbit: { parent: 'terra', a: 245, e: 0.55, phase: 1.0 + Math.PI, argp: 2.0 } },
    ],
    ship: ship({ start: { conic: { body: 'terra', pe: 40, e: 0.7838, nu: 1.838, angle: -1.838 } }, heading: 'prograde', rcs: { fuel: 60 }, stack: [
      { id: 'booster', name: 'Booster', dv: 1.2, accel: 0.8 },
      { name: 'Satellite', dv: 5.5, accel: 0.6, dry: 0.3 },
    ] }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 300, rMax: 360 }],
    par: 4.6, bounds: 2000, tMax: 400, predict: 200, view: { x: 0, y: 0, span: 900 },
  },
];

const proofs = {
  cleanzone: {
    p: [39.255, 324.374, 287.598, 319.825], scale: [15, 10, 8, 5],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[3] },
    ],
  },
  shieldedmoon: {
    p: [-0.072, 0.5, 44.963, 119.413], scale: [3, 0.6, 8, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { drop: true },
      // Dodge: burn off the collision course until the low point clears the zone.
      { burn: p[1], rel: 'luna', until: (m) => closest(m, 'luna', 150) >= p[2] },
      { coast: (m) => AP.orb(m, 'luna').r < 150 && AP.orb(m, 'luna').rising },
      { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[3]; } },
    ],
  },
  rangesafety: {
    p: [25, 272.2, 60.8, 220], scale: [10, 10, 4, 4],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[2] },
      // Nose prograde: the separation spring pushes the stage down.
      { fn: (m) => { m.ship.angle = AP.aim(m, 'pro'); } },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[3] },
    ],
  },
  airdrop: {
    p: [-0.627, 275.775, 275.924, 125.509, 249.067, 249.483], scale: [10, 5, 5, 20, 10, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      // Round off just below the zone's orbit: you creep up on it slowly.
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
      { coast: (m) => dist(m, 'mark') < p[3] },
      { drop: true },
      // You share the beacon's orbit: leave it at once.
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe <= p[4] },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= p[5] },
    ],
  },
  twinzones: {
    p: [0, 5.459, 93.984, 4.922, 113.491, 0.51, 137.203, 180.217], scale: [0, 0, 12, 3, 12, 0.3, 10, 5], opts: { turn: true, turnRate: 0.15 },
    script: (p, AP) => { let d0 = null; return [
      // Already on a path through Alpha: drop short of the zone.
      still((m) => dist(m, 'alpha') < p[2]),
      { drop: true },
      // Burning on for Beta is also the dodge.
      { burn: 'pro', until: (m) => closest(m, 'beta', 250) < p[3] },
      still((m) => dist(m, 'beta') < p[4]),
      { drop: true },
      // A short prograde push and Beta passes beneath you.
      { burn: 'pro', until: (m) => m.dvUsed() - (d0 == null ? (d0 = m.dvUsed()) : d0) >= p[5] },
      // One flip, then brake at the top and again at the bottom.
      still((m) => !AP.orb(m, 'terra').rising),
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[6] },
      // Face retrograde again just before the low point (it has swung round).
      still((m) => AP.orb(m, 'terra').r < p[6] + 40),
      turnTo('retro'),
      still((m) => AP.orb(m, 'terra').rising),
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= p[7] },
    ]; },
  },
  crossingtraffic: {
    p: [60, 299.21, 8.394], scale: [4, 8, 4], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      // Coast up holding still, then the one flip, timed to finish at the top.
      still((m) => { const o = AP.orb(m, 'terra'); return o.ap - o.r < p[2]; }),
      turnTo('pro'),
      // Start rounding off on the booster, but stop while its path still
      // falls back (the separation spring takes a little more off its PE).
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[0] },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[1] },
    ],
  },
};

const fails = {
  cleanzone: [
    { name: 'deploy after the transfer burn', steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 350 },
      { deploy: true },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 325 },
    ] },
    { name: 'burn the booster dry', steps: (AP) => [
      { burn: 'pro', until: () => false },
      { deploy: true },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= 380 },
    ] },
  ],
  shieldedmoon: [
    { name: 'follow the probe in', steps: () => [{ drop: true }] },
    { name: 'drop close in, then dodge (Moon Mail)', steps: (AP) => [
      { coast: (m) => AP.orb(m, 'luna').r < 120 },
      { drop: true },
      { burn: 'out', rel: 'luna', until: (m) => closest(m, 'luna', 150) >= 60 },
      { coast: (m) => AP.orb(m, 'luna').r < 150 && AP.orb(m, 'luna').rising },
      { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= 100; } },
    ] },
    { name: 'dawdle 40 s, then the same drop and dodge', steps: (AP) => [
      { wait: 40 },
      ...proofs.shieldedmoon.script(proofs.shieldedmoon.p, AP),
    ] },
  ],
  rangesafety: [
    { name: 'Leave No Junk at once', steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 272.2 },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= 60.8 },
      { fn: (m) => { m.ship.angle = AP.aim(m, 'pro'); } },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 220 },
    ] },
  ],
  airdrop: [
    { name: 'throw it in from the transfer', steps: (AP) => [
      { wait: 8 },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 300 },
      { coast: (m) => dist(m, 'mark') < 70 },
      { drop: true },
      { burn: 'retro', rel: 'terra', max: 1.2 },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= 240 },
    ] },
    { name: 'drop and stay on the beacon\'s orbit', steps: (AP) => [
      { wait: -16.593 },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 279 },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 277.6 },
      { coast: (m) => dist(m, 'mark') < 107 },
      { drop: true },
    ] },
  ],
  crossingtraffic: [
    { name: 'round off on the booster', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => [
      { coast: (m) => { const o = AP.orb(m, 'terra'); return o.r > o.ap - 40 && o.rising; } },
      { burn: 'pro', stage: true, until: (m) => AP.orb(m, 'terra').pe >= 300 },
    ] },
    { name: 'dawdle: flip and burn 20 s after the top', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => [
      { deploy: true },
      still((m) => !AP.orb(m, 'terra').rising),
      { wait: 20 },
      turnTo('pro'),
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 300 },
    ] },
    { name: 'track prograde all the way up, fast turns', opts: { turn: true, turnRate: 0.6 }, steps: (AP) => [
      { deploy: true },
      { coast: (m) => { const o = AP.orb(m, 'terra'); return o.r > o.ap - 40 && o.rising; } },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 300 },
    ] },
  ],
  twinzones: [
    { name: 'drop both probes for Alpha', opts: { turn: true, turnRate: 0.15 }, steps: (AP) => {
      const p = proofs.twinzones.p;
      return [
        still((m) => dist(m, 'alpha') < p[2]),
        { drop: true },
        { drop: true },
        { burn: 'pro', until: (m) => closest(m, 'beta', 250) < p[3] },
      ];
    } },
    { name: 'follow Probe A in', opts: { turn: true, turnRate: 0.15 }, steps: (AP) => {
      const p = proofs.twinzones.p;
      return [
        still((m) => dist(m, 'alpha') < p[2]),
        { drop: true },
      ];
    } },
    { name: 'the same plan with fast turns (holding the keys)', opts: { turn: true, turnRate: 0.6 }, steps: (AP) => proofs.twinzones.script(proofs.twinzones.p, AP) },
    { name: 'dawdle 30 s, then the same plan', opts: { turn: true, turnRate: 0.15 }, steps: (AP) => [
      { wait: 30 },
      ...proofs.twinzones.script(proofs.twinzones.p, AP),
    ] },
  ],
};

module.exports = { levels, proofs, fails };
