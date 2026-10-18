// World 4 · Chapter 2 · Shadows and Beams. See tools/w4/README.md ("Redesign v3").
//
// A hot star is a disc, so the shadow behind a moon or rock has a dark umbra
// (no dose) that narrows and ends, inside a lighter penumbra; hide close
// behind. A pulsar is a point: its two sweeping beams cast sharp shadows that
// widen into wedges of constant angle, so the shade behind a moon reaches
// out for ever. Every mission has two parts sharing one tank and one dose
// budget: a sloppy first part leaves too little for the second.
'use strict';
const { ship, C } = require('../../js/levels.js');

const PULSAR = '#e4dcff';

// ------------------------------------------------------------- proof helpers

// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };
// Distance from the ship to the current goal's point.
const goalDist = (m) => { const P = m.goalPoint(m.currentGoal()); return Math.hypot(m.ship.x - P.x, m.ship.y - P.y); };
// Coast with the nose held still (no side thrusters spent chasing a target).
const hold = (pred) => ({ control: (m, c) => pred(m, c) ? { done: true } : { thrust: false, angle: null, dt: 0.25 } });
// A burn held in the direction dir gives as it starts (relative to `rel`):
// flip once, then hold still, e.g. a retrograde burn right through a stop.
const held = (AP, dir, rel, until) => {
  let a = null;
  return [{ fn: () => { a = null; } }, { burn: (m) => (a == null ? (a = typeof dir === 'function' ? dir(m) : AP.aim(m, dir, rel)) : a), until }];
};

// Close on a body and match its velocity: steer the velocity toward the
// body's own plus a slow approach (k per k of distance, at most vMax),
// firing only when the error is over `dead` k/s. Ends when the current goal
// changes; `lag` aims that far behind the body (no bumping into a station).
const meet = (id, k, vMax, dead, lag) => {
  const st = {};
  return { control: (m, c) => {
    if (st.t0 !== c.t0) { st.t0 = c.t0; st.g0 = m.goalIndex; st.burning = false; }
    if (m.status !== 'flying' || m.goalIndex > st.g0) return { done: true };
    const sys = m.sys; sys.update(m.t);
    const i = sys.byId[id].index, s = m.ship;
    const bvx = sys.vx[i], bvy = sys.vy[i], u = Math.hypot(bvx, bvy) || 1, b = lag || 0;
    const dx = sys.px[i] - b * bvx / u - s.x, dy = sys.py[i] - b * bvy / u - s.y, d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(vMax, k * d);
    const ex = bvx + sp * dx / d - s.vx, ey = bvy + sp * dy / d - s.vy;
    const e = Math.hypot(ex, ey), lo = dead == null ? 0.06 : dead;
    if (st.burning ? e < Math.min(0.02, lo / 3) : e < lo) { st.burning = false; return { thrust: false, angle: null, dt: 0.05 }; }
    st.burning = true;
    return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
  } };
};

