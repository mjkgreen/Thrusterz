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
    intro: 'Three relay satellites for Nyx, to be spread evenly round it, and each one soaks up Calor\'s heat from the moment it leaves your hold: a satellite can take only 17 Sv. The long phasing laps that work at Terra, a third slower each, leave Sat 1 out in the heat far too long. Phase the other way: round off about 95 k up, drop a satellite (E), and brake until your low point is about 18 k up, a lap a third shorter. Back at the high point, round off again and drop the next; the spacing readout should show close to 120°, and every orbit must be nearly round.',
    objective: 'Spread three satellites at least 116° apart in orbits between 77 and 103 k above Nyx, each taking under 17 Sv of radiation.',
    teaches: 'Quick phasing laps · cargo dose',
    bodies: [
      { id: 'calor', name: 'Calor', gm: 100000, radius: 60, color: C.sun2, kind: 'star', radiation: { rate: 0.12, at: 1200, dose: 60 } },
      { id: 'nyx', name: 'Nyx', gm: 20000, radius: 70, color: '#5a6b8c', orbit: { parent: 'calor', a: 1200, phase: 0 } },
    ],
    ship: ship({ start: { orbit: { body: 'nyx', r: 110, angle: 0 } }, heading: 'prograde', dv: 10.8, accel: 1, cargo: [
      { id: 'd1', name: 'Sat 1', mass: 0.2, dose: 17 }, { id: 'd2', name: 'Sat 2', mass: 0.2, dose: 17 }, { id: 'd3', name: 'Sat 3', mass: 0.2, dose: 17 },
    ] }),
    goals: [
      { type: 'spread', body: 'nyx', crafts: ['d1', 'd2', 'd3'], rMin: 147, rMax: 173, minSep: 116 * Math.PI / 180 },
    ],
    par: 10.2, bounds: 4000, tMax: 400, predict: 200, view: { x: 1000, y: 0, span: 700 },
  },
  {
    id: 'stageddive',
    name: 'Staged Dive',
    intro: 'Your orbit has sagged deep into Cinder\'s heat, and every lap crosses Watch Station\'s ring: a spent stage left on any orbit that reaches the ring hits the station sooner or later. So each stage has to go where it can\'t come back. Burn the dive stage retrograde until it runs dry: your path now ends inside Cinder, so drop it there. Then burn prograde until your low point just clears the surface, about 1 to 2 k up: the kick stage has barely enough to escape, and only from that deep. As you reach the low point burn it dry, right at the bottom: you are escaping, so it flies away for good.',
    objective: 'Get 2400 k from Cinder, taking under 9.4 Sv of radiation, with no spent stage left on an orbit that crosses Watch Station\'s.',
    teaches: 'Disposal dives · staging at the bottom',
    bodies: [
      { id: 'cinder', name: 'Cinder', gm: 40000, radius: 50, color: '#ffe2b8', kind: 'star', radiation: { rate: 0.3, at: 100, dose: 9.4 } },
      { id: 'watch', name: 'Watch Station', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 15, orbit: { parent: 'cinder', a: 250, phase: 1 } },
    ],
    ship: ship({ start: { conic: { body: 'cinder', pe: 80, e: 0.698, nu: -2.6, angle: 0 } }, heading: 'retrograde', stack: [
      { name: 'Dive stage', dv: 2.4, accel: 1.2 },
      { name: 'Kick stage', dv: 3.35, accel: 1.5 },
      { name: 'Capsule', dv: 1.5, accel: 1, dry: 0.4, sprite: 'satellite' },
    ] }),
    goals: [{ type: 'escape', body: 'cinder', r: 2400 }],
    par: 6.6, bounds: 5000, tMax: 600, predict: 300, view: { x: 0, y: 0, span: 900 },
  },
  {
    id: 'sentrypulsar',
    name: 'Sentry Pulsar',
    intro: 'You are riding Argus\'s dark lane: at this height you go round exactly as fast as its beams sweep, so they never touch you. Climb out and they start to catch up, and a sweep anywhere closer than Tyche is brutal: the path glows where it would hit. So wait here, in the dark, until Tyche is a little less than a quarter turn ahead of you and Kore\'s zone and the Sentries are clear of the half lap you will fly. Then burn until the closest approach marker touches Tyche (no KEEP OUT on your path) and brake into orbit when you get there.',
    objective: 'Orbit Tyche between 16 and 76 k up, taking under 12 Sv of radiation, without entering a Sentry\'s or Kore\'s keep-out zone.',
    teaches: 'The dark lane · launch windows',
    bodies: [
      { id: 'argus', name: 'Argus', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 3, at: 250, dose: 12, beam: { width: 0.3, period: 120, phase: 3.979 } } },
      { id: 'sen1', name: 'Sentry 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, orbit: { parent: 'argus', a: 430, phase: 4.379 } },
      { id: 'sen2', name: 'Sentry 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, orbit: { parent: 'argus', a: 430, phase: 4.379 + 2.094 } },
      { id: 'sen3', name: 'Sentry 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 35, orbit: { parent: 'argus', a: 430, phase: 4.379 + 4.189 } },
      { id: 'kore', name: 'Kore', gm: 300, radius: 12, color: C.red, keepOut: 55, orbit: { parent: 'argus', a: 570, phase: 3.147 } },
      { id: 'tyche', name: 'Tyche', gm: 800, radius: 14, color: C.ice, orbit: { parent: 'argus', a: 720, phase: 3.795 } },
    ],
    ship: ship({ start: { orbit: { body: 'argus', r: 244.4, angle: 5.55 } }, heading: 'prograde', dv: 7.6, accel: 1 }),
    goals: [{ type: 'orbit', body: 'tyche', rMin: 30, rMax: 90 }],
    par: 5.4, bounds: 3000, tMax: 950, predict: 300, view: { x: 0, y: 0, span: 1700 },
  },
  {
    id: 'pulsarsupply',
    name: 'Pulsar Supply Run',
    intro: 'Supply Run again, this time around a pulsar. Orrin Base needs its supply pod, but Orrin goes round backwards, so it comes at you head-on and its keep-out zone closes fast. Climb until your path meets Orrin, and turn round on the way up (there is no time to turn after the drop, and side thruster fuel is short); a tap of the engine keeps the path on Orrin. The pod can take only 0.25 Sv, less than one sweep: watch Talon\'s beam and time the climb so a sweep passes you on the way up, drop the pod (E) just after it, and brake at once to bring your high point under the zone.',
    objective: 'Land the supply pod on Orrin, then orbit Talon between 192 and 502 k up, without entering Orrin\'s keep-out zone.',
    teaches: 'Drop between sweeps · turn before the drop',
    bodies: [
      { id: 'talon', name: 'Talon', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 0.2, at: 300, dose: 20, beam: { width: 0.3, period: 80, phase: 0 } } },
      { id: 'orrin', name: 'Orrin', gm: 600, radius: 14, color: C.tan, keepOut: 60, orbit: { parent: 'talon', a: 560, phase: 2.5, dir: -1 } },
    ],
    ship: ship({ start: { orbit: { body: 'talon', r: 300, angle: 0 } }, heading: 'prograde', dv: 6.4, accel: 1, rcs: { fuel: 3.6 }, cargo: [{ id: 'pod', name: 'Supply pod', mass: 0.3, dose: 0.25 }] }),
    goals: [
      { type: 'hit', body: 'orrin', craft: 'pod' },
      { type: 'orbit', body: 'talon', rMin: 200, rMax: 510 },
    ],
    par: 4.5, bounds: 3000, tMax: 400, predict: 300, view: { x: 0, y: 0, span: 1500 },
  },
  {
    id: 'beamrescue',
    name: 'Rescue in the Beam',
    intro: 'Wren is drifting dead just ahead of you, and Vesper\'s beams sweep this orbit every 50 s: each sweep costs nearly 3 Sv, and you can take only 10. Close in gently and match Wren\'s speed, but don\'t stay. Umbriel is up ahead: right after the match, nudge your path onto the L2 marker beyond it (watch the closest approach marker) and let Umbriel\'s pull fling you up there, then brake onto L2, in its shadow, the one place the beams never reach.',
    objective: 'Rendezvous with Wren (within 20 k, relative speed under 1 k/s), then hold within 25 k of Umbriel\'s L2 for 10 s, taking under 10 Sv of radiation.',
    teaches: 'Rendezvous between sweeps · shelter at L2',
    bodies: [
      { id: 'vesper', name: 'Vesper', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 0.6, at: 400, dose: 10, beam: { width: 0.35, period: 100, phase: 1.0 } } },
      { id: 'umbriel', name: 'Umbriel', gm: 1500, radius: 30, color: '#7d8fa8', orbit: { parent: 'vesper', a: 650, phase: 2.2 } },
      { id: 'wren', name: 'Wren', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'vesper', a: 420, e: 0.2, phase: 0.6, argp: 0 } },
    ],
    ship: ship({ start: { conic: { body: 'vesper', pe: 330, e: 0.21, nu: 0.8, angle: 0 } }, heading: 'prograde', dv: 9, accel: 1 }),
    goals: [
      { type: 'rendezvous', body: 'wren', dist: 20, relVel: 1 },
      { type: 'hold', lagrange: { body: 'umbriel', lead: 0, scale: 1.24721 }, r: 25, hold: 10, label: 'Umbriel L2' },
    ],
    par: 6.2, bounds: 3000, tMax: 450, predict: 300, view: { x: 0, y: 0, span: 1800 },
  },
  {
    id: 'pulsartour',
    name: 'Pulsar Tour',
    intro: 'The grand tour of Lumen. You are falling in far too deep, and a spent booster left on any orbit that reaches Beacon\'s ring hits it sooner or later. So use the booster now, while you are still on an escape path: push out and a little forward, halfway between prograde and straight out, until it runs dry. Your low point rises to the dark lane, about 235 k up, where you go round as fast as the beams sweep; drop the booster (the stage button) and it flies away for good. Just before the low point brake with the capsule until your path meets Ossa head-on (watch the closest approach marker), release Lark (E), and keep braking until your orbit is round, inside the band, with no glow on your path.',
    objective: 'Land the Lark probe on Ossa, then orbit Lumen between 222 and 254 k up for 15 s, taking under 8 Sv of radiation, with no spent stage on an orbit that crosses Beacon\'s.',
    teaches: 'Everything at once',
    bodies: [
      { id: 'lumen', name: 'Lumen', gm: 40000, radius: 8, color: '#e4dcff', kind: 'pulsar', radiation: { rate: 1, at: 244, dose: 8, beam: { width: 0.3, period: 120, phase: 0 } } },
      { id: 'beacon', name: 'Beacon', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 15, orbit: { parent: 'lumen', a: 380, phase: 1 } },
      { id: 'ossa', name: 'Ossa', gm: 400, radius: 14, color: C.green, keepOut: 50, orbit: { parent: 'lumen', a: 520, phase: 2.55, dir: -1 } },
    ],
    ship: ship({ start: { conic: { body: 'lumen', pe: 150, e: 1.15, nu: -1.9, angle: 0 } }, heading: 'prograde', rcs: { fuel: 7.4 }, stack: [
      { name: 'Booster', dv: 3, accel: 1.2 },
      { name: 'Capsule', dv: 13, accel: 1, dry: 0.4, sprite: 'satellite' },
    ], cargo: [{ id: 'lark', name: 'Lark probe', mass: 0.2, dose: 4 }] }),
    goals: [
      { type: 'hit', body: 'ossa', craft: 'lark' },
      { type: 'orbit', body: 'lumen', rMin: 230, rMax: 262, confirm: 15 },
    ],
    par: 11.4, bounds: 4000, tMax: 300, predict: 300, view: { x: 0, y: 0, span: 1600 }, startCam: 'overview',
  },
];

