// World 4 · Chapter 1 · Sunburn: radiation falloff. A hot star's dose rate
// falls with the square of the distance, so time close in is what costs:
// dive fast, park far out, and let cargo with its own limit do the hot work.
'use strict';
const { ship, C } = require('../../js/levels.js');

// Distance from the ship (or an object) to a body's centre.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };

// Coast until within `d` of a body, or until it starts to pull away.
function nearest(id, d) {
  return { coast: (m, ctx) => { const x = dist(m, id), prev = ctx.near; ctx.near = x; return x < d || (x < 5 * d && prev != null && x > prev); } };
}

// Speed relative to a body.
const relSpeed = (m, id) => { m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(m.ship.vx - m.sys.vx[i], m.ship.vy - m.sys.vy[i]); };

// A burn of a set Δv in a direction (relative to `rel`).
const dvBurn = (dir, rel, amount) => {
  const st = { d0: 0 };
  return [
    { fn: (m) => { st.d0 = m.dvUsed(); } },
    { burn: dir, rel, until: (m) => m.dvUsed() - st.d0 >= amount },
  ];
};

// The closest approach to a body along the coasting path ahead, as the
// game's readout shows it: { d, t }.
const Phys = require('../../js/physics.js');
function closest(m, id, horizon) {
  const sys = m.sys, i = sys.byId[id].index, q = [0, 0];
  const p = Phys.predict(sys, m.ship, m.t, horizon || m.level.predict, { bounds: m.level.bounds, maxSteps: 8000 });
  let best = Infinity, bt = m.t;
  for (let k = 0; k < p.ts.length; k++) {
    sys.posAt(i, p.ts[k], q);
    const d = Math.hypot(p.xs[k] - q[0], p.ys[k] - q[1]);
    if (d < best) { best = d; bt = p.ts[k]; }
  }
  sys.update(m.t);
  return { d: best, t: bt };
}

// Course trim the way a player does it: once the closest approach to `id`
// is under `lead` s away, tap the engine (0.1 k/s at a time) prograde,
// retrograde, outward or inward, whichever brings the readout toward `want`
// k (a near miss: stations are solid), until it is within 6 k of it or
// there is no time left.
function trim(id, rel, lead, want) {
  const tap = 0.1;
  return {
    control: (m, ctx) => {
      if (m.goalIndex > 0 || m.status !== 'flying') return { done: true };
      if (ctx.tap) {
        if (m.dvUsed() - ctx.tap.d0 < tap) return { thrust: true, angle: ctx.tap.a, tol: 0.1 };
        ctx.tap = null;
      }
      const c = closest(m, id);
      if (c.t - m.t > lead) return { thrust: false, angle: null, dt: 0.5 };
      if (Math.abs(c.d - want) < 6 || c.t - m.t < 5) return { done: true };
      const sys = m.sys; sys.update(m.t);
      const i = sys.byId[rel].index, s = m.ship;
      const pro = Math.atan2(s.vy - sys.vy[i], s.vx - sys.vx[i]);
      let best = Math.abs(c.d - want), ba = null;
      for (const a of [pro, pro + Math.PI, pro + Math.PI / 2, pro - Math.PI / 2]) {
        const v0x = s.vx, v0y = s.vy;
        s.vx += tap * Math.cos(a); s.vy += tap * Math.sin(a);
        const d = Math.abs(closest(m, id).d - want);
        s.vx = v0x; s.vy = v0y;
        if (d < best - 1) { best = d; ba = a; }
      }
      if (ba == null) return { done: true };
      ctx.tap = { d0: m.dvUsed(), a: ba };
      return { thrust: true, angle: ba, tol: 0.1 };
    },
  };
}

// Rendezvous with a moving body: steer the velocity toward (its velocity +
// a closing speed toward it, at most vMax, k per unit distance).
function meet(id, vMax, k) {
  return {
    control: (m, ctx) => {
      if (m.goalIndex > 0 || m.status !== 'flying') return { done: true };
      const sys = m.sys; sys.update(m.t);
      const i = sys.byId[id].index, s = m.ship;
      const dx = sys.px[i] - s.x, dy = sys.py[i] - s.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(vMax, k * d);
      const ex = sys.vx[i] + sp * dx / d - s.vx, ey = sys.vy[i] + sp * dy / d - s.vy, e = Math.hypot(ex, ey);
      if (ctx.burning ? e < 0.02 : e < 0.1) { ctx.burning = false; return { thrust: false, angle: null, dt: 0.05 }; }
      ctx.burning = true;
      return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
    },
  };
}

