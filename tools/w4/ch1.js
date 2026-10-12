// World 4 · Chapter 1 · Sunburn: radiation falloff. A hot star's dose rate
// falls with the square of the distance, so time close in is what costs:
// dive fast, park far out, and let cargo with its own limit do the hot work.
'use strict';
const { ship, C } = require('../../js/levels.js');

// Distance from the ship (or an object) to a body's centre.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };

// A burn of a set Δv in a direction (relative to `rel`).
const dvBurn = (dir, rel, amount) => {
  const st = { d0: 0 };
  return [
    { fn: (m) => { st.d0 = m.dvUsed(); } },
    { burn: dir, rel, until: (m) => m.dvUsed() - st.d0 >= amount },
  ];
};

// Rendezvous with a moving body: steer the velocity toward (its velocity +
// a closing speed toward it, at most vMax, k per unit distance).
function meet(id, vMax, k) {
  return {
    control: (m) => {
      if (m.goalIndex > 0 || m.status !== 'flying') return { done: true };
      const sys = m.sys; sys.update(m.t);
      const i = sys.byId[id].index, s = m.ship;
      const dx = sys.px[i] - s.x, dy = sys.py[i] - s.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(vMax, k * d);
      const ex = sys.vx[i] + sp * dx / d - s.vx, ey = sys.vy[i] + sp * dy / d - s.vy;
      if (Math.hypot(ex, ey) < 0.05) return { thrust: false, dt: 0.05 };
      return { thrust: true, angle: Math.atan2(ey, ex) };
    },
  };
}

const levels = [
  {
    id: 'sunburn',
    name: 'Sunburn',
    intro: 'Ardent is a hot star, and its radiation is strongest close in: a quarter as strong at twice the distance. The dose meter shows what you have taken, and your ship can take only 110 Sv in all. Every lap down here adds up fast, so don\'t wait: burn prograde now to climb, and round off your orbit far out where the light is weak.',
    objective: 'Orbit Ardent between 700 and 900 k up, taking under 110 Sv of radiation.',
    teaches: 'Radiation falloff',
    bodies: [
      { id: 'ardent', name: 'Ardent', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 1, at: 300, dose: 110 } },
    ],
    ship: ship({ start: { orbit: { body: 'ardent', r: 200, angle: 0 } }, heading: 'prograde', dv: 11, accel: 1 }),
    goals: [{ type: 'orbit', body: 'ardent', rMin: 745, rMax: 945 }],
    par: 7.2, bounds: 4000, tMax: 900, predict: 400, view: { x: 0, y: 0, span: 2100 },
  },
  {
    id: 'sendrelease',
    name: 'Send and Release',
    intro: 'You are falling toward Pyra on a long ellipse, and the Sundrop probe has to land on Cinder, the scorched planet racing round close to the star. Your path already ends on Cinder, but only after a pass round Pyra: far too hot for the probe, and for you. Out here a small burn moves your path a lot, so aim to hit Cinder on the way in, release the probe (E), and burn at once to lift your own low point. The longer you ride along, the dearer that climb gets.',
    objective: 'Land the probe on Cinder before it takes 80 Sv, then get 1200 k from Pyra, taking under 60 Sv yourself.',
    teaches: 'Cargo with its own dose limit',
    bodies: [
      { id: 'pyra', name: 'Pyra', gm: 40000, radius: 40, color: C.sun2, kind: 'star', radiation: { rate: 1, at: 300, dose: 60 } },
      { id: 'cinder', name: 'Cinder', gm: 300, radius: 12, color: C.red, orbit: { parent: 'pyra', a: 150, phase: 3.45 } },
    ],
    ship: ship({ start: { conic: { body: 'pyra', pe: 110, e: 0.85, nu: -2.85, angle: 0 } }, heading: 'prograde', dv: 5.2, accel: 1, cargo: [{ id: 'sundrop', name: 'Sundrop', mass: 0.3, dose: 80 }] }),
    goals: [
      { type: 'hit', body: 'cinder', craft: 'sundrop' },
      { type: 'escape', body: 'pyra', r: 1240 },
    ],
    par: 3.7, bounds: 4000, tMax: 1000, predict: 400, view: { x: 0, y: 0, span: 2000 },
  },
  {
    id: 'hotbooster',
    name: 'Hot Booster',
    intro: 'Fly through the sample point in Kiln\'s corona, then get out fast: the dose adds up so quickly down there that the Sunskipper has to burn hard at the bottom of the dive. Hearth is inhabited, and a spent booster left on a path that crosses its orbit hits it sooner or later. So burn the slow, heavy booster retrograde until it is empty and its path falls into Kiln, and drop it (the stage button) at once: the Sunskipper has to lift your low point back up to the sample point while you are still far out, where that is cheap, and save the rest to burn prograde hard as you pass.',
    objective: 'Fly through the corona sample point, then get 1500 k from Kiln, taking under 90 Sv of radiation and leaving no booster on a path that crosses Hearth\'s orbit.',
    teaches: 'Stages for a fast dive',
    bodies: [
      { id: 'kiln', name: 'Kiln', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.5, at: 300, dose: 89 } },
      { id: 'hearth', name: 'Hearth', gm: 300, radius: 16, color: C.green, protect: true, orbit: { parent: 'kiln', a: 260, phase: 2.0 } },
      { id: 'watch', name: 'Kiln Watch', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, orbit: { parent: 'kiln', a: 600, phase: Math.PI } },
    ],
    ship: ship({ start: { orbit: { body: 'kiln', r: 600, angle: 0 } }, heading: 'retrograde', stack: [
      { id: 'booster', name: 'Booster', dv: 5.8, accel: 0.15 },
      { name: 'Sunskipper', dv: 5.4, accel: 1.5, dry: 0.4 },
    ] }),
    goals: [
      { type: 'reach', x: -110, y: 0, r: 20, label: 'Corona sample' },
      { type: 'escape', body: 'kiln', r: 1545 },
    ],
    par: 10.7, bounds: 4000, tMax: 700, predict: 400, view: { x: 0, y: 0, span: 1400 },
  },
  {
    id: 'retrorelay',
    name: 'Retrograde Relay',
    intro: 'TODO',
    objective: 'TODO',
    teaches: 'Phase far out, meet close in',
    bodies: [
      { id: 'brand', name: 'Brand', gm: 40000, radius: 45, color: C.sun2, kind: 'star', radiation: { rate: 1, at: 300, dose: 1000 } },
      { id: 'tern', name: 'Relay Tern', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'brand', a: 220, dir: -1, phase: 0 } },
    ],
    ship: ship({ start: { conic: { body: 'brand', pe: 220, e: 1.1, nu: -1.6, angle: 2.4, dir: -1 } }, heading: 'retrograde', dv: 9, accel: 1.5 }),
    goals: [{ type: 'rendezvous', body: 'tern', dist: 10, relVel: 0.6 }],
    par: 6, bounds: 4000, tMax: 1500, predict: 400, view: { x: 0, y: 0, span: 2400 }, startCam: 'overview',
  },
];

