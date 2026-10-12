// World 4 · Chapter 5 · Grand Missions: every radiation type (falloff,
// shadows, beams, deep gravity) combined with the toolbox of Worlds 1 to 3.
'use strict';
const { ship, C, belt, VE } = require('../../js/levels.js');

// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };

// Coast with the nose held still (no side thrusters spent chasing a target).
const hold = (pred) => ({ control: (m, c) => pred(m, c) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });

const levels = [
  {
    id: 'darkconst',
    name: 'Dark Constellation',
    intro: 'Three relay satellites for Nyx, spread evenly in the band, and each one starts soaking up Calor\'s heat the moment it leaves your hold: a satellite can take only 20 Sv. Long phasing laps, a third slower, give Sat 1 far too long in the sun. Phase the other way: after each drop, brake into a quick lap a third shorter that dips deep past Nyx\'s night side, and come back up to drop the next.',
    objective: 'Spread three satellites at least 100° apart in orbits between 140 and 190 k from Nyx, each taking under 20 Sv of radiation.',
    teaches: 'Quick phasing laps · cargo dose',
    bodies: [
      { id: 'calor', name: 'Calor', gm: 100000, radius: 60, color: C.sun2, kind: 'star', radiation: { rate: 0.12, at: 1200, dose: 60 } },
      { id: 'nyx', name: 'Nyx', gm: 20000, radius: 70, color: '#5a6b8c', orbit: { parent: 'calor', a: 1200, phase: 0 } },
    ],
    ship: ship({ start: { orbit: { body: 'nyx', r: 110, angle: 0 } }, heading: 'prograde', dv: 12, accel: 1, cargo: [
      { id: 'd1', name: 'Sat 1', mass: 0.2, dose: 20 }, { id: 'd2', name: 'Sat 2', mass: 0.2, dose: 20 }, { id: 'd3', name: 'Sat 3', mass: 0.2, dose: 20 },
    ] }),
    goals: [
      { type: 'spread', body: 'nyx', crafts: ['d1', 'd2', 'd3'], rMin: 140, rMax: 190, minSep: 100 * Math.PI / 180 },
    ],
    par: 9, bounds: 4000, tMax: 600, predict: 200, view: { x: 1200, y: 0, span: 700 },
  },
  {
    id: 'stageddive',
    name: 'Staged Dive',
    intro: 'Your orbit has sagged deep into Cinder\'s heat, and every lap crosses Watch Station\'s ring: a spent stage left on any orbit that reaches the ring hits the station sooner or later. So each stage has to go where it can\'t come back. Burn the dive stage retrograde until your path ends well inside Cinder, and drop it there. Then lift your low point just clear of the surface with the kick stage and burn prograde at the bottom: be escaping before you drop it.',
    objective: 'Get 2400 k from Cinder, taking under 14 Sv of radiation, with no spent stage left on an orbit that crosses Watch Station\'s.',
    teaches: 'Disposal dives · staging at the bottom',
    bodies: [
      { id: 'cinder', name: 'Cinder', gm: 40000, radius: 50, color: '#ffe2b8', kind: 'star', radiation: { rate: 0.3, at: 100, dose: 14 } },
      { id: 'watch', name: 'Watch Station', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 15, orbit: { parent: 'cinder', a: 250, phase: 1 } },
    ],
    ship: ship({ start: { conic: { body: 'cinder', pe: 80, e: 0.698, nu: -2.6, angle: 0 } }, heading: 'retrograde', stack: [
      { name: 'Dive stage', dv: 2.4, accel: 1.2 },
      { name: 'Kick stage', dv: 4.2, accel: 1.5 },
      { name: 'Capsule', dv: 2, accel: 1, dry: 0.4, sprite: 'satellite' },
    ] }),
    goals: [{ type: 'escape', body: 'cinder', r: 2400 }],
    par: 6.1, bounds: 5000, tMax: 600, predict: 300, view: { x: 0, y: 0, span: 900 },
  },
  {
    id: 'sentrypulsar',
    name: 'Sentry Pulsar',
    intro: 'You are riding Argus\'s dark lane: at this height you go round exactly as fast as its beams sweep, so they never touch you. Climb out and they start to catch up, and a sweep anywhere closer than Tyche is brutal. So wait here, in the dark, for the lap when one climb to Tyche threads the gaps between the Sentries and clears Kore\'s zone, then brake straight into orbit at Tyche.',
    objective: 'Orbit Tyche between 16 and 76 k up, taking under 12 Sv of radiation, without entering a Sentry\'s or Kore\'s keep-out zone.',
    teaches: 'The dark lane · launch windows',
    bodies: [
      { id: 'argus', name: 'Argus', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 3, at: 250, dose: 12, beam: { width: 0.3, period: 120, phase: 0 } } },
      { id: 'sen1', name: 'Sentry 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, orbit: { parent: 'argus', a: 430, phase: 2.674 } },
      { id: 'sen2', name: 'Sentry 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, orbit: { parent: 'argus', a: 430, phase: 2.674 + 2.094 } },
      { id: 'sen3', name: 'Sentry 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, orbit: { parent: 'argus', a: 430, phase: 2.674 + 4.189 } },
      { id: 'kore', name: 'Kore', gm: 300, radius: 12, color: C.red, keepOut: 55, orbit: { parent: 'argus', a: 570, phase: 2.026 } },
      { id: 'tyche', name: 'Tyche', gm: 800, radius: 14, color: C.ice, orbit: { parent: 'argus', a: 720, phase: 3 } },
    ],
    ship: ship({ start: { orbit: { body: 'argus', r: 244.4, angle: Math.PI / 2 } }, heading: 'prograde', dv: 6.6, accel: 1 }),
    goals: [{ type: 'orbit', body: 'tyche', rMin: 30, rMax: 90 }],
    par: 4.4, bounds: 3000, tMax: 950, predict: 300, view: { x: 0, y: 0, span: 1700 },
  },
  {
    id: 'pulsarsupply',
    name: 'Pulsar Supply Run',
    intro: 'TBD',
    objective: 'TBD',
    teaches: 'Drop between sweeps · turn before the drop',
    bodies: [
      { id: 'talon', name: 'Talon', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 0.2, at: 300, dose: 20, beam: { width: 0.3, period: 80, phase: 0 } } },
      { id: 'orrin', name: 'Orrin', gm: 600, radius: 14, color: C.tan, keepOut: 60, orbit: { parent: 'talon', a: 560, phase: 2.5, dir: -1 } },
    ],
    ship: ship({ start: { orbit: { body: 'talon', r: 300, angle: 0 } }, heading: 'prograde', dv: 4.5, accel: 1, rcs: { fuel: 4.8 }, cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3, dose: 0.5 }] }),
    goals: [
      { type: 'hit', body: 'orrin', craft: 'pod' },
      { type: 'orbit', body: 'talon', rMin: 200, rMax: 510 },
    ],
    par: 3.1, bounds: 3000, tMax: 400, predict: 300, view: { x: 0, y: 0, span: 1500 },
  },
  {
    id: 'beamrescue',
    name: 'Rescue in the Beam',
    intro: 'TBD',
    objective: 'TBD',
    teaches: 'Rendezvous between sweeps · shelter at L2',
    bodies: [
      { id: 'vesper', name: 'Vesper', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 0.6, at: 400, dose: 10, beam: { width: 0.35, period: 100, phase: 1.0 } } },
      { id: 'umbriel', name: 'Umbriel', gm: 1500, radius: 30, color: '#7d8fa8', orbit: { parent: 'vesper', a: 650, phase: 2.2 } },
      { id: 'wren', name: 'Wren', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'vesper', a: 420, e: 0.2, phase: 0.6, argp: 0 } },
    ],
    ship: ship({ start: { conic: { body: 'vesper', pe: 330, e: 0.21, nu: 0.8, angle: 0 } }, heading: 'prograde', dv: 7.6, accel: 1 }),
    goals: [
      { type: 'rendezvous', body: 'wren', dist: 12, relVel: 0.8 },
      { type: 'hold', lagrange: { body: 'umbriel', lead: 0, scale: 1.24721 }, r: 20, hold: 10, label: 'Umbriel L2' },
    ],
    par: 5.4, bounds: 3000, tMax: 450, predict: 300, view: { x: 0, y: 0, span: 1800 },
  },
  {
    id: 'pulsartour',
    name: 'Pulsar Tour',
    intro: 'TBD',
    objective: 'TBD',
    teaches: 'Everything at once',
    bodies: [
      { id: 'lumen', name: 'Lumen', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 1, at: 244, dose: 1500, beam: { width: 0.3, period: 120, phase: 0 } } },
      { id: 'beacon', name: 'Beacon', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 15, orbit: { parent: 'lumen', a: 380, phase: 1 } },
      { id: 'ossa', name: 'Ossa', gm: 400, radius: 14, color: C.green, keepOut: 50, orbit: { parent: 'lumen', a: 520, phase: 1.115, dir: -1 } },
    ],
    ship: ship({ start: { conic: { body: 'lumen', pe: 150, e: 1.15, nu: -1.9, angle: 0 } }, heading: 'prograde', stack: [
      { name: 'Booster', dv: 2.6, accel: 1.2 },
      { name: 'Capsule', dv: 9, accel: 1, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'lark', name: 'Lark probe', mass: 0.2, dose: 200 }] }),
    goals: [
      { type: 'hit', body: 'ossa', craft: 'lark' },
      { type: 'orbit', body: 'lumen', rMin: 230, rMax: 262 },
    ],
    par: 6, bounds: 4000, tMax: 900, predict: 300, view: { x: 0, y: 0, span: 1600 }, startCam: 'overview',
  },
];

