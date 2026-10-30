'use strict';
// World 4 · Chapter 3 · Magnetic Shelter: a planet's magnetosphere turns a
// star's particles away (light still gets through), radiation belts sit
// inside it, and scheduled storms squeeze it in or sweep outward as a front.
// See tools/w4/README.md ("Magnetic Shelter") and the experimental
// prototypes Storm Warning, The Slot and Storm Front (js/levels.js).
//
// Rules used here (js/flight.js): radiation.particles is the share of a
// source a magnetosphere stops; radiation.storm { start, end, rate, squeeze,
// speed?, ramp? } adds particles and squeezes every nose in (builds and dies
// away over `ramp` s); belts are rings of 1 Sv/s (or `rate`); an orbit goal
// with `after` only counts once the clock passes it.
const { ship, C } = require('../../js/levels.js');
const Phys = require('../../js/physics.js');

// ---------------------------------------------------------------- helpers

const orb = (AP, id) => (m) => AP.orb(m, id);
// One transfer: burn (pro or retro) until the low/high point reaches `target`,
// coast to that point, then round off until the other side is within `round`.
function transfer(AP, body, down, target, round) {
  const o = orb(AP, body);
  return [
    { burn: down ? 'retro' : 'pro', rel: body, until: (m) => (down ? o(m).pe <= target : o(m).ap >= target) },
    { coast: (m) => (down ? o(m).r < target + 1.5 && o(m).rising : o(m).r > target - 1.5 && !o(m).rising) },
    { burn: down ? 'retro' : 'pro', rel: body, until: (m) => (down ? o(m).ap <= round : o(m).pe >= round) },
  ];
}
// Close in on a station (by id) and match its speed: aim at it (or, with
// `off`, at a point that far out from it, away from the body it circles,
// so the approach never clips it) with a closing speed that tapers as you
// get near, correcting only when the error is worth it.
// With `near`, it coasts (letting a slightly lower or higher orbit drift
// it in) until the station is that close, then closes gently.
function dock(id, gain, cap, off, near) {
  return {
    control: (m, c) => {
      if (m.status !== 'flying' || m.goalIndex !== c.dockGoal) { if (c.dockGoal == null) c.dockGoal = m.goalIndex; else return { done: true }; }
      m.sys.update(m.t);
      const i = m.sys.byId[id].index, b = m.sys.bodies[i];
      let tx = m.sys.px[i], ty = m.sys.py[i];
      if (off && b.parent != null) { const ux = tx - m.sys.px[b.parent], uy = ty - m.sys.py[b.parent], u = Math.hypot(ux, uy) || 1; tx += off * ux / u; ty += off * uy / u; }
      const dx = tx - m.ship.x, dy = ty - m.ship.y, d = Math.hypot(dx, dy);
      if (near && d > near) return { thrust: false, dt: 0.1 };
      const sp = Math.min(cap, gain * Math.max(0, d - (off ? 1 : 6)));
      const ex = m.sys.vx[i] + sp * dx / d - m.ship.vx, ey = m.sys.vy[i] + sp * dy / d - m.ship.vy, e = Math.hypot(ex, ey);
      if (c.b ? e < 0.03 : e < 0.12) { c.b = false; return { thrust: false, dt: 0.05 }; }
      c.b = true;
      return { thrust: true, angle: Math.atan2(ey, ex) };
    },
  };
}

// ---------------------------------------------------------------- levels