// A point d from the centre of body id, straight away from the source (in its
// shadow), moving with the body.
const behind = (m, id, src, d) => {
  const sys = m.sys; sys.update(m.t);
  const i = sys.byId[id].index, j = sys.byId[src].index;
  const ux = sys.px[i] - sys.px[j], uy = sys.py[i] - sys.py[j], u = Math.hypot(ux, uy);
  return { x: sys.px[i] + d * ux / u, y: sys.py[i] + d * uy / u, vx: sys.vx[i], vy: sys.vy[i] };
};
// Fly to the moving point P(m) and keep station on it (closing gain k, at most
// vMax), firing only when the velocity is off by more than `dead` k/s: a
// player can't match a speed much better than a tenth or two of a k/s.
const chase = (P, k, vMax, dead, until) => {
  const st = {};
  return { control: (m, c) => {
    if (st.t0 !== c.t0) { st.t0 = c.t0; st.burning = false; }
    if (m.status !== 'flying' || until(m)) return { done: true };
    const q = P(m), s = m.ship;
    const dx = q.x - s.x, dy = q.y - s.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(vMax, k * d);
    const ex = q.vx + sp * dx / d - s.vx, ey = q.vy + sp * dy / d - s.vy, e = Math.hypot(ex, ey);
    if (st.burning ? e < dead / 3 : e < dead) { st.burning = false; return { thrust: false, angle: null, dt: 0.05 }; }
    st.burning = true;
    return { thrust: true, angle: Math.atan2(ey, ex) };
  } };
};
// Fly to the current hold goal's point and move with it (gain k, at most
// vmax), firing only when the error is bigger than tol.
const park = (k, vmax, tol, max) => ({
  control: (m) => {
    const g = m.currentGoal();
    if (!g || g.type !== 'hold') return { done: true };
    const P = m.goalPoint(g), s = m.ship;
    const dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy), c = Math.min(vmax, k * d, Math.sqrt(0.6 * m.thrustAccel() * d)) / Math.max(d, 1e-9);
    const ex = P.vx + dx * c - s.vx, ey = P.vy + dy * c - s.vy;
    if (Math.hypot(ex, ey) < tol) return { thrust: false, angle: null, dt: 0.05 };
    return { thrust: true, angle: Math.atan2(ey, ex) };
  },
  max,
});
// Correct the course like a player watching the predicted path: nudge it
// (chunk k/s at a time, or 3 or 8 times that, in whichever of 8 directions
// helps most) until the coast path passes within tol of a body in the next
// `horizon` seconds, or with `want`, passes within tol of `want` k from its
// centre (a near miss, not a hit).
const aimAt = (id, horizon, tol, chunk, max, want) => {
  const st = { until: -1, ang: 0 }, o = [0, 0];
  const miss = (m, s) => {
    const P = globalThis.Phys.predict(m.sys, s, m.t, horizon), i = m.sys.byId[id].index;
    if (P.hit === i) return want ? want : -1;
    let best = Infinity;
    for (let k = 0; k < P.ts.length; k++) { m.sys.posAt(i, P.ts[k], o); best = Math.min(best, Math.hypot(P.xs[k] - o[0], P.ys[k] - o[1])); }
    return want ? Math.abs(best - want) : best;
  };
  return {
    control: (m) => {
      if (m.status !== 'flying') return { done: true };
      if (m.dvUsed() < st.until) return { thrust: true, angle: st.ang };
      const s = m.ship, d0 = miss(m, s);
      if (d0 < tol) return { done: true };
      let best = d0, ang = null, dv = chunk;
      for (const c of [chunk, 3 * chunk, 8 * chunk]) {
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4, d = miss(m, { x: s.x, y: s.y, vx: s.vx + c * Math.cos(a), vy: s.vy + c * Math.sin(a) });
          if (d < best) { best = d; ang = a; dv = c; }
        }
        if (ang != null && best < d0 * 0.97) break;
      }
      m.sys.update(m.t);
      if (ang == null || best > d0 * 0.97) return { done: true };
      st.until = m.dvUsed() + dv; st.ang = ang;
      return { thrust: true, angle: ang };
    },
    max,
  };
};
// Coast to the closest approach to a body (or until within `near` k).
const coastToClosest = (id, near) => ({ coast: (m, c) => { const d = dist(m, id), r = d < near || (c.dl != null && d > c.dl && d < 200); c.dl = d; return r; } });

// ------------------------------------------------------------------ geometry

// Shade Drop: Lee Station co-rotates with Veil, parked in its shadow.
const VEIL_A = 520, VEIL_PH = 0.9, VEIL_N = Math.sqrt(46000 / (VEIL_A * VEIL_A * VEIL_A));
// Veil's centre sits at VEIL_A × 40000/46000 from the barycentre (the star wobbles).
const LEE_R = VEIL_A * 40000 / 46000 + 140;
// Veil's L2, as a multiple of the Brand to Veil distance (solved with the wobble).
const L2_K = 1.3985;

// Backward Moon: Kesh circles Mire the wrong way round; it turns slowly so
// that its night side keeps facing away from Ardent.
const KESH_PH = -0.5;
const MIRE_N = Math.sqrt(46000 / 520 ** 3);

// Umbrella Field: big rocks on their own orbits. Umbrella 1 circles just
// inside your orbit, faster than you, so its shadow sweeps over you soon
// after the start; the others are placed so a climb begun in that shadow
// slips behind them in turn ([radius, phase, size]).
const UMBRELLAS = [[262, -0.2, 24], [340, 0.2194, 24], [390, 0.5187, 24], [450, 0.7979, 24], [520, 1.0772, 24], [600, 1.3265, 24]].map(([a, phase, radius], k) => ({
  id: 'brolly' + k, name: 'Umbrella ' + (k + 1), kind: 'rock', gm: 0, radius, color: '#8d8478', orbit: { parent: 'corona', a, phase },
}));
// In Umbrella 1's shadow (umbra or penumbra)?
const underBrolly = (m) => m.radShade >= 0 && m.sys.bodies[m.radShade].id === 'brolly0';

