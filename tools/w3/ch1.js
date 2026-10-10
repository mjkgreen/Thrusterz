// World 3, chapter 1: Keep Out. Keep-out zones on their own (ship only).
'use strict';
const { ship, C } = require('../../js/levels.js');

// Distance from the ship to a body's centre.
const dist = (m, id) => {
  m.sys.update(m.t);
  const i = m.sys.byId[id].index;
  return Math.hypot(m.ship.x - m.sys.px[i], m.ship.y - m.sys.py[i]);
};

// Distance from the ship to the current goal's point (e.g. a Lagrange point).
const goalDist = (m) => {
  const g = m.currentGoal(), P = m.goalPoint(g);
  return Math.hypot(m.ship.x - P.x, m.ship.y - P.y);
};

// Station-keeping on a moving point: steer the velocity toward
// (point's velocity + a slow approach), burning only when the error is worth it.
function park(k, vMax) {
  return {
    control: (m, ctx) => {
      if (m.status !== 'flying') return { done: true };
      const g = m.currentGoal(), P = m.goalPoint(g), s = m.ship;
      const dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(vMax, k * d);
      const ex = P.vx + sp * dx / d - s.vx, ey = P.vy + sp * dy / d - s.vy, e = Math.hypot(ex, ey);
      if (ctx.burning ? e < 0.02 : e < 0.08) { ctx.burning = false; return { thrust: false, angle: null, dt: 0.1 }; }
      ctx.burning = true;
      return { thrust: true, angle: Math.atan2(ey, ex), tol: 0.1 };
    },
  };
}

// Crowded Trojans: Luna's mean motion (its rail includes its own mass), so
// the massless debris cloud rides exactly 60° ahead of it.
const TROJAN_MU = 20000 + 30;