// Circularise at the next high point, drop, then brake into a phasing lap
// whose low point is lo; back at the high point, round off again.
const proofs = {
  darkconst: {
    p: [0, 165, 163, 88, 163, 88, 163], scale: [5, 3, 2, 4, 2, 4, 2],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', rel: 'nyx', until: (m) => AP.orb(m, 'nyx').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'nyx').rising },
      { burn: 'pro', rel: 'nyx', until: (m) => { const o = AP.orb(m, 'nyx'); return o.pe >= Math.min(p[2], o.r - 1.5); } },
      { drop: true },
      { burn: 'retro', rel: 'nyx', until: (m) => AP.orb(m, 'nyx').pe <= p[3] },
      { coast: (m) => AP.orb(m, 'nyx').rising },
      { coast: (m) => !AP.orb(m, 'nyx').rising },
      { burn: 'pro', rel: 'nyx', until: (m) => { const o = AP.orb(m, 'nyx'); return o.pe >= Math.min(p[4], o.r - 1.5); } },
      { drop: true },
      { burn: 'retro', rel: 'nyx', until: (m) => AP.orb(m, 'nyx').pe <= p[5] },
      { coast: (m) => AP.orb(m, 'nyx').rising },
      { coast: (m) => !AP.orb(m, 'nyx').rising },
      { burn: 'pro', rel: 'nyx', until: (m) => { const o = AP.orb(m, 'nyx'); return o.pe >= Math.min(p[6], o.r - 1.5); } },
      { drop: true },
    ],
  },
};

