'use strict';
// World 4 · Chapter 3 · Beams: the pulsar's sweeping beam. See tools/w4/README.md.
// A pulsar sweeps two narrow beams round; outside them there is no radiation
// and shadows block them too. Close in a hit is huge, far out it is weak,
// and a beam that turns with you lingers while one you meet head on is gone
// in seconds.
const { ship, C } = require('../../js/levels.js');

const PULSAR = '#e4dcff';
// Nox's year round Argus (its rail includes its own mass): the beam turns with it.
// The 400 k orbit round Lyre turns exactly with its beams.
const LYRE_SYNC = 2 * Math.PI / Math.sqrt(20000 / 400 ** 3);
// The 500 k orbit round Corvus turns exactly with its beams.
const CORVUS_SYNC = 2 * Math.PI / Math.sqrt(10000 / 500 ** 3);
const NOX_YEAR = 2 * Math.PI / Math.sqrt(44000 / 1500 ** 3);

// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };
// A burn held in the direction dir gives as it starts (relative to `rel`):
// flip once, then hold still, e.g. a retrograde burn right through a stop.
const held = (AP, dir, rel, until) => {
  let a = null;
  return [{ fn: () => { a = null; } }, { burn: (m) => (a == null ? (a = typeof dir === 'function' ? dir(m) : AP.aim(m, dir, rel)) : a), until }];
};
// Close in on a body and match its velocity: steer the velocity toward the
// body's own plus a slow approach (k per k of distance, at most vMax).
const meet = (id, k, vMax, lag) => ({ control: (m, c) => {
  if (m.status !== 'flying' || m.goalIndex > (c.g0 == null ? (c.g0 = m.goalIndex) : c.g0)) return { done: true };
  const sys = m.sys; sys.update(m.t);
  const i = sys.byId[id].index, s = m.ship;
  const bvx = sys.vx[i], bvy = sys.vy[i], u = Math.hypot(bvx, bvy) || 1, back = lag || 0;
  const dx = sys.px[i] - back * bvx / u - s.x, dy = sys.py[i] - back * bvy / u - s.y, d = Math.hypot(dx, dy) || 1;
  const sp = Math.min(vMax, k * d);
  const ex = bvx + sp * dx / d - s.vx, ey = bvy + sp * dy / d - s.vy;
  if (Math.hypot(ex, ey) < (c.burning ? 0.02 : 0.06)) { c.burning = false; return { thrust: false, angle: null, dt: 0.05 }; }
  c.burning = true;
  return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
} });
// Keep station on a moving goal point (e.g. L2, goal g of the level): steer
// the velocity toward the point's own plus a slow approach, burning only
// when the error is worth it. Runs until pred (or the mission ends).
const park = (gi, k, vMax, pred) => ({ control: (m, c) => {
  if (m.status !== 'flying' || (pred && pred(m, c))) return { done: true };
  const P = m.goalPoint(m.level.goals[gi]), s = m.ship;
  const dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy) || 1;
  const sp = Math.min(vMax, k * d);
  const ex = P.vx + sp * dx / d - s.vx, ey = P.vy + sp * dy / d - s.vy, e = Math.hypot(ex, ey);
  if (c.burning ? e < 0.02 : e < 0.08) { c.burning = false; return { thrust: false, angle: null, dt: 0.1 }; }
  c.burning = true;
  return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
} });

// Honest turning on a side-thruster budget (as in tools/w3/ch3.js): hold the
// nose still while coasting (free), make each turn one slow deliberate slew,
// and burn wherever the nose points.
const hold = (pred) => ({ control: (m, c) => pred(m, c) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });
// Angle turned while counter-firing a spin w to a stop (the thrusters ramp
// up from 30% over 0.8 s, see flight.js).
const stopDist = (w) => {
  let t = 0, a = 0, v = w;
  while (v > 0) { const h = 1 / 120; v -= 1.2 * Math.min(1, 0.3 + t / 0.8) * h; a += Math.max(0, v) * h; t += h; }
  return a;
};
// Spin up to `rate` (rad/s), coast, counter-fire to stop on targetFn(m, c).
const slew = (AP, targetFn, rate) => {
  let ph = 0, dir = 1;
  return { control: (m, c) => {
    const s = m.ship;
    let rem = AP.wrap(targetFn(m, c) - s.angle);
    if (ph === 0) {
      if (Math.abs(rem) < 0.02 && Math.abs(s.omega) < 1e-3) return { done: true };
      dir = Math.sign(rem) || 1; ph = 1;
    }
    rem *= dir;
    if (rem < -2) rem += 2 * Math.PI;
    const w = s.omega * dir, stop = w > 0 ? stopDist(w) + 0.004 : 0;
    if (ph === 1) {
      if (m.rotLatch === dir) return { rotate: 0, angle: null, dt: 1 / 120 };
      if (w < rate && rem > stop + 0.02) return { rotate: dir, angle: null, dt: 1 / 120 };
      ph = 2;
    }
    if (ph === 2) {
      if (rem > stop) return { rotate: 0, angle: null, dt: Math.max(1 / 120, Math.min(0.1, (rem - stop) / (2 * Math.abs(w) + 1e-9))) };
      ph = 3;
    }
    if (Math.abs(s.omega) > 1e-4 && m.rcsFuel > 0) return { rotate: -Math.sign(s.omega), angle: null, dt: 1 / 120 };
    return { done: true };
  } };
};
const burnHere = (until) => ({ control: (m, c) => until(m, c) ? { done: true } : { thrust: true, rotate: 0, angle: null } });

