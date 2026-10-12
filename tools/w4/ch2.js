// World 4 · Chapter 2 · Shadows: any planet, moon or rock between a hot
// star and you blocks its radiation completely. See tools/w4/README.md.
'use strict';
const { ship, C, belt, VE } = require('../../js/levels.js');

// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };
// A burn of a set Δv (turning first doesn't count).
const dvBurn = (dir, rel, amount) => {
  const st = { d0: 0 };
  return [
    { fn: (m) => { st.d0 = m.dvUsed(); } },
    { burn: dir, rel, until: (m) => m.dvUsed() - st.d0 >= amount },
  ];
};

// Distance from the ship to the current goal's point.
const goalDist = (m) => { const P = m.goalPoint(m.currentGoal()); return Math.hypot(m.ship.x - P.x, m.ship.y - P.y); };
// Fly to the current goal's point and move with it: aim the velocity at
// the point's own velocity plus a closing speed (gain k, at most vmax),
// firing only when the error is bigger than tol.
const park = (k, vmax, tol, max) => ({
  control: (m) => {
    const g = m.currentGoal();
    if (!g || g.type !== 'hold') return { done: true };
    const P = m.goalPoint(g), s = m.ship;
    const dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy), c = Math.min(vmax, k * d) / Math.max(d, 1e-9);
    const ex = P.vx + dx * c - s.vx, ey = P.vy + dy * c - s.vy;
    if (Math.hypot(ex, ey) < tol) return { thrust: false, angle: null, dt: 0.05 };
    return { thrust: true, angle: Math.atan2(ey, ex) };
  },
  max,
});

// Close on a body and match its velocity (rendezvous): aim the velocity
// at the body's own plus a closing speed (gain k, at most vmax).
const meet = (id, k, vmax, tol, max) => ({
  control: (m) => {
    if (m.status !== 'flying') return { done: true };
    const sys = m.sys; sys.update(m.t);
    const i = sys.byId[id].index, s = m.ship;
    const dx = sys.px[i] - s.x, dy = sys.py[i] - s.y, d = Math.hypot(dx, dy), c = Math.min(vmax, k * d) / Math.max(d, 1e-9);
    const ex = sys.vx[i] + dx * c - s.vx, ey = sys.vy[i] + dy * c - s.vy;
    if (Math.hypot(ex, ey) < tol) return { thrust: false, angle: null, dt: 0.05 };
    return { thrust: true, angle: Math.atan2(ey, ex) };
  },
  max,
});

// Shade Drop: Lee Station co-rotates with Veil, parked in its shadow.
const VEIL_A = 520, VEIL_PH = 0.9, VEIL_N = Math.sqrt(46000 / (VEIL_A * VEIL_A * VEIL_A));
// Veil's centre sits at VEIL_A × 40000/46000 from the barycentre (the star wobbles).
const LEE_R = VEIL_A * 40000 / 46000 + 140;
// Veil's L2, as a multiple of the Brand to Veil distance (solved with the wobble).
const L2_K = 1.3985;

// Fenced Shade: Gloam's shadow, a fence of zones across it, a shelter at L2.
const GLOAM_A = 600, GLOAM_PH = -0.5, GLOAM_N = Math.sqrt(48000 / (GLOAM_A * GLOAM_A * GLOAM_A));
const GLOAM_R = GLOAM_A * 40000 / 48000;            // Gloam's distance from the barycentre
const SHELTER_R = 762.85;                           // L2, solved with the star's wobble
// A point d behind Gloam (away from Sear), offset sideways by w (counter-clockwise),
// moving with Gloam's orbit.
const behindGloam = (d, w) => {
  const c = Math.cos(GLOAM_PH), sn = Math.sin(GLOAM_PH), r = GLOAM_R + d;
  return { x: r * c - w * sn, y: r * sn + w * c, vx: -GLOAM_N * (r * sn + w * c), vy: GLOAM_N * (r * c - w * sn), r: Math.hypot(r, w), ph: GLOAM_PH + Math.atan2(w, r) };
};
const fence = (k, w) => { const p = behindGloam(115, w); return { id: 'fence' + k, name: 'Fence ' + (k + 1), gm: 0, radius: 3, color: '#ff8a8a', kind: 'station', keepOut: 15, orbit: { parent: 'sear', a: p.r, n: GLOAM_N, phase: p.ph, reflex: false } }; };
const SINK = behindGloam(215, 6);