const levels = [
  {
    id: 'stormwarn',
    name: 'Storm Warning',
    intro: 'Corona\'s wind is charged particles, and Halde\'s magnetic field turns them away: inside its magnetosphere, the blue bubble, you take none. A storm hits at T+1:15 and squashes the bubble\'s nose in past your orbit; the red dotted line shows where to. Get down under the radiation belt before it hits, crossing the belt quickly, and wait there until the storm has passed. Then climb back up through the belt to your work orbit. Both crossings come out of the same dose budget.',
    objective: 'Orbit Halde between 13 and 29 k up when the storm ends (T+2:45), then between 102 and 114 k up, taking under 20 Sv.',
    teaches: 'Magnetospheres · a scheduled storm',
    bodies: [
      { id: 'corona', name: 'Corona', gm: 0, radius: 60, color: C.sun, kind: 'star', x: -1500, y: 0, radiation: { rate: 0.3, at: 1500, dose: 20, particles: 1, storm: { start: 75, end: 165, rate: 1.5, squeeze: 0.5 } } },
      { id: 'halde', name: 'Halde', gm: 8000, radius: 35, color: C.blue, magnetosphere: { nose: 170, width: 230, tail: 1200 }, belt: { rMin: 75, rMax: 110 } },
    ],
    ship: ship({ start: { orbit: { body: 'halde', r: 150, angle: -0.51 } }, heading: 'prograde', dv: 10.5, accel: 1 }),
    goals: [
      { type: 'orbit', body: 'halde', rMin: 48, rMax: 64, after: 165, label: 'Under the belt' },
      { type: 'orbit', body: 'halde', rMin: 137, rMax: 149, label: 'Work orbit' },
    ],
    par: 9.5, bounds: 2500, tMax: 500, predict: 200, view: { x: -150, y: 0, span: 700 },
  },
  {
    id: 'slot',
    name: 'The Slot',
    intro: 'Gauss has two radiation belts with a narrow slot of clean space between them, and Slot Station rides in it. Above the outer belt you are safe inside Gauss\'s magnetosphere, but only up to its edge on the sunward side, where Ferro\'s wind gets in. Every second in a belt costs 1 Sv. Phase up here until the station is in the right place, drop through the outer belt once without dipping into the inner one, and dock. Then climb back out through the outer belt to your parking orbit.',
    objective: 'Rendezvous with Slot Station (within 10 k, relative speed under 0.3 k/s), then orbit Gauss between 155 and 180 k up, taking under 25 Sv.',
    teaches: 'Belts and magnetospheres · a narrow slot',
    bodies: [
      { id: 'ferro', name: 'Ferro', gm: 0, radius: 60, color: C.sun2, kind: 'star', x: -1800, y: 0, radiation: { rate: 1.5, at: 1800, dose: 25, particles: 1 } },
      { id: 'gauss', name: 'Gauss', gm: 20000, radius: 35, color: C.purple, magnetosphere: { nose: 230, width: 300, tail: 1500 }, belt: [{ rMin: 55, rMax: 85 }, { rMin: 130, rMax: 170 }] },
      { id: 'slotst', name: 'Slot Station', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'gauss', a: 105, phase: 2.0 } },
    ],
    ship: ship({ start: { orbit: { body: 'gauss', r: 200, angle: 0 } }, heading: 'prograde', dv: 11, accel: 1 }),
    goals: [
      { type: 'rendezvous', body: 'slotst', dist: 10, relVel: 0.3 },
      { type: 'orbit', body: 'gauss', rMin: 190, rMax: 215, label: 'Parking orbit' },
    ],
    par: 9, bounds: 2500, tMax: 600, predict: 200, view: { x: -150, y: 0, span: 800 },
  },
  {
    id: 'stormfront',
    name: 'Storm Front',
    intro: 'Pyre has just thrown out a storm, and its front is racing outward: the red ring. It reaches Cinder Outpost, a bare rock with no magnetic field, at T+1:47, and Vale further out a minute later. Vale\'s magnetosphere is the only shelter. Head for Vale now, fast enough to beat the front there (aim a little to one side of it), and brake into a low orbit inside Vale\'s bubble. Caught in the open, the front takes ages to pass you. Once it has passed, head back to the outpost: whatever fuel you spent racing the front isn\'t there for the trip home.',
    objective: 'Orbit Vale between 19 and 55 k up once the storm has passed it (T+4:31), then fly back to within 40 k of Cinder Outpost, taking under 15 Sv.',
    teaches: 'A storm front moving out · outrun it',
    bodies: [
      { id: 'pyre', name: 'Pyre', gm: 0, radius: 60, color: C.sun, kind: 'star', x: -1500, y: 0, radiation: { rate: 0.05, at: 1500, dose: 15, particles: 1, storm: { start: 0, end: 100, rate: 3, squeeze: 0.7, speed: 14 } } },
      { id: 'cinder', name: 'Cinder Outpost', gm: 0, radius: 14, color: C.red, kind: 'rock', x: 0, y: 0 },
      { id: 'vale', name: 'Vale', gm: 3000, radius: 25, color: C.green, x: 900, y: 0, magnetosphere: { nose: 130, width: 170, tail: 900 } },
    ],
    ship: ship({ start: { free: { x: 0, y: -30 } }, heading: 0, dv: 15.2, accel: 1 }),
    goals: [
      { type: 'orbit', body: 'vale', rMin: 44, rMax: 80, after: 271, label: 'In Vale\'s bubble' },
      { type: 'reach', body: 'cinder', r: 40, label: 'Back at the outpost' },
    ],
    par: 14, bounds: 3000, tMax: 800, predict: 260, view: { x: 200, y: 0, span: 1700 }, startCam: 'overview',
  },
  {
    id: 'moontail',
    name: 'Moon in the Tail',
    intro: 'A storm is blowing, and only Tor\'s magnetosphere keeps it off you; its tail stretches far behind Tor, away from Brand. Wick Base needs a supply pod, but Wick has no field of its own, and the pod can take only 3 Sv once you let it go. Watch Wick swing round into Tor\'s tail, and time your climb so the pod drops onto it while it\'s in there. Drop the pod right after your burn so it coasts up on its own, then steer yourself off the collision course and back down into a low orbit, inside the bubble.',
    objective: 'Land the pod on Wick (it may take under 3 Sv), then orbit Tor between 41 and 57 k up, taking under 12 Sv yourself.',
    teaches: 'Magnetotails · a moon passing through',
    bodies: [
      { id: 'brand', name: 'Brand', gm: 0, radius: 60, color: C.sun, kind: 'star', x: -1600, y: 0, radiation: { rate: 0.2, at: 1600, dose: 12, particles: 1, storm: { start: 0, end: 400, rate: 2, squeeze: 0.6, ramp: 0 } } },
      { id: 'tor', name: 'Tor', gm: 6000, radius: 30, color: C.blue, magnetosphere: { nose: 160, width: 200, tail: 1400 } },
      { id: 'wick', name: 'Wick', gm: 250, radius: 13, color: C.grey, orbit: { parent: 'tor', a: 260, phase: -2.0 } },
    ],
    ship: ship({ start: { orbit: { body: 'tor', r: 75, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1, cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3, dose: 3 }] }),
    goals: [
      { type: 'hit', body: 'wick', craft: 'pod', label: 'Pod to Wick Base' },
      { type: 'orbit', body: 'tor', rMin: 71, rMax: 87, label: 'Back in the bubble' },
    ],
    par: 5, bounds: 2500, tMax: 500, predict: 220, view: { x: 150, y: 0, span: 800 },
  },
  {
    id: 'lightwind',
    name: 'Light and Wind',
    intro: 'Wisp is a pulsar: its wind is particles, which Gale\'s magnetosphere keeps off you, but its two sweeping beams are light, and the bubble does nothing about those. Only Gale itself blocks the beams, in the narrow shadow on its far side. A beam crosses Gale\'s line every 40 s, and so does your orbit if you set it right: an orbit 40 s round, timed so each sweep finds you behind Gale. Lower your orbit to the band at the right moment, stay in it while the beams go by, then climb back to the high orbit.',
    objective: 'Orbit Gale between 25 and 33 k up (about 40 s round) and still be there at T+6:00, then orbit between 52 and 64 k up, taking under 13 Sv.',
    teaches: 'Light and wind · an orbit timed to the beam',
    bodies: [
      { id: 'wisp', name: 'Wisp', gm: 0, radius: 8, color: '#e4dcff', kind: 'pulsar', x: -1500, y: 0, radiation: { rate: 1.2, at: 1500, dose: 13, beam: { width: 0.35, period: 80, phase: 0.3 } } },
      { id: 'wispwind', name: 'Wisp\'s wind', gm: 0, radius: 2, color: '#e4dcff', hidden: true, x: -1500, y: 0, radiation: { rate: 0.4, at: 1500, dose: 13, particles: 1 } },
      { id: 'gale', name: 'Gale', gm: 8000, radius: 40, color: C.purple, magnetosphere: { nose: 115, width: 150, tail: 900 } },
    ],
    ship: ship({ start: { orbit: { body: 'gale', r: 95, angle: 2.0 } }, heading: 'prograde', dv: 4, accel: 1 }),
    goals: [
      { type: 'orbit', body: 'gale', rMin: 65, rMax: 73, after: 360, label: 'Timed to the beam' },
      { type: 'orbit', body: 'gale', rMin: 92, rMax: 104, label: 'Back to the high orbit' },
    ],
    par: 3.8, bounds: 2500, tMax: 600, predict: 200, view: { x: -100, y: 0, span: 700 },
  },
  {
    id: 'pocket',
    name: 'Pocket',
    intro: 'Jovan\'s radiation belt is thick, but its moon Gan has a magnetic field of its own, and inside Gan\'s little magnetosphere the belt can\'t reach you: a clean pocket in the middle of it. You need to call at Gan and wait there until T+5:20. Drop from your high orbit down to Gan, letting it catch you up, and settle into a tight orbit inside the pocket. Don\'t wait about: Gan passes close under your orbit at about T+1:15 and its pull will throw you off it. Then leave it, cross the rest of the belt and park in the clear space beneath it. Leave Gan at the right point of your loop: too early and Gan flings you into Jovan, too late and you fall back into the belt. Both crossings come out of the same dose budget, and an orbit round Gan that strays out of the pocket takes the belt\'s full dose.',
    objective: 'Orbit Gan between 14 and 21 k up and still be there at T+5:20, then get down under the belt and park in an orbit round Jovan whose high point is under 114 k up, taking under 23.5 Sv.',
    teaches: 'A moon\'s own magnetosphere · a pocket in the belt',
    bodies: [
      { id: 'helion', name: 'Helion', gm: 0, radius: 60, color: C.sun, kind: 'star', x: -3000, y: 0, radiation: { rate: 0.05, at: 3000, dose: 23.5, particles: 1 } },
      { id: 'jovan', name: 'Jovan', gm: 30000, radius: 66, color: C.tan, magnetosphere: { nose: 1200, width: 1400, tail: 4000 }, belt: { rMin: 200, rMax: 380, rate: 0.6 } },
      { id: 'gan', name: 'Gan', gm: 2000, radius: 14, color: C.grey, magnetosphere: { nose: 55, width: 65, tail: 160 }, orbit: { parent: 'jovan', a: 330, phase: -0.92 } },
    ],
    ship: ship({ start: { orbit: { body: 'jovan', r: 445, angle: 0 } }, heading: 'prograde', dv: 15.4, accel: 1 }),
    goals: [
      { type: 'orbit', body: 'gan', rMin: 28, rMax: 35, after: 320, label: 'In Gan\'s pocket' },
      { type: 'reach', body: 'jovan', r: 190, label: 'Under the belt' },
      { type: 'orbit', body: 'jovan', rMin: 66, rMax: 180, label: 'Parked under the belt' },
    ],
    // Gan (a heavy moon) passes close under the starting orbit at T+1:15
    // and wrecks it: waiting where you start is not an option, on purpose.
    unstableStart: 'Gan passes close at T+1:15',
    par: 13.5, bounds: 3000, tMax: 800, predict: 250, view: { x: 0, y: 0, span: 1100 },
  },
];

