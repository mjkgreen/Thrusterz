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
function trim(id, rel, lead, want, gi) {
  const tap = 0.1;
  return {
    control: (m, ctx) => {
      if (m.goalIndex > (gi || 0) || m.status !== 'flying') return { done: true };
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
function meet(id, vMax, k, gi) {
  return {
    control: (m, ctx) => {
      if (m.goalIndex > (gi || 0) || m.status !== 'flying') return { done: true };
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

// Prograde round `rel`, turned `off` radians away from the side the station
// `id` is on (further while it is close ahead), for a climb that starts
// next to it: stations are solid.
function proAway(id, rel, off) {
  return (m) => {
    const sys = m.sys; sys.update(m.t);
    const i = sys.byId[id].index, j = sys.byId[rel].index, s = m.ship;
    const vx = s.vx - sys.vx[j], vy = s.vy - sys.vy[j];
    const dx = sys.px[i] - s.x, dy = sys.py[i] - s.y, d = Math.hypot(dx, dy) || 1, v = Math.hypot(vx, vy) || 1;
    const side = Math.sign(vx * dy - vy * dx) || 1, ahead = Math.max(0, (dx * vx + dy * vy) / (d * v));
    return Math.atan2(vy, vx) - side * (off + (d < 30 ? 0.5 * ahead : 0));
  };
}

// Straight away from a body (to back off from a station after meeting it).
const awayFrom = (id) => (m) => { m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.atan2(m.ship.y - m.sys.py[i], m.ship.x - m.sys.px[i]); };

// How far Relay Tern is ahead of the ship round Brand, in its direction of
// travel (clockwise), in radians.
const ternLead = (m, AP) => -AP.wrap(AP.phase(m, 'tern', 'brand') - AP.shipPhase(m, 'brand'));

const levels = [
  {
    id: 'sunburn',
    name: 'Sunburn',
    intro: 'Ardent is a hot star, and its radiation is strongest close in: four times as strong at half the distance. Your ship can take 160 Sv in all, and down here the dose meter already climbs by about 1 Sv a second. First dip into the corona for a sample, then climb straight out and park far away, where the glow on your dashed path fades. Do it in one pass: brake to drop your low point, burn prograde hard at the bottom, and round off at the top on the high and low point readouts.',
    objective: 'Dip below 100 k above Ardent, then orbit it between 700 and 760 k up, taking under 160 Sv of radiation.',
    teaches: 'Radiation falloff',
    bodies: [
      { id: 'ardent', name: 'Ardent', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.6, at: 300, dose: 160 } },
    ],
    ship: ship({ start: { orbit: { body: 'ardent', r: 240, angle: 0 } }, heading: 'retrograde', dv: 9.9, accel: 1 }),
    goals: [
      { type: 'reach', body: 'ardent', r: 145, label: 'Corona sample' },
      { type: 'orbit', body: 'ardent', rMin: 745, rMax: 805, label: 'Cool parking orbit' },
    ],
    par: 9.2, bounds: 4000, tMax: 900, predict: 400, view: { x: 0, y: 0, span: 2100 },
  },
  {
    id: 'sendrelease',
    name: 'Send and Release',
    intro: 'You are falling toward Pyra on a long ellipse, and the Sundrop probe has to land on Cinder, the scorched planet racing round close to the star. Your path already ends on Cinder, but only after a pass round Pyra: far too hot for the probe, and for you. Out here a small burn moves your path a lot: nudge it until it hits little Cinder on the way in, before the probe\'s dose mark, and release the probe (E). Then turn half way between prograde and straight out and burn at once, watching the low and high point readouts: your ship can take only 16 Sv, so you must stay far out while the probe falls.',
    objective: 'Land the probe on Cinder before it takes 55 Sv, then orbit Pyra between 800 and 2000 k up, taking under 16 Sv yourself.',
    teaches: 'Cargo with its own dose limit',
    bodies: [
      { id: 'pyra', name: 'Pyra', gm: 40000, radius: 40, color: C.sun2, kind: 'star', radiation: { rate: 1, at: 300, dose: 16 } },
      { id: 'cinder', name: 'Cinder', gm: 60, radius: 9, color: C.red, orbit: { parent: 'pyra', a: 150, phase: 3.45 } },
    ],
    ship: ship({ start: { conic: { body: 'pyra', pe: 110, e: 0.85, nu: -2.85, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1, cargo: [{ id: 'sundrop', name: 'Sundrop', mass: 0.3, dose: 55 }] }),
    goals: [
      { type: 'hit', body: 'cinder', craft: 'sundrop' },
      { type: 'orbit', body: 'pyra', rMin: 840, rMax: 2040, label: 'Cool orbit' },
    ],
    par: 6.1, bounds: 4000, tMax: 1000, predict: 400, view: { x: 0, y: 0, span: 2000 },
  },
  {
    id: 'hotbooster',
    name: 'Hot Booster',
    intro: 'Fly through the sample point in Kiln\'s corona, then park far out. Hearth is inhabited: a spent booster left on a path that crosses its orbit hits it sooner or later, and its red keep-out zone is closed to you. Kiln Watch, on your own orbit, is guarded the same way. Burn the slow, heavy booster retrograde until it is empty so its path falls into Kiln, and drop it (the stage button) at once. Then lift your low point onto the sample point with the light Sunskipper, burn prograde as you pass it, where a little fuel throws your high point a long way, and round off at the top on the high and low point readouts.',
    objective: 'Fly through the corona sample point, send the booster into Kiln, then orbit Kiln between 1145 and 1200 k up, taking under 118 Sv of radiation and staying out of Hearth\'s zone.',
    teaches: 'Stages for a fast dive',
    bodies: [
      { id: 'kiln', name: 'Kiln', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.5, at: 300, dose: 118 } },
      { id: 'hearth', name: 'Hearth', gm: 60, radius: 16, color: C.green, protect: true, keepOut: 80, orbit: { parent: 'kiln', a: 260, phase: 2.3 } },
      { id: 'watch', name: 'Kiln Watch', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, orbit: { parent: 'kiln', a: 600, phase: Math.PI } },
    ],
    ship: ship({ start: { orbit: { body: 'kiln', r: 600, angle: 0 } }, heading: 'retrograde', stack: [
      { id: 'booster', name: 'Booster', dv: 5.8, accel: 0.15 },
      { name: 'Sunskipper', dv: 9.4, accel: 1.5, dry: 0.4 },
    ] }),
    goals: [
      { type: 'reach', x: -110, y: 0, r: 5, label: 'Corona sample' },
      { type: 'hit', body: 'kiln', craft: 'booster', label: 'Booster into Kiln' },
      { type: 'orbit', body: 'kiln', rMin: 1190, rMax: 1245, label: 'Far parking orbit' },
    ],
    par: 13.6, bounds: 4000, tMax: 700, predict: 400, view: { x: 0, y: 0, span: 1400 },
  },
  {
    id: 'retrorelay',
    name: 'Retrograde Relay',
    intro: 'You are coming past Brand on a fast flyby, clockwise, the same way Relay Tern circles close in to the star. Down at the relay\'s height Brand burns at almost 2 Sv a second, and your ship can take 258 Sv in all, so don\'t chase it there. Brake at your low point into a long lap far out, where the light is weak, and wait until Relay Tern is about a third of a lap ahead of you. Then drop your low point to its height: the ghost on your path shows where it will be when you get there, so tap to bring the closest approach down and brake to match it. Once you have met it, climb straight to the cool orbit, burning prograde and a little away from the relay.',
    objective: 'Get captured by Brand (high point under 1055 k up), rendezvous with Relay Tern (within 12 k, relative speed under 0.5 k/s), then orbit Brand between 367 and 395 k up, taking under 258 Sv of radiation.',
    teaches: 'Phase far out, meet close in',
    bodies: [
      { id: 'brand', name: 'Brand', gm: 40000, radius: 45, color: C.sun2, kind: 'star', radiation: { rate: 1, at: 300, dose: 258 } },
      { id: 'tern', name: 'Relay Tern', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'brand', a: 220, dir: -1, phase: 6.1248 } },
    ],
    ship: ship({ start: { conic: { body: 'brand', pe: 600, e: 1.1, nu: -1.2, angle: 2.4, dir: -1 } }, heading: 'retrograde', dv: 15, accel: 1.5 }),
    goals: [
      { type: 'orbit', body: 'brand', rMin: 200, rMax: 1100, label: 'Capture' },
      { type: 'rendezvous', body: 'tern', dist: 12, relVel: 0.5 },
      { type: 'orbit', body: 'brand', rMin: 412, rMax: 440, label: 'Cool orbit' },
    ],
    par: 13.6, bounds: 4000, tMax: 1100, predict: 400, view: { x: 0, y: 0, span: 2400 }, startCam: 'overview',
  },
  {
    id: 'patrolshift',
    name: 'Patrol Shift',
    intro: 'Outpost Kestrel shares your orbit, well ahead of you, and you have to catch it and then move up to the cooler inner lane just below the patrols. A lower, faster lap would catch it, but that close in Forge would cook you. The cool lane outside is patrolled by three guards circling the other way, each in a red keep-out zone. Raise your high point to about 805 k up so one lap lasts long enough for Kestrel to come round to you, leaving when your dashed path slips between the patrols both ways; on the way back down, tap to bring the closest approach to Kestrel down and brake to match it. Then back off from the outpost and climb, cutting the engine on the high and low point readouts: the dose meter keeps running the whole time.',
    objective: 'Rendezvous with Outpost Kestrel (within 15 k, relative speed under 0.6 k/s), then orbit Forge between 559 and 587 k up, never entering a patrol zone and taking under 219 Sv of radiation.',
    teaches: 'Phasing in the cool lane',
    bodies: [
      { id: 'forge', name: 'Forge', gm: 40000, radius: 45, color: '#ffb27a', kind: 'star', radiation: { rate: 1, at: 300, dose: 219 } },
      { id: 'outpost', name: 'Outpost Kestrel', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'forge', a: 500, phase: 2.583 } },
      { id: 'pat1', name: 'Patrol 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 40, orbit: { parent: 'forge', a: 700, dir: -1, phase: 1.8 } },
      { id: 'pat2', name: 'Patrol 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 40, orbit: { parent: 'forge', a: 700, dir: -1, phase: 1.8 + 2 * Math.PI / 3 } },
      { id: 'pat3', name: 'Patrol 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 40, orbit: { parent: 'forge', a: 700, dir: -1, phase: 1.8 + 4 * Math.PI / 3 } },
    ],
    ship: ship({ start: { orbit: { body: 'forge', r: 500, angle: 0 } }, heading: 'prograde', dv: 5.2, accel: 1 }),
    goals: [
      { type: 'rendezvous', body: 'outpost', dist: 15, relVel: 0.6 },
      { type: 'orbit', body: 'forge', rMin: 604, rMax: 632, label: 'Inner lane' },
    ],
    par: 4.8, bounds: 4000, tMax: 1400, predict: 400, view: { x: 0, y: 0, span: 2000 },
  },
  {
    id: 'solarsurvey',
    name: 'Solar Survey',
    intro: 'You are on a lopsided orbit round Lumen, and its low point dips deep into the heat. Round off your orbit at the top first, then spread the three survey probes round the star: drop one (E), and fly a phasing lap before each of the next two. Once dropped, every probe soaks up radiation until the whole job is done, parking included, so the slow, cool phasing laps of Constellation take too long: dip your low point to about 160 k up for quicker laps instead, a little less deep on the second, and watch the probes\' dose. Then climb straight out to your parking orbit and round it off on the readouts before those low laps add up.',
    objective: 'Orbit Lumen between 315 and 405 k up, spread the three probes at least 112° apart in orbits between 330 and 380 k up, then orbit Lumen between 766 and 810 k up, with no probe over 192 Sv and you under 242 Sv.',
    teaches: 'A constellation on dose budgets',
    bodies: [
      { id: 'lumen', name: 'Lumen', gm: 40000, radius: 45, color: '#fff1b0', kind: 'star', radiation: { rate: 0.5, at: 300, dose: 242 } },
    ],
    ship: ship({ start: { conic: { body: 'lumen', pe: 210, e: 0.3115, nu: 2.5, angle: 0 } }, heading: 'prograde', dv: 13.6, accel: 1, cargo: [
      { id: 'sv1', name: 'Survey 1', mass: 0.2, dose: 192 }, { id: 'sv2', name: 'Survey 2', mass: 0.2, dose: 192 }, { id: 'sv3', name: 'Survey 3', mass: 0.2, dose: 192 },
    ] }),
    goals: [
      { type: 'orbit', body: 'lumen', rMin: 360, rMax: 450, label: 'Survey orbit' },
      { type: 'spread', body: 'lumen', crafts: ['sv1', 'sv2', 'sv3'], rMin: 375, rMax: 425, minSep: 112 * Math.PI / 180 },
      { type: 'orbit', body: 'lumen', rMin: 811, rMax: 855, label: 'Parking orbit' },
    ],
    par: 12.8, bounds: 4000, tMax: 1000, predict: 400, view: { x: 0, y: 0, span: 2200 },
  },
];

const proofs = {
  sunburn: {
    p: [2, 133, 787, 767], scale: [1, 5, 10, 10], tol: [2, 5, 31, 31],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'retro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').pe <= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'ardent'); return !o.rising && o.r < o.pe + 4; } },
      { coast: (m) => AP.orb(m, 'ardent').rising },
      { burn: 'pro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').ap >= p[2] },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').pe >= p[3] },
    ],
  },
  sendrelease: {
    p: [2, 0.17, 1.11, 900, -1.3], scale: [2, 0.3, 0.2, 20, 0.4], tol: [2, 0.06, 0.1, 42, 0.06],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      ...dvBurn(p[1], 'pyra', Math.max(0, p[2])),
      { drop: true },
      { burn: p[4], rel: 'pyra', until: (m) => AP.orb(m, 'pyra').pe >= p[3] },
    ],
  },
  hotbooster: {
    p: [3, 108, 1, 1207, 1192], scale: [2, 3, 0.5, 10, 10], tol: [2, 4.3, 1, 48, 48],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'retro', rel: 'kiln', until: () => false },
      { deploy: true },
      { burn: 'pro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').pe >= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'kiln'); return o.r < o.pe + 6; } },
      { wait: Math.max(0, p[2]) },
      { burn: 'pro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').ap >= p[3] },
      { coast: (m) => AP.orb(m, 'kiln').r > 300 },
      { coast: (m) => !AP.orb(m, 'kiln').rising },
      { burn: 'pro', rel: 'kiln', until: (m) => AP.orb(m, 'kiln').pe >= p[4] },
    ],
  },
  retrorelay: {
    p: [2, 1000, 2.3, 221, 431, 419], scale: [2, 30, 0.3, 5, 5, 5], tol: [2, 40, 0.11, 9, 17, 17],
    script: (p, AP) => [
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 5; } },
      { wait: Math.max(0, p[0]) },
      { burn: 'retro', rel: 'brand', until: (m) => { const o = AP.orb(m, 'brand'); return o.bound && o.ap <= p[1]; } },
      { coast: (m) => AP.orb(m, 'brand').r > 650 },
      { coast: (m) => { const d = AP.wrap(ternLead(m, AP) - p[2]); return d >= 0 && d < 0.2; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').pe <= p[3] },
      trim('tern', 'brand', 80, 15, 1),
      nearest('tern', 18),
      { burn: 'retro', rel: 'tern', until: (m) => relSpeed(m, 'tern') < 0.4 },
      meet('tern', 1.5, 0.04, 1),
      { burn: proAway('tern', 'brand', 0.3), until: (m) => AP.orb(m, 'brand').ap >= p[4] },
      { coast: (m) => AP.orb(m, 'brand').rising },
      { coast: (m) => !AP.orb(m, 'brand').rising },
      { burn: 'pro', rel: 'brand', until: (m) => AP.orb(m, 'brand').pe >= p[5] },
    ],
  },
  patrolshift: {
    p: [10, 850, 300, 621, 614], scale: [3, 5, 50, 5, 5], tol: [2, 34, 30, 25, 24],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', rel: 'forge', until: (m) => AP.orb(m, 'forge').ap >= p[1] },
      { coast: (m) => AP.orb(m, 'forge').rising },
      trim('outpost', 'forge', p[2], 10),
      nearest('outpost', 18),
      { burn: 'retro', rel: 'outpost', until: (m) => relSpeed(m, 'outpost') < 0.4 },
      meet('outpost', 1.5, 0.04),
      { burn: 'retro', rel: 'outpost', until: (m) => relSpeed(m, 'outpost') < 0.05 },
      ...dvBurn(awayFrom('outpost'), null, 0.2),
      { wait: 15 },
      { burn: proAway('outpost', 'forge', 0.15), until: (m) => AP.orb(m, 'forge').ap >= p[3] },
      { coast: (m) => AP.orb(m, 'forge').rising },
      { coast: (m) => !AP.orb(m, 'forge').rising },
      { burn: 'pro', rel: 'forge', until: (m) => { const o = AP.orb(m, 'forge'); return o.pe >= Math.min(p[4], o.r - 3); } },
    ],
  },
  solarsurvey: {
    p: [412, 202, 217, 838, 827, 5], scale: [1, 3, 3, 20, 20, 1], tol: [16, 8, 8, 34, 33, 1.5],
    script: (p, AP) => {
      const top = { coast: (m) => !AP.orb(m, 'lumen').rising };
      const lap = (q) => [
        { burn: 'retro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe <= q },
        { coast: (m) => AP.orb(m, 'lumen').rising }, Object.assign({}, top),
        { burn: 'pro', rel: 'lumen', until: (m) => { const o = AP.orb(m, 'lumen'); return o.pe >= Math.min(p[0], o.r - 3); } },
        { wait: Math.max(0, p[5]) }, { drop: true },
      ];
      return [
        top,
        { burn: 'pro', rel: 'lumen', until: (m) => { const o = AP.orb(m, 'lumen'); return o.pe >= Math.min(p[0], o.r - 3); } },
        { wait: Math.max(0, p[5]) }, { drop: true },
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
      return [...s.slice(0, 4), ...outer(), ...outer(), ...s.slice(-4)];
    } },
    { name: 'one more lap down low before the climb', steps: (AP) => {
      const s = proofs.solarsurvey.script(proofs.solarsurvey.p, AP);
      return [...s.slice(0, -4), { burn: 'retro', rel: 'lumen', until: (m) => AP.orb(m, 'lumen').pe <= 211 },
        { coast: (m) => AP.orb(m, 'lumen').rising }, { coast: (m) => !AP.orb(m, 'lumen').rising }, ...s.slice(-4)];
    } },
  ],
  patrolshift: [
    ...[300, 340, 380, 420].map((pe) => ({ name: 'catch it on a fast lap in the hot inner lane (low point ' + pe + ' k)', steps: (AP) => [
      { burn: 'retro', rel: 'forge', until: (m) => AP.orb(m, 'forge').pe <= pe },
      trim('outpost', 'forge', 300, 15),
      nearest('outpost', 18),
      { burn: 'retro', rel: 'outpost', until: (m) => relSpeed(m, 'outpost') < 0.4 },
      meet('outpost', 1.5, 0.04),
      ...proofs.patrolshift.script(proofs.patrolshift.p, AP).slice(-8),
    ] })),
    { name: 'climb into the cool lane at once', steps: (AP) => proofs.patrolshift.script([0].concat(proofs.patrolshift.p.slice(1)), AP) },
    { name: 'wait a lap for a clear look, then climb', steps: (AP) => proofs.patrolshift.script([proofs.patrolshift.p[0] + 351].concat(proofs.patrolshift.p.slice(1)), AP) },
  ],
  retrorelay: [
    { name: 'drop as Tern passes right below you', steps: (AP) => { const p = proofs.retrorelay.p.slice(); p[2] = 0; return proofs.retrorelay.script(p, AP); } },
    { name: 'dive in at once and chase the relay down there', steps: (AP) => [
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 5; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').pe <= 221 },
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 2; } },
      { burn: 'retro', rel: 'brand', until: (m) => { const o = AP.orb(m, 'brand'); return o.ap <= Math.max(232, o.r + 2); } },
      meet('tern', 6, 0.04, 1),
      ...proofs.retrorelay.script(proofs.retrorelay.p, AP).slice(-4),
    ] },
    { name: 'dive in at once and wait on a phasing lap down there', steps: (AP) => [
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 5; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').pe <= 221 },
      { coast: (m) => { const o = AP.orb(m, 'brand'); return o.r < o.pe + 2; } },
      { burn: 'retro', rel: 'brand', until: (m) => AP.orb(m, 'brand').ap <= 300 },
      { coast: (m) => dist(m, 'tern') < 40 },
      meet('tern', 1.5, 0.04, 1),
      ...proofs.retrorelay.script(proofs.retrorelay.p, AP).slice(-4),
    ] },
    { name: 'meet the relay, then linger a minute before the climb', steps: (AP) => {
      const s = proofs.retrorelay.script(proofs.retrorelay.p, AP);
      return [...s.slice(0, -4), { wait: 60 }, ...s.slice(-4)];
    } },
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
    { name: 'release, watch the probe for half a minute, then climb', steps: (AP) => {
      const p = proofs.sendrelease.p, s = proofs.sendrelease.script(p, AP);
      return [...s.slice(0, -1), { wait: 30 }, s[s.length - 1]];
    } },
    { name: 'release, then climb straight prograde', steps: (AP) => {
      const p = proofs.sendrelease.p, s = proofs.sendrelease.script(p, AP);
      return [...s.slice(0, -1), { burn: 'pro', rel: 'pyra', until: (m) => AP.orb(m, 'pyra').pe >= p[3] }];
    } },
  ],
  sunburn: [
    { name: 'wait half a lap, then dive', steps: (AP) => [{ wait: 58 }, ...proofs.sunburn.script(proofs.sunburn.p, AP)] },
    { name: 'climb to the cool orbit first, dive from there', steps: (AP) => [
      { burn: 'pro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').ap >= 787 },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').pe >= 767 },
      { burn: 'retro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').pe <= 133 },
      { coast: (m) => AP.orb(m, 'ardent').rising },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').pe >= 767 },
    ] },
    { name: 'dive, ride back up, climb from the top', steps: (AP) => [
      { burn: 'retro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').pe <= 133 },
      { coast: (m) => AP.orb(m, 'ardent').rising },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').ap >= 787 },
      { coast: (m) => AP.orb(m, 'ardent').r < 700 },
      { coast: (m) => !AP.orb(m, 'ardent').rising },
      { burn: 'pro', rel: 'ardent', until: (m) => AP.orb(m, 'ardent').pe >= 767 },
    ] },
  ],
};

module.exports = { levels, proofs, fails };
