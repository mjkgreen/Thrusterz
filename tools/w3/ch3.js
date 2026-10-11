'use strict';
// World 3 · Chapter 3 · Flip Burns: side-thruster (RCS) budgets.
// Every mission has a small rcs budget; proofs turn honestly (opts.turn) with
// the helpers below, which fly the way a careful pilot taps: one slow turn
// to a heading worked out in advance, then hold still (holding costs
// nothing; chasing a moving marker does). The fails fly the same plans with
// faster turns (holding the keys) and run the side thrusters dry.
const { ship, C } = require('../../js/levels.js');
const Phys = require('../../js/physics.js');

const terra = { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue };
const T = { turn: true, turnRate: 0.1 };
const R = 0.1; // proof turn rate (rad/s): a few taps

// Coast without turning: stop any spin and hold the nose still until pred.
const hold = (pred) => ({ control: (m, c) => pred(m, c) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });
// Angle turned while counter-firing a spin w to a stop (the thrusters ramp
// up from 30% over 0.8 s, see flight.js).
const stopDist = (w) => {
  let t = 0, a = 0, v = w;
  while (v > 0) { const h = 1 / 120; v -= 1.2 * Math.min(1, 0.3 + t / 0.8) * h; a += Math.max(0, v) * h; t += h; }
  return a;
};
// One slow, deliberate turn the way a careful pilot taps it: spin up to
// `rate` (rad/s), coast, counter-fire to stop on the target heading. The
// target (targetFn(m, c), an absolute angle) is re-read every tick, so it
// can drift slowly. At 0.1 rad/s a turn costs about 0.4 s of propellant.
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
      // spin up toward the target (release first if a counter-fire latched
      // this direction, e.g. on a leftover 1e-17 spin)
      if (m.rotLatch === dir) return { rotate: 0, angle: null, dt: 1 / 120 };
      if (w < rate && rem > stop + 0.02) return { rotate: dir, angle: null, dt: 1 / 120 };
      ph = 2;
    }
    if (ph === 2) {
      // coast until it's time to stop
      if (rem > stop) return { rotate: 0, angle: null, dt: Math.max(1 / 120, Math.min(0.1, (rem - stop) / (2 * Math.abs(w) + 1e-9))) };
      ph = 3;
    }
    // counter-fire: stops dead at zero spin
    if (Math.abs(s.omega) > 1e-4 && m.rcsFuel > 0) return { rotate: -Math.sign(s.omega), angle: null, dt: 1 / 120 };
    return { done: true };
  } };
};
// Where retrograde will point at time t (on a near-circular orbit it turns
// at the orbit's angular rate): pre-point there and wait for it.
const retroAt = (AP, m, t) => { const o = AP.orb(m, 'terra'); return AP.aim(m, 'retro') + Math.max(0, t - m.t) * o.h / (o.r * o.r); };
// How long before a burn to start a flip at this rate.
const flipLead = (rate) => 1.4 * Math.PI / rate;
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
// will have at its closest approach to that body (within `horizon` s),
// found by coasting a copy of the ship forward: where to pre-point for a
// capture or braking burn.
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
// Closest the ship will come to `body` in the next `horizon` seconds of
// coasting (after leaving a moon, where the osculating orbit means little).
const minDist = (m, body, horizon) => {
  const sys = m.sys, i = sys.byId[body].index, s = Object.assign({}, m.ship);
  let t = m.t, best = Infinity;
  while (t < m.t + horizon) {
    sys.update(t);
    const d = Math.hypot(s.x - sys.px[i], s.y - sys.py[i]);
    if (d < best) best = d;
    const hit = Phys.collision(sys, s.x, s.y, t);
    if (hit >= 0) { best = hit === i ? 0 : Infinity; break; }
    const dt = Math.min(1, Phys.coastDt(sys, s, t, 0.002, 1));
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
  }
  sys.update(m.t);
  return best;
};
// Burn wherever the nose points (no turning) until pred.
const burnHere = (until) => ({ control: (m, c) => until(m, c) ? { done: true } : { thrust: true, rotate: 0, angle: null } });