// How far Relay Tern is ahead of the ship round Brand, in its direction of
// travel (clockwise), in radians.
const ternLead = (m, AP) => -AP.wrap(AP.phase(m, 'tern', 'brand') - AP.shipPhase(m, 'brand'));

const levels = [
  {
    id: 'sunburn',
    name: 'Sunburn',
    intro: 'Ardent is a hot star, and its radiation is strongest close in: a quarter as strong at twice the distance. The dose meter shows what you have taken, and your ship can take only 130 Sv in all. Every lap down here adds up fast, so don\'t wait: burn prograde now to climb, and round off your orbit far out where the light is weak.',
    objective: 'Orbit Ardent between 600 and 1000 k up, taking under 130 Sv of radiation.',
    teaches: 'Radiation falloff',
    bodies: [
      { id: 'ardent', name: 'Ardent', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 1, at: 300, dose: 130 } },
    ],
    ship: ship({ start: { orbit: { body: 'ardent', r: 200, angle: 0 } }, heading: 'prograde', dv: 11, accel: 1 }),
    goals: [{ type: 'orbit', body: 'ardent', rMin: 645, rMax: 1045 }],
    par: 7.2, bounds: 4000, tMax: 900, predict: 400, view: { x: 0, y: 0, span: 2100 },
  },
  {
    id: 'sendrelease',
    name: 'Send and Release',
    intro: 'You are falling toward Pyra on a long ellipse, and the Sundrop probe has to land on Cinder, the scorched planet racing round close to the star. Your path already ends on Cinder, but only after a pass round Pyra: far too hot for the probe, and for you. Out here a small burn moves your path a lot, so aim to hit Cinder on the way in, release the probe (E), and burn at once to lift your own low point. The longer you ride along, the dearer that climb gets.',
    objective: 'Land the probe on Cinder before it takes 80 Sv, then get 1200 k from Pyra, taking under 50 Sv yourself.',
    teaches: 'Cargo with its own dose limit',
    bodies: [
      { id: 'pyra', name: 'Pyra', gm: 40000, radius: 40, color: C.sun2, kind: 'star', radiation: { rate: 1, at: 300, dose: 50 } },
      { id: 'cinder', name: 'Cinder', gm: 300, radius: 12, color: C.red, orbit: { parent: 'pyra', a: 150, phase: 3.45 } },
    ],
    ship: ship({ start: { conic: { body: 'pyra', pe: 110, e: 0.85, nu: -2.85, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1, cargo: [{ id: 'sundrop', name: 'Sundrop', mass: 0.3, dose: 80 }] }),
    goals: [
      { type: 'hit', body: 'cinder', craft: 'sundrop' },
      { type: 'escape', body: 'pyra', r: 1240 },
    ],
    par: 5.8, bounds: 4000, tMax: 1000, predict: 400, view: { x: 0, y: 0, span: 2000 },
  },
  {
    id: 'hotbooster',
    name: 'Hot Booster',
    intro: 'Fly through the sample point in Kiln\'s corona, then get out fast: the dose adds up so quickly down there that the Sunskipper has to burn hard at the bottom of the dive. Hearth is inhabited, and a spent booster left on a path that crosses its orbit hits it sooner or later. So burn the slow, heavy booster retrograde until it is empty and its path falls into Kiln, and drop it (the stage button) at once: the Sunskipper has to lift your low point back up to the sample point while you are still far out, where that is cheap, and save the rest to burn prograde hard as you pass.',
    objective: 'Fly through the corona sample point, then get 1500 k from Kiln, taking under 90 Sv of radiation and leaving no booster on a path that crosses Hearth\'s orbit.',
    teaches: 'Stages for a fast dive',
    bodies: [
      { id: 'kiln', name: 'Kiln', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.5, at: 300, dose: 110 } },
      { id: 'hearth', name: 'Hearth', gm: 300, radius: 16, color: C.green, protect: true, keepOut: 80, orbit: { parent: 'kiln', a: 260, phase: 2.3 } },
      { id: 'watch', name: 'Kiln Watch', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, orbit: { parent: 'kiln', a: 600, phase: Math.PI } },
    ],
    ship: ship({ start: { orbit: { body: 'kiln', r: 600, angle: 0 } }, heading: 'retrograde', stack: [
      { id: 'booster', name: 'Booster', dv: 5.8, accel: 0.15 },
      { name: 'Sunskipper', dv: 11.6, accel: 1.5, dry: 0.4 },
    ] }),
    goals: [
      { type: 'reach', x: -110, y: 0, r: 20, label: 'Corona sample' },
      { type: 'escape', body: 'kiln', r: 1545 },
    ],
    par: 12.5, bounds: 4000, tMax: 700, predict: 400, view: { x: 0, y: 0, span: 1400 },
  },
  {
    id: 'retrorelay',
    name: 'Retrograde Relay',
    intro: 'You are coming past Brand on a fast flyby, clockwise, the same way Relay Tern circles close in to the star. Down at the relay\'s height Brand burns at almost 2 Sv a second, so you can\'t afford to wait there for it to come round. Brake at your low point into a long lap far out, where the light is weak, and choose its length so that when you drop your low point to the relay\'s height from the top, you both get there together. Brake at the bottom to match its speed.',
    objective: 'Rendezvous with Relay Tern (within 10 k, relative speed under 0.6 k/s), taking under 165 Sv of radiation.',
    teaches: 'Phase far out, meet close in',
    bodies: [
      { id: 'brand', name: 'Brand', gm: 40000, radius: 45, color: C.sun2, kind: 'star', radiation: { rate: 1, at: 300, dose: 180 } },
      { id: 'tern', name: 'Relay Tern', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'brand', a: 220, dir: -1, phase: 6.1248 } },
    ],
    ship: ship({ start: { conic: { body: 'brand', pe: 600, e: 1.1, nu: -1.2, angle: 2.4, dir: -1 } }, heading: 'retrograde', dv: 12, accel: 1.5 }),
    goals: [{ type: 'rendezvous', body: 'tern', dist: 20, relVel: 1 }],
    par: 8.4, bounds: 4000, tMax: 1100, predict: 400, view: { x: 0, y: 0, span: 2400 }, startCam: 'overview',
  },
  {
    id: 'patrolshift',
    name: 'Patrol Shift',
    intro: 'Outpost Kestrel shares your orbit, well ahead of you, and you have to catch it. A lower, faster lap would catch it in one go, but that close in Forge would cook you. The cool lane outside is patrolled by three guards circling the other way, each in a red keep-out zone. Raise your high point so one lap lasts long enough for Kestrel to come all the way round to you, leave when your dashed path slips between the patrols both ways, and brake to match Kestrel when you meet.',
    objective: 'Rendezvous with Outpost Kestrel (within 10 k, relative speed under 0.6 k/s) without entering a patrol zone, taking under 140 Sv of radiation.',
    teaches: 'Phasing in the cool lane',
    bodies: [
      { id: 'forge', name: 'Forge', gm: 40000, radius: 45, color: '#ffb27a', kind: 'star', radiation: { rate: 1, at: 300, dose: 150 } },
      { id: 'outpost', name: 'Outpost Kestrel', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'forge', a: 500, phase: 2.583 } },
      { id: 'pat1', name: 'Patrol 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 50, orbit: { parent: 'forge', a: 700, dir: -1, phase: 1.8 } },
      { id: 'pat2', name: 'Patrol 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 50, orbit: { parent: 'forge', a: 700, dir: -1, phase: 1.8 + 2 * Math.PI / 3 } },
      { id: 'pat3', name: 'Patrol 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 50, orbit: { parent: 'forge', a: 700, dir: -1, phase: 1.8 + 4 * Math.PI / 3 } },
    ],
    ship: ship({ start: { orbit: { body: 'forge', r: 500, angle: 0 } }, heading: 'prograde', dv: 4, accel: 1 }),
    goals: [{ type: 'rendezvous', body: 'outpost', dist: 20, relVel: 1 }],
    par: 1.9, bounds: 4000, tMax: 1100, predict: 400, view: { x: 0, y: 0, span: 2000 },
  },
  {
    id: 'solarsurvey',
    name: 'Solar Survey',
    intro: 'You are on a lopsided orbit round Lumen, and its low point dips deep into the heat. Spread the three survey probes evenly round the star: round off your orbit at the top, drop one (E), and fly a phasing lap before each of the next two. Once dropped, every probe soaks up radiation until the job is done, so the slow, cool phasing laps of Constellation take too long: dip your low point for quicker laps instead. Then climb straight out to your parking orbit before those low laps add up for you.',
    objective: 'Spread the three probes at least 100° apart in orbits between 315 and 405 k up, then orbit Lumen between 700 and 1000 k up, with no probe over 190 Sv and you under 230 Sv.',
    teaches: 'A constellation on dose budgets',
    bodies: [
      { id: 'lumen', name: 'Lumen', gm: 40000, radius: 45, color: '#fff1b0', kind: 'star', radiation: { rate: 0.5, at: 300, dose: 230 } },
    ],
    ship: ship({ start: { conic: { body: 'lumen', pe: 210, e: 0.3115, nu: 2.5, angle: 0 } }, heading: 'prograde', dv: 15, accel: 1, cargo: [
      { id: 'sv1', name: 'Survey 1', mass: 0.2, dose: 190 }, { id: 'sv2', name: 'Survey 2', mass: 0.2, dose: 190 }, { id: 'sv3', name: 'Survey 3', mass: 0.2, dose: 190 },
    ] }),
    goals: [
      { type: 'spread', body: 'lumen', crafts: ['sv1', 'sv2', 'sv3'], rMin: 360, rMax: 450, minSep: 100 * Math.PI / 180 },
      { type: 'orbit', body: 'lumen', rMin: 745, rMax: 1045, label: 'Parking orbit' },
    ],
    par: 10.5, bounds: 4000, tMax: 1000, predict: 400, view: { x: 0, y: 0, span: 2200 },
  },
];

const proofs = {
  sunburn: {
    p: [2, 850, 800], scale: [1, 20, 20], tol: [2, 34, 32],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'ardent').pe >= p[2] },
    ],
  },
  sendrelease: {
    p: [2, 0.15, 1.1, 750, -0.7], scale: [2, 0.3, 0.2, 20, 0.4], tol: [2, 0.06, 0.1, 30, 0.06],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      ...dvBurn(p[1], 'pyra', Math.max(0, p[2])),
      { drop: true },
      { burn: p[4], rel: 'pyra', until: (m) => AP.orb(m, 'pyra').pe >= p[3] },
    ],
  },
  hotbooster: {
    p: [2, 118, 1, 4], scale: [2, 5, 1, 0.5], tol: [2, 5, 1, 0.3],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'retro', rel: 'kiln', until: () => false },
      { deploy: true },
      { burn: 'pro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').pe >= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'kiln'); return o.r < o.pe + 6; } },
      { wait: Math.max(0, p[2]) },
      ...dvBurn('pro', 'kiln', p[3]),
    ],
  },
  retrorelay: {
    p: [2, 1000, 2.3, 221], scale: [2, 30, 0.3, 5], tol: [2, 40, 0.11, 9],
    script: (p, AP) => [
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 5; } },
      { wait: Math.max(0, p[0]) },
      { burn: 'retro', rel: 'brand', until: (m) => { const o = AP.orb(m, 'brand'); return o.bound && o.ap <= p[1]; } },
      { coast: (m) => AP.orb(m, 'brand').r > 650 },
      { coast: (m) => { const d = AP.wrap(ternLead(m, AP) - p[2]); return d >= 0 && d < 0.2; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').pe <= p[3] },
      trim('tern', 'brand', 80, 15),
      nearest('tern', 18),
      { burn: 'retro', rel: 'tern', until: (m) => relSpeed(m, 'tern') < 0.4 },
      meet('tern', 1.5, 0.04),
    ],
  },
  patrolshift: {
    p: [10, 850, 300], scale: [3, 5, 50], tol: [2, 34, 30],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', rel: 'forge', until: (m) => AP.orb(m, 'forge').ap >= p[1] },
      { coast: (m) => AP.orb(m, 'forge').rising },
      trim('outpost', 'forge', p[2], 10),
      nearest('outpost', 18),
      { burn: 'retro', rel: 'outpost', until: (m) => relSpeed(m, 'outpost') < 0.4 },
      meet('outpost', 1.5, 0.04),
    ],
  },
  solarsurvey: {
    p: [398.654, 255.573, 247.959, 829.34, 760], scale: [1, 3, 3, 20, 20],
    script: (p, AP) => {
      const top = { coast: (m) => !AP.orb(m, 'lumen').rising };
      const lap = (q) => [
        { burn: 'retro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe <= q },
        { coast: (m) => AP.orb(m, 'lumen').rising }, Object.assign({}, top),
        { burn: 'pro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe >= p[0] },
        { drop: true },
      ];
      return [
        top,
        { burn: 'pro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe >= p[0] },
        { drop: true },
        ...lap(p[1]), ...lap(p[2]),
        { burn: 'pro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').ap >= p[3] },
        { coast: (m) => AP.orb(m, 'lumen').rising },
        { coast: (m) => !AP.orb(m, 'lumen').rising },
        { burn: 'pro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe >= p[4] },
      ];
    },
  },
};

const fails = {
  solarsurvey: [
    { name: 'wait and see', steps: () => [] },
    { name: 'Constellation: phasing laps a third longer, out in the cool', steps: (AP) => {
      const p = proofs.solarsurvey.p, s = proofs.solarsurvey.script(p, AP);
      const outer = () => [
        { burn: 'pro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').ap >= 569 },
        { coast: (m) => AP.orb(m, 'lumen').r > 420 },
        { coast: (m) => AP.orb(m, 'lumen').r < 402 && !AP.orb(m, 'lumen').rising },
        { coast: (m) => AP.orb(m, 'lumen').rising },
        { burn: 'retro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').ap <= 401 },
        { drop: true },
      ];
      return [s[0], s[1], s[2], ...outer(), ...outer(), ...s.slice(-4)];
    } },
    { name: 'one more lap down low before the climb', steps: (AP) => {
      const s = proofs.solarsurvey.script(proofs.solarsurvey.p, AP);
      return [...s.slice(0, -4), { burn: 'retro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe <= 211 },
        { coast: (m) => AP.orb(m, 'lumen').rising }, { coast: (m) => !AP.orb(m, 'lumen').rising }, ...s.slice(-4)];
    } },
  ],
  patrolshift: [
    ...[200, 260, 320, 380].map((pe) => ({ name: 'catch it on a fast lap in the hot inner lane (low point ' + pe + ' k)', steps: (AP) => [
      { burn: 'retro', rel: 'forge', until: (m) => AP.orb(m, 'forge').pe <= pe },
      trim('outpost', 'forge', 300, 15),
      nearest('outpost', 18),
      { burn: 'retro', rel: 'outpost', until: (m) => relSpeed(m, 'outpost') < 0.4 },
      meet('outpost', 1.5, 0.04),
    ] })),
    { name: 'climb into the cool lane at once', steps: (AP) => proofs.patrolshift.script([0].concat(proofs.patrolshift.p.slice(1)), AP) },
    { name: 'wait a lap for a clear look, then climb', steps: (AP) => proofs.patrolshift.script([proofs.patrolshift.p[0] + 351].concat(proofs.patrolshift.p.slice(1)), AP) },
  ],
  retrorelay: [
    { name: 'drop as Tern passes right below you', steps: (AP) => proofs.retrorelay.script([2, 1000, 0, 221], AP) },
    { name: 'dive in at once and chase the relay down there', steps: (AP) => [
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 5; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').pe <= 221 },
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 2; } },
      { burn: 'retro', rel: 'brand', until: (m) => { const o = AP.orb(m, 'brand'); return o.ap <= Math.max(232, o.r + 2); } },
      meet('tern', 6, 0.04),
    ] },
    { name: 'dive in at once and wait on a phasing lap down there', steps: (AP) => [
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 5; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').pe <= 221 },
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 2; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').ap <= 300 },
      { coast: (m) => dist(m, 'tern') < 40 },
      meet('tern', 1.5, 0.04),
    ] },
  ],
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