const proofs = {
  // Circularise at the next high point, drop, then brake into a quick
  // phasing lap (low point p[3], p[5]); back at the high point, round off
  // again and drop the next.
  darkconst: {
    p: [0, 166, 164.393, 88, 167.315, 88, 166.288], scale: [5, 3, 2, 4, 2, 4, 2], tol: [2, 6, 6, 4, 6, 4, 6],
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

// Seconds to the low point about `id` (bound orbit, coming down; 0 otherwise).
const tToPe = (m, id, AP) => {
  const o = AP.orb(m, id);
  if (!o.bound || o.rising) return 0;
  const E = 2 * Math.PI - Math.acos(Math.max(-1, Math.min(1, (1 - o.r / o.a) / o.e)));
  return (2 * Math.PI - (E - o.e * Math.sin(E))) / (2 * Math.PI) * o.period;
};

proofs.stageddive = {
  // Dive stage retrograde until the low point is p[0], inside Cinder, drop
  // it; lift the low point to p[1] with the kick stage; start burning the
  // rest of it p[2] s before the low point (negative: after) until it runs
  // dry, drop it, and burn the capsule for p[3].
  p: [42, 51.5, 0.75, 0.3], scale: [2, 2, 1, 0.3], tol: [2, 3, 2, 0.2],
  script: (p, AP) => [
    { burn: 'retro', rel: 'cinder', until: (m) => AP.orb(m, 'cinder').pe <= p[0] },
    { deploy: true },
    { burn: 'pro', rel: 'cinder', until: (m) => AP.orb(m, 'cinder').pe >= p[1] },
    { coast: (m, c) => {
      const o = AP.orb(m, 'cinder');
      if (o.rising && c.tp == null) c.tp = m.t;
      return p[2] >= 0 ? o.rising || tToPe(m, 'cinder', AP) <= p[2] : c.tp != null && m.t - c.tp >= -p[2];
    } },
    { burn: 'pro', rel: 'cinder', until: () => false },
    { deploy: true },
    { fn: (m, c) => { c.d0 = m.dvUsed(); } },
    { burn: 'pro', rel: 'cinder', until: (m, c) => m.dvUsed() - c.d0 >= p[3] },
  ],
};

// Closest predicted approach to body `id` if the ship coasts from now with
// its velocity changed by (dvx, dvy): what the path preview's closest
// approach marker shows a player.
// `id` is a body, or 'goal' for the current goal's point (e.g. an L2).
const closest = (m, id, dvx, dvy, dur) => {
  const sys = m.sys, s = m.ship, bp = [0, 0], g = id === 'goal' ? m.currentGoal() : null, i = g ? -1 : sys.byId[id].index;
  const p = globalThis.Phys.predict(sys, { x: s.x, y: s.y, vx: s.vx + dvx, vy: s.vy + dvy }, m.t, dur, {});
  let d = Infinity;
  for (let k = 0; k < p.ts.length; k++) {
    if (g) { const q = m.goalPoint(g, p.ts[k]); bp[0] = q.x; bp[1] = q.y; } else sys.posAt(i, p.ts[k], bp);
    d = Math.min(d, Math.hypot(p.xs[k] - bp[0], p.ys[k] - bp[1]));
  }
  sys.update(m.t);
  return d;
};
// A small correction burn (prograde, retrograde, out or in about `rel`)
// that puts the closest approach to `id` near `want`, as a player nudges the
// marker: the cheapest one within 6 k of it, else the closest.
const nudge = (id, rel, want, dur, AP) => ({
  control: (m, c) => {
    if (c.ang == null) {
      const o = AP.orb(m, rel), out = o.theta;
      let best = Infinity;
      c.ang = o.pro; c.dv = 0;
      for (let k = 0; k <= 60; k++) {
        for (const a of [o.pro, o.pro + Math.PI, out, out + Math.PI]) {
          const dv = k * 0.025, e = Math.abs(closest(m, id, Math.cos(a) * dv, Math.sin(a) * dv, dur) - want);
          const score = e < 6 ? dv : 100 + e;
          if (score < best - 1e-9) { best = score; c.ang = a - o.pro; c.dv = dv; }
        }
        if (best < 100) break;
      }
      c.d0 = m.dvUsed();
    }
    if (m.dvUsed() - c.d0 >= c.dv - 1e-6) return { done: true };
    return { thrust: true, angle: AP.orb(m, rel).pro + c.ang };
  },
});

proofs.sentrypulsar = {
  // Ride the dark lane until p[0], climb until the closest approach to Tyche
  // is under p[1] (as a player watches the marker); p[3] s later nudge it to
  // p[4]; brake there until the high point about Tyche is p[2].
  p: [84, 45, 84, 30, 45], scale: [3, 8, 4, 5, 5], tol: [2, 12, 4, 5, 6],
  script: (p, AP) => [
    { wait: Math.max(0, p[0]) },
    { burn: 'pro', rel: 'argus', until: (m, c) => {
      const o = AP.orb(m, 'argus');
      if (o.ap < 600) return false;
      if (o.ap > 1100) return true;
      if (c.tc != null && m.t - c.tc < 0.1) return false;
      c.tc = m.t;
      return closest(m, 'tyche', 0, 0, 300) <= p[1];
    } },
    { wait: Math.max(0, p[3]) },
    nudge('tyche', 'argus', p[4], 250, AP),
    { coast: (m) => dist(m, 'tyche') < 150 && AP.orb(m, 'tyche').rising },
    { burn: 'retro', rel: 'tyche', until: (m) => { const o = AP.orb(m, 'tyche'); return o.bound && o.ap <= p[2]; } },
  ],
};

// Seconds since the trailing edge of one of `id`'s beams swept past the
// ship (what a player judges by eye watching the beam go by).
const sinceSweep = (m, id, AP) => {
  const b = m.sys.byId[id], B = b.radiation.beam, a = B.phase + 2 * Math.PI * m.t / B.period;
  let d = (a - AP.shipPhase(m, id) - B.width / 2) % Math.PI;
  if (d < 0) d += Math.PI;
  return d / (2 * Math.PI / B.period);
};

proofs.pulsarsupply = {
  // Hold until p[0], climb until the path meets Orrin and a little past it
  // (p[1] more); turn to the brake heading (p[3] from prograde) and past
  // p[6] from Talon tap the engine until the path meets Orrin again; past
  // p[2], drop the pod p[5] s after a sweep goes by, and burn until the high
  // point is p[4].
  p: [112, 0.15, 380, 2.847, 470, 1, 350], scale: [3, 0.05, 15, 0.2, 6, 1, 15], tol: [2, 0.1, 15, 0.06, 15, 1.5, 15], opts: { turn: true, turnRate: 0.2 },
  script: (p, AP) => [
    hold((m) => m.t >= p[0]),
    { burn: 'pro', rel: 'talon', until: (m) => { const o = AP.orb(m, 'talon'); return o.ap > 800 || (o.ap > 480 && closest(m, 'orrin', 0, 0, 200) <= 15); } },
    { fn: (m, c) => { c.d0 = m.dvUsed(); } },
    { burn: 'pro', rel: 'talon', until: (m, c) => m.dvUsed() - c.d0 >= p[1] },
    { coast: (m) => AP.orb(m, 'talon').r >= p[6] },
    { fn: (m, c) => { c.d0 = m.dvUsed(); } },
    { burn: p[3], rel: 'talon', until: (m, c) => m.dvUsed() - c.d0 > 1 || closest(m, 'orrin', 0, 0, 150) <= 15 },
    { coast: (m) => { if (AP.orb(m, 'talon').r < p[2]) return false; const k = sinceSweep(m, 'talon', AP); return k >= Math.max(0, p[5]) && k < Math.max(0, p[5]) + 1; } },
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
// Burn until the orbit about `id` is circular where you are now.
const circularize = (id, gm) => ({
  control: (m) => {
    const sys = m.sys; sys.update(m.t);
    const i = sys.byId[id].index, rx = m.ship.x - sys.px[i], ry = m.ship.y - sys.py[i], r = Math.hypot(rx, ry);
    const vx = m.ship.vx - sys.vx[i], vy = m.ship.vy - sys.vy[i], dir = rx * vy - ry * vx > 0 ? 1 : -1, vc = Math.sqrt(gm / r);
    const ex = -dir * ry / r * vc - vx, ey = dir * rx / r * vc - vy;
    if (Math.hypot(ex, ey) < 0.04) return { done: true };
    return { thrust: true, angle: Math.atan2(ey, ex) };
  },
});
const goalPt = (m) => m.goalPoint(m.currentGoal());
// A point `back` behind a body along its path (to park beside it, not in it).
const behind = (id, back) => (m) => { const q = bodyPt(id)(m), u = Math.hypot(q.vx, q.vy); return { x: q.x - back * q.vx / u, y: q.y - back * q.vy / u, vx: q.vx, vy: q.vy }; };

proofs.beamrescue = {
  // Close in on Wren (closing speed at most p[0]) and match it; p[1], p[2]
  // are the velocity error a hand-flown match leaves (k/s). p[3] s later
  // nudge the path onto the L2 marker (closest approach p[4]); from p[5]
  // out, fly onto L2 (closing speed at most p[6]).
  p: [0.75, 0, 0, 5, 5, 60, 1.5], scale: [0.2, 0, 0, 3, 3, 10, 0.3], tol: [0.1, 0.3, 0.3, 2, 5, 15, 0.2],
  script: (p, AP) => [
    goTo(behind('wren', 8), p[0], 0.042, (m) => m.goalIndex > 0),
    { fn: (m) => { m.ship.vx += p[1]; m.ship.vy += p[2]; } },
    { wait: Math.max(0, p[3]) },
    nudge('goal', 'vesper', p[4], 300, AP),
    { coast: (m) => { const q = goalPt(m); return Math.hypot(q.x - m.ship.x, q.y - m.ship.y) < p[5]; } },
    goTo(goalPt, p[6], 0.04, (m) => m.status !== 'flying'),
  ],
};

proofs.pulsartour = {
  // Booster: push p[0] from prograde until it runs dry (still on an escape
  // path) and drop it. Capsule: from p[4] above the low point brake until
  // the high point is p[1], release Lark, and brake on until the orbit is
  // round; p[2], p[3] are the speed error a hand-flown rounding leaves
  // (along, out; k/s).
  p: [-1.2, 690, 0, 0, 10], scale: [0.2, 8, 0, 0, 3], tol: [0.1, 25, 0.15, 0.15, 4], opts: { turn: true, turnRate: 0.3 },
  script: (p, AP) => [
    { burn: p[0], rel: 'lumen', until: () => false },
    { deploy: true },
    { coast: (m) => { const o = AP.orb(m, 'lumen'); return o.rising || o.r < o.pe + p[4]; } },
    { burn: 'retro', rel: 'lumen', until: (m) => { const o = AP.orb(m, 'lumen'); return o.bound && o.ap <= p[1]; } },
    { drop: true },
    circularize('lumen', 40000),
    { fn: (m) => { const o = AP.orb(m, 'lumen'); m.ship.vx += p[2] * Math.cos(o.pro) + p[3] * Math.cos(o.theta); m.ship.vy += p[2] * Math.sin(o.pro) + p[3] * Math.sin(o.theta); } },
  ],
};

const tourOpts = { turn: true, turnRate: 0.3 };
const fails = {
  pulsartour: [
    { name: 'wait and see', steps: () => [] },
    { name: 'brake on the booster at the low point', opts: tourOpts, steps: (AP) => [
      { coast: (m) => AP.orb(m, 'lumen').rising },
      { burn: 'retro', rel: 'lumen', stage: true, until: (m) => { const o = AP.orb(m, 'lumen'); return o.bound && o.ap <= 690; } },
      { drop: true },
      circularize('lumen', 40000),
    ] },
    { name: 'push the booster backward: it stays bound', opts: tourOpts, steps: (AP) => proofs.pulsartour.script([-2.4, ...proofs.pulsartour.p.slice(1)], AP) },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.pulsartour.script(proofs.pulsartour.p, AP) },
    { name: 'round off high above the dark lane', opts: tourOpts, steps: (AP) => { const s = proofs.pulsartour.script(proofs.pulsartour.p, AP); return [...s.slice(0, 5), { coast: (m) => AP.orb(m, 'lumen').r >= 300 }, s[5]]; } },
  ],
  beamrescue: [
    { name: 'wait and see', steps: () => [] },
    { name: 'stay with Wren', steps: (AP) => [...proofs.beamrescue.script(proofs.beamrescue.p, AP).slice(0, 2), goTo(behind('wren', 8), 0.5, 0.05, () => false)] },
    { name: 'rush in, then rest before leaving', steps: (AP) => { const s = proofs.beamrescue.script(proofs.beamrescue.p, AP); return [goTo(behind('wren', 8), 3, 0.1, (m) => m.goalIndex > 0), hold((m, c) => m.t - c.t0 > 60), ...s.slice(2)]; } },
  ],
  pulsarsupply: [
    { name: 'carry the pod in close', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => { const s = proofs.pulsarsupply.script(proofs.pulsarsupply.p, AP); return [...s.slice(0, 7), { coast: (m) => dist(m, 'orrin') < 200 }, s[8], s[9]]; } },
    { name: 'climb at once', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => { const p = proofs.pulsarsupply.p.slice(); p[0] = 0; return proofs.pulsarsupply.script(p, AP); } },
    { name: 'drop as a sweep comes round', opts: { turn: true, turnRate: 0.2 }, steps: (AP) => { const p = proofs.pulsarsupply.p.slice(); p[2] = 320; p[5] = 37; return proofs.pulsarsupply.script(p, AP); } },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.2 }, steps: (AP) => proofs.pulsarsupply.script(proofs.pulsarsupply.p, AP) },
  ],
  sentrypulsar: [
    { name: 'climb to Tyche at once', steps: (AP) => proofs.sentrypulsar.script([0, ...proofs.sentrypulsar.p.slice(1)], AP) },
    { name: 'climb while Kore is in the way', steps: (AP) => proofs.sentrypulsar.script([68, ...proofs.sentrypulsar.p.slice(1)], AP) },
    { name: 'climb out of the dark lane and wait there', steps: (AP) => [
      { burn: 'pro', rel: 'argus', until: (m) => AP.orb(m, 'argus').ap >= 330 },
      { coast: (m) => !AP.orb(m, 'argus').rising },
      { burn: 'pro', rel: 'argus', until: (m) => AP.orb(m, 'argus').pe >= 325 },
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
    { name: 'brake the dive stage only to just above the surface', steps: (AP) => proofs.stageddive.script([62, ...proofs.stageddive.p.slice(1)], AP) },
    { name: 'lift the low point well clear of the heat', steps: (AP) => proofs.stageddive.script([proofs.stageddive.p[0], 100, ...proofs.stageddive.p.slice(2)], AP) },
    { name: 'burn the kick stage long before the low point', steps: (AP) => proofs.stageddive.script([proofs.stageddive.p[0], proofs.stageddive.p[1], 12, proofs.stageddive.p[3]], AP) },
  ],
  darkconst: [
    { name: 'phase on long laps, a third slower', steps: slowLaps },
    { name: 'drop all three at once', steps: (AP) => [...proofs.darkconst.script(proofs.darkconst.p, AP).slice(0, 5), { drop: true }, { drop: true }] },
  ],
};

module.exports = { levels, proofs, fails };