// The phasing lap World 2 taught: a third longer each time.
const slowLaps = (AP) => {
  const lap = (drop) => [
    { burn: 'pro', rel: 'nyx', until: (m) => AP.orb(m, 'nyx').ap >= 226 },
    { coast: (m, c) => m.t - c.t0 > 20 && !AP.orb(m, 'nyx').rising },
    { coast: (m, c) => m.t - c.t0 > 20 && AP.orb(m, 'nyx').rising },
    { burn: 'retro', rel: 'nyx', until: (m) => { const o = AP.orb(m, 'nyx'); return o.ap <= Math.max(167, o.r + 1.5); } },
    { drop: true },
  ];
  return [...proofs.darkconst.script(proofs.darkconst.p, AP).slice(0, 5), ...lap(), ...lap()];
};

proofs.stageddive = {
  // Dive stage retrograde until the path plunges (p[0]: how far past the
  // ring, as the low point a Newtonian orbit would have), drop it; lift the low
  // point to p[1]; burn the kick stage from r < p[2] until dry, drop it, and
  // burn the capsule for p[3] of Δv.
  p: [44.581, 49.446, 64.372, -0.882, 10.56], scale: [2, 3, 6, 0.3, 5],
  script: (p, AP) => [
    { burn: 'retro', rel: 'cinder', until: (m) => AP.orb(m, 'cinder').pe <= p[0] },
    { deploy: true },
    { burn: 'pro', rel: 'cinder', until: (m) => AP.orb(m, 'cinder').pe >= p[1] },
    { coast: (m) => AP.orb(m, 'cinder').r < p[2] },
    { burn: 'pro', rel: 'cinder', until: (m) => { const o = AP.orb(m, 'cinder'); return o.v * o.v / 2 - 40000 / o.r >= p[4]; } },
    { deploy: true },
    { fn: (m, c) => { c.d0 = m.dvUsed(); } },
    { burn: 'pro', rel: 'cinder', until: (m, c) => m.dvUsed() - c.d0 >= p[3] },
  ],
};

