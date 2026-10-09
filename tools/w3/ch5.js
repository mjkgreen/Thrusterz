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

// Retrograde as it will be at the low point of the current orbit about
// `rel`: a direction that stays put while you coast in, so you flip once,
// hold still and brake through periapsis without chasing prograde round.
// off: an extra angle (radians) from that retrograde.
const peRetro = (rel, off) => (m) => {
  const s = m.ship, sys = m.sys; sys.update(m.t);
  const i = sys.byId[rel].index, gm = sys.bodies[i].gm;
  const rx = s.x - sys.px[i], ry = s.y - sys.py[i], vx = s.vx - sys.vx[i], vy = s.vy - sys.vy[i];
  const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy, rv = rx * vx + ry * vy, h = rx * vy - ry * vx;
  const ex = ((v2 - gm / r) * rx - rv * vx) / gm, ey = ((v2 - gm / r) * ry - rv * vy) / gm;
  return Math.atan2(ey, ex) + (h > 0 ? -Math.PI / 2 : Math.PI / 2) + (off || 0);
};

// A burn of a set Δv in a direction (turning first doesn't count).
const dvBurn = (dir, rel, amount) => {
  const st = { d0: 0 };
  return [
    { fn: (m) => { st.d0 = m.dvUsed(); } },
    { burn: dir, rel, until: (m) => m.dvUsed() - st.d0 >= amount },
  ];
};