// Umbrella Field: big rocks on their own orbits, placed so one transfer
// window slips behind them in turn ([radius, phase, size]).
const UMBRELLAS = [[340,0.2304,22],[380,0.4957,22],[420,0.7103,22],[465,0.9198,22],[510,1.0996,22],[560,1.2741,22],[610,1.4259,22]].map(([a, phase, radius], k) => ({
  id: 'brolly' + k, name: 'Umbrella ' + (k + 1), kind: 'rock', gm: 0, radius, color: '#8d8478', orbit: { parent: 'corona', a, phase },
}));

const levels = [
  {
    id: 'eclipse',
    name: 'Eclipse',
    intro: 'Pyra is a hot star, and Nyx orbits close enough to feel it: you can take only 16 Sv in all, and every sunlit half lap adds a few. Nyx\'s shadow, the dark cone on its far side, is the only place with no radiation. Burn prograde as you pass over the day side, closest to Pyra: your climb then swings out behind Nyx and through the dark cone. Burn while you are in the shadow and you climb out into full sunlight.',
    objective: 'Get 1050 k from Pyra, taking under 18 Sv of radiation.',
    teaches: 'Shadows · leave from the night side',
    bodies: [
      { id: 'pyra', name: 'Pyra', gm: 45000, radius: 50, color: C.sun2, kind: 'star', radiation: { rate: 0.8, at: 300, dose: 16 } },
      { id: 'nyx', name: 'Nyx', gm: 5000, radius: 40, color: C.purple, orbit: { parent: 'pyra', a: 480, phase: 2.3 } },
    ],
    ship: ship({ start: { orbit: { body: 'nyx', r: 58, angle: 2.8, dir: -1 } }, heading: 'prograde', dv: 6.5, accel: 1 }),
    goals: [{ type: 'escape', body: 'pyra', r: 1100 }],
    par: 4.5, bounds: 4000, tMax: 600, predict: 300, view: { x: -300, y: 300, span: 1700 }, startCam: 'overview',
  },
  {
    id: 'shadedrop',
    name: 'Shade Drop',
    intro: 'Lee Station rides in Veil\'s shadow, always on its night side, and it needs the relay you carry. Once you drop it (E) the relay is unshielded: it can take only 1 Sv, and the sunlit stretch of the climb is more than that. Climb from the day side so your path rises past the station into the dark cone, and drop the relay once you are in the dark. Then coast on and park at L2, just beyond the station, where the shade is total, before your own dose adds up.',
    objective: 'Get the relay within 15 k of Lee Station, then hold within 20 k of Veil\'s L2 for 10 s, with the relay under 1 Sv and you under 10 Sv.',
    teaches: 'Drop in the shade',
    bodies: [
      { id: 'brand', name: 'Brand', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.6, at: 300, dose: 10 } },
      { id: 'veil', name: 'Veil', gm: 6000, radius: 34, color: C.tan, orbit: { parent: 'brand', a: VEIL_A, phase: VEIL_PH } },
      { id: 'lee', name: 'Lee Station', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'brand', a: LEE_R, n: VEIL_N, phase: VEIL_PH, reflex: false } },
    ],
    ship: ship({ start: { orbit: { body: 'veil', r: 60, angle: 0 } }, heading: 'prograde', dv: 3.8, accel: 1, cargo: [{ id: 'relay', name: 'Relay', mass: 0.3, dose: 1 }] }),
    goals: [
      { type: 'reach', body: 'lee', craft: 'relay', r: 15, label: 'Lee Station' },
      { type: 'hold', lagrange: { body: 'veil', lead: 0, scale: L2_K }, r: 20, hold: 10, relVel: 1, label: 'L2' },
    ],
    par: 2.4, bounds: 4000, tMax: 600, predict: 300, view: { x: 300, y: 300, span: 1500 }, startCam: 'overview',
  },
  {
    id: 'fencedshade',
    name: 'Fenced Shade',
    intro: 'You are drifting in Gloam\'s shadow, and Gloam is pulling you down toward it. Out in Sear\'s light your whole dose would be gone in about 15 seconds, and the dark cone narrows as you sink. Lower down, a fence of red keep-out zones blocks the shadow. Stop the fall before the fence and climb back up the middle of the cone to the Shelter at L2: Gloam\'s orbit swings your path sideways, so steer against it.',
    objective: 'Dock with the Shelter (within 8 k, relative speed under 0.5 k/s) without entering a zone, taking under 6 Sv of radiation.',
    teaches: 'Stay in the cone',
    bodies: [
      { id: 'sear', name: 'Sear', gm: 40000, radius: 50, color: C.sun, kind: 'star', radiation: { rate: 3, at: 300, dose: 6 } },
      { id: 'gloam', name: 'Gloam', gm: 8000, radius: 38, color: '#5f8fa8', orbit: { parent: 'sear', a: GLOAM_A, phase: GLOAM_PH } },
      fence(0, -28), fence(1, 0), fence(2, 28),
      { id: 'shelter', name: 'Shelter', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'sear', a: SHELTER_R, n: GLOAM_N, phase: GLOAM_PH, reflex: false } },
    ],
    ship: ship({ start: { free: { x: SINK.x, y: SINK.y, vx: SINK.vx - 1.2 * Math.cos(GLOAM_PH), vy: SINK.vy - 1.2 * Math.sin(GLOAM_PH) } }, heading: GLOAM_PH, dv: 5.5, accel: 1 }),
    goals: [{ type: 'rendezvous', body: 'shelter', dist: 8, relVel: 0.5 }],
    par: 3.8, bounds: 4000, tMax: 400, predict: 200, view: { x: 650 * Math.cos(GLOAM_PH), y: 650 * Math.sin(GLOAM_PH), span: 600 },
  },
  {
    id: 'umbrellafield',
    name: 'Umbrella Field',
    intro: 'TBD',
    objective: 'Orbit Corona between 575 and 675 k up, taking under 12 Sv of radiation.',
    teaches: 'Rocks as shade',
    bodies: [
      { id: 'corona', name: 'Corona', gm: 40000, radius: 45, color: C.sun, kind: 'star', radiation: { rate: 0.1, at: 300, dose: 7 } },
      ...UMBRELLAS,
    ],
    ship: ship({ start: { orbit: { body: 'corona', r: 300, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1 }),
    goals: [{ type: 'orbit', body: 'corona', rMin: 760, rMax: 860 }],
    par: 3, bounds: 4000, tMax: 900, predict: 300, view: { x: 0, y: 0, span: 1600 }, startCam: 'overview',
  },
];

const proofs = {
  eclipse: {
    p: [19, 4.4], scale: [2, 0.3],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', rel: 'nyx', until: (m) => m.dvUsed() >= p[1] },
    ],
  },
};