// ---------------------------------------------------------------- proofs

const proofs = {
  stormwarn: {
    // Down before the storm: low point p[0], round off with the high point
    // under p[1]; after the storm, up: high point p[2], low point over p[3].
    p: [56, 61.683, 144.314, 137.684], scale: [3, 2, 4, 4],
    tol: [2.3, 2.6, 5.8, 5.4],
    script: (p, AP) => [
      ...transfer(AP, 'halde', true, p[0], p[1]),
      { coast: (m) => m.goalIndex >= 1 },
      ...transfer(AP, 'halde', false, p[2], p[3]),
    ],
  },
  slot: {
    // Phase above the outer belt for p[0] s, one transfer down to a low point
    // p[1] in the slot, round off under p[2], dock; then climb: high point
    // p[3], low point over p[4].
    p: [24.565, 99.317, 105.008, 207.041, 198.343], scale: [1, 2, 2, 4, 4],
    tol: [2, 4, 4, 8, 8],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      ...transfer(AP, 'gauss', true, p[1], p[2]),
      dock('slotst', 0.1, 1),
      ...transfer(AP, 'gauss', false, p[3], p[4]),
    ],
  },
  stormfront: {
    // Out at once toward a point p[1] beside Vale at speed p[0], brake at
    // radius p[2] into an orbit with the high point under p[5], round off the
    // low point over p[6]; after the storm, leave when your
    // direction of travel points p[3] rad off the way home, burn until the
    // speed left at infinity is p[4], then steer home at that speed (aimed
    // p[7] rad off: nobody points exactly).
    p: [5, 140, 70, 0.8, 2.5, 74, 50, 0], scale: [0.5, 15, 10, 0.2, 0.3, 2, 2, 0.02],
    tol: [0.1, 6, 6, 0.06, 0.12, 3, 2, 0.06],
    script: (p, AP) => {
      const v = orb(AP, 'vale');
      const aim = (m) => { m.sys.update(m.t); const i = m.sys.byId.vale.index; return Math.atan2(m.sys.py[i] + p[1] - m.ship.y, m.sys.px[i] - m.ship.x); };
      const home = (m) => { m.sys.update(m.t); const i = m.sys.byId.cinder.index; return Math.atan2(m.sys.py[i] - m.ship.y, m.sys.px[i] - m.ship.x) + (p[7] || 0); };
      const wrap = (a) => ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      return [
        { burn: aim, until: (m) => Math.hypot(m.ship.vx, m.ship.vy) >= p[0] },
        { coast: (m) => v(m).r < p[2] },
        { burn: 'retro', rel: 'vale', until: (m) => { const o = v(m); return o.bound && o.ap <= p[5]; } },
        { coast: (m) => !v(m).rising },
        { burn: 'pro', rel: 'vale', until: (m) => v(m).pe >= p[6] },
        { coast: (m) => m.goalIndex >= 1 && Math.abs(wrap(v(m).pro - home(m) - p[3])) < 0.05 },
        { burn: 'pro', rel: 'vale', until: (m) => { const o = v(m); return !o.bound && Math.sqrt(Math.max(0, o.v * o.v - 2 * 3000 / o.r)) >= p[4]; } },
        { coast: (m) => v(m).r > 250 },
        // Course correction: point the velocity at the outpost, keeping the speed.
        { control: (m, c) => {
          const sp = Math.hypot(m.ship.vx, m.ship.vy), h = home(m), ex = sp * Math.cos(h) - m.ship.vx, ey = sp * Math.sin(h) - m.ship.vy, e = Math.hypot(ex, ey);
          if (c.b ? e < 0.03 : e < 0.15) { c.b = false; return { thrust: false, dt: 0.2 }; }
          c.b = true;
          return { thrust: true, angle: Math.atan2(ey, ex) };
        } },
      ];
    },
  },
  moontail: {
    // Wait p[0] s, climb until the high point is p[1] (Wick's orbit), drop
    // the pod, then pull the high point down to p[2] (missing Wick, staying
    // in the tail), and round off at the bottom with the high point under p[3].
    p: [29, 256, 200, 85], scale: [2, 4, 15, 3],
    tol: [2, 4, 8, 3.4],
    script: (p, AP) => {
      const t = orb(AP, 'tor');
      return [
        { wait: Math.max(0, p[0]) },
        { burn: 'pro', rel: 'tor', until: (m) => t(m).ap >= p[1] },
        { drop: true },
        { burn: 'retro', rel: 'tor', until: (m) => t(m).ap <= p[2] },
        { coast: (m) => t(m).r < 80 && t(m).rising },
        { burn: 'retro', rel: 'tor', until: (m) => t(m).ap <= p[3] },
      ];
    },
  },
  lightwind: {
    // Wait p[0] s, one transfer down to a low point p[1], round off with the
    // high point under p[2]: an orbit about 40 s round, phased to the beam.
    p: [2, 69, 70, 100, 96], scale: [1, 1, 1, 2, 2],
    tol: [2, 2.8, 2.8, 4, 4],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      ...transfer(AP, 'gale', true, p[1], p[2]),
      { coast: (m) => m.goalIndex >= 1 },
      ...transfer(AP, 'gale', false, p[3], p[4]),
    ],
  },
  pocket: {
    // Wait p[0] s, burn retrograde until the low point is p[1] (Gan catches
    // you up), at p[2] from Gan turn the arrival into a circular orbit round
    // it; after T+5:20, at the slowest point of your loop round Gan (+p[3] s),
    // burn retrograde (round Jovan) until clear of Gan with the low point
    // under p[4], fall under the belt, and at the low point brake the high
    // point down to p[5].
    p: [31, 320, 32, 1.5, 160, 160], scale: [2, 4, 3, 1, 4, 4],
    tol: [2, 13, 3, 2, 6, 7],
    script: (p, AP) => {
      const j = orb(AP, 'jovan'), g = orb(AP, 'gan');
      return [
        { wait: Math.max(0, p[0]) },
        { burn: 'retro', rel: 'jovan', until: (m) => j(m).pe <= p[1] },
        { coast: (m) => g(m).r < p[2] },
        // Capture: turn the arrival into a circular orbit round Gan at this
        // distance (match Gan's motion plus a sideways circular speed).
        { control: (m) => {
          m.sys.update(m.t);
          const i = m.sys.byId.gan.index, rx = m.ship.x - m.sys.px[i], ry = m.ship.y - m.sys.py[i], r = Math.hypot(rx, ry);
          const rvx = m.ship.vx - m.sys.vx[i], rvy = m.ship.vy - m.sys.vy[i], dir = rx * rvy - ry * rvx >= 0 ? 1 : -1, vc = Math.sqrt(m.sys.byId.gan.gm / r);
          const ex = m.sys.vx[i] - dir * vc * ry / r - m.ship.vx, ey = m.sys.vy[i] + dir * vc * rx / r - m.ship.vy, e = Math.hypot(ex, ey);
          if (e < 0.05) return { done: true };
          return { thrust: true, angle: Math.atan2(ey, ex) };
        } },
        { coast: (m) => m.goalIndex >= 1 },
        // Leave when your loop round Gan is carrying you backwards (slowest
        // round Jovan), p[3] s past that point.
        { coast: (m) => { const o = g(m); return j(m).v < Math.sqrt(30000 / 330) - 0.8 * Math.sqrt(m.sys.byId.gan.gm / o.r); } },
        { wait: Math.max(0, p[3]) },
        { burn: 'retro', rel: 'jovan', until: (m) => !g(m).bound && j(m).pe <= p[4] },
        { coast: (m) => j(m).r < j(m).pe + 1.5 && j(m).rising },
        { burn: 'retro', rel: 'jovan', until: (m) => j(m).ap <= p[5] },
      ];
    },
  },
};

