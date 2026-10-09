'use strict';
// World 3 · Chapter 3 · Flip Burns: side-thruster (RCS) budgets.
const { ship, C } = require('../../js/levels.js');

const terra = { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue };
const T = { turn: true, turnRate: 0.1 };
const R = 0.1; // proof turn rate (rad/s): a few taps
const FAST = { turn: true, turnRate: 1.5 };

// Coast without turning: stop any spin and hold the nose still until pred.
const hold = (pred) => ({ control: (m, c) => pred(m, c) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });
// One slow, deliberate turn the way a careful pilot taps it: spin up to
// `rate` (rad/s), coast, counter-fire to stop on the target heading. The
// target (targetFn(m, c), an absolute angle) is re-read every tick, so it
// can drift slowly. Costs about 2 * rate / 1.2 s of side-thruster time.
const slew = (AP, targetFn, rate) => {
  let ph = 0;
  return { control: (m, c) => {
    const s = m.ship, err = AP.wrap(targetFn(m, c) - s.angle), sg = Math.sign(err) || 1;
    if (ph === 0) {
      if (Math.abs(err) < 0.02 && Math.abs(s.omega) < 1e-3) return { done: true };
      ph = 1;
    }
    if (ph === 1) {
      // spin up toward the target
      if (Math.abs(s.omega) < rate && Math.abs(err) > s.omega * s.omega / 2.4 + 0.02) return { rotate: sg, angle: null, dt: 1 / 120 };
      ph = 2;
    }
    if (ph === 2) {
      // coast until it's time to stop
      if (Math.abs(err) > s.omega * s.omega / 2.4 + 0.005 && Math.sign(err) === Math.sign(s.omega)) return { rotate: 0, angle: null, dt: 1 / 120 };
      ph = 3;
    }
    if (Math.abs(s.omega) > 1e-4 && m.rcsFuel > 0) return { rotate: -Math.sign(s.omega), angle: null, dt: 1 / 120 };
    return { done: true };
  } };
};
// Burn along prograde or retrograde (about `rel`, default the dominant body)
// until pred, tracking the marker as it turns the way a pilot would: match
// its turn rate with a tap, then only touch up when the nose drifts off.
const _a = [0, 0];
const burnTrack = (AP, dir, rel, until) => ({ control: (m, c) => {
  if (until(m, c)) return { done: true };
  const s = m.ship, sys = m.sys;
  sys.update(m.t);
  const i = rel ? sys.byId[rel].index : sys.dominant(s.x, s.y, m.t);
  sys.accel(s.x, s.y, m.t, _a);
  const vx = s.vx - sys.vx[i], vy = s.vy - sys.vy[i], ax = _a[0] - sys.ax[i], ay = _a[1] - sys.ay[i];
  const wPro = (vx * ay - vy * ax) / (vx * vx + vy * vy);
  const err = AP.wrap(AP.aim(m, dir, rel) - s.angle);
  const wDes = wPro + Math.max(-0.1, Math.min(0.1, 0.6 * err));
  const dw = wDes - s.omega;
  return { thrust: Math.abs(err) < 0.05, rotate: Math.abs(dw) > 0.04 ? Math.sign(dw) : 0, angle: null, dt: 1 / 120 };
} });
// Retrograde direction (absolute angle, relative to body `rel`) the ship
// will have at its closest approach (within `horizon` seconds) to that body, found by coasting a
// copy of the ship forward: where to pre-point for a capture or braking burn.
const Phys = require('../../js/physics.js');
const retroAtPe = (m, rel, horizon) => {
  // Re-predict at most every 2 s of flight (the answer changes slowly).
  const memo = m._retroAtPe || (m._retroAtPe = {});
  if (memo.rel === rel && m.t - memo.t < 2) return memo.ang;
  const sys = m.sys, i = sys.byId[rel].index, s = Object.assign({}, m.ship);
  let t = m.t, best = Infinity, ang = 0;
  while (t < m.t + (horizon || 400)) {
    sys.update(t);
    const dx = s.x - sys.px[i], dy = s.y - sys.py[i], d = Math.hypot(dx, dy);
    if (d < best) { best = d; ang = Math.atan2(-(s.vy - sys.vy[i]), -(s.vx - sys.vx[i])); }
    else if (d > best * 1.5 + 20) break;
    const dt = Math.min(1, Phys.coastDt(sys, s, t, 0.002, 1));
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
  }
  sys.update(m.t);
  Object.assign(memo, { rel, t: m.t, ang });
  return ang;
};
// Burn wherever the nose points (no turning) until pred.
const burnHere = (until) => ({ control: (m, c) => until(m, c) ? { done: true } : { thrust: true, rotate: 0, angle: null } });