// Lighthouse: Skerry orbits Pharos, and the Lee Light buoy rides 110 k
// behind it, inside its shadow wedge.
const SKERRY_A = 700, SKERRY_PH = 1.7, SKERRY_N = Math.sqrt(30000 / SKERRY_A ** 3);

// Keeper's Station: the 500 k orbit round Corvus turns exactly with its beams.
const CORVUS_SYNC = 2 * Math.PI / Math.sqrt(10000 / 500 ** 3);

// -------------------------------------------------------------------- levels

const levels = [
  {
    id: 'shadedrop',
    name: 'Shade Drop',
    intro: 'Brand is a hot star and a wide disc, so Veil\'s shadow has a dark core, the umbra, where none of Brand shows and you take no dose, inside a lighter penumbra where part of the disc peeks round. Lee Station rides in that umbra and needs the relay you carry, but once you drop it (E) the relay can take only 1 Sv. Burn prograde on the day side so your climb rises into the dark cone (the glow on your path goes out there) and park at L2, beyond the station. Then nudge toward the station until your path runs through it and drop the relay: it falls in down the shadow.',
    objective: 'Hold within 15 k of Veil\'s L2 for 8 s, then get the relay within 12 k of Lee Station, with the relay under 1 Sv and you under 11 Sv.',
    teaches: 'Umbra and penumbra · drop in the shade',
    bodies: [
      { id: 'brand', name: 'Brand', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.6, at: 300, dose: 11 } },
      { id: 'veil', name: 'Veil', gm: 6000, radius: 34, color: C.tan, orbit: { parent: 'brand', a: VEIL_A, phase: VEIL_PH } },
      { id: 'lee', name: 'Lee Station', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'brand', a: LEE_R, n: VEIL_N, phase: VEIL_PH, reflex: false } },
    ],
    ship: ship({ start: { orbit: { body: 'veil', r: 60, angle: 0 } }, heading: 'prograde', dv: 3.9, accel: 1, cargo: [{ id: 'relay', name: 'Relay', mass: 0.3, dose: 1 }] }),
    goals: [
      { type: 'hold', lagrange: { body: 'veil', lead: 0, scale: L2_K }, r: 15, hold: 8, relVel: 1, label: 'L2' },
      { type: 'reach', body: 'lee', craft: 'relay', r: 12, label: 'Lee Station' },
    ],
    par: 3.5, bounds: 4000, tMax: 600, predict: 300, view: { x: 300, y: 300, span: 1500 }, startCam: 'overview',
  },
  {
    id: 'backwardmoon',
    name: 'Backward Moon',
    intro: 'You are drifting out of Mire\'s shadow and sinking toward it, and out in Ardent\'s light your 2.45 Sv lasts only a few seconds. Kesh, Mire\'s backward moon, comes round the wrong way and passes right under you in about ten seconds. Its umbra is a short dark spike pointing away from Ardent, narrowing as it goes, so tuck in close behind Kesh as it passes and move with it. Then let yourself down onto its night side, gently: every second you take doing either is fuel and dose you need for the other.',
    objective: 'Stay within 24 k of Kesh, moving with it (under 0.39 k/s), for 3 s, then land on Kesh\'s night side slower than 0.85 k/s, taking under 2.45 Sv of radiation.',
    teaches: 'An eclipse that passes · hide close behind',
    bodies: [
      { id: 'ardent', name: 'Ardent', gm: 40000, radius: 45, color: C.sun2, kind: 'star', radiation: { rate: 1.5, at: 300, dose: 2.45 } },
      { id: 'mire', name: 'Mire', gm: 6000, radius: 30, color: C.green, orbit: { parent: 'ardent', a: 520, phase: 0 } },
      { id: 'kesh', name: 'Kesh', gm: 30, radius: 16, color: C.grey, spin: MIRE_N, orbit: { parent: 'mire', a: 110, phase: KESH_PH, dir: -1 } },
    ],
    ship: ship({ start: { orbit: { body: 'mire', r: 135, angle: 0, dir: -1, speed: 0.75 } }, heading: 'prograde', dv: 10.6, accel: 2 }),
    goals: [
      { type: 'hold', body: 'kesh', r: 24, relVel: 0.39, hold: 3, label: 'Behind Kesh' },
      { type: 'hit', body: 'kesh', site: { angle: 0, width: 1.6 }, maxSpeed: 0.85, label: 'Kesh\'s night side' },
    ],
    par: 9.9, bounds: 4000, tMax: 300, predict: 150, view: { x: 450, y: 0, span: 420 },
  },
  {
    id: 'umbrellafield',
    name: 'Umbrella Field',
    intro: 'Corona\'s light is fierce all the way out, and the only shade is behind the big rocks circling it, the umbrellas: each casts a dark umbra close behind it, fading into a lighter penumbra. Touch one and your ship is lost, and a climb right now runs straight into them. Umbrella 1 circles just inside your orbit, faster than you, and its shadow is about to sweep over you: climb from under it and your path slips behind one umbrella after another. Round off in the band at the top, then catch Parasol Post, just behind you there: the dose keeps adding up while you close in.',
    objective: 'Orbit Corona between 770 and 840 k, then rendezvous with Parasol Post (within 15 k, relative speed under 0.5 k/s), taking under 4.8 Sv of radiation.',
    teaches: 'Rocks as shade',
    bodies: [
      { id: 'corona', name: 'Corona', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.1, at: 300, dose: 4.8 } },
      ...UMBRELLAS,
      { id: 'post', name: 'Parasol Post', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'corona', a: 800, phase: 1.7072 } },
    ],
    ship: ship({ start: { orbit: { body: 'corona', r: 300, angle: 0 } }, heading: 'prograde', dv: 5.8, accel: 1 }),
    goals: [
      { type: 'orbit', body: 'corona', rMin: 770, rMax: 840, label: 'Cool band' },
      { type: 'rendezvous', body: 'post', dist: 15, relVel: 0.5 },
    ],
    par: 5.5, bounds: 4000, tMax: 900, predict: 300, view: { x: 0, y: 0, span: 1800 }, startCam: 'overview',
  },
  {
    id: 'beacon',
    name: 'Lighthouse',
    intro: 'Pharos is a pulsar: it sweeps two narrow beams of radiation round like a lighthouse, and outside them there is none at all. You are climbing away slowly on an orbit that falls back, and a beam is coming round behind you; you can take less than 2 Sv. A pulsar is a point, so Skerry\'s shadow is a sharp wedge that never ends, and the Lee Light buoy marks it. Burn hard now, a little outward of prograde, and trim your path through Lee Light: arrive as the beam does and the wedge hides you, burn too gently and the beam finds you before you get there.',
    objective: 'Fly within 20 k of Lee Light, then get 1800 k from Pharos, taking under 1.8 Sv of radiation.',
    teaches: 'Pulsars · hide in a sharp shadow',
    bodies: [
      { id: 'pharos', name: 'Pharos', gm: 30000, radius: 10, color: PULSAR, kind: 'pulsar', radiation: { rate: 6.5, at: 300, dose: 1.8, beam: { width: 0.3, period: 150, phase: 0 } } },
      { id: 'skerry', name: 'Skerry', gm: 100, radius: 25, color: C.grey, orbit: { parent: 'pharos', a: SKERRY_A, phase: SKERRY_PH } },
      { id: 'leelight', name: 'Lee Light', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'pharos', a: SKERRY_A + 110, n: SKERRY_N, phase: SKERRY_PH, reflex: false } },
    ],
    ship: ship({ start: { conic: { body: 'pharos', pe: 150, e: 0.5, nu: 0.8, angle: 0 } }, heading: 'prograde', dv: 7.8, accel: 1 }),
    goals: [
      { type: 'reach', body: 'leelight', r: 20, label: 'Lee Light' },
      { type: 'escape', body: 'pharos', r: 1800, label: 'Deep space' },
    ],
    par: 7.4, bounds: 4000, tMax: 500, predict: 300, view: { x: -300, y: 400, span: 2200 }, startCam: 'overview',
  },
  {
    id: 'widdershins',
    name: 'Wrong Way Round',
    intro: 'A beam from Vela is about to sweep over you, and it turns almost as fast as you go round: going with it, it would sit on you for most of a minute, but against its spin it is gone in seconds. Climbing first and turning round up high would be cheaper, and far too slow. Flip now and burn retrograde right through a stop until you are going round the other way, and keep burning until your path climbs to meet Widdershins Station, which orbits backwards. The path glows where a beam catches you: watch the glow shrink as you turn round. Hold the nose right on the retrograde marker: a few degrees off and you arrive late, under the next sweeps, or spend the little spare fuel chasing the station.',
    objective: 'Orbit Vela the wrong way round (clockwise) between 150 and 700 k, then rendezvous with Widdershins Station (within 10 k, relative speed under 0.3 k/s), taking under 5.4 Sv of radiation.',
    teaches: 'Cross the beam against its spin',
    bodies: [
      { id: 'vela', name: 'Vela', gm: 3000, radius: 8, color: PULSAR, kind: 'pulsar', radiation: { rate: 0.15, at: 250, dose: 5.4, beam: { width: 0.3, period: 317, phase: -0.2 } } },
      { id: 'widd', name: 'Widdershins Station', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'vela', a: 500, phase: 1.86, dir: -1 } },
    ],
    ship: ship({ start: { orbit: { body: 'vela', r: 250, angle: 0 } }, heading: 'prograde', dv: 9.6, accel: 1 }),
    goals: [
      { type: 'orbit', body: 'vela', rMin: 150, rMax: 700, dir: -1, label: 'Wrong way round' },
      { type: 'rendezvous', body: 'widd', dist: 10, relVel: 0.3 },
    ],
    par: 9.1, bounds: 3000, tMax: 500, predict: 300, view: { x: 0, y: 0, span: 1300 }, startCam: 'overview',
  },
  {
    id: 'keeper',
    name: 'Keeper\'s Station',
    intro: 'Keeper\'s Station rides the 500 k orbit, which turns exactly with Corvus\'s beams, so it sits between them forever, and so do you, on the far side. To catch up you must cross a beam: near the 500 k orbit it turns almost with you and lingers, but deep down you cross it fast (the path glows where it will catch you). Dive into the deep lane on the booster, round off down there and drop it (the stage button) where its orbit stays well clear of the station\'s: the readout says STAGE NOW → SAFE ORBIT when it is. Then climb on the upper stage when Keeper is about 50° ahead of you, and match its speed with what little fuel is left.',
    objective: 'Orbit Corvus between 280 and 340 k, then rendezvous with Keeper\'s Station (within 12 k, relative speed under 0.4 k/s), taking under 11 Sv of radiation, with no spent stage on an orbit that crosses the station\'s.',
    teaches: 'Phase through a beam · stage where it is safe',
    bodies: [
      { id: 'corvus', name: 'Corvus', gm: 10000, radius: 10, color: PULSAR, kind: 'pulsar', radiation: { rate: 0.11, at: 500, dose: 11, beam: { width: 0.3, period: CORVUS_SYNC, phase: Math.PI / 2 } } },
      { id: 'keeper', name: 'Keeper\'s Station', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 30, orbit: { parent: 'corvus', a: 500, phase: Math.PI } },
    ],
    ship: ship({ start: { orbit: { body: 'corvus', r: 500, angle: 0 } }, heading: 'prograde', stack: [
      { name: 'Booster', dv: 1.6, accel: 1 },
      { name: 'Upper stage', dv: 1.05, accel: 0.6, dry: 0.4, sprite: 'satellite' },
    ] }),
    goals: [
      { type: 'orbit', body: 'corvus', rMin: 280, rMax: 340, label: 'Deep lane' },
      { type: 'rendezvous', body: 'keeper', dist: 12, relVel: 0.4 },
    ],
    par: 2.4, bounds: 3000, tMax: 950, predict: 300, view: { x: 0, y: 0, span: 1300 }, startCam: 'overview',
  },
];