const levels = [
  {
    id: 'spinburn',
    name: 'Spin Burn',
    intro: 'The side thrusters have only a few taps of propellant left: enough to start a slow spin, not to aim every burn. Tap to set the ship turning, then fire short bursts each time the nose swings past prograde (the green marker). Raise the high point to the band, then do the same at the top of the orbit to lift the low point.',
    objective: 'Orbit Terra between 180 and 220 k up with 1 s of side-thruster propellant.',
    teaches: 'Spin-stabilised burns',
    bodies: [terra],
    ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1, rcs: { fuel: 1 } }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 230, rMax: 270 }],
    par: 4.2, bounds: 2000, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 640 },
  },
  {
    id: 'oneflip',
    name: 'One Flip',
    intro: 'Your orbit dips into Terra and you crash in well under a minute, nose pointing the wrong way. Turn now, at a steady few taps, to point between prograde and straight up, and burn to lift your low point out of Terra. Then just hold still: at the bottom of the fall the retrograde marker swings round to your nose, ready for the burn that rounds off your orbit. Holding the turn keys empties the side thrusters; looking around first is too late.',
    objective: 'Orbit Terra between 100 and 150 k up with 1.25 s of side-thruster propellant.',
    teaches: 'Turn in time · the marker comes to you',
    bodies: [terra],
    ship: ship({ start: { conic: { body: 'terra', pe: 30, e: 0.818, nu: -3.1, angle: Math.PI } }, heading: 'retrograde', dv: 7.8, accel: 1, rcs: { fuel: 1.25 } }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 150, rMax: 200 }],
    par: 5.5, bounds: 2000, tMax: 400, predict: 200, view: { x: 0, y: 0, span: 800 },
  },
  {
    id: 'brake',
    name: 'Brake at Luna',
    intro: 'Burn prograde to send yourself to Luna, then burn retrograde as you pass Luna to be captured. That capture burn points backwards, and the side thrusters can only afford a slow turn: make it during the long coast out, not in a rush at the last moment. Press V to see your path relative to Luna.',
    objective: 'Orbit Luna between 12 and 72 k up with 1.8 s of side-thruster propellant.',
    teaches: 'Pre-pointing during a coast',
    bodies: [terra, { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 1.75 } }],
    ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 11, accel: 1, rcs: { fuel: 1.8 } }),
    goals: [{ type: 'orbit', body: 'luna', rMin: 30, rMax: 90 }],
    par: 7.2, bounds: 2500, tMax: 1000, predict: 200, view: { x: 0, y: 0, span: 1000 },
  },
  {
    id: 'stationstop',
    name: 'Station Stop',
    intro: 'You are diving at Tycho Station nose first and will hit it in under half a minute. Turn round now and brake to match its speed as you close in. Turn too slowly, or wait, and you arrive nose first; hold the turn keys and the side thrusters run dry before you can stop.',
    objective: 'Rendezvous with Tycho Station (within 25 k, relative speed under 0.5 k/s) with 0.9 s of side-thruster propellant.',
    teaches: 'Braking flip under time pressure',
    bodies: [terra, { id: 'tycho', name: 'Tycho Station', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 130, phase: -3.4 } }],
    ship: ship({ start: { conic: { body: 'terra', pe: 128, e: 0.34, nu: -2.4 } }, heading: 1.8, dv: 3, accel: 0.8, rcs: { fuel: 0.9 } }),
    goals: [{ type: 'rendezvous', body: 'tycho', dist: 25, relVel: 0.5 }],
    par: 2, bounds: 2000, tMax: 400, predict: 160, view: { x: 0, y: 0, span: 640 },
  },
  {
    id: 'downgap',
    name: 'Down Through the Gap',
    intro: 'Three guard satellites patrol between you and the low orbit you need, each inside a red keep-out zone. Turn round while you wait for a gap, drop through it, and let the nose turn slowly on the way down so it points backwards at the bottom. Dropping as soon as you have turned runs into a guard.',
    objective: 'Orbit Terra between 60 and 110 k up without entering any keep-out zone, with 0.9 s of side-thruster propellant.',
    teaches: 'Flip burns · moving keep-out zones',
    bodies: [terra,
      { id: 'guard1', name: 'Guard 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 50, orbit: { parent: 'terra', a: 230, phase: 0 } },
      { id: 'guard2', name: 'Guard 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 50, orbit: { parent: 'terra', a: 230, phase: 2 * Math.PI / 3 } },
      { id: 'guard3', name: 'Guard 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 50, orbit: { parent: 'terra', a: 230, phase: 4 * Math.PI / 3 } },
    ],
    ship: ship({ start: { orbit: { body: 'terra', r: 340, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1, rcs: { fuel: 0.9 } }),
    goals: [{ type: 'orbit', body: 'terra', rMin: 110, rMax: 160 }],
    par: 4, bounds: 2000, tMax: 900, predict: 200, view: { x: 0, y: 0, span: 800 },
  },
  {
    id: 'roundtrip',
    name: 'Round Trip',
    intro: 'You are falling past Luna far too fast to stay, nose pointing at it: turn round at once and burn retrograde at closest approach to be captured. Then come home: leave Luna against its motion round Terra so you fall back, and round off your orbit at the bottom. Turn steadily but not hard, and plan each turn during the coast before it.',
    objective: 'Get captured into an orbit round Luna between 12 and 72 k up, then orbit Terra between 70 and 170 k up, with 2 s of side-thruster propellant.',
    teaches: 'Capture in time · planning every flip',
    bodies: [terra, { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 1.75 } }],
    ship: ship({ start: { conic: { body: 'luna', pe: 50, e: 1.3, nu: -1.4, angle: 0 } }, heading: 1.74, dv: 4, accel: 1, rcs: { fuel: 2 } }),
    goals: [
      { type: 'orbit', body: 'luna', rMin: 30, rMax: 90 },
      { type: 'orbit', body: 'terra', rMin: 120, rMax: 220 },
    ],
    par: 2.6, bounds: 2500, tMax: 1000, predict: 200, view: { x: 0, y: 0, span: 1000 },
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
    // Flip to prograde fast enough to burn before the crash, burn, then just
    // hold still: at the bottom the retrograde marker swings round onto the
    // nose. A slower flip burns too late; holding the keys runs dry.
    p: [150.176, 0.2, 200.345, -1.115], scale: [8, 0, 4, 0.2], opts: T,
    script: (p, AP, rate) => [
      slew(AP, (m) => AP.aim(m, 'pro') + p[3], rate || p[1]),
      burnHere((m) => AP.orb(m, 'terra').pe >= p[0]),
      slew(AP, (m) => retroAtPe(m, 'terra'), Math.min(rate || R, 0.05)),
      hold((m) => AP.orb(m, 'terra').rising),
      burnHere((m) => AP.orb(m, 'terra').ap <= p[2]),
    ],
  },
  brake: {
    p: [0.72, 443.458, 275.897, 86.358], scale: [4, 10, 20, 10], opts: T,
    script: (p, AP, rate = R) => [
      hold((m) => m.t >= p[0]),
      burnTrack(AP, 'pro', null, (m) => AP.orb(m, 'terra').ap >= p[1]),
      hold((m) => AP.orb(m, 'terra').r > p[2]),
      slew(AP, (m) => retroAtPe(m, 'luna'), rate),
      hold((m) => { const o = AP.orb(m, 'luna'); return o.r < 150 && o.rising; }),
      burnHere((m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[3]; }),
    ],
  },
  stationstop: {
    // Flip straight away (fast enough to be round before you reach the
    // station, slow enough to afford), then brake as you close in.
    p: [0.2, -0.18, 0.213], scale: [0, 0.2, 0.1], opts: T,
    script: (p, AP, rate) => [
      slew(AP, (m) => retroAtPe(m, 'tycho', 120), rate || p[0]),
      hold((m) => { const o = AP.orb(m, 'tycho'); return o.r < p[1] * o.v * o.v / 1.6 + 10; }),
      burnHere((m, c) => { const v = AP.orb(m, 'tycho').v; c.vMin = Math.min(c.vMin || 99, v); return v < p[2] || v > c.vMin + 0.02; }),
      hold((m) => m.status !== 'flying'),
    ],
  },
  downgap: {
    p: [85, 150, 335, 152, 0.04], scale: [10, 6, 0, 6, 0.01], opts: T,
    script: (p, AP, rate = R) => [
      hold((m) => m.t >= p[0] - flipLead(rate)),
      slew(AP, (m) => retroAt(AP, m, p[0]), rate),
      hold((m) => m.t >= p[0]),
      burnHere((m) => AP.orb(m, 'terra').pe <= p[1]),
      hold((m) => AP.orb(m, 'terra').r < p[2]),
      slew(AP, (m) => retroAtPe(m, 'terra'), Math.min(rate, p[4])),
      hold((m) => AP.orb(m, 'terra').rising),
      burnHere((m) => AP.orb(m, 'terra').ap <= p[3]),
    ],
  },
  roundtrip: {
    p: [0.25, 72.878, 0.068, 190.97, 0.078, 214.62], scale: [0, 8, 0.1, 15, 0.01, 8], opts: T,
    script: (p, AP, rate) => {
      // Luna's direction of travel round Terra.
      const lunaVel = (m) => { m.sys.update(m.t); const i = m.sys.byId.luna.index; return Math.atan2(m.sys.vy[i], m.sys.vx[i]); };
      return [
        // Arriving too fast to stay: flip now, capture at closest approach.
        slew(AP, (m) => retroAtPe(m, 'luna'), rate || p[0]),
        hold((m) => AP.orb(m, 'luna').rising),
        burnHere((m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[1]; }),
        // Leave Luna backwards (against its motion) to fall back to Terra:
        // turn to face that way, then burn when the orbit carries you along it.
        slew(AP, (m) => lunaVel(m) + Math.PI, rate || R),
        hold((m) => m.goalIndex >= 1 && Math.abs(AP.wrap(AP.orb(m, 'luna').pro - m.ship.angle)) < p[2]),
        burnHere((m) => minDist(m, 'terra', 150) <= p[3]),
        slew(AP, (m) => retroAtPe(m, 'terra'), Math.min(rate || R, p[4])),
        hold((m) => { const o = AP.orb(m, 'terra'); return o.r < 300 && o.rising; }),
        burnHere((m) => AP.orb(m, 'terra').ap <= p[5]),
      ];
    },
  },
};

// Naive plans. hohmann(): the textbook burns, aimed by the autopilot's honest
// turning (tracking the marker the whole way). rushed(): the proof's own plan
// with every turn made at 1.5 rad/s (holding the turn keys) or 0.5 rad/s
// (short holds). With an unlimited budget each of these wins.
const hohmann = (AP, dir, lo, hi) => [
  { burn: dir, until: (m) => dir === 'pro' ? AP.orb(m, 'terra').ap >= hi : AP.orb(m, 'terra').pe <= lo },
  { coast: (m) => dir === 'pro' ? !AP.orb(m, 'terra').rising : AP.orb(m, 'terra').rising },
  { burn: dir, until: (m) => dir === 'pro' ? AP.orb(m, 'terra').pe >= lo : AP.orb(m, 'terra').ap <= hi },
];
const rushed = (id, rate) => ({
  name: rate ? `same plan, turning at ${rate} rad/s (short holds)` : 'same plan, turning with the keys held',
  steps: (AP) => proofs[id].script(proofs[id].p, AP, rate || 1.5), opts: T,
});
const fails = {
  spinburn: [
    { name: 'aim every burn at prograde', steps: (AP) => hohmann(AP, 'pro', 245, 250), opts: T },
  ],
  oneflip: [
    rushed('oneflip'),
    rushed('oneflip', 0.5),
    { name: 'look around for 15 s first', steps: (AP) => [hold((m) => m.t >= 15), ...proofs.oneflip.script(proofs.oneflip.p, AP)], opts: T },
  ],
  brake: [rushed('brake'), rushed('brake', 0.5)],
  stationstop: [
    rushed('stationstop'),
    rushed('stationstop', 0.5),
    { name: 'flip slowly, at 0.1 rad/s', steps: (AP) => proofs.stationstop.script(proofs.stationstop.p, AP, 0.1), opts: T },
    { name: 'wait 15 s, then the same flip', steps: (AP) => [hold((m) => m.t >= 15), ...proofs.stationstop.script(proofs.stationstop.p, AP)], opts: T },
  ],
  downgap: [
    rushed('downgap'),
    rushed('downgap', 0.5),
    // the first flip takes about 45 s, so this burns the moment it ends
    { name: 'drop as soon as you have turned', steps: (AP) => proofs.downgap.script([50].concat(proofs.downgap.p.slice(1)), AP), opts: T },
  ],
  roundtrip: [
    rushed('roundtrip'),
    rushed('roundtrip', 0.5),
    { name: 'flip slowly at Luna, at 0.1 rad/s', steps: (AP) => proofs.roundtrip.script(proofs.roundtrip.p.map((v, i) => i === 0 ? 0.1 : v), AP), opts: T },
    { name: 'wait 15 s, then the same flip', steps: (AP) => [hold((m) => m.t >= 15), ...proofs.roundtrip.script(proofs.roundtrip.p, AP)], opts: T },
  ],
};

module.exports = { levels, proofs, fails };