proofs.sentrypulsar = {
  // Ride the dark lane until lap p[0], climb to p[1], brake into orbit at Tyche.
  p: [309.59, 697.058, 50.053, 83.867], scale: [3, 8, 8, 4],
  script: (p, AP) => [
    { wait: Math.max(0, p[0]) },
    { burn: 'pro', rel: 'argus', until: (m) => AP.orb(m, 'argus').ap >= p[1] },
    { coast: (m) => dist(m, 'tyche') < p[2] || (dist(m, 'tyche') < 150 && AP.orb(m, 'tyche').rising) },
    { burn: 'retro', rel: 'tyche', until: (m) => { const o = AP.orb(m, 'tyche'); return o.bound && o.ap <= p[3]; } },
  ],
};

proofs.pulsarsupply = {
  // Hold until p[0], climb so the high point is p[1]; on the way up turn
  // to the brake heading (p[3] from prograde); drop the pod p[2] from Orrin
  // and burn until the high point is down to p[4].
  p: [99.166, 597.8, 409.946, 2.847, 491.479], scale: [3, 6, 15, 0.2, 6], opts: { turn: true, turnRate: 0.2 },
  script: (p, AP) => [
    hold((m) => m.t >= p[0]),
    { burn: 'pro', rel: 'talon', until: (m) => AP.orb(m, 'talon').ap >= p[1] },
    { coast: (m) => AP.orb(m, 'talon').r >= p[2] },
    { drop: true },
    { burn: p[3], rel: 'talon', until: (m) => AP.orb(m, 'talon').ap <= p[4] },
  ],
};

// Fly to a moving point: aim for its velocity plus a closing speed of at
// most vmax (k per k of distance), burning only when the error is over tol.
const goTo = (pt, vmax, k, done, tol) => ({
  control: (m) => {
    if (done(m)) return { done: true };
    const q = pt(m), dx = q.x - m.ship.x, dy = q.y - m.ship.y, d = Math.hypot(dx, dy);
    const c = Math.min(vmax, k * d) / Math.max(d, 1e-9);
    const ex = q.vx + dx * c - m.ship.vx, ey = q.vy + dy * c - m.ship.vy;
    if (Math.hypot(ex, ey) < (tol || 0.08)) return { thrust: false, dt: 0.05 };
    return { thrust: true, angle: Math.atan2(ey, ex) };
  },
});
const bodyPt = (id) => (m) => { m.sys.update(m.t); const i = m.sys.byId[id].index; return { x: m.sys.px[i], y: m.sys.py[i], vx: m.sys.vx[i], vy: m.sys.vy[i] }; };
const goalPt = (m) => m.goalPoint(m.currentGoal());
// A point `back` behind a body along its path (to park beside it, not in it).
const behind = (id, back) => (m) => { const q = bodyPt(id)(m), u = Math.hypot(q.vx, q.vy); return { x: q.x - back * q.vx / u, y: q.y - back * q.vy / u, vx: q.vx, vy: q.vy }; };

proofs.beamrescue = {
  // Close in on Wren and match it; wait until Umbriel leads you by p[3];
  // climb to p[4], then fly onto L2 from p[7] out.
  p: [-6.524, 0.751, 0.042, 0.043, 802.034, 2.913, 0.041, 172.316], scale: [5, 0.3, 0.01, 0.1, 10, 0.5, 0.01, 30],
  script: (p, AP) => [
    hold((m) => m.t >= p[0]),
    goTo(behind('wren', 8), p[1], p[2], (m) => m.goalIndex > 0),
    hold((m) => AP.wrap(AP.phase(m, 'umbriel', 'vesper') - AP.shipPhase(m, 'vesper')) <= p[3]),
    { burn: 'pro', rel: 'vesper', until: (m) => AP.orb(m, 'vesper').ap >= p[4] },
    { coast: (m) => { const q = goalPt(m); return Math.hypot(q.x - m.ship.x, q.y - m.ship.y) < p[7]; } },
    goTo(goalPt, p[5], p[6], (m) => m.status !== 'flying'),
  ],
};

