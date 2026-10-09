// World 3 · Chapter 5 · Grand Missions: probes and stages + keep-out zones
// (ship-only and closed to everything) + flip burns on an RCS budget.
'use strict';
const { ship, C, belt } = require('../../js/levels.js');

const ZONE = '#ff8a8a';
// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };

// Coast without pre-pointing at the next burn: hold the current attitude
// (a pilot leaves the nose alone on a long coast; turning early wastes RCS
// chasing a direction that keeps moving).
const hold = (pred) => ({ control: (m, c) => pred(m, c) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });

const levels = [
  {
    id: 'resupplyrun',
    name: 'Resupply Run',
    intro: 'Haven Station needs its supply pod, and its amber zone is closed to everything: you, the pod on its way in excepted, and your spent kick stage. A stage dropped in an orbit that reaches Haven\'s height will drift in sooner or later, so drop it while your high point is still well below the station. Then the carrier climbs the rest, releases the pod (E), and turns round to brake back down into a low orbit.',
    objective: 'Deliver the pod to Haven Station, then orbit Terra between 100 and 220, leaving nothing in Haven\'s way.',
    teaches: 'Stage before the zone · flip to come home',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'haven', name: 'Haven Station', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 40, zone: 'all', orbit: { parent: 'terra', a: 300, phase: 1.3 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 140, angle: 0 } }, heading: 'prograde', rcs: { fuel: 2 }, stack: [
      { name: 'Kick stage', dv: 2.4, accel: 1 },
      { name: 'Carrier', dv: 3, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3 }] }),
    goals: [
      { type: 'reach', body: 'haven', craft: 'pod', r: 12, label: 'Docking arm' },
      { type: 'orbit', body: 'terra', rMin: 100, rMax: 220 },
    ],
    par: 3.7, bounds: 2000, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 800 },
  },
  {
    id: 'blockade',
    name: 'Blockade Run',
    intro: 'Three patrol ships guard the orbit at 220, each inside an amber zone closed to everything. Your shuttle has to get down through their band to a low orbit, riding a big descent stage. A spent stage left in an orbit that still reaches the patrol band will drift into a zone sooner or later, so carry the stage through the band and only drop it once its whole orbit is below the patrols. Burning to go down means turning round first.',
    objective: 'Orbit Terra between 100 and 150 without your ship or its stage entering a patrol zone.',
    teaches: 'Carry the stage across the band',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'pat1', name: 'Patrol 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 220, phase: 0.4 } },
      { id: 'pat2', name: 'Patrol 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 220, phase: 0.4 + 2.094 } },
      { id: 'pat3', name: 'Patrol 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 220, phase: 0.4 + 4.189 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 360, angle: 0 } }, heading: 'prograde', rcs: { fuel: 5 }, stack: [
      { name: 'Descent stage', dv: 4.5, accel: 0.8 },
      { name: 'Shuttle', dv: 2.5, accel: 0.5, dry: 0.4, sprite: 'satellite' },
    ] }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 100, rMax: 150 }],
    par: 4.7, bounds: 2000, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 860 },
  },
  {
    id: 'mooncourier',
    name: 'Moon Courier',
    intro: 'Luna Gate circles Luna inside an amber zone closed to everything but its supply pod. Ride the transfer stage out to Luna, then drop it (the pod can only go once the stage is gone). Release the pod early on a path that meets the Gate, steer yourself clear of the zone, and flip round to brake into a low orbit beneath it.',
    objective: 'Deliver the pod to Luna Gate, then orbit Luna between 30 and 70 without entering the Gate\'s zone.',
    teaches: 'Stage, drop, swerve, capture',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 420, phase: 2.2 } },
      { id: 'gate', name: 'Luna Gate', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 25, zone: 'all', orbit: { parent: 'luna', a: 110, phase: 2.55 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', rcs: { fuel: 6 }, stack: [
      { name: 'Transfer stage', dv: 4.6, accel: 1 },
      { name: 'Carrier', dv: 2.6, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3 }] }),
    goals: [
      { type: 'reach', body: 'gate', craft: 'pod', r: 12, label: 'Docking arm' },
      { type: 'orbit', body: 'luna', rMin: 30, rMax: 70 },
    ],
    par: 6, bounds: 2500, tMax: 1500, predict: 220, view: { x: 0, y: 0, span: 1000 },
  },
];

const proofs = {
  resupplyrun: {
    p: [-22.151, 248.544, 288.085, 152.183, 110.358, 220.078], scale: [15, 10, 10, 15, 15, 10], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[2] },
      { coast: (m) => dist(m, 'haven') < p[3] },
      { drop: true },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe <= p[4] },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= p[5] },
    ],
  },
  blockade: {
    p: [31.246, 145.693, 151.059, 150.023], scale: [20, 8, 6, 4], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[1] },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= p[2] },
      { deploy: true },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= p[3] },
    ],
  },
  mooncourier: {
    p: [4.667, 428.534, 336.083, -0.144, 0.909, 63.166], scale: [2, 6, 60, 1, 0.4, 8], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { deploy: true },
      { coast: (m) => dist(m, 'luna') < p[2] },
      { drop: true },
      { burn: p[3], rel: 'luna', max: Math.max(0, p[4]) },
      hold((m) => dist(m, 'luna') < 150),
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < 100 && o.rising; } },
      { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[5]; } },
    ],
  },
};

const fails = {
  blockade: [
    { name: 'drop the stage after the first burn', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => [
      { wait: 31 },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= 146 },
      { deploy: true },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= 150 },
    ] },
    { name: 'ditch the stage up high, fly the shuttle down', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => [
      { deploy: true },
      { wait: 31 },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= 146 },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= 150 },
    ] },
    { name: 'go down at once', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.blockade.script([0].concat(proofs.blockade.p.slice(1)), AP) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.blockade.script(proofs.blockade.p, AP) },
  ],
  resupplyrun: [
    { name: 'burn the kick stage dry, then stage', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => [
      { burn: 'pro', until: () => false },
      { deploy: true },
      { coast: (m) => dist(m, 'haven') < 152 },
      { drop: true },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe <= 110 },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= 220 },
    ] },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.resupplyrun.script(proofs.resupplyrun.p, AP) },
    { name: 'keep climbing after the drop', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.resupplyrun.script(proofs.resupplyrun.p, AP).slice(0, 6) },
  ],
};

module.exports = { levels, proofs, fails };
