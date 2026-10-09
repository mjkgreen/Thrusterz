// Scripted flight plans that prove each World 2 mission can be won.
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
    p: [208.4, 200], scale: [10, 5],
    script: (p, AP) => [
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', rel: 'terra', stage: true, until: (m) => AP.orb(m, 'terra').pe >= p[1] },
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
    p: [4.73, 425.477, 83.882, 1.17, 27.923, 79.021], scale: [3, 8, 30, 0.6, 10, 10],
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

  'test-keepout': {
    p: [-6.026, 288.216, 149.765, 156.874, 249.37], scale: [15, 10, 15, 20, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => { m.sys.update(m.t); const i = m.sys.byId.haven.index; return Math.hypot(m.ship.x - m.sys.px[i], m.ship.y - m.sys.py[i]) < p[2]; } },
      { drop: true },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe <= p[3] },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= p[4] },
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

  'test-patrol': {
    // Wait for a gap between the guards, then a Hohmann climb through it.
    p: [41.552, 305.444, 300.404], scale: [40, 10, 10],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
    ],
  },

  'test-berth': {
    // One burn onto a wide pass behind Goliath, outside its keep-out zone.
    p: [54, 2.8], scale: [6, 0.3],
    script: (p) => [{ wait: p[0] }, { burn: 'pro', max: p[1] }],
  },

  twinprobes: {
    p: [13.029, 257.144, 0.333, 458.463, -43.355, -0.089, -0.805], scale: [10, 8, 20, 10, 30, 2, 1.5],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
      { wait: p[2] },
      { drop: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[3] },
      { wait: p[4] },
      { drop: true },
      { burn: p[6], max: Math.max(0, p[5]) },
      // Then settle the carrier into a safe orbit of its own.
      { wait: 30 },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 120 },
      { wait: 10 },
      { coast: (m) => AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').ap <= 550 },
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
    p: [9.747, 1415.741, 140.892], scale: [6, 30, 20],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', rel: 'terra', until: (m) => AP.orb(m, 'sun').ap >= p[1] },
      { coast: (m) => { const o = AP.orb(m, 'rust'); return o.r < 280 && o.rising; } },
      { burn: 'retro', rel: 'rust', stage: true, until: (m) => { const o = AP.orb(m, 'rust'); return o.bound && o.ap <= p[2]; } },
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
    p: [272.2, 60.8, 220], scale: [10, 4, 4],
    script: (p, AP) => [
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[0] },
      { coast: (m) => !AP.orb(m, 'terra').rising },
      { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[1] },
      // Turn prograde first: the separation spring pushes the stage the
      // opposite way from your nose, here further down.
      { fn: (m) => { m.ship.angle = AP.aim(m, 'pro'); } },
      { deploy: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
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
    p: [2.659, 291.35, 60.49, 20.42, 522.83, 86.08], scale: [3, 8, 8, 30, 15, 10],
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
    p: [28.617, 688.006, 1.744, 852.925, 6.74, 1060.627], scale: [20, 15, 30, 15, 40, 40],
    script: (p, AP) => [
      { wait: p[0] },
      { burn: 'pro', until: (m) => AP.orb(m, 'sun').ap >= p[1] },
      { wait: p[2] },
      { drop: true },
      { burn: 'pro', until: (m) => AP.orb(m, 'sun').ap >= p[3] },
      { wait: p[4] },
      { drop: true },
      { wait: 2 },
      { burn: 'pro', until: (m) => AP.orb(m, 'sun').ap >= p[5] },
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