// -------------------------------------------------------------------- proofs

const proofs = {
  shadedrop: {
    // Climb from the day side into the dark cone, park at L2, then push in
    // toward Lee Station and let the relay go: it falls in down the shadow.
    // p: wait for the day side, high point of the climb, distance from L2
    // to start parking, parking gain and speed, how close the path must
    // pass Lee Station before the drop.
    p: [32.392, 133.96, 32.881, 0.043, 0.507, 8], scale: [3, 10, 10, 0.02, 1, 3],
    tol: [2, 5, 4, 0, 0, 4],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', rel: 'veil', until: (m) => AP.orb(m, 'veil').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'veil').rising || goalDist(m) < p[2] },
      park(p[3], p[4], 0.3, 300),
      aimAt('lee', 120, p[5], 0.05, 30),
      { drop: true },
    ],
  },
  backwardmoon: {
    // React, fly to Kesh's night side as it passes and move with it, then
    // settle down onto the night side.
    // p: reaction time, distance from Kesh's centre to sit behind it, wait
    // after the hold, descent speed, how well you match speeds (k/s).
    p: [4, 20, 0, 0.75, 0.24], scale: [2, 5, 1, 0.1, 0.05], tol: [2, 4, 2, 0.1, 0.1],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      chase((m) => behind(m, 'kesh', 'ardent', p[1]), 0.2, 4, p[4], (m) => m.goalIndex > 0),
      { wait: Math.max(0, p[2]) },
      chase((m) => behind(m, 'kesh', 'ardent', 10), 0.15, p[3], 0.1, () => false),
    ],
  },
  umbrellafield: {
    // Wait for Umbrella 1's shadow to cover you, burn prograde a moment later
    // until the high point is in the band, coast to the top and round off,
    // then close in on Parasol Post.
    // p: wait once in the shadow, high point, low point to round off to.
    p: [3.267, 802.26, 787.485], scale: [2, 15, 10], tol: [2, 30, 30],
    script: (p, AP) => [
      { coast: (m) => underBrolly(m) || m.t > 300 },
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', until: (m) => AP.orb(m, 'corona').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'corona').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'corona').pe >= Math.min(p[2], 0.97 * AP.orb(m, 'corona').ap) },
      { coast: (m) => m.goalIndex > 0 },
      meet('post', 0.03, 0.6, 0.06, 6),
    ],
  },
  beacon: {
    // React, burn hard a little outward of prograde, then trim the path to
    // pass close by Lee Light, in Skerry's wedge as the beam comes round.
    // p: Δv of the climb, its aim off prograde (rad), reaction time.
    p: [6.2, -0.6, 2], scale: [0.3, 0.1, 1], tol: [0.2, 0.06, 1.5],
    script: (p, AP) => [
      { wait: Math.max(0, p[2]) },
      { burn: p[1], until: (m) => m.dvUsed() >= p[0] },
      { wait: 3 },
      aimAt('leelight', 200, 5, 0.03, 100, 11),
    ],
  },
  widdershins: {
    // Flip at once and burn retrograde through a stop: going round the other
    // way the beam crosses in seconds. Up to the station's height, then meet it.
    // p: high point to burn to, how far off retrograde the nose is held
    // (rad), distance to start matching speed (or the closest approach),
    // top closing speed.
    p: [600, 0, 60, 1], scale: [10, 0.01, 10, 0], tol: [24, 0.06, 10, 0], opts: { turn: true, turnRate: 0.3 },
    script: (p, AP) => [
      ...held(AP, (m) => AP.aim(m, 'retro', 'vela') + p[1], null, (m) => { const o = AP.orb(m, 'vela'); return o.dir < 0 && o.ap >= p[0]; }),
      { coast: (m) => m.goalIndex > 0 || m.t > 100 },
      { coast: (m, c) => { const d = dist(m, 'widd'), r = d < p[2] || (c.dl != null && d > c.dl); c.dl = d; return r; } },
      meet('widd', 0.03, p[3] || 0.6),
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
      coastToClosest('keeper', 25),
      meet('keeper', 0.03, 0.6),
    ],
  },
};