const levels = [
  {
    id: 'beacon',
    name: 'Lighthouse',
    intro: 'Pharos is a pulsar: it sweeps two narrow beams of radiation round like a lighthouse, and outside them there is none at all. You are climbing away from it slowly, on an orbit that falls back, and a beam is coming round behind you. One sweep this close is more than your ship can take, but far out a beam is weak. Burn prograde now and keep burning well past escape: the farther out you are when it catches you, the less it hurts. Watch the path ahead: it glows where the beam will catch you, fainter the farther out that is.',
    objective: 'Get 1200 k from Pharos, taking under 10 Sv of radiation.',
    teaches: 'Pulsars · beat the beam outward',
    bodies: [
      { id: 'pharos', name: 'Pharos', gm: 30000, radius: 10, color: PULSAR, kind: 'pulsar', radiation: { rate: 6.5, at: 300, dose: 10, beam: { width: 0.3, period: 150, phase: 0 } } },
    ],
    ship: ship({ start: { conic: { body: 'pharos', pe: 150, e: 0.5, nu: 0.8, angle: 0 } }, heading: 'prograde', dv: 7.4, accel: 1 }),
    goals: [{ type: 'escape', body: 'pharos', r: 1200 }],
    par: 5.2, bounds: 4000, tMax: 400, predict: 300, view: { x: 0, y: 300, span: 1700 }, startCam: 'overview',
  },
  {
    id: 'widdershins',
    name: 'Wrong Way Round',
    intro: 'A beam from Vela is about to sweep over you, and it turns almost as fast as you go round: going with it, it would sit on you for most of a minute, but against its spin it is gone in seconds. Climbing first and turning round up high would be cheaper, and far too slow. Flip now and burn retrograde right through a stop until you are going round the other way, and keep burning until your path climbs to meet Widdershins Station, which orbits backwards. The path glows where a beam catches you: watch the glow shrink as you turn round. Then match the station\'s speed.',
    objective: 'Rendezvous with Widdershins Station (within 20 k, relative speed under 0.8 k/s), taking under 7 Sv of radiation.',
    teaches: 'Cross the beam against its spin',
    bodies: [
      { id: 'vela', name: 'Vela', gm: 3000, radius: 8, color: PULSAR, kind: 'pulsar', radiation: { rate: 0.15, at: 250, dose: 7, beam: { width: 0.3, period: 317, phase: -0.2 } } },
      { id: 'widd', name: 'Widdershins Station', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'vela', a: 500, phase: 1.879, dir: -1 } },
    ],
    ship: ship({ start: { orbit: { body: 'vela', r: 250, angle: 0 } }, heading: 'prograde', dv: 13, accel: 1 }),
    goals: [{ type: 'rendezvous', body: 'widd', dist: 20, relVel: 0.8 }],
    par: 8.8, bounds: 3000, tMax: 900, predict: 300, view: { x: 0, y: 0, span: 1300 }, startCam: 'overview',
  },
  {
    id: 'duckdrop',
    name: 'Duck and Release',
    intro: 'You are racing out past Cowl with a probe for deep space, and a beam from Vigil is about to sweep across your path. The probe takes radiation once it is out (E drops it), and it can\'t survive a sweep this close. Watch the beam on screen: let it pass, release the probe straight after it, and the probe is far out before the next one. Then brake hard and duck into Cowl\'s shadow at L2, the marker in the dark cone behind it, before that next sweep reaches you.',
    objective: 'Hold at Cowl\'s L2 (within 20 k, moving with it to within 0.6 k/s) for 8 s, and get the probe 1200 k from Vigil, the ship taking under 16 Sv and the probe under 5 Sv.',
    teaches: 'Release between sweeps · hide at L2',
    bodies: [
      { id: 'vigil', name: 'Vigil', gm: 10000, radius: 10, color: PULSAR, kind: 'pulsar', radiation: { rate: 1, at: 650, dose: 16, beam: { width: 0.3, period: 200, phase: 1.53 } } },
      { id: 'cowl', name: 'Cowl', gm: 400, radius: 30, color: C.grey, orbit: { parent: 'vigil', a: 700, phase: 1.84 } },
    ],
    ship: ship({ start: { conic: { body: 'vigil', pe: 250, e: 1.05, nu: 1.75, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1, cargo: [{ id: 'probe', name: 'Probe', mass: 0.3, dose: 5 }] }),
    goals: [
      { type: 'hold', lagrange: { body: 'cowl', lead: 0, scale: 1.2528 }, r: 20, relVel: 0.6, hold: 8, label: 'L2' },
      { type: 'escape', body: 'vigil', craft: 'probe', r: 1200, label: 'Deep space' },
    ],
    par: 5.2, bounds: 4000, tMax: 400, predict: 250, view: { x: -300, y: 700, span: 1500 }, startCam: 'overview',
  },
  {
    id: 'darkturn',
    name: 'Turn in the Dark',
    intro: 'Nox goes round Argus exactly as fast as the beam turns, so the beam never leaves it: its day side is always lit, and the only shade is the shadow cone behind it. You are coasting through that shadow near the top of your orbit, nose forward, and the side thrusters have only a few taps left. The glow on your path ahead shows where you come out of the shadow, and a slow turn round takes about 20 s: start now, with a tap or two (a spin you can\'t stop wastes the lot), while you are still in the dark. Then burn to kill most of your speed and fall straight down the shadow to the landing zone.',
    objective: 'Land on Nox inside the night-side zone, taking under 10 Sv of radiation, with 0.8 s of side-thruster propellant.',
    teaches: 'Turn in the shade · a beam that turns with you',
    bodies: [
      { id: 'argus', name: 'Argus', gm: 40000, radius: 10, color: PULSAR, kind: 'pulsar', radiation: { rate: 1, at: 1500, dose: 10, beam: { width: 0.6, period: NOX_YEAR, phase: 0 } } },
      { id: 'nox', name: 'Nox', gm: 4000, radius: 60, color: C.purple, spin: 2 * Math.PI / NOX_YEAR, orbit: { parent: 'argus', a: 1500, phase: 0 } },
    ],
    ship: ship({ start: { conic: { body: 'nox', pe: 110, e: 190 / 410, nu: 3.17, angle: Math.PI } }, heading: 'prograde', dv: 3.2, accel: 1, rcs: { fuel: 0.8 } }),
    goals: [{ type: 'hit', body: 'nox', site: { angle: 0, width: 1.2 }, label: 'Night side' }],
    par: 2.1, bounds: 4000, tMax: 400, predict: 200, view: { x: 1500, y: 0, span: 900 },
  },
  {
    id: 'beampatrol',
    name: 'Beam Patrol',
    intro: 'Sentry patrols guard the lane you are drifting along, each inside a red keep-out zone, and Sentry 1 is closing in from behind. Your way out is down to the 400 k band, where an orbit turns exactly with Lyre\'s beams: arrive between them and they never reach you, arrive in one and it sits on you. Dive now and you land in a beam, wait in the lane and the sentry gets you, and lower down the sweeps burn you. So brake just a touch to pull ahead of the sentry, then wait for the gap. A dive bottoms out half way round from where you start it: brake a little and the path preview shows that bottom, glowing if a beam will be waiting there. Go when it comes out dark.',
    objective: 'Orbit Lyre between 380 and 420 k without entering a keep-out zone, taking under 10 Sv of radiation.',
    teaches: 'Line up patrol gaps and beam gaps',
    bodies: [
      { id: 'lyre', name: 'Lyre', gm: 20000, radius: 10, color: PULSAR, kind: 'pulsar', radiation: { rate: 0.1, at: 400, dose: 10, beam: { width: 1.2, period: LYRE_SYNC, phase: 1.6 } } },
      ...[1, 2, 3].map((k) => ({ id: 'sentry' + k, name: 'Sentry ' + k, gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 45, orbit: { parent: 'lyre', a: 600, phase: -0.1 + (k - 1) * 2 * Math.PI / 3 } })),
    ],
    ship: ship({ start: { conic: { body: 'lyre', pe: 590, e: 0.03, nu: 0, angle: 0 } }, heading: 'prograde', dv: 2.2, accel: 1 }),
    goals: [{ type: 'orbit', body: 'lyre', rMin: 380, rMax: 420 }],
    par: 1.45, bounds: 3000, tMax: 900, predict: 300, view: { x: 0, y: 0, span: 1500 }, startCam: 'overview',
  },
  {
    id: 'keeper',
    name: 'Keeper\'s Station',
    intro: 'Keeper\'s Station rides the 500 k orbit, which turns exactly with Corvus\'s beams, so it sits between them forever, and so do you, on the far side. To catch up you must cross a beam: near the 500 k orbit it turns almost with you and lingers, but deep down you cross it fast (the path glows where it will catch you). Dive deep on the booster, round off down there and drop it (the stage button) where its orbit stays well clear of the station\'s: the readout says STAGE NOW → SAFE ORBIT when it is. Then climb on the upper stage when Keeper is about 50° ahead of you: the closest approach readout shows how near you will pass.',
    objective: 'Rendezvous with Keeper\'s Station (within 20 k, relative speed under 0.8 k/s), taking under 13 Sv of radiation, with no spent stage on an orbit that crosses the station\'s.',
    teaches: 'Phase through a beam · stage where it is safe',
    bodies: [
      { id: 'corvus', name: 'Corvus', gm: 10000, radius: 10, color: PULSAR, kind: 'pulsar', radiation: { rate: 0.11, at: 500, dose: 13, beam: { width: 0.3, period: CORVUS_SYNC, phase: Math.PI / 2 } } },
      { id: 'keeper', name: 'Keeper\'s Station', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 30, orbit: { parent: 'corvus', a: 500, phase: Math.PI } },
    ],
    ship: ship({ start: { orbit: { body: 'corvus', r: 500, angle: 0 } }, heading: 'prograde', stack: [
      { name: 'Booster', dv: 1.6, accel: 1 },
      { name: 'Upper stage', dv: 2.4, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ] }),
    goals: [{ type: 'rendezvous', body: 'keeper', dist: 20, relVel: 0.8 }],
    par: 2.3, bounds: 3000, tMax: 950, predict: 300, view: { x: 0, y: 0, span: 1300 }, startCam: 'overview',
  },
];

const proofs = {
  beacon: {
    // Burn prograde at once, well past escape, so the beam finds you far out.
    // p: Δv to burn, aim off prograde.
    p: [5.1, 0], scale: [0.3, 0.3], tol: [0.2, 0.06],
    script: (p) => [
      { burn: p[1], until: (m) => m.dvUsed() >= p[0] },
    ],
  },
  widdershins: {
    // Flip at once and burn retrograde through a stop: going round the other
    // way the beam crosses in seconds. Up to the station's height, then meet it.
    // p: high point to burn to, distance to start matching speed.
    p: [600, 60], scale: [10, 10], tol: [24, 10], opts: { turn: true, turnRate: 0.3 },
    script: (p, AP) => [
      ...held(AP, 'retro', 'vela', (m) => { const o = AP.orb(m, 'vela'); return o.dir < 0 && o.ap >= p[0]; }),
      { coast: (m) => dist(m, 'widd') < p[1] },
      meet('widd', 0.03, 0.6),
    ],
  },
  duckdrop: {
    // Let the sweep pass, release, then brake into Cowl's L2 and keep station
    // in its shadow through the next sweep.
    // p: release time, distance from L2 to start braking, station-keeping gain and top approach speed.
    p: [24.536, 147.333, 0.015, 2.985], scale: [3, 20, 0.005, 0.5], tol: [1.5, 20, 0, 0], opts: { turn: true, turnRate: 0.4 },
    script: (p, AP) => {
      const dL2 = (m) => { const P = m.goalPoint(m.level.goals[0]); return Math.hypot(P.x - m.ship.x, P.y - m.ship.y); };
      return [
        { wait: p[0] },
        { drop: true },
        { coast: (m) => dL2(m) < p[1] },
        park(0, p[2], p[3]),
      ];
    },
  },
  darkturn: {
    // Turn round at once, slowly (a few taps), while still in the shadow;
    // then burn off most of the sideways speed and fall down the shadow.
    // p: when to light the engine, angular momentum to burn down to (where the
    // path ends on Nox), when to start turning, turn rate (rad/s).
    p: [28, 240, 2, 0.15], scale: [3, 20, 2, 0.02], tol: [2, 10, 2, 0.03], opts: { turn: true, turnRate: 0.15 },
    script: (p, AP, rate, wait) => [
      hold((m) => m.t >= (wait != null ? wait : p[2] || 0)),
      slew(AP, (m) => AP.aim(m, 'retro', 'nox') - 0.2, rate || p[3] || 0.1),
      hold((m) => m.t >= p[0]),
      burnHere((m) => AP.orb(m, 'nox').h * AP.orb(m, 'nox').dir <= p[1]),
      hold(() => false),
    ],
  },
  beampatrol: {
    // Drop just under the lane so Sentry 1 passes overhead, wait for the
    // beam gap to come round, then dive to the 400 k band and round off.
    // p: low point to trim down to, when to dive, low point to dive to.
    p: [580, 256, 400], scale: [8, 20, 5], tol: [8, 4, 10], opts: { turn: true, turnRate: 0.3 },
    script: (p, AP) => [
      { burn: 'retro', until: (m) => AP.orb(m, 'lyre').pe <= p[0] },
      hold((m) => m.t >= p[1]),
      { burn: 'retro', until: (m) => AP.orb(m, 'lyre').pe <= p[2] },
      { coast: (m) => { const o = AP.orb(m, 'lyre'); return o.rising && o.r < 450; } },
      { burn: 'retro', until: (m) => { const o = AP.orb(m, 'lyre'); return o.ap <= 410 || o.ap - o.pe < 6; } },
    ],
  },
  keeper: {
    // Dive deep and round off roughly on the booster, drop it there (its
    // orbit, pushed up a little by the separation, stays clear of the
    // station's), cross the beam down low, climb when Keeper is ~50° ahead
    // and close in on it. p: dive depth, how far ahead Keeper is when you
    // climb (rad), how round the low orbit is (high point above the low
    // point), high point of the climb.
    p: [300, 0.84, 20, 500], scale: [10, 0.05, 10, 10], tol: [12, 0.07, 10, 15], opts: { turn: true, turnRate: 0.3 },
    script: (p, AP) => [
      { burn: 'retro', until: (m) => AP.orb(m, 'corvus').pe <= p[0] },
      { coast: (m) => { const o = AP.orb(m, 'corvus'); return o.rising && o.r < p[0] + 30; } },
      { burn: 'retro', until: (m) => AP.orb(m, 'corvus').ap <= p[0] + p[2] },
      { deploy: true },
      hold((m) => AP.wrap(AP.phase(m, 'keeper', 'corvus') - AP.shipPhase(m, 'corvus')) <= p[1]),
      { burn: 'pro', until: (m) => AP.orb(m, 'corvus').ap >= p[3] },
      // coast to the closest approach (or within reach), then close in
      { coast: (m, c) => { const d = dist(m, 'keeper'), r = d < 25 || (c.dl != null && d > c.dl && d < 200); c.dl = d; return r; } },
      meet('keeper', 0.03, 0.6),
    ],
  },
};

// Turn and burn the way the autopilot aims: hold the turn (at opts.turnRate)
// toward the burn direction, fire once lined up.
const darkFlip = (AP, wait) => [
  hold((m) => m.t >= wait),
  ...held(AP, (m) => AP.aim(m, 'retro', 'nox') - 0.2, null, (m) => AP.orb(m, 'nox').h * AP.orb(m, 'nox').dir <= proofs.darkturn.p[1]),
];
const fails = {
  beacon: [
    { name: 'coast and watch', steps: () => [] },
    { name: 'burn just to escape', steps: (AP) => [{ burn: 'pro', until: (m) => !AP.orb(m, 'pharos').bound }] },
    { name: 'wait 40 s to see the beam coming, then burn everything', steps: () => [{ wait: 40 }, { burn: 'pro', until: () => false }] },
    { name: 'burn everything straight out, away from Pharos', steps: () => [{ burn: 'out', rel: 'pharos', until: () => false }] },
  ],
  widdershins: [
    { name: 'coast and watch', steps: () => [] },
    ...[500, 900].map((H) => ({ name: 'climb first (to ' + H + ' k), turn round up high (cheaper)', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'vela').ap >= H },
      { coast: (m) => { const o = AP.orb(m, 'vela'); return o.r > H - 20 && !o.rising; } },
      ...held(AP, 'retro', 'vela', (m) => { const o = AP.orb(m, 'vela'); return o.dir < 0 && o.pe >= 495; }),
      { coast: (m) => dist(m, 'widd') < 60 },
      meet('widd', 0.03, 0.6),
    ] })),
  ],
  duckdrop: [
    { name: 'release at once', opts: { turn: true, turnRate: 0.4 }, steps: (AP) => [{ drop: true }, ...proofs.duckdrop.script(proofs.duckdrop.p, AP).slice(2)] },
    { name: 'duck into the shade first, then release', opts: { turn: true, turnRate: 0.4 }, steps: (AP) => [
      { coast: (m) => { const P = m.goalPoint(m.level.goals[0]); return Math.hypot(P.x - m.ship.x, P.y - m.ship.y) < 120; } },
      park(0, 0.02, 3, (m) => m.goalIndex > 0), { drop: true }, park(0, 0.02, 3),
    ] },
    { name: 'release after the sweep, brake at leisure', opts: { turn: true, turnRate: 0.4 }, steps: (AP) => [{ wait: 22 }, { drop: true }, { wait: 75 }, park(0, 0.02, 3)] },
  ],
  darkturn: [
    { name: 'turn at once with the keys held', opts: { turn: true, turnRate: 1.5 }, steps: (AP) => darkFlip(AP, 0) },
    { name: 'look round first, then turn fast (0.3 rad/s)', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => darkFlip(AP, 12) },
    { name: 'coast to the top first, then turn', opts: { turn: true }, steps: (AP) => proofs.darkturn.script([45, proofs.darkturn.p[1]], AP, 0.15, 20) },
    { name: 'let the autopilot aim at the marker', opts: { turn: true }, steps: (AP) => [
      { burn: 'retro', rel: 'nox', until: (m) => AP.orb(m, 'nox').h * AP.orb(m, 'nox').dir <= proofs.darkturn.p[1] },
    ] },
  ],
  beampatrol: [
    { name: 'dive now', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => proofs.beampatrol.script([590, 0, 400], AP).slice(1) },
    { name: 'wait in the lane for the gap, then dive', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => proofs.beampatrol.script(proofs.beampatrol.p, AP).slice(1) },
    { name: 'wait well below the lane (500 k), then dive', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => proofs.beampatrol.script([500].concat(proofs.beampatrol.p.slice(1)), AP) },
  ],
  keeper: [
    { name: 'stage at once, do it all on the upper stage', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => {
      const s = proofs.keeper.script(proofs.keeper.p, AP);
      return [{ deploy: true }, ...s.slice(0, 3), ...s.slice(4)];
    } },
    { name: 'drop the booster once you are on your way down', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => {
      const s = proofs.keeper.script(proofs.keeper.p, AP);
      return [s[0], { deploy: true }, ...s.slice(1, 3), ...s.slice(4)];
    } },
    { name: 'drop the booster at the low point, before rounding off', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => {
      const s = proofs.keeper.script(proofs.keeper.p, AP);
      return [s[0], s[1], { deploy: true }, s[2], ...s.slice(4)];
    } },
    ...[400, 420].map((d) => ({ name: 'dive shallow (' + d + ' k), keep the booster', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => {
      // the right moment to climb for this depth, so only the beam can stop it
      const s = proofs.keeper.script([d, 0.46, 5, 500], AP);
      return [...s.slice(0, 3), ...s.slice(4)];
    } })),
    { name: 'climb to 800 k, stage up there and let it come round', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'corvus').ap >= 800 },
      { coast: (m) => { const o = AP.orb(m, 'corvus'); return !o.rising && o.r > 780; } },
      { burn: 'pro', until: (m) => AP.orb(m, 'corvus').pe >= 795 },
      { deploy: true },
      hold((m) => AP.wrap(AP.phase(m, 'keeper', 'corvus') - AP.shipPhase(m, 'corvus')) >= -0.3 && AP.wrap(AP.phase(m, 'keeper', 'corvus') - AP.shipPhase(m, 'corvus')) < 0),
      { burn: 'retro', until: (m) => AP.orb(m, 'corvus').pe <= 500 },
      { coast: (m, c) => { const d = dist(m, 'keeper'), r = d < 25 || (c.dl != null && d > c.dl && d < 200); c.dl = d; return r; } },
      meet('keeper', 0.03, 0.6),
    ] },
  ],
};

module.exports = { levels, proofs, fails };