proofs.shadedrop = {
  p: [32.392, 133.96, 112.781, -2.339, -0.008, 0.043, 0.507, 32.881], scale: [3, 10, 15, 0.5, 0.5, 0.02, 1, 10],
  script: (p, AP) => [
    { wait: Math.max(0, p[0]) },
    { burn: 'pro', rel: 'veil', until: (m) => AP.orb(m, 'veil').ap >= p[1] },
    { coast: (m) => AP.orb(m, 'veil').r >= p[2] },
    { drop: true },
    ...dvBurn(p[3], 'veil', 0.2 + Math.abs(p[4])),
    { coast: (m) => m.goalIndex >= 1 && (!AP.orb(m, 'veil').rising || goalDist(m) < p[7]) },
    park(p[5], p[6], 0.3, 300),
  ],
};

proofs.fencedshade = {
  // Burn up the cone at once, a little against the sideways drift, coast
  // up to the Shelter and match its speed there.
  p: [0, 0.386, 3.102, 17.004, 0.041, 0.679, 0.195], scale: [2, 0.2, 0.4, 10, 0.02, 0.4, 0.05],
  script: (p, AP) => [
    { wait: Math.max(0, p[0]) },
    ...dvBurn((m) => GLOAM_PH + GLOAM_N * m.t + p[1], null, Math.abs(p[2])),
    { coast: (m) => dist(m, 'shelter') < p[3] || m.t > 300 },
    meet('shelter', p[4], p[5], p[6], 380),
  ],
};

