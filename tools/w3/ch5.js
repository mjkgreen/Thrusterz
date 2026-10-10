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

// A burn held in the direction dir(m) gives as it starts: flip once, then
// hold still instead of chasing a direction that drifts as the orbit changes.
const heldBurn = (dir, until) => {
  let a = null;
  return [
    { fn: () => { a = null; } },
    { burn: (m) => (a == null ? (a = dir(m)) : a), until },
  ];
};

// A burn of a set Δv in a direction (turning first doesn't count).
const dvBurn = (dir, rel, amount) => {
  const st = { d0: 0 };
  return [
    { fn: (m) => { st.d0 = m.dvUsed(); } },
    { burn: dir, rel, until: (m) => m.dvUsed() - st.d0 >= amount },
  ];
};

// Finale phases, fitted so the proof's Luna pass sits under Luna Gate.
const HAVEN = 3.2, LUNA = 3.54, GATE = 0;
const levels = [
  {
    id: 'resupplyrun',
    name: 'Resupply Run',
    intro: 'Haven Station\'s amber zone is closed to everything but its supply pod, and that includes your spent kick stage: a stage left in an orbit that reaches Haven\'s height drifts in sooner or later. So drop the kick stage (the stage button) while your high point is still well below the station. Then climb the rest with the carrier, release the pod (E) on a path that meets Haven, and turn round to brake back down.',
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
    intro: 'Your orbit is sagging into the patrol band at 220, and at its low point, a minute from now, Patrol 1 will be right there. Each patrol sits in an amber zone closed to everything, so get down through the band now, riding the big descent stage, to a low orbit beneath it. Don\'t drop the stage after the first burn: an empty stage whose orbit still reaches the band drifts into a zone sooner or later.',
    objective: 'Get below the patrols before you meet one: orbit Terra between 100 and 150 without your ship or its stage entering a patrol zone.',
    teaches: 'Carry the stage across the band',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'pat1', name: 'Patrol 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 220, phase: 3.34 } },
      { id: 'pat2', name: 'Patrol 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 220, phase: 3.34 + 2.094 } },
      { id: 'pat3', name: 'Patrol 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, zone: 'all', orbit: { parent: 'terra', a: 220, phase: 3.34 + 4.189 } },
    ],
    ship: ship({ start: { conic: { body: 'terra', pe: 205, e: 0.299, nu: -2.4, angle: 0 } }, heading: 'prograde', rcs: { fuel: 5 }, stack: [
      { name: 'Descent stage', dv: 4.5, accel: 0.8 },
      { name: 'Shuttle', dv: 2.5, accel: 0.5, dry: 0.4, sprite: 'satellite' },
    ] }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 100, rMax: 150 }],
    par: 4.7, bounds: 2000, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 860 },
  },
  {
    id: 'mooncourier',
    name: 'Moon Courier',
    intro: 'You are already coasting to Luna, on a path that runs straight through Luna Gate\'s amber zone. The zone is closed to everything but the Gate\'s supply pod, so this is the pod\'s path, not yours: drop the empty transfer stage, release the pod (E) and nudge yourself clear before you get there. Then flip late and brake into a low orbit beneath the Gate.',
    objective: 'Deliver the pod to Luna Gate before your path carries you into its zone, then orbit Luna between 30 and 70.',
    teaches: 'Drop, swerve, capture',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 420, phase: 2.3404 } },
      { id: 'gate', name: 'Luna Gate', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 25, zone: 'all', orbit: { parent: 'luna', a: 110, phase: 2.8266 } },
    ],
    ship: ship({ start: { conic: { body: 'terra', pe: 90.601, e: 0.65878, nu: 0.34791, angle: 1.0853 } }, heading: 'prograde', rcs: { fuel: 2.6 }, stack: [
      { name: 'Transfer stage', dv: 0.3, accel: 1 },
      { name: 'Carrier', dv: 2.4, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3 }] }),
    goals: [
      { type: 'reach', body: 'gate', craft: 'pod', r: 12, label: 'Docking arm' },
      { type: 'orbit', body: 'luna', rMin: 30, rMax: 70 },
    ],
    par: 2, bounds: 2500, tMax: 1000, predict: 220, view: { x: 0, y: 0, span: 1000 },
  },
  {
    id: 'relaysling',
    name: 'Slingshot Relay',
    intro: 'You have just burned out of low orbit on a path that swings past Goliath, and Goliath will fling you out of Terra\'s reach for good. That ride is for the deep-space relay, not for you: drop the spent stage, release the relay (E) on this path, then flip and brake at once so you fall back into a low orbit while it flies on. Goliath\'s radiation zone is closed to everything.',
    objective: 'Send the relay 1600 away from Terra, but stay behind yourself: orbit Terra between 120 and 250.',
    teaches: 'Send the cargo, stay home',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'goliath', name: 'Goliath', gm: 5000, radius: 26, color: C.tan, keepOut: 70, zone: 'all', orbit: { parent: 'terra', a: 350, phase: 2.4375 } },
    ],
    ship: ship({ start: { conic: { body: 'terra', pe: 91.03, e: 0.52528, nu: 0.36345, angle: 2.69664 } }, heading: 'prograde', rcs: { fuel: 3.5 }, stack: [
      { name: 'Transfer stage', dv: 0.2, accel: 1 },
      { name: 'Carrier', dv: 0.6, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'relay', name: 'Relay', mass: 0.2 }] }),
    goals: [
      { type: 'escape', body: 'terra', craft: 'relay', r: 1600, label: 'Deep space' },
      { type: 'orbit', body: 'terra', rMin: 120, rMax: 250 },
    ],
    par: 0.55, bounds: 1700, tMax: 1600, predict: 300, view: { x: 0, y: 0, span: 2400 },
  },
  {
    id: 'surveydrop',
    name: 'Survey Drop',
    intro: 'Two survey sites ride the asteroid belt, each in an amber zone closed to everything but its own probe. Drop the transfer stage while your high point is still below the belt, then release probe A (E) when your path meets Site A, climb a little more and release probe B for Site B. Then turn round before the zones and rocks and brake back down to your home orbit.',
    objective: 'Deliver probe A to Site A and probe B to Site B, then orbit Sol between 430 and 520.',
    teaches: 'Two drops on one climb · flip home',
    bodies: [
      { id: 'sun', name: 'Sol', gm: 200000, radius: 60, color: C.sun },
      { id: 'sitea', name: 'Site A', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'sun', a: 720, phase: 0.88 } },
      { id: 'siteb', name: 'Site B', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'sun', a: 840, phase: 1.05 } },
      ...belt('sun', 26, 690, 870, 977),
    ],
    ship: ship({ start: { orbit: { body: 'sun', r: 450, angle: 0 } }, heading: 'prograde', rcs: { fuel: 3.3 }, stack: [
      { name: 'Transfer stage', dv: 3.2, accel: 1.2 },
      { name: 'Carrier', dv: 4.2, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pa', name: 'Probe A', mass: 0.2 }, { id: 'pb', name: 'Probe B', mass: 0.2 }] }),
    goals: [
      { type: 'reach', body: 'sitea', craft: 'pa', r: 12, label: 'Site A' },
      { type: 'reach', body: 'siteb', craft: 'pb', r: 12, label: 'Site B' },
      { type: 'orbit', body: 'sun', rMin: 430, rMax: 520 },
    ],
    par: 5.9, bounds: 4000, tMax: 1200, predict: 400, view: { x: 0, y: 0, span: 2200 },
  },
  {
    id: 'longhaul',
    name: 'The Long Haul',
    intro: 'Everything at once, and every zone is closed to everything. Ride the booster up through the patrol band and drop it in the gap below Haven Station, where its whole orbit touches neither zone. Fly the carrier to Luna and brake into a low orbit beneath Luna Gate. Then, at your low point, raise your high point to the Gate, release the pod (E) and flip at once to come back down before you reach the zone.',
    objective: 'Deliver pod A to Haven Station and pod B to Luna Gate, then orbit Luna between 25 and 55.',
    teaches: 'Everything at once',
    bodies: [
      { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      { id: 'pat1', name: 'Patrol 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 200, phase: 0.3 } },
      { id: 'pat2', name: 'Patrol 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 200, phase: 0.3 + 2.094 } },
      { id: 'pat3', name: 'Patrol 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 200, phase: 0.3 + 4.189 } },
      { id: 'haven', name: 'Haven Station', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 30, zone: 'all', orbit: { parent: 'terra', a: 340, phase: HAVEN } },
      { id: 'luna', name: 'Luna', gm: 800, radius: 16, color: C.grey, orbit: { parent: 'terra', a: 480, phase: LUNA } },
      { id: 'gate', name: 'Luna Gate', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 15, zone: 'all', orbit: { parent: 'luna', a: 80, phase: GATE } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 110, angle: 0 } }, heading: 'prograde', rcs: { fuel: 15 }, stack: [
      { name: 'Booster', dv: 5.6, accel: 1 },
      { name: 'Carrier', dv: 6.5, accel: 0.5, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3 }] }),
    goals: [
      { type: 'reach', body: 'gate', craft: 'pod', r: 10, label: 'Gate dock' },
      { type: 'orbit', body: 'luna', rMin: 25, rMax: 55 },
    ],
    par: 10, bounds: 2500, tMax: 1200, predict: 260, view: { x: 0, y: 0, span: 1200 },
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
    p: [0, 135, 172, 145], scale: [5, 8, 6, 4], opts: { turn: true, turnRate: 0.2 },
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
    p: [-2.442, 0.608, 0.328, 78.027, 48.83, 45.136], scale: [3, 1, 0.15, 8, 10, 10], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { deploy: true },
      { drop: true },
      ...dvBurn(p[1], 'luna', Math.max(0, p[2])),
      hold((m) => dist(m, 'luna') < p[5]),
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < p[4] || o.rising; } },
      { burn: peRetro('luna'), until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[3]; } },
    ],
  },
  relaysling: {
    p: [-6.327, 262.853, 121.808], scale: [3, 8, 6], opts: { turn: true, turnRate: 0.2 },
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { deploy: true },
      { drop: true },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= p[1] },
      hold((m) => AP.orb(m, 'terra').r > p[1] - 40),
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
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
    p: [-34.72, 302.578, 285.316, 3.692, 481.982, 163.839, 0.801, 60.651, -3.165, 82.515, 50.681], scale: [20, 6, 4, 15, 4, 30, 15, 6, 30, 4, 4], opts: { turn: true, turnRate: 0.5 },
    script: (p, AP) => [
      // Through the patrol band on the booster; drop it in the gap above.
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      hold((m) => AP.orb(m, 'terra').r > p[1] - 30),
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
      { deploy: true },
      // Past Haven's band to Luna on the carrier.
      { wait: Math.max(0, p[3]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[4] },
      // Flip late, brake at the low point.
      hold((m) => dist(m, 'luna') < p[5]),
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < p[6] + 60 || o.rising; } },
      ...heldBurn(peRetro('luna'), (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[7]; }),
      // The pod: at the low point, raise the high point to the Gate, drop, and come back down.
      hold((m, c) => { const o = AP.orb(m, 'luna'); return m.t - c.t0 > Math.max(0, p[8]) && !o.rising && o.r < o.pe + 4; }),
      ...heldBurn(peRetro('luna', Math.PI), (m) => AP.orb(m, 'luna').ap >= p[9]),
      { drop: true },
      // Flip at once and lower your own high point before you reach the Gate.
      { burn: 'retro', rel: 'luna', until: (m) => AP.orb(m, 'luna').ap <= p[10] },
    ],
  },



};