// ---------------------------------------------------------------- fails

const fails = {
  stormwarn: [
    { name: 'stay put', steps: () => [] },
    { name: 'wait for the storm, then go down', steps: (AP) => [{ wait: 76 }, ...transfer(AP, 'halde', true, 55, 66)] },
    { name: 'slow two-step descent through the belt', steps: (AP) => [...transfer(AP, 'halde', true, 100, 104), { wait: 5 }, ...transfer(AP, 'halde', true, 55, 66)] },
    { name: 'climb above the storm', steps: (AP) => [...transfer(AP, 'halde', false, 260, 250)] },
  ],
  slot: [
    { name: 'go down at once and catch up in the slot', steps: (AP) => [...transfer(AP, 'gauss', true, 100, 104), dock('slotst', 0.1, 1)] },
    { name: 'dip into the inner belt (low point 80)', steps: (AP) => [{ wait: 24.5 }, ...transfer(AP, 'gauss', true, 80, 90), dock('slotst', 0.1, 1)] },
    { name: 'phase higher up, past the magnetosphere', steps: (AP) => [...transfer(AP, 'gauss', false, 300, 290), ...transfer(AP, 'gauss', true, 100, 104), dock('slotst', 0.1, 1)] },
    { name: 'slow two-step descent through the outer belt', steps: (AP) => [{ wait: 24.5 }, ...transfer(AP, 'gauss', true, 150, 154), { wait: 3 }, ...transfer(AP, 'gauss', true, 100, 104), dock('slotst', 0.1, 1)] },
  ],
  stormfront: [
    { name: 'stay at Cinder Outpost (no magnetosphere)', steps: () => [] },
    { name: 'leave a minute later (the front catches you)', steps: (AP) => [{ wait: 60 }, ...proofs.stormfront.script(proofs.stormfront.p, AP)] },
    { name: 'a slow cruise (speed 3)', steps: (AP) => proofs.stormfront.script([3, 140, 70, 0.8, 2.5, 74, 50, 0], AP) },
  ],
  moontail: [
    { name: 'drop straight away (Wick is out in the storm)', steps: (AP) => proofs.moontail.script([0, 256, 200, 85], AP) },
    { name: 'follow the pod up, no dodge', steps: (AP) => [{ wait: 29 }, { burn: 'pro', rel: 'tor', until: (m) => AP.orb(m, 'tor').ap >= 256 }, { drop: true }] },
    { name: 'drop a lap late (Wick has left the tail)', steps: (AP) => proofs.moontail.script([60, 256, 200, 85], AP) },
  ],
  pocket: [
    { name: 'stay put (Gan\'s pull wrecks the orbit)', steps: () => [] },
    { name: 'orbit Gan wide, outside the pocket', steps: (AP) => proofs.pocket.script([31, 320, 45, 1.5, 160, 160], AP) },
    { name: 'leave Gan at once, at the fast point of the loop', steps: (AP) => proofs.pocket.script([31, 320, 32, -6, 160, 160], AP) },
    { name: 'linger in the pocket a few loops longer', steps: (AP) => proofs.pocket.script([31, 320, 32, 12, 160, 160], AP) },
  ],
  lightwind: [
    { name: 'stay in the starting orbit (the beams catch you)', steps: () => [] },
    { name: 'an orbit too low (out of step with the beam)', steps: (AP) => proofs.lightwind.script([2, 60, 61, 100, 96], AP) },
    { name: 'an orbit too high (out of step with the beam)', steps: (AP) => proofs.lightwind.script([2, 80, 81, 100, 96], AP) },
    { name: 'leave half a lap later (out of phase)', steps: (AP) => proofs.lightwind.script([22, 69, 70, 100, 96], AP) },
  ],
};

module.exports = { levels, proofs, fails };
