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

// Turn to face dir once (relative to Terra), then hold still until done(m):
// a pilot pre-pointing for the next burn without chasing it with the thrusters.
function turnThen(dir, done) {
  return {
    control: (m, ctx) => {
      if (done(m)) return { done: true };
      if (!ctx.aligned) {
        const a = AP_.aim(m, dir, 'terra'), err = AP_.wrap(a - m.ship.angle);
        if (Math.abs(err) < 0.03 && Math.abs(m.ship.omega) < 0.02) ctx.aligned = true;
        else return { thrust: false, angle: a, dt: 0.1 };
      }
      return { thrust: false, angle: null, dt: 0.25 };
    },
  };
}

// Match a body's motion plus a drift of V toward it (until within 0.05).
function approach(id, V, tol) {
  return {
    control: (m) => {
      m.sys.update(m.t);
      const i = m.sys.byId[id].index, s = m.ship;
      const dx = m.sys.px[i] - s.x, dy = m.sys.py[i] - s.y, d = Math.hypot(dx, dy);
      const wx = m.sys.vx[i] + V * dx / d - s.vx, wy = m.sys.vy[i] + V * dy / d - s.vy;
      if (Math.hypot(wx, wy) < (tol || 0.05)) return { done: true };
      return { thrust: true, angle: Math.atan2(wy, wx) };
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
    intro: 'Science wants a crater on Luna and close-up photos of it, but Luna now has a red keep-out zone for ships. Probes may pass. Aim your whole ship at Luna and drop the probe (E) while the path still ends on Luna, then nudge yourself off the collision course so you sweep past just outside the zone. The earlier you dodge, the smaller the nudge.',
    objective: 'Crash the probe into Luna, then pass within 75 of Luna without entering its zone, and stay in an orbit between 80 and 600 from Terra.',
    teaches: 'Drop, then dodge a zone',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'luna', name: 'Luna', gm: 2500, radius: 18, color: C.grey, keepOut: 45, orbit: { parent: 'terra', a: 420, phase: 2.2 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 7.5, accel: 1, cargo: [{ id: 'probe', name: 'Probe', mass: 0.4 }] }),
    goals: [
      { type: 'hit', body: 'luna', craft: 'probe' },
      { type: 'reach', body: 'luna', r: 75, label: 'Photo pass' },
      { type: 'orbit', body: 'terra', rMin: 80, rMax: 600 },
    ],
    par: 5.3, bounds: 3000, tMax: 1000, predict: 260, view: { x: 0, y: 0, span: 1000 },
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
    intro: 'The survey beacon has to settle inside an amber drop zone that rides its own orbit, and you may not follow it in. Thrown in fast, it just sails through. Fly up close to the zone, match its motion, then give the ship a gentle push toward the marker and drop the beacon (E): it drifts in slowly while you turn away and burn retrograde, down to your working orbit.',
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
    par: 6, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 760 },
  },
  {
    id: 'twinzones',
    name: 'Twin Zones',
    intro: 'Two stations, one probe each, and both amber zones are closed to everything: each lets in only its own probe. Line up on Station Alpha, drop Probe A (E) before its zone, and burn on toward Beta at once, which also takes you off A\'s collision course. Drop Probe B the same way, then come back down. The side thrusters are short on propellant: turn slowly, and only when you must.',
    objective: 'Deliver Probe A to Alpha and Probe B to Beta (each within 12) without any craft entering the wrong zone, then orbit Terra between 100 and 180.',
    teaches: 'Two drops, two closed zones',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'alpha', name: 'Station Alpha', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 210, phase: 1.26 } },
      { id: 'beta', name: 'Station Beta', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 330, phase: 2.3 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1, rcs: { fuel: 60 }, cargo: [{ id: 'a', name: 'Probe A', mass: 0.25 }, { id: 'b', name: 'Probe B', mass: 0.25 }] }),
    goals: [
      { type: 'reach', body: 'alpha', craft: 'a', r: 12, label: 'Alpha dock' },
      { type: 'reach', body: 'beta', craft: 'b', r: 12, label: 'Beta dock' },
      { type: 'orbit', body: 'terra', rMin: 100, rMax: 180 },
    ],
    par: 6, bounds: 2500, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 860 },
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
    p: [5.56, 466.438, 280.919, -3.01, 0.062], scale: [6, 15, 40, 1.5, 0.4],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => AP.orb(m, 'luna').r < p[2] },
      { drop: true },
      { burn: p[3], rel: 'luna', max: Math.max(0, p[4]) },
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
    p: [5, 6, 50, 330, 50, 172, 155], scale: [8, 3, 15, 8, 10, 8, 8], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: p[0] },
      // Burn until the path runs through Alpha, coast in and drop short of the zone.
      { burn: 'pro', until: (m) => closest(m, 'alpha', 120) < p[1] },
      still((m) => dist(m, 'alpha') < p[2]),
      { drop: true },
      // Burning on for Beta is also the dodge.
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[3] },
      // Beta catches up from behind: face retrograde, drop at the top, get out of its way.
      turnThen('retro', (m) => !AP.orb(m, 'terra').rising || dist(m, 'beta') < p[4]),
      { drop: true },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[5] },
      still((m) => AP.orb(m, 'terra').rising),
      still((m) => !AP.orb(m, 'terra').rising),
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= p[6] },
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
  ],
  shieldedmoon: [
    { name: 'follow the probe in', steps: (AP) => [
      { wait: 5.626 },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 470.697 },
      { coast: (m) => AP.orb(m, 'luna').r < 276 },
      { drop: true },
    ] },
    { name: 'drop close in, then dodge (Moon Mail)', steps: (AP) => [
      { wait: 5.626 },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 470.697 },
      { coast: (m) => AP.orb(m, 'luna').r < 120 },
      { drop: true },
      { burn: 'out', rel: 'luna', max: 0.6 },
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
};

module.exports = { levels, proofs, fails };