const levels = [
  {
    id: 'spinburn',
    name: 'Spin Burn',
    intro: 'The side thrusters have only a few taps of propellant left: enough to start a slow spin, not to aim every burn. Tap to set the ship turning, then fire short bursts each time the nose swings past prograde (the green marker). Raise the high point to the band, then do the same at the top of the orbit to lift the low point.',
    objective: 'Orbit Terra between 230 and 270 with 1 s of side-thruster propellant.',
    teaches: 'Spin-stabilised burns',
    bodies: [terra],
    ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1, rcs: { fuel: 1 } }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 230, rMax: 270 }],
    par: 4.2, bounds: 2000, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 640 },
  },
  {
    id: 'oneflip',
    name: 'One Flip',
    intro: 'You need to come down from this high orbit, and both burns to get there point backwards. So turn round once, slowly, with a few taps, and stay turned round: the second burn points the same way. Holding the turn keys or flipping back and forth empties the side thrusters before the last burn.',
    objective: 'Orbit Terra between 150 and 200 with 0.8 s of side-thruster propellant.',
    teaches: 'Flip once · slow turns',
    bodies: [terra],
    ship: ship({ start: { orbit: { body: 'terra', r: 300, angle: 0 } }, heading: 'prograde', dv: 4, accel: 1, rcs: { fuel: 0.8 } }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 150, rMax: 200 }],
    par: 2.5, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 800 },
  },
  {
    id: 'brake',
    name: 'Brake at Luna',
    intro: 'Burn prograde to send yourself to Luna, then burn retrograde near Luna to be captured. The capture burn points backwards, and the side thrusters can afford one slow turn: make it during the long coast out, not in a rush at the last moment. Press V to see your path relative to Luna.',
    objective: 'Orbit Luna between 30 and 90 with 1 s of side-thruster propellant.',
    teaches: 'Pre-pointing during a coast',
    bodies: [terra, { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 1.75 } }],
    ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 9, accel: 1, rcs: { fuel: 60 } }),
    goals: [{ type: 'orbit', body: 'luna', rMin: 30, rMax: 90 }],
    par: 5, bounds: 2500, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 1000 },
  },
  {
    id: 'stationstop',
    name: 'Station Stop',
    intro: 'Tycho Station orbits below you. Burn retrograde to drop toward it, and meet it at the bottom of your fall, where you will be moving faster than the station: you have to brake, and braking points backwards too. Plan your turns: the side thrusters hold just enough for two slow ones.',
    objective: 'Rendezvous with Tycho Station (within 30, relative speed under 1) with 1 s of side-thruster propellant.',
    teaches: 'Planning the braking flip',
    bodies: [terra, { id: 'tycho', name: 'Tycho Station', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 130, phase: 1.5 } }],
    ship: ship({ start: { orbit: { body: 'terra', r: 260, angle: 0 } }, heading: 'prograde', dv: 6, accel: 0.8, rcs: { fuel: 60 } }),
    goals: [{ type: 'rendezvous', body: 'tycho', dist: 30, relVel: 1 }],
    par: 4, bounds: 2000, tMax: 1200, predict: 160, view: { x: 0, y: 0, span: 640 },
  },
  {
    id: 'downgap',
    name: 'Down Through the Gap',
    intro: 'Two guard satellites patrol between you and the low orbit you need, each inside a red keep-out zone. Turn round slowly while you wait for a gap, drop through it, and turn again in time to round off your orbit at the bottom. The side thrusters hold two slow turns, not three.',
    objective: 'Orbit Terra between 110 and 160 without entering either keep-out zone, with 1 s of side-thruster propellant.',
    teaches: 'Flip burns · moving keep-out zones',
    bodies: [terra,
      { id: 'guard1', name: 'Guard 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 45, orbit: { parent: 'terra', a: 230, phase: 0.6 } },
      { id: 'guard2', name: 'Guard 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 45, orbit: { parent: 'terra', a: 230, phase: 0.6 + Math.PI } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 340, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1, rcs: { fuel: 60 } }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 110, rMax: 160 }],
    par: 4, bounds: 2000, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 800 },
  },
  {
    id: 'roundtrip',
    name: 'Round Trip',
    intro: 'Fly out to Luna, get captured into orbit, then come home to a low orbit round Terra. That is a lot of burns, and the ones at the far end point all over the place. Work out where the nose has to be for each burn and turn there slowly during the coasts before it.',
    objective: 'Orbit Luna between 30 and 90, then orbit Terra between 120 and 220, with 2.5 s of side-thruster propellant.',
    teaches: 'Planning every flip',
    bodies: [terra, { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 1.75 } }],
    ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 14, accel: 1, rcs: { fuel: 60 } }),
    goals: [
      { type: 'orbit', body: 'luna', rMin: 30, rMax: 90 },
      { type: 'orbit', body: 'terra', rMin: 120, rMax: 220 },
    ],
    par: 9, bounds: 2500, tMax: 2500, predict: 200, view: { x: 0, y: 0, span: 1000 },
  },
];