// --------------------------------------------------------------------- fails

// A plain Hohmann transfer to the band after waiting T seconds.
const hohmann = (AP, T, ap) => [
  { wait: T },
  { burn: 'pro', until: (m) => AP.orb(m, 'corona').ap >= ap },
  { coast: (m) => !AP.orb(m, 'corona').rising },
  { burn: 'pro', until: (m) => AP.orb(m, 'corona').pe >= Math.min(790, 0.97 * AP.orb(m, 'corona').ap) },
  { coast: (m) => m.goalIndex > 0 || m.t > 600 },
  meet('post', 0.03, 0.6, 0.06, 6),
];

const fails = {
  shadedrop: [
    { name: 'drop the relay as you start the climb', steps: (AP) => {
      const p = proofs.shadedrop.p;
      return [
        { wait: p[0] },
        { burn: 'pro', rel: 'veil', until: (m) => AP.orb(m, 'veil').ap >= p[1] },
        { drop: true },
        { coast: (m) => !AP.orb(m, 'veil').rising || goalDist(m) < p[2] },
        park(p[3], p[4], 0.3, 300),
      ];
    } },
    { name: 'climb at once', steps: (AP) => proofs.shadedrop.script([0].concat(proofs.shadedrop.p.slice(1)), AP) },
    { name: 'the same plan, one lap later', steps: (AP) => proofs.shadedrop.script([proofs.shadedrop.p[0] + 37.7].concat(proofs.shadedrop.p.slice(1)), AP) },
  ],
  backwardmoon: [
    { name: 'catch Kesh on its sunlit side', steps: (AP) => {
      const p = proofs.backwardmoon.p;
      return [{ wait: p[0] }, chase((m) => behind(m, 'kesh', 'ardent', -p[1]), 0.2, 4, p[4], (m) => m.goalIndex > 0), chase((m) => behind(m, 'kesh', 'ardent', -10), 0.15, p[3], 0.1, () => false)];
    } },
    { name: 'wait to see where Kesh goes, then chase it', steps: (AP) => proofs.backwardmoon.script([10].concat(proofs.backwardmoon.p.slice(1)), AP) },
    { name: 'sit far back in its shadow (40 k)', steps: (AP) => proofs.backwardmoon.script([4, 40].concat(proofs.backwardmoon.p.slice(2)), AP) },
    { name: 'drop straight onto Kesh, fast', steps: (AP) => proofs.backwardmoon.script(proofs.backwardmoon.p.slice(0, 3).concat([1.6, 0.24]), AP) },
  ],
  umbrellafield: [
    { name: 'Hohmann at once', steps: (AP) => hohmann(AP, 0, 810) },
    { name: 'wait for a clear lane, then Hohmann', steps: (AP) => hohmann(AP, 30, 810) },
    { name: 'climb in the shadow, but to a wide orbit (860 k)', steps: (AP) => proofs.umbrellafield.script([3.267, 870, 850], AP) },
  ],
  beacon: [
    { name: 'coast and watch', steps: () => [] },
    { name: 'burn prograde hard, straight out (no aim at Lee Light)', steps: () => [{ wait: 2 }, { burn: 'pro', until: (m) => m.dvUsed() >= 6.2 }] },
    { name: 'burn gently toward Lee Light (save fuel)', steps: (AP) => proofs.beacon.script([5.2, -0.6, 2], AP) },
    { name: 'wait for the beam to pass, then go', steps: (AP) => proofs.beacon.script([6.2, -0.6, 30], AP) },
  ],
  widdershins: [
    { name: 'coast and watch', steps: () => [] },
    ...[500, 900].map((H) => ({ name: 'climb first (to ' + H + ' k), turn round up high (cheaper)', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'vela').ap >= H },
      { coast: (m) => { const o = AP.orb(m, 'vela'); return o.r > H - 20 && !o.rising; } },
      ...held(AP, 'retro', 'vela', (m) => { const o = AP.orb(m, 'vela'); return o.dir < 0 && o.pe >= 495; }),
      { coast: (m) => m.goalIndex > 0 || m.t > 400 },
      { coast: (m) => dist(m, 'widd') < 60 },
      meet('widd', 0.03, 0.6),
    ] })),
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
    { name: 'climb to 800 k, stage up there and let it come round', opts: { turn: true, turnRate: 0.3 }, steps: (AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'corvus').ap >= 800 },
      { coast: (m) => { const o = AP.orb(m, 'corvus'); return !o.rising && o.r > 780; } },
      { burn: 'pro', until: (m) => AP.orb(m, 'corvus').pe >= 795 },
      { deploy: true },
      hold((m) => AP.wrap(AP.phase(m, 'keeper', 'corvus') - AP.shipPhase(m, 'corvus')) >= -0.3 && AP.wrap(AP.phase(m, 'keeper', 'corvus') - AP.shipPhase(m, 'corvus')) < 0),
      { burn: 'retro', until: (m) => AP.orb(m, 'corvus').pe <= 500 },
      coastToClosest('keeper', 25),
      meet('keeper', 0.03, 0.6),
    ] },
  ],
};

module.exports = { levels, proofs, fails };
