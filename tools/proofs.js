// Scripted flight plans that prove each World 2 mission can be won.
// World 3's proofs live with their levels in tools/w3/ch*.js and are added at the end.
// p: stored parameters (a known win), scale: search step per parameter.
// script(p, AP) returns the step list for tools/autopilot.js.
'use strict';

const until = {
  apAbove: (id, v) => (m, c, AP) => AP.orb(m, id).ap >= v,
};


module.exports = {
  satellite: {
    p: [59.842, 144.242], scale: [3, 5],
    script: (p) => [{ launch: { body: 'gaia', lo: p[0], hi: p[1] } }],
  },

  burndry: {
    // Climbing to the top of an ellipse whose low point is inside Terra:
    // burn prograde at the top, booster first, before the fall begins.
    p: [-0.584, 199.846, 0.032], scale: [2, 4, 0.1],
    script: (p, AP) => [
      { coast: (m) => AP.orb(m, 'terra').r >= AP.orb(m, 'terra').ap - Math.max(0, -p[0]) || !AP.orb(m, 'terra').rising },
      { wait: Math.max(0, p[0]) },
      { burn: p[2], rel: 'terra', stage: true, until: (m) => AP.orb(m, 'terra').pe >= p[1] },
    ],
  },

  againstspin: {
    p: [81.846, 126.459, 0.162, -0.193], scale: [4, 8, 0.05, 1],
    script: (p) => [{ launch: { body: 'kiri', lo: p[0], hi: p[1], turn: p[2], kick: p[3], dir: -1 } }],
  },

  stationary: {
    p: [129.772, 142.988, 0.656], scale: [2, 2, 0.05],
    script: (p) => [{ launch: { body: 'mira', lo: p[0], hi: p[1], turn: p[2] } }],
  },

  moonprobe: {
    p: [4.37, 420.3, 88.6], scale: [3, 8, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < 150 && o.rising; } },
      { burn: 'retro', rel: 'luna', stage: true, until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[2]; } },
    ],
  },

  homecoming: {
    p: [-9.791, 68.128], scale: [10, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', rel: 'luna', stage: true, until: (m) => AP.orb(m, 'terra').pe <= p[1] },
    ],
  },
  releasepoint: {
    p: [20.159, 49.683, 65.111], scale: [6, 4, 4],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[1] },
      { drop: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
    ],
  },

  impactor: {
    // Already falling straight at Luna: drop the impactor, sidestep, then
    // brake into orbit at the low point.
    p: [14.126, -1.655, 6.606, 91.267], scale: [5, 0.6, 10, 10],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { drop: true },
      { burn: p[1], rel: 'luna', until: (m) => AP.orb(m, 'luna').pe >= p[2] },
      { coast: (m) => AP.orb(m, 'luna').rising },
      { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[3]; } },
    ],
  },

  relaydrop: {
    p: [284.455, 279.615, 175.021, 175.8], scale: [10, 8, 10, 8],
    script: (p, AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[1] },
      { drop: true },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[2] },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= p[3] },
    ],
  },

  moonmail: {
    p: [4.651, 431.839, 235.228, 0.57, 0.114], scale: [6, 15, 40, 1.5, 0.4],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => AP.orb(m, 'luna').r < p[2] },
      { drop: true },
      { burn: p[3], rel: 'luna', max: Math.max(0, p[4]) },
    ],
  },

  twinprobes: {
    p: [11.682, 258.762, -1.86, 455.075, -24.074, -1.262, -0.152, 100, 170], scale: [10, 8, 20, 10, 30, 2, 1.5, 10, 15],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { wait: p[2] },
      { drop: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[3] },
      { wait: p[4] },
      { drop: true },
      { burn: p[6], max: Math.max(0, p[5]) },
      // Then settle the carrier into a safe orbit of its own, below Io's, so
      // neither moon can pull it off.
      { wait: 30 },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[7] },
      { wait: 10 },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= p[8] },
    ],
  },

  satnet: {
    // Circularise in the band, drop, then a 4/3-period phasing lap between drops.
    p: [183.727, 183.789, 271.451, 208.95, 305.524, 291.474], scale: [4, 4, 6, 3, 15, 10],
    script: (p, AP) => {
      const lap = [
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[2] },
        { wait: 10 },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { coast: (m) => AP.orb(m, 'terra').rising },
        { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= p[3] },
        { drop: true },
      ];
      return [
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[1] },
        { drop: true },
        ...lap, ...lap.map(st => Object.assign({}, st)),
        // Graveyard orbit for the empty carrier.
        { wait: 5 },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[4] },
        { wait: 10 },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[5] },
      ];
    },
  },
  threestages: {
    p: [149.45, 220.29, 0.771], scale: [5, 8, 0.05],
    script: (p) => [{ launch: { body: 'atlas', lo: p[0], hi: p[1], turn: p[2] } }],
  },

  kickstage: {
    p: [365.155, 1.055, 338.486], scale: [8, 15, 6],
    script: (p, AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
      { coast: (m) => { const o = AP.orb(m, 'terra'); return o.r >= o.ap - p[1]; } },
      { burn: 'pro', stage: true, until: (m) => AP.orb(m, 'terra').pe >= p[2] },
    ],
  },

  escapeprobe: {
    p: [0.218, -2.674], scale: [0.1, 1],
    script: (p) => [{ launch: { body: 'gaia', lo: 1e9, hi: 1e9, turn: p[0], kick: p[1] } }],
  },

  sundiverprobe: {
    p: [100.011], scale: [8],
    script: (p, AP) => [{ burn: 'retro', stage: true, until: (m) => AP.orb(m, 'sun').pe <= p[0] }],
  },

  outerplanet: {
    // Arriving at Rust faster than escape speed: brake around the low point,
    // transfer stage first, before Rust flings you back out.
    p: [2, 128], scale: [3, 6],
    script: (p, AP) => [
      { coast: (m) => { const o = AP.orb(m, 'rust'); return o.r < o.pe + Math.max(0, p[0]) || o.rising; } },
      { burn: 'retro', rel: 'rust', stage: true, until: (m) => { const o = AP.orb(m, 'rust'); return o.bound && o.ap <= p[1]; } },
    ],
  },

  splashdown: {
    p: [69.302, 180.392, 0.317, 0.372], scale: [3, 5, 0.05, 0.5],
    script: (p) => [{ launch: { body: 'gaia', lo: p[0], hi: p[1], turn: p[2], kick: p[3] } }],
  },
  clearstation: {
    p: [261.969, 259.75], scale: [10, 5],
    script: (p, AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[1] },
    ],
  },

  busyorbit: {
    // Drop the booster while it would still fall back, once the high point is up.
    p: [159.9, 212.2, 0.395, -0.95, 165], scale: [5, 8, 0.05, 0.5, 20],
    script: (p) => [{ launch: { body: 'gaia', lo: p[0], hi: p[1], turn: p[2], kick: p[3], dropWhen: (m, o) => m.stage === 0 && o.ap >= p[4] && o.pe < 30 } }],
  },

  leavenojunk: {
    // Swinging past Terra faster than escape speed: brake at the low point
    // to be captured, then deorbit the upper stage from the top as before.
    p: [9.869, 274.084, 60.845, 220.036], scale: [5, 10, 4, 4],
    script: (p, AP) => [
      { coast: (m) => { const o = AP.orb(m, 'terra'); return o.r < o.pe + Math.max(0, p[0]) || o.rising; } },
      { burn: 'retro', until: (m) => { const o = AP.orb(m, 'terra'); return o.bound && o.ap <= p[1]; } },
      { wait: 5 },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[2] },
      // Turn prograde first: the separation spring pushes the stage the
      // opposite way from your nose, here further down.
      { fn: (m) => { m.ship.angle = AP.aim(m, 'pro'); } },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[3] },
    ],
  },

  fueldepot: {
    p: [2.352, 466.321, 419.769], scale: [10, 10, 6],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', stage: true, until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', stage: true, until: (m) => AP.orb(m, 'terra').pe >= p[2] },
    ],
  },

  trojanrelay: {
    // Drop at L4, climb a little to drift back to L5, then match L5's motion
    // plus a slow drift toward it, and drop as you arrive.
    p: [1.478, 37.308, 0.374, 0.271, 268.032, 267.893], scale: [0.15, 15, 0.2, 0.1, 20, 15],
    script: (p, AP) => {
      const l5 = (m) => {
        const q = m.goalPoint(m.level.goals[1]), s = m.ship, d = Math.hypot(q.x - s.x, q.y - s.y);
        const wx = q.vx + p[2] * (q.x - s.x) / d - s.vx, wy = q.vy + p[2] * (q.y - s.y) / d - s.vy;
        return { d, w: Math.hypot(wx, wy), wa: Math.atan2(wy, wx) };
      };
      return [
        { drop: true },
        { wait: 1 },
        { burn: 'pro', max: Math.max(0, p[0]) },
        { wait: 100 },
        { coast: (m) => l5(m).d < p[1] },
        // Close in: keep matching L5's motion plus a slow drift toward it.
        { control: (m) => { const q = l5(m); return q.d < 20 ? { done: true } : { thrust: q.w > Math.max(0.05, p[3]), angle: q.wa }; }, max: 400 },
        { drop: true },
        { wait: 2 },
        { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe <= p[4] },
        { wait: 5 },
        { coast: (m) => AP.orb(m, 'terra').rising },
        { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= p[5] },
      ];
    },
  },

  junkyard: {
    // Booster falls back by itself; the upper stage is dropped while its path
    // still reenters, and the satellite finishes the climb.
    p: [229.478, 286.108, 0.266, -1.806, 213.012], scale: [5, 8, 0.05, 0.5, 25],
    script: (p) => [{ launch: { body: 'gaia', lo: p[0], hi: p[1], turn: p[2], kick: p[3], dropWhen: (m, o) => m.stage === 1 && o.ap >= p[4] && o.pe < 30 } }],
  },
  apollo: {
    p: [4.73, 425.5, 83.9, 1.17, 27.9, 79], scale: [3, 8, 25, 0.6, 8, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => AP.orb(m, 'luna').r < p[2] },
      { drop: true },
      { burn: p[3], rel: 'luna', until: (m) => AP.orb(m, 'luna').pe >= p[4] },
      { coast: (m) => AP.orb(m, 'luna').rising },
      { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[5]; } },
    ],
  },

  cometprobe: {
    p: [25.78, 2.102, 522.7, 1.222, 0.108], scale: [20, 0.8, 100, 1, 0.3],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', rel: 'sun', max: Math.max(0, p[1]) },
      { coast: (m) => AP.orb(m, 'iris').r < p[2] },
      { drop: true },
      { burn: p[3], rel: 'sun', max: Math.max(0, p[4]) },
    ],
  },

  voyager: {
    p: [7.026, 215.647], scale: [6, 15],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', rel: 'terra', stage: true, until: (m) => AP.orb(m, 'terra').ap >= p[1] },
    ],
  },

  moonnet: {
    p: [2.883, 294.169, 58.19, 48.786, 524.806, 94.761], scale: [3, 8, 4, 30, 15, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'luna'); return o.r < 100 && o.rising; } },
      { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= p[2]; } },
      { drop: true },
      { wait: p[3] },
      { burn: 'pro', rel: 'luna', until: (m) => AP.orb(m, 'terra').ap >= p[4] },
      { coast: (m) => { const o = AP.orb(m, 'selene'); return o.r < 180 && o.rising; } },
      { burn: 'retro', rel: 'selene', until: (m) => { const o = AP.orb(m, 'selene'); return o.bound && o.ap <= p[5]; } },
      { drop: true },
      { wait: 6 },
      { burn: 'retro', rel: 'selene', until: (m) => AP.orb(m, 'selene').pe <= 8 },
    ],
  },

  beltsurvey: {
    // Already on the way out through the belt: nudge onto Ceres, drop,
    // nudge off it onto Pallas, drop, nudge off that, and coast on out.
    p: [-2.415, 1.67, 0.231, -1.509, -1.098, 0.294, -3.73, 2.022, 0.003], scale: [1, 0.3, 0.1, 2, 0.3, 0.1, 2, 0.5, 0.2],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: p[1], rel: 'sun', max: Math.max(0, p[2]) },
      { wait: Math.max(0, p[3]) },
      { drop: true },
      { wait: 1 },
      { burn: p[4], rel: 'sun', max: Math.max(0, p[5]) },
      { wait: Math.max(0, p[6]) },
      { drop: true },
      { wait: 1 },
      { burn: p[7], rel: 'sun', max: Math.max(0, p[8]) },
    ],
  },

  granddeploy: {
    p: [194.087, 188.486, 0.194, -2.645, 249.475, 273.26, 8.219], scale: [4, 4, 0.05, 0.5, 15, 6, 3],
    script: (p, AP) => {
      const lap = [
        { burn: 'pro', until: (m) => AP.orb(m, 'gaia').ap >= p[5] },
        { wait: 20 },
        { coast: (m) => !AP.orb(m, 'gaia').rising },
        { coast: (m) => AP.orb(m, 'gaia').rising },
        { burn: 'retro', until: (m) => { const o = AP.orb(m, 'gaia'); return o.ap - o.pe <= p[6]; } },
        { drop: true },
      ];
      return [
        { launch: { body: 'gaia', lo: p[0], hi: p[1], turn: p[2], kick: p[3], dropWhen: (m, o) => m.stage === 0 && o.ap >= p[4] } },
        // Nose retrograde, so the separation spring pushes the booster up and clear of the lab.
        { fn: (m) => { m.ship.angle = AP.aim(m, 'retro'); } },
        { deploy: true },
        { drop: true },
        ...lap, ...lap.map(st => Object.assign({}, st)),
        { wait: 6 },
        { burn: 'retro', until: (m) => AP.orb(m, 'gaia').pe <= 20 },
      ];
    },
  },
};