const proofs = {
  sunburn: {
    p: [848.647, 743.235], scale: [20, 20],
    script: (p, AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').ap >= p[0] },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').pe >= p[1] },
    ],
  },
  sendrelease: {
    p: [0, 0.05, 1.018, 540.423, -0.638], scale: [2, 0.3, 0.2, 20, 0.4],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      ...dvBurn(p[1], 'pyra', Math.max(0, p[2])),
      { drop: true },
      { burn: p[4], rel: 'pyra', until: (m) => AP.orb(m, 'pyra').pe >= p[3] },
    ],
  },
  hotbooster: {
    p: [0, 118, 6, 2.2], scale: [5, 5, 2, 0.3],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'retro', rel: 'kiln', until: () => false },
      { deploy: true },
      { burn: 'pro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').pe >= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'kiln'); return o.r < o.pe + p[2]; } },
      ...dvBurn('pro', 'kiln', p[3]),
    ],
  },
  retrorelay: {
    p: [10, 1150, 120], scale: [4, 20, 20],
    script: (p, AP) => [
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + Math.max(0, p[0]); } },
      { burn: 'retro', rel: 'brand', until: (m) => { const o = AP.orb(m, 'brand'); return o.bound && o.ap <= p[1]; } },
      { coast: (m) => !AP.orb(m, 'brand').rising },
      { coast: (m) => dist(m, 'tern') < p[2] || AP.orb(m, 'brand').rising },
      meet('tern', 10, 0.04),
    ],
  },
};

const fails = {
  hotbooster: [
    { name: 'drop the booster once the dive is set', steps: (AP) => [
      { burn: 'retro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').pe <= 110 },
      { deploy: true },
      { coast: (m) => { const o = AP.orb(m, 'kiln'); return o.r < o.pe + 6; } },
      { burn: 'pro', rel: 'kiln', until: () => false },
    ] },
    { name: 'keep the booster for the burn at the bottom', steps: (AP) => [
      { burn: 'retro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').pe <= 110 },
      { coast: (m) => { const o = AP.orb(m, 'kiln'); return o.r < o.pe + 30; } },
      { burn: 'pro', rel: 'kiln', stage: true, until: () => false },
    ] },
    { name: 'ride the empty booster in, stage near the bottom', steps: (AP) => [
      { burn: 'retro', rel: 'kiln', until: () => false },
      { coast: (m) => AP.orb(m, 'kiln').r < 220 },
      { deploy: true },
      { burn: (m) => { const o = AP.orb(m, 'kiln'); return o.theta + Math.PI / 2 * o.dir; }, until: (m) => AP.orb(m, 'kiln').pe >= 110 },
      { coast: (m) => { const o = AP.orb(m, 'kiln'); return o.r < o.pe + 6; } },
      { burn: 'pro', rel: 'kiln', until: () => false },
    ] },
    { name: 'ditch the heavy booster at once, fly the Sunskipper', steps: (AP) => [
      { deploy: true },
      { burn: 'retro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').pe <= 110 },
      { coast: (m) => { const o = AP.orb(m, 'kiln'); return o.r < o.pe + 6; } },
      { burn: 'pro', rel: 'kiln', until: () => false },
    ] },
  ],
  sendrelease: [
    { name: 'wait and see', steps: () => [] },
    { name: 'release now: the path already ends on Cinder', steps: (AP) => {
      const p = proofs.sendrelease.p;
      return [{ drop: true }, { burn: p[4], rel: 'pyra', until: (m) => AP.orb(m, 'pyra').pe >= p[3] }];
    } },
    { name: 'ride in with the probe, release close to Cinder', steps: (AP) => {
      const p = proofs.sendrelease.p;
      return [...dvBurn(p[1], 'pyra', p[2]), { coast: (m) => dist(m, 'cinder') < 120 }, { drop: true }, { burn: p[4], rel: 'pyra', until: (m) => AP.orb(m, 'pyra').pe >= p[3] }];
    } },
  ],
  sunburn: [
    { name: 'wait half a lap, then climb', steps: (AP) => [{ wait: 44 }, ...proofs.sunburn.script(proofs.sunburn.p, AP)] },
    { name: 'climb in two easy steps', steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').ap >= 420 },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').pe >= 400 },
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').ap >= 845 },
      { wait: 10 },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').pe >= 800 },
    ] },
  ],
};

module.exports = { levels, proofs, fails };
