// World 3 · Chapter 4 · Zone Drops: probes and spent stages meet keep-out
// zones. Introduces zones closed to everything (zone: 'all'), so where a
// probe or a booster drifts matters as much as where the ship goes.
'use strict';
const { ship, C } = require('../../js/levels.js');

const AMBER = '#ffb466';
const dist = (m, id) => { m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(m.ship.x - m.sys.px[i], m.ship.y - m.sys.py[i]); };

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
    intro: 'Port Kiri sits just downrange of the pad, right where a booster burnt to the last drop comes down, and its amber zone is closed to everything. Everywhere else is open sea. Drop the booster early (E) while its path still ends short of the town, or keep it until it flies well past, and let the satellite make up the difference. The DEPLOY NOW readout shows where it will land.',
    objective: 'Bring the booster down anywhere but Port Kiri\'s zone, and put the satellite in an orbit between 60 and 200.',
    teaches: 'Where the booster falls',
    bodies: [
      { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
      { id: 'port', name: 'Port Kiri', gm: 0, radius: 3, color: AMBER, kind: 'station', keepOut: 18, zone: 'all', orbit: { parent: 'gaia', a: 40, n: 0.085, phase: 2.1 } },
    ],
    ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, ve: 30, stack: [
      { id: 'booster', name: 'Booster', dv: 7, accel: 1.8 },
      { name: 'Satellite', dv: 5, accel: 0.9, dry: 0.25 },
    ] }),
    goals: [
      { type: 'hit', body: 'gaia', craft: 'booster', deorbit: true, label: 'Open sea' },
      { type: 'orbit', body: 'gaia', rMin: 60, rMax: 200 },
    ],
    par: 9, bounds: 2000, tMax: 900, predict: 120, view: { x: 0, y: 0, span: 420 }, startCam: 'overview',
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
    p: [70.288, 152.413, 0.243, 1.377, 45.151], scale: [5, 10, 0.05, 0.5, 15],
    script: (p) => [{ launch: { body: 'gaia', lo: p[0], hi: p[1], turn: p[2], kick: p[3], dropWhen: (m, o) => m.stage === 0 && o.ap >= p[4] } }],
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
    { name: 'burn the booster dry', steps: () => [{ launch: { body: 'gaia', lo: 80, hi: 150, turn: 0.25, kick: 0 } }] },
  ],
};

module.exports = { levels, proofs, fails };