// Experimental levels (test: true): one per prototype mechanic.
Object.assign(module.exports, {
  'test-aero': {
    // Lower the low point into the air, let drag capture you, then lift the
    // low point back out at the top of the new orbit.
    p: [7.92, 72.47, 101, 1.762], scale: [5, 1.5, 4, 0.3],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      // Far out you are falling almost straight in: push against the small
      // sideways part of your motion, not against all of it.
      { burn: p[3], rel: 'thule', until: (m) => AP.orb(m, 'thule').pe <= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'thule'); return o.bound && o.r > 120 && o.rising; } },
      { coast: (m) => !AP.orb(m, 'thule').rising },
      { burn: 'pro', rel: 'thule', until: (m) => AP.orb(m, 'thule').pe >= p[2] },
    ],
  },

  'test-wormhole': {
    // A transfer that crosses Mouth A on the way up, not at its high point,
    // comes out of Mouth B angled toward Elysium.
    p: [48.28, 295], scale: [2, 30],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
    ],
  },

  'test-tether': {
    // Latch just past the closest point (the rope is nearly taut, so little
    // speed is lost), swing round, and let go when the path points at the gate.
    p: [0, 0], scale: [0.4, 0.08],
    script: (p, AP) => {
      const rel = (m) => { m.sys.update(m.t); const i = m.sys.byId.post.index; return { x: m.ship.x - m.sys.px[i], y: m.ship.y - m.sys.py[i] }; };
      const toGate = (m) => Math.atan2(330 - m.ship.y, -420 - m.ship.x);
      return [
        { coast: (m) => { const r = rel(m); return m.tetherInRange() >= 0 && r.x * m.ship.vx + r.y * m.ship.vy >= p[0]; } },
        { fn: (m) => m.toggleTether() },
        { wait: 5 },
        { coast: (m) => Math.abs(AP.wrap(Math.atan2(m.ship.vy, m.ship.vx) - toGate(m) - p[1])) < 0.02 },
        { fn: (m) => m.toggleTether() },
      ];
    },
  },

  'test-sail': {
    // Hold the sail p[0] rad off straight-out, on the prograde side. If the
    // orbit gets lopsided (high minus low over p[3]), only sail on the high
    // half. Once it fits, turn the sail edge-on to the light.
    p: [0.6, 462, 508, 20], scale: [0.1, 6, 6, 8],
    script: (p, AP) => [
      { control: (m) => {
        const o = AP.orb(m, 'sol');
        if (o.pe >= p[1] && o.ap <= p[2]) return { done: true };
        const push = o.ap - o.pe < p[3] || o.r > o.a;
        return { thrust: false, angle: o.theta + o.dir * (push ? p[0] : Math.PI / 2), dt: 0.25 };
      } },
      { control: (m) => ({ thrust: false, angle: AP.orb(m, 'sol').theta + Math.PI / 2, dt: 0.25 }) },
    ],
    // Turns with the real side thrusters: the sail is steered by rotation alone.
    opts: { turn: true, turnRate: 0.3 },
  },

  'test-horizon': {
    // Push sideways toward Maw's line for p[0] seconds: the pass drops from
    // about 200 to about 110, inside the unstable ring, and the whirl swings
    // the path round to the gate.
    p: [0.9], scale: [0.01],
    script: (p) => [{ burn: () => Math.PI / 2, max: Math.max(0, p[0]) }],
  },

  'test-belt': {
    // A transfer aimed well past the target orbit (high point p[0]) crosses
    // the belt fast; at radius p[1], brake straight onto a circular orbit.
    p: [420, 362], scale: [20, 4],
    script: (p, AP) => [
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
      { coast: (m) => AP.orb(m, 'terra').r >= p[1] },
      { control: (m) => {
        const o = AP.orb(m, 'terra');
        const vc = Math.sqrt(20000 / o.r), ux = -Math.sin(o.theta) * vc, uy = Math.cos(o.theta) * vc;
        m.sys.update(m.t);
        const dx = ux - m.ship.vx, dy = uy - m.ship.vy;
        if (Math.hypot(dx, dy) < 0.05) return { done: true };
        return { thrust: true, angle: Math.atan2(dy, dx) };
      } },
    ],
  },

  'test-depot': {
    // Hohmann up to the depot, close in and match its speed, then (tank
    // refilled) Hohmann on up to the high orbit.
    p: [5.35, 198.8, 640, 615], scale: [0.3, 2, 10, 10],
    script: (p, AP) => [
      { wait: Math.max(0, p[0]) },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => { m.sys.update(m.t); const i = m.sys.byId.halley.index; return Math.hypot(m.ship.x - m.sys.px[i], m.ship.y - m.sys.py[i]) < 12 || m.t > 70; } },
      { control: (m) => {
        if (m.goalIndex > 0) return { done: true };
        m.sys.update(m.t);
        // Aim for a spot 3.5 behind the depot, not the depot itself.
        const i = m.sys.byId.halley.index, u = Math.hypot(m.sys.vx[i], m.sys.vy[i]);
        const dx = m.sys.px[i] - 3.5 * m.sys.vx[i] / u - m.ship.x, dy = m.sys.py[i] - 3.5 * m.sys.vy[i] / u - m.ship.y;
        const d = Math.hypot(dx, dy), k = Math.min(0.3, 0.06 * d) / Math.max(d, 1e-9);
        const ex = m.sys.vx[i] + dx * k - m.ship.vx, ey = m.sys.vy[i] + dy * k - m.ship.vy;
        if (Math.hypot(ex, ey) < 0.05) return { thrust: false, dt: 0.05 };
        return { thrust: true, angle: Math.atan2(ey, ex) };
      } },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[2] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe >= p[3] },
    ],
  },

  'test-softland': {
    // Kill most of the orbital speed, fall, and fire against the motion
    // (relative to the turning ground) whenever it's faster than you could
    // still stop in the height left: √(p[1]² + 2·p[2]·(a − g)·height).
    p: [5.5, 1.1, 0.9], scale: [0.5, 0.1, 0.05],
    script: (p, AP) => [
      { burn: 'retro', rel: 'dust', until: (m) => AP.orb(m, 'dust').v <= Math.max(0, p[0]) },
      { control: (m) => {
        const sys = m.sys, i = sys.byId.dust.index, b = sys.bodies[i];
        sys.update(m.t);
        const dx = m.ship.x - sys.px[i], dy = m.ship.y - sys.py[i], r = Math.hypot(dx, dy), h = r - b.radius;
        const ux = m.ship.vx - sys.vx[i] + b.spin * dy, uy = m.ship.vy - sys.vy[i] - b.spin * dx, v = Math.hypot(ux, uy);
        const brake = Math.max(0.1, m.thrustAccel() - b.gm / (r * r));
        const thrust = v > Math.sqrt(p[1] * p[1] + 2 * p[2] * brake * Math.max(0, h));
        return thrust ? { thrust: true, angle: Math.atan2(-uy, -ux) } : { thrust: false, dt: 1 / 120 };
      } },
    ],
  },

  'test-ion': {
    // Burn prograde the whole way, turning with it: a slow spiral that
    // stays nearly round. Stop once the orbit sits inside the band.
    p: [118, 132], scale: [2, 2],
    script: (p, AP) => [
      { burn: 'pro', rel: 'terra', until: (m) => { const o = AP.orb(m, 'terra'); return o.pe >= p[0] && o.ap <= p[1]; } },
    ],
  },
});

// World 3: each chapter file keeps its levels, proofs and naive "fails" together.
for (const ch of ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']) Object.assign(module.exports, require('./w3/' + ch).proofs);