const fails = {
  blockade: [
    { name: 'wait and see', steps: () => [] },
    { name: 'drop the stage after the first burn', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => {
      const s = proofs.blockade.script(proofs.blockade.p, AP);
      return [s[0], s[1], { deploy: true }, s[2], s[5]];
    } },
    { name: 'ditch the stage, fly the shuttle down', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => {
      const s = proofs.blockade.script(proofs.blockade.p, AP);
      return [{ deploy: true }, s[0], s[1], s[2], s[5]];
    } },
    { name: 'wait for the next lap to go down', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.blockade.script([60].concat(proofs.blockade.p.slice(1)), AP) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.blockade.script(proofs.blockade.p, AP) },
  ],
  mooncourier: [
    { name: 'wait and see', steps: () => [] },
    { name: 'coast on and drop the pod near the Gate', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => [
      { deploy: true }, { coast: (m) => dist(m, 'gate') < 60 }, { drop: true },
      { burn: 1.57, rel: 'luna', max: 4 },
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < 100 && o.rising; } },
      { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= 70; } },
    ] },
    { name: 'no swerve after the drop', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.mooncourier.script(proofs.mooncourier.p, AP).filter((st, k) => k !== 3 && k !== 4) },
    { name: 'turn retrograde early and chase it all the way in', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.mooncourier.script(proofs.mooncourier.p.slice(0, 5).concat([1e4]), AP) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.mooncourier.script(proofs.mooncourier.p, AP) },
  ],
  relaysling: [
    { name: 'wait and see', steps: () => [] },
    { name: 'ride the slingshot, release the relay later', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => [
      { deploy: true }, { coast: (m) => dist(m, 'goliath') < 160 }, { drop: true },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= 250 },
    ] },
    { name: 'brake later, as Goliath comes close', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => {
      const s = proofs.relaysling.script(proofs.relaysling.p, AP);
      return [s[0], s[1], s[2], hold((m) => dist(m, 'goliath') < 150), ...s.slice(3)];
    } },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.relaysling.script(proofs.relaysling.p, AP) },
  ],
  surveydrop: [
    { name: 'burn the transfer stage dry, then stage', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => {
      const s = proofs.surveydrop.script(proofs.surveydrop.p, AP);
      return [{ burn: 'pro', until: () => false }, { deploy: true }, ...s.slice(4)];
    } },
    { name: 'drop both probes together', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => {
      const s = proofs.surveydrop.script(proofs.surveydrop.p, AP);
      return [...s.slice(0, 6), { drop: true }, ...s.slice(9)];
    } },
    { name: 'keep climbing after the drops', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => proofs.surveydrop.script(proofs.surveydrop.p, AP).slice(0, 9) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.surveydrop.script(proofs.surveydrop.p, AP) },
  ],
  longhaul: [
    { name: 'drop the booster once it is through the band', opts: { turn: true, turnRate: 0.5 }, steps: (AP) => {
      const s = proofs.longhaul.script(proofs.longhaul.p, AP);
      return [s[0], s[1], { deploy: true }, ...s.slice(2, 5), ...s.slice(6)];
    } },
    { name: 'burn the booster dry on the way up', opts: { turn: true, turnRate: 0.5 }, steps: (AP) => {
      const s = proofs.longhaul.script(proofs.longhaul.p, AP);
      return [s[0], { burn: 'pro', until: () => false }, { deploy: true }, ...s.slice(6)];
    } },
    { name: 'park the booster up at Haven\'s height', opts: { turn: true, turnRate: 0.5 }, steps: (AP) => {
      const p = proofs.longhaul.p.slice(); p[1] = 345; p[2] = 330;
      return proofs.longhaul.script(p, AP);
    } },
    { name: 'no flip after the pod drop', opts: { turn: true, turnRate: 0.5 }, steps: (AP) => proofs.longhaul.script(proofs.longhaul.p, AP).slice(0, -1) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.6 }, steps: (AP) => proofs.longhaul.script(proofs.longhaul.p, AP) },
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