const LUNA = +(process.env.LUNA || 3.29), GATE = +(process.env.GATE || 3.88);
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
    ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', rcs: { fuel: 5 }, stack: [
      { name: 'Transfer stage', dv: 4.6, accel: 1 },
      { name: 'Carrier', dv: 4.8, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3 }] }),
    goals: [
      { type: 'reach', body: 'gate', craft: 'pod', r: 12, label: 'Docking arm' },
      { type: 'orbit', body: 'luna', rMin: 30, rMax: 70 },
    ],
    par: 7.3, bounds: 2500, tMax: 1500, predict: 220, view: { x: 0, y: 0, span: 1000 },
  },
  {
    id: 'relaysling',
    name: 'Slingshot Relay',
    intro: 'The deep-space relay needs Goliath\'s slingshot to leave Terra for good, but you don\'t: your carrier stays home to talk to it. Goliath\'s radiation zone is closed to everything, relay and spent stage included. Put the stack on a path that swings wide behind Goliath, drop the stage and release the relay (E) on it, then flip and brake so that you fall back into a low orbit while the relay flies on.',
    objective: 'Send the relay 1600 away from Terra, then orbit Terra between 120 and 250 yourself.',
    teaches: 'Send the cargo, stay home',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'goliath', name: 'Goliath', gm: 5000, radius: 26, color: C.tan, keepOut: 70, zone: 'all', orbit: { parent: 'terra', a: 350, phase: 2.0 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', rcs: { fuel: 5.5 }, stack: [
      { name: 'Transfer stage', dv: 4, accel: 1 },
      { name: 'Carrier', dv: 2.5, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'relay', name: 'Relay', mass: 0.2 }] }),
    goals: [
      { type: 'escape', body: 'terra', craft: 'relay', r: 1600, label: 'Deep space' },
      { type: 'orbit', body: 'terra', rMin: 120, rMax: 250 },
    ],
    par: 4.6, bounds: 3500, tMax: 1500, predict: 300, view: { x: 0, y: 0, span: 2400 },
  },
  {
    id: 'surveydrop',
    name: 'Survey Drop',
    intro: 'Two survey sites ride the asteroid belt, each in an amber zone closed to everything but its own probe. Drop the transfer stage while your high point is still below the belt, then climb on with the carrier and release the probes on the way: probe A when your path meets Site A, then a little more climb and probe B for Site B. Then turn round, stay clear of the zones and the rocks, and brake back down to your home orbit.',
    objective: 'Deliver probe A to Site A and probe B to Site B, then orbit Sol between 430 and 520.',
    teaches: 'Two drops on one climb · flip home',
    bodies: [
      { id: 'sun', name: 'Sol', gm: 200000, radius: 60, color: C.sun },
      { id: 'sitea', name: 'Site A', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'sun', a: 720, phase: 0.88 } },
      { id: 'siteb', name: 'Site B', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'sun', a: 840, phase: 1.05 } },
      ...belt('sun', 26, 690, 870, 977),
    ],
    ship: ship({ start: { orbit: { body: 'sun', r: 450, angle: 0 } }, heading: 'prograde', rcs: { fuel: 6 }, stack: [
      { name: 'Transfer stage', dv: 3.2, accel: 1.2 },
      { name: 'Carrier', dv: 3.5, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pa', name: 'Probe A', mass: 0.2 }, { id: 'pb', name: 'Probe B', mass: 0.2 }] }),
    goals: [
      { type: 'reach', body: 'sitea', craft: 'pa', r: 12, label: 'Site A' },
      { type: 'reach', body: 'siteb', craft: 'pb', r: 12, label: 'Site B' },
      { type: 'orbit', body: 'sun', rMin: 430, rMax: 520 },
    ],
    par: 6, bounds: 4000, tMax: 3000, predict: 400, view: { x: 0, y: 0, span: 2200 },
  },
  {
    id: 'longhaul',
    name: 'The Long Haul',
    intro: 'Everything at once. Climb through the patrol band at 200 and only drop the booster once its whole orbit is above it. Then aim the transfer stage at Luna itself and drop it there, since an empty stage left looping out toward Luna would drift into Haven\'s zone. Nudge the carrier off the collision course onto a path past Luna Gate, release the pod, swerve wide of the Gate\'s zone, and flip to brake into orbit. Every zone here is closed to everything, and the side thrusters have little to spare.',
    objective: 'Deliver the pod to Luna Gate, then orbit Luna between 100 and 160, leaving no stage where it can drift into a zone.',
    teaches: 'Everything at once',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'pat1', name: 'Patrol 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 200, phase: 0.3 } },
      { id: 'pat2', name: 'Patrol 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 200, phase: 0.3 + 2.094 } },
      { id: 'pat3', name: 'Patrol 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 200, phase: 0.3 + 4.189 } },
      { id: 'haven', name: 'Haven Station', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 340, phase: 4.0 } },
      { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 480, phase: LUNA } },
      { id: 'gate', name: 'Luna Gate', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 18, zone: 'all', orbit: { parent: 'luna', a: 60, phase: GATE } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 110, angle: 0 } }, heading: 'prograde', rcs: { fuel: 8 }, stack: [
      { name: 'Booster', dv: 5.6, accel: 1 },
      { name: 'Transfer stage', dv: 1.6, accel: 0.8 },
      { name: 'Carrier', dv: 3, accel: 0.5, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3 }] }),
    goals: [
      { type: 'reach', body: 'gate', craft: 'pod', r: 10, label: 'Docking arm' },
      { type: 'orbit', body: 'luna', rMin: 100, rMax: 160 },
    ],
    par: 9, bounds: 2500, tMax: 2000, predict: 260, view: { x: 0, y: 0, span: 1200 },
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
    p: [4.724, 438.858, 452.966, 0.333, 0.622, 71.81, 37.324, 83.569], scale: [2, 6, 60, 1, 0.4, 8, 10, 10], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { deploy: true },
      { coast: (m) => dist(m, 'luna') < p[2] },
      { drop: true },
      { burn: p[3], rel: 'luna', max: Math.max(0, p[4]) },
      hold((m) => dist(m, 'luna') < p[7]),
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < p[6] || o.rising; } },
      { burn: peRetro('luna'), until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[5]; } },
    ],
  },
  relaysling: {
    p: [15.153, 291.922, 259.792, 117.19], scale: [6, 20, 8, 6], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { deploy: true },
      { drop: true },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= p[2] },
      hold((m) => AP.orb(m, 'terra').r > p[2] - 40),
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe >= p[3] },
    ],
  },
  surveydrop: {
    p: [0, 680, 730, 0, 845, 0, 780, 515], scale: [10, 6, 6, 3, 6, 3, 15, 6], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'sun').ap >= p[1] },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'sun').ap >= p[2] },
      { wait: Math.max(0, p[3]) },
      { drop: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'sun').ap >= p[4] },
      { wait: Math.max(0, p[5]) },
      { drop: true },
      { burn: 'retro', rel: 'sun', until: (m) => AP.orb(m, 'sun').ap <= p[6] },
      hold((m) => !AP.orb(m, 'sun').rising),
      hold((m) => AP.orb(m, 'sun').r < 520),
      { coast: (m) => AP.orb(m, 'sun').rising },
      { burn: peRetro('sun'), until: (m) => AP.orb(m, 'sun').ap <= p[7] },
    ],
  },
  longhaul: {
    p: [0, 300, 292, 0, 470, 5, 1.57, 0.3, 100, 60, 150], scale: [20, 6, 4, 15, 6, 4, 1, 0.2, 20, 15, 8], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      // Through the patrol band on the booster; drop it once its orbit is clear above.
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      hold((m) => AP.orb(m, 'terra').r > p[1] - 30),
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
      { deploy: true },
      // Transfer stage onto a path that hits Luna, then let it go.
      { wait: Math.max(0, p[3]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[4] },
      { deploy: true },
      { wait: Math.max(0, p[5]) },
      { drop: true },
      // Swerve off the collision course, then brake at the low point.
      ...dvBurn(p[6], 'terra', p[7]),
      hold((m) => dist(m, 'luna') < p[8]),
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < p[9] + 60 || o.rising; } },
      { burn: peRetro('luna'), until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[10]; } },
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
  mooncourier: [
    { name: 'drop the pod as you near the Gate', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => {
      const p = proofs.mooncourier.p;
      return [
        { wait: p[0] }, { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] }, { deploy: true },
        { coast: (m) => dist(m, 'gate') < 60 }, { drop: true },
        { burn: 1.57, rel: 'luna', max: 2 },
        { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < 100 && o.rising; } },
        { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[5]; } },
      ];
    } },
    { name: 'no swerve after the drop', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.mooncourier.script(proofs.mooncourier.p, AP).filter((st, k) => k !== 5) },
    { name: 'turn retrograde early and chase it all the way in', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.mooncourier.script(proofs.mooncourier.p.slice(0, 7).concat([1e4]), AP) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.mooncourier.script(proofs.mooncourier.p, AP) },
  ],
  relaysling: [
    { name: 'ride the slingshot, release the relay later', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => {
      const s = proofs.relaysling.script(proofs.relaysling.p, AP);
      return [s[0], s[1], s[2], { coast: (m) => m.t > 300 }, { drop: true }, { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= 250 }];
    } },
    { name: 'aim close to Goliath for a bigger kick', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.relaysling.script([15.153, 340, 300, 117], AP) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.relaysling.script(proofs.relaysling.p, AP) },
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