proofs.umbrellafield = {
  p: [19.291, 761.87, 756.386], scale: [3, 15, 10],
  script: (p, AP) => [
    { wait: Math.max(0, p[0]) },
    { burn: 'pro', until: (m) => AP.orb(m, 'corona').ap >= p[1] },
    { coast: (m) => !AP.orb(m, 'corona').rising },
    { burn: 'pro', until: (m) => AP.orb(m, 'corona').pe >= p[2] },
  ],
};

const fails = {
  eclipse: [
    { name: 'burn at once, in the shadow', steps: (AP) => [
      { burn: 'pro', rel: 'nyx', until: (m) => m.dvUsed() >= 5 },
    ] },
    { name: 'the right burn, one lap later', steps: (AP) => [
      { wait: 14 + 31.4 },
      { burn: 'pro', rel: 'nyx', until: (m) => m.dvUsed() >= 4.4 },
    ] },
  ],
  shadedrop: [
    { name: 'drop the relay as you start the climb', steps: (AP) => {
      const p = proofs.shadedrop.p;
      return [
        { wait: p[0] },
        { burn: 'pro', rel: 'veil', until: (m) => AP.orb(m, 'veil').ap >= p[1] },
        { drop: true },
        { coast: (m) => AP.orb(m, 'veil').r >= p[2] },
        ...dvBurn(p[3], 'veil', 0.2 + p[4]),
      ];
    } },
    { name: 'climb at once', steps: (AP) => proofs.shadedrop.script([0].concat(proofs.shadedrop.p.slice(1)), AP) },
    { name: 'the same plan, one lap later', steps: (AP) => proofs.shadedrop.script([proofs.shadedrop.p[0] + 37.7].concat(proofs.shadedrop.p.slice(1)), AP) },
  ],
  fencedshade: [
    { name: 'coast and see', steps: () => [] },
    { name: 'burn straight up the cone, no lead against the drift', steps: (AP) => {
      const p = proofs.fencedshade.p.slice(); p[1] = 0;
      return proofs.fencedshade.script(p, AP);
    } },
    { name: 'burn straight away from Gloam', steps: (AP) => [
      ...dvBurn('out', 'gloam', 3.1),
      { coast: (m) => dist(m, 'shelter') < 17 || m.t > 300 },
      meet('shelter', 0.041, 0.679, 0.195, 380),
    ] },
    { name: 'fall past the fence and swing round Gloam', steps: (AP) => [
      ...dvBurn((m) => GLOAM_PH + GLOAM_N * m.t + Math.PI / 2, null, 0.8),
      { coast: (m) => AP.orb(m, 'gloam').rising || m.t > 200 },
      { coast: (m) => dist(m, 'shelter') < 60 || m.t > 300 },
      meet('shelter', 0.041, 0.679, 0.195, 380),
    ] },
  ],
  umbrellafield: [
    { name: 'Hohmann at once', steps: (AP) => proofs.umbrellafield.script([0, 790, 790], AP) },
    { name: 'wait for a clear lane, then Hohmann', steps: (AP) => proofs.umbrellafield.script([30, 790, 790], AP) },
    { name: 'clear lane, then a fast transfer', steps: (AP) => [
      { wait: 30 },
      { burn: 'pro', until: (m) => AP.orb(m, 'corona').ap >= 1200 },
      { coast: (m) => AP.orb(m, 'corona').r >= 790 },
      { control: (m) => {
        const o = AP.orb(m, 'corona'), vc = Math.sqrt(40000 / o.r);
        m.sys.update(m.t);
        const dx = -Math.sin(o.theta) * vc - m.ship.vx, dy = Math.cos(o.theta) * vc - m.ship.vy;
        if (Math.hypot(dx, dy) < 0.05) return { done: true };
        return { thrust: true, angle: Math.atan2(dy, dx) };
      } },
    ] },
  ],
};

module.exports = { levels, proofs, fails };