const proofs = {
  spinburn: {
    p: [0.156, 250.176, 0.326, 243.859], scale: [0.05, 10, 0.15, 10], opts: { turn: true },
    script: (p, AP) => {
      const near = (m) => Math.abs(AP.wrap(AP.orb(m, 'terra').pro - m.ship.angle)) < p[2];
      return [
        { control: (m) => m.ship.omega < p[0] ? { rotate: 1, angle: null } : { done: true } },
        { control: (m) => AP.orb(m, 'terra').ap >= p[1] ? { done: true } : { thrust: near(m), rotate: 0, angle: null, dt: 0.05 } },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { control: (m) => AP.orb(m, 'terra').pe >= p[3] ? { done: true } : { thrust: near(m), rotate: 0, angle: null, dt: 0.05 } },
      ];
    },
  },
  oneflip: {
    p: [197.062, 200.049, 281.901, 0], scale: [8, 8, 15, 0.1], opts: T,
    script: (p, AP) => [
      slew(AP, (m) => AP.aim(m, 'retro') + p[3], R),
      burnHere((m) => AP.orb(m, 'terra').pe <= p[0]),
      hold((m) => AP.orb(m, 'terra').r < p[2]),
      slew(AP, (m) => retroAtPe(m, 'terra'), R),
      hold((m) => AP.orb(m, 'terra').rising),
      burnHere((m) => AP.orb(m, 'terra').ap <= p[1]),
    ],
  },
  brake: {
    p: [0.72, 443.458, 275.897, 86.358], scale: [4, 10, 20, 10], opts: T,
    script: (p, AP) => [
      hold((m) => m.t >= p[0]),
      burnTrack(AP, 'pro', null, (m) => AP.orb(m, 'terra').ap >= p[1]),
      hold((m) => AP.orb(m, 'terra').r > p[2]),
      slew(AP, (m) => retroAtPe(m, 'luna'), R),
      hold((m) => { const o = AP.orb(m, 'luna'); return o.r < 150 && o.rising; }),
      burnHere((m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[3]; }),
    ],
  },
  stationstop: {
    p: [30, 130, 230, 0.3], scale: [8, 6, 15, 0.1], opts: T,
    script: (p, AP) => [
      slew(AP, (m) => AP.aim(m, 'retro'), R),
      hold((m) => m.t >= p[0]),
      burnHere((m) => AP.orb(m, 'terra').pe <= p[1]),
      hold((m) => AP.orb(m, 'terra').r < p[2]),
      slew(AP, (m) => retroAtPe(m, 'tycho'), R),
      hold((m) => { const o = AP.orb(m, 'tycho'); return o.r < 30 + 2 * o.v; }),
      burnHere((m) => AP.orb(m, 'tycho').v < p[3]),
      hold((m) => m.status !== 'flying'),
    ],
  },
  downgap: {
    p: [20, 135, 260, 145], scale: [10, 6, 15, 6], opts: T,
    script: (p, AP) => [
      slew(AP, (m) => AP.aim(m, 'retro'), R),
      hold((m) => m.t >= p[0]),
      burnHere((m) => AP.orb(m, 'terra').pe <= p[1]),
      hold((m) => AP.orb(m, 'terra').r < p[2]),
      slew(AP, (m) => retroAtPe(m, 'terra'), R),
      hold((m) => AP.orb(m, 'terra').rising),
      burnHere((m) => AP.orb(m, 'terra').ap <= p[3]),
    ],
  },
};

const fails = {
  spinburn: [],
  oneflip: [],
};

module.exports = { levels, proofs, fails };