proofs.pulsartour = {
  // Booster: push p[0] from prograde until the low point is p[1] (still on
  // an escape path), drop it. Capsule: at the low point brake until the high
  // point is p[2], release the probe, and keep braking until the high point
  // is down to p[3].
  p: [-1.5, 244, 520, 255], scale: [0.2, 4, 8, 4],
  script: (p, AP) => [
    { burn: p[0], rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe >= p[1] },
    { deploy: true },
    { coast: (m) => AP.orb(m, 'lumen').rising },
    { burn: 'retro', rel: 'lumen', until: (m) => { const o = AP.orb(m, 'lumen'); return o.bound && o.ap <= p[2]; } },
    { drop: true },
    { burn: 'retro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').ap <= p[3] },
  ],
};

const fails = {
  beamrescue: [
    { name: 'wait and see', steps: () => [] },
    { name: 'stay with Wren', steps: (AP) => [...proofs.beamrescue.script(proofs.beamrescue.p, AP).slice(0, 2), goTo(behind('wren', 8), 0.5, 0.05, () => false)] },
    { name: 'rush in, then rest before leaving', steps: (AP) => { const s = proofs.beamrescue.script(proofs.beamrescue.p, AP); return [goTo(behind('wren', 8), 3, 0.1, (m) => m.goalIndex > 0), hold((m, c) => m.t - c.t0 > 60), ...s.slice(2)]; } },
  ],
  pulsarsupply: [
    { name: 'carry the pod in close', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => { const s = proofs.pulsarsupply.script(proofs.pulsarsupply.p, AP); return [s[0], s[1], { coast: (m) => dist(m, 'orrin') < 200 }, s[3], s[4]]; } },
    { name: 'climb at once', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => { const p = proofs.pulsarsupply.p.slice(); p[0] = 0; return proofs.pulsarsupply.script(p, AP); } },
    { name: 'drop as a sweep comes round', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => { const p = proofs.pulsarsupply.p.slice(); p[2] = 330; return proofs.pulsarsupply.script(p, AP); } },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.pulsarsupply.script(proofs.pulsarsupply.p, AP) },
  ],
  sentrypulsar: [
    { name: 'climb to Tyche at once', steps: (AP) => proofs.sentrypulsar.script([7, 725, 56, 77], AP) },
    { name: 'climb to Tyche on the next lap', steps: (AP) => proofs.sentrypulsar.script([150, 725, 56, 77], AP) },
    { name: 'climb above the Sentries and wait there', steps: (AP) => [
      { burn: 'pro', rel: 'argus', until: (m) => AP.orb(m, 'argus').ap >= 500 },
      { coast: (m) => !AP.orb(m, 'argus').rising },
      { burn: 'pro', rel: 'argus', until: (m) => AP.orb(m, 'argus').pe >= 490 },
      { wait: 300 },
    ] },
  ],
  stageddive: [
    { name: 'wait and see', steps: () => [] },
    { name: 'save it all for the bottom', steps: (AP) => [
      { coast: (m) => AP.orb(m, 'cinder').r < 100 },
      { burn: 'pro', rel: 'cinder', stage: true, until: () => false },
    ] },
    { name: 'drop the full dive stage at once', steps: (AP) => proofs.stageddive.script(proofs.stageddive.p, AP).slice(1) },
    { name: 'brake the dive stage only a little', steps: (AP) => proofs.stageddive.script([85].concat(proofs.stageddive.p.slice(1)), AP) },
    { name: 'lift the low point well clear of the ring', steps: (AP) => proofs.stageddive.script([proofs.stageddive.p[0], 100, 115, ...proofs.stageddive.p.slice(3)], AP) },
  ],
  darkconst: [
    { name: 'phase on long laps, a third slower', steps: slowLaps },
    { name: 'drop all three at once', steps: (AP) => [...proofs.darkconst.script(proofs.darkconst.p, AP).slice(0, 5), { drop: true }, { drop: true }] },
  ],
};

module.exports = { levels, proofs, fails };