module.exports = {
  levels: [
    {
      id: 'nofly',
      name: 'No-Fly Zone',
      intro: 'A guard satellite circles between your low orbit and the high orbit you need, inside a red keep-out zone that moves with it. Your dashed path turns red where it would cross the zone. Wait until the guard has gone by, then burn prograde to climb and round off your orbit at the top.',
      objective: 'Orbit Terra between 280 and 360 without entering the guard\'s keep-out zone.',
      teaches: 'Keep-out zones',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'guard', name: 'Guard', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 60, orbit: { parent: 'terra', a: 210, phase: 1.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 280, rMax: 360 }],
      par: 5, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 800 },
    },
    {
      id: 'patrol',
      name: 'Patrol',
      intro: 'Three guard satellites now patrol the orbit between you and the high orbit you need, each inside a red keep-out zone that moves with it. The gaps between them are narrower, and the climb has to fit through one all the way up. Watch where your dashed path turns red, wait for a gap, then climb through it and round off your orbit up top.',
      objective: 'Orbit Terra between 300 and 360 without entering any keep-out zone.',
      teaches: 'Moving keep-out zones',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'guard1', name: 'Guard 1', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 55, orbit: { parent: 'terra', a: 220, phase: 1.2 } },
        { id: 'guard2', name: 'Guard 2', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 55, orbit: { parent: 'terra', a: 220, phase: 1.2 + 2 * Math.PI / 3 } },
        { id: 'guard3', name: 'Guard 3', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 55, orbit: { parent: 'terra', a: 220, phase: 1.2 + 4 * Math.PI / 3 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0 } }, heading: 'prograde', dv: 7.5, accel: 1 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 300, rMax: 360 }],
      par: 5.3, bounds: 2000, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 800 },
    },
    {
      id: 'supplyrun',
      name: 'Supply Run',
      intro: 'You are already coasting up to Haven Station, on a path that carries you into its red keep-out zone in about half a minute. The pod is on the right path, you are not: drop it (E) soon so it drifts in on its own, then brake away before the zone and settle into a lower orbit. The later you drop, the harder you have to brake.',
      objective: 'Deliver the pod to Haven Station without entering the keep-out zone, then orbit Terra between 100 and 250.',
      teaches: 'Dropping cargo into a keep-out zone',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'haven', name: 'Haven Station', gm: 0, radius: 4, color: C.station, kind: 'station', keepOut: 45, orbit: { parent: 'terra', a: 300, phase: 1.47 } },
      ],
      ship: ship({ start: { conic: { body: 'terra', pe: 150, e: 0.33, nu: 1.0, angle: 0 } }, heading: 'prograde', dv: 1, accel: 1, cargo: [{ id: 'pod', name: 'Pod', mass: 0.3 }] }),
      goals: [
        { type: 'reach', body: 'haven', craft: 'pod', r: 12, label: 'Docking arm' },
        { type: 'orbit', body: 'terra', rMin: 100, rMax: 250 },
      ],
      par: 0.6, bounds: 2000, tMax: 600, predict: 200, view: { x: 0, y: 0, span: 760 },
    },
    {
      id: 'wideberth',
      name: 'Wide Berth',
      intro: 'Slingshot again, but Goliath now has a radiation belt: no ship may come inside its red keep-out zone. A wider pass behind Goliath still bends your path, just less, so you need a little more speed going in.',
      objective: 'Fly through the Jump Gate without entering Goliath\'s keep-out zone.',
      teaches: 'Gravity assist around a keep-out zone',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'goliath', name: 'Goliath', gm: 5000, radius: 26, color: C.tan, keepOut: 110, orbit: { parent: 'terra', a: 350, phase: 2.0 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 5.5, accel: 1 }),
      goals: [{ type: 'reach', x: -1500, y: 0, r: 120, label: 'Jump Gate' }],
      par: 3.7, bounds: 3500, tMax: 1800, predict: 300, view: { x: -500, y: 0, span: 2400 },
    },
    {
      id: 'hotmoon',
      name: 'Hot Moon',
      intro: 'You are falling toward Luna and will plunge into its radiation belt in about 15 seconds: no ship may come inside the red keep-out zone. Act now. Burn early to swing your closest pass out past the zone (braking and pushing sideways at once works well), then burn retrograde at closest approach to get captured. Press V to view your path relative to Luna.',
      objective: 'Get captured into an orbit around Luna that stays between 60 and 110, without entering its keep-out zone.',
      teaches: 'Capture outside a keep-out zone',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, keepOut: 50, orbit: { parent: 'terra', a: 400, phase: 0 } },
      ],
      ship: ship({ start: { conic: { body: 'luna', pe: 20, e: 1.105, nu: -2.28, angle: 4.0 } }, heading: 'prograde', dv: 7.2, accel: 1 }),
      goals: [{ type: 'orbit', body: 'luna', rMin: 60, rMax: 110 }],
      par: 5, bounds: 2500, tMax: 400, predict: 160, view: { x: 400, y: 0, span: 600 },
    },
    {
      id: 'crowdedtrojans',
      name: 'Crowded Trojans',
      intro: 'You share Luna\'s orbit just ahead of its L4 point, slowly drifting back toward it, but L4 has filled with a debris cloud nobody may enter. Park at L5, 60° behind Luna, instead. A higher orbit drifts you backwards, a lower one forwards: pick the way round that keeps you out of the cloud.',
      objective: 'Park at L5: stay within 40 of it, moving with it, for 30 s, without entering the debris cloud.',
      teaches: 'Choosing the direction of drift',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 30, radius: 14, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 0 } },
        { id: 'cloud', name: 'Debris Cloud', gm: 0, radius: 6, color: C.rock, kind: 'station', keepOut: 70, orbit: { parent: 'terra', a: 400, phase: Math.PI / 3, mu: TROJAN_MU } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 400, angle: 1.75 } }, heading: 'prograde', dv: 1.5, accel: 0.8 }),
      goals: [{ type: 'hold', lagrange: { body: 'luna', lead: -Math.PI / 3 }, r: 40, relVel: 0.2, hold: 30, label: 'L5' }],
      par: 0.9, bounds: 2500, tMax: 2400, predict: 400, view: { x: 0, y: 0, span: 1000 },
    },
  ],

  proofs: {
    nofly: {
      // Let the guard pass, then a Hohmann climb behind it.
      p: [15.891, 283.311, 280.112], scale: [30, 10, 10],
      script: (p, AP) => [
        { wait: p[0] },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
      ],
    },
    patrol: {
      // Wait for a gap between the guards, then a Hohmann climb through it.
      p: [20.434, 304.23, 300.635], scale: [10, 10, 10],
      script: (p, AP) => [
        { wait: p[0] },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= p[1] },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= p[2] },
      ],
    },
    supplyrun: {
      // Already on the way in: drop the pod early, then brake away and down.
      p: [192.97, 160.627, 250.321], scale: [30, 20, 5],
      script: (p, AP) => [
        { coast: (m) => dist(m, 'haven') < p[0] },
        { drop: true },
        { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe <= p[1] },
        { coast: (m) => AP.orb(m, 'terra').rising },
        { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= p[2] },
      ],
    },
    wideberth: {
      // One burn onto a wide pass behind Goliath, outside its keep-out zone.
      p: [52.373, 2.754], scale: [6, 0.3],
      script: (p) => [{ wait: p[0] }, { burn: 'pro', max: p[1] }],
    },
    hotmoon: {
      // Push the closest pass out past the belt early, then capture at closest approach.
      p: [-2.034, 2.012, 5.823], scale: [0.3, 0.4, 5],
      script: (p, AP) => [
        { burn: p[0], rel: 'luna', max: p[1] },
        { coast: (m) => AP.orb(m, 'luna').rising },
        { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= 100 + p[2]; } },
      ],
    },
    crowdedtrojans: {
      // Drop lower to drift forward the long way round, then circularize at L5.
      p: [0.033, 320.204, 69.32, -0.037, 0.006, 0.132], scale: [10, 4, 20, 0.05, 0.002, 0.05],
      script: (p, AP) => [
        { wait: p[0] },
        { burn: 'retro', until: (m) => AP.orb(m, 'terra').pe <= p[1] },
        { coast: (m) => { const o = AP.orb(m, 'terra'); return goalDist(m) < p[2] && o.ap - o.r < 2; } },
        { burn: 'pro', until: (m) => { const P = m.goalPoint(m.currentGoal()), s = m.ship, o = AP.orb(m, 'terra'); return (s.vx - P.vx) * Math.cos(o.pro) + (s.vy - P.vy) * Math.sin(o.pro) >= p[3]; } },
        park(p[4], p[5]),
      ],
    },
  },

  fails: {
    nofly: [{
      name: 'climb at once',
      steps: (AP) => [
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 320 },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 300 },
      ],
    }],
    patrol: [{
      name: 'climb at once',
      steps: (AP) => [
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 305 },
        { coast: (m) => !AP.orb(m, 'terra').rising },
        { burn: 'pro', until: (m) => AP.orb(m, 'terra').pe >= 300 },
      ],
    }],
    supplyrun: [{
      name: 'do nothing',
      steps: () => [],
    }, {
      name: 'carry the pod in',
      steps: () => [{ coast: (m) => dist(m, 'haven') < 30 }, { drop: true }],
    }, {
      name: 'dawdle: drop late, then brake',
      steps: (AP) => [
        { coast: (m) => dist(m, 'haven') < 60 },
        { drop: true },
        { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').pe <= 160 },
        { coast: (m) => AP.orb(m, 'terra').rising },
        { burn: 'retro', rel: 'terra', until: (m) => AP.orb(m, 'terra').ap <= 250 },
      ],
    }],
    wideberth: [{
      name: 'close Slingshot pass',
      steps: () => [{ wait: 54 }, { burn: 'pro', max: 2.5 }],
    }],
    hotmoon: [{
      name: 'do nothing',
      steps: () => [],
    }, {
      name: 'capture at closest approach only',
      steps: (AP) => [
        { coast: (m) => AP.orb(m, 'luna').rising },
        { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= 100; } },
      ],
    }, {
      name: 'dawdle 15 s, then fix it',
      steps: (AP) => [
        { wait: 15 },
        { burn: -2.0, rel: 'luna', max: 5 },
        { coast: (m) => AP.orb(m, 'luna').rising },
        { burn: 'retro', rel: 'luna', until: (m) => { const o = AP.orb(m, 'luna'); return o.bound && o.ap <= 100; } },
      ],
    }],
    crowdedtrojans: [{
      name: 'climb a little and drift back past L4',
      steps: (AP) => [{ burn: 'pro', until: (m) => AP.orb(m, 'terra').ap >= 440 }],
    }, {
      name: 'do nothing',
      steps: () => [],
    }],
  },
};
