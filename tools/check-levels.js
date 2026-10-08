// Headless solvability check: searches for a burn program that beats each
// level, using a simple autopilot (point at prograde + offset, burn for a
// duration). Prints the best Δv found so `par` values can be calibrated.
//   node tools/check-levels.js [levelId] [iterations]
'use strict';
globalThis.Phys = require('../js/physics.js');
const { Mission } = require('../js/flight.js');
const { LEVELS } = require('../js/levels.js');

function run(level, prog, wantTrace) {
  const m = new Mission(level);
  let best = Infinity, goalAt = 0;
  const burns = prog.map(b => Object.assign({}, b));
  let k = 0;
  const CH = 0.25;
  while (m.status === 'flying') {
    const b = burns[k];
    let thrust = false;
    if (b && m.t >= b.t) {
      if (!b.started) {
        b.started = true; b.end = m.t + b.dur;
        if (level.ship.canRotate) {
          const s = m.ship, sys = m.sys;
          const ref = sys.dominant(s.x, s.y, m.t);
          sys.update(m.t);
          s.angle = (level.check.absolute ? 0 : Math.atan2(s.vy - sys.vy[ref], s.vx - sys.vx[ref])) + b.off;
          s.omega = 0;
        }
      }
      if (m.t < b.end) thrust = true; else k++;
    }
    const step = thrust || (b && b.t - m.t < CH) ? 1 / 120 : CH;
    m.advance(step, { thrust, throttle: 1, rotate: 0 });
    const g = m.currentGoal();
    if (m.goalIndex > goalAt) { goalAt = m.goalIndex; best = Infinity; }
    if (g) {
      const p = m.goalPoint(g);
      let d = Math.hypot(m.ship.x - p.x, m.ship.y - p.y);
      if (g.type === 'orbit') d = (m.goalErr != null ? m.goalErr : Math.max(0, g.rMin - d, d - g.rMax)) + 40 * (1 - m.holdTime / (g.confirm || 3));
      if (g.type === 'rendezvous') d += 10 * Math.hypot(m.ship.vx - p.vx, m.ship.vy - p.vy);
      if (g.type === 'hold') d = (m.goalErr != null ? m.goalErr : Math.max(0, d - g.r)) + 40 * (1 - m.holdTime / g.hold);
      if (g.type === 'escape') d = Math.max(0, g.r - d);
      if (g.site) {
        const b = m.sys.byId[g.body], a = g.site.angle + b.spin * m.t;
        d = Math.hypot(m.ship.x - p.x - b.radius * Math.cos(a), m.ship.y - p.y - b.radius * Math.sin(a));
      }
      best = Math.min(best, d);
    }
  }
  const won = m.status === 'won';
  const cost = won ? m.dvUsed() : 1000 * (level.goals.length - m.goalIndex) + best + m.dvUsed() * 0.1;
  return { cost, won, dv: m.dvUsed(), status: m.status, t: m.t, m };
}

// Program encoding: params → burns with sequential times.
function decode(p, nb) {
  const burns = []; let t = 0;
  for (let i = 0; i < nb; i++) {
    t += Math.max(0, p[i * 3]);
    burns.push({ t, off: p[i * 3 + 1], dur: Math.max(0, p[i * 3 + 2]) });
    t += Math.max(0, p[i * 3 + 2]);
  }
  return burns;
}

function search(level, iters, seed) {
  const nb = level.check.burns;
  const scale = level.check.scale;
  let rnd = seed || 1;
  const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  let bestP = level.check.guess.slice(), best = run(level, decode(bestP, nb));
  let sigma = 1;
  for (let it = 0; it < iters; it++) {
    const p = bestP.map((v, i) => v + (rand() * 2 - 1) * scale[i] * sigma);
    const r = run(level, decode(p, nb));
    if (r.cost < best.cost) { best = r; bestP = p; }
    if (it % 200 === 199) sigma = Math.max(0.05, sigma * 0.7);
  }
  return { best, p: bestP };
}

// Autopilot search spaces: per burn [wait, heading offset from prograde, duration].
const CHECK = {
  liftoff: { burns: 1, guess: [0, 0, 2], scale: [1, 0, 1] },
  point: { burns: 1, absolute: true, guess: [0, 0.36, 2], scale: [2, 0.1, 1] },
  stop: { burns: 2, absolute: true, guess: [0, 0, 2, 183, Math.PI, 2], scale: [1, 0.05, 0.3, 10, 0.05, 0.3] },
  circularize: { burns: 1, guess: [0, 0, 2.5], scale: [2, 0.2, 0.8] },
  deorbit: { burns: 1, guess: [0, Math.PI, 3], scale: [5, 0.3, 1] },
  landing: { burns: 1, guess: [9, Math.PI, 2.5], scale: [2, 0.1, 0.4] },
  wrongway: { burns: 3, guess: [0, 0, 2.5, 500, Math.PI, 1.4, 500, Math.PI, 2.2], scale: [2, 0.1, 0.5, 30, 0.1, 0.4, 30, 0.2, 0.5] },
  freereturn: { burns: 2, guess: [5, 0, 4.2, 100, 0, 0], scale: [10, 0.2, 0.5, 100, 3, 0.3] },
  moon2moon: { burns: 2, guess: [5, 0, 2.5, 100, 0, 0], scale: [20, 0.3, 1, 100, 3, 0.5] },
  lagrange: { burns: 3, guess: [10, 0, 2.6, 60, 0, 2, 5, 0, 0], scale: [100, 0.2, 0.6, 20, 0.3, 0.6, 20, 3, 0.4] },
  belt: { burns: 2, guess: [5, 0, 4, 50, 0, 0], scale: [40, 0.2, 1, 100, 3, 0.4] },
  skimmer: { burns: 2, guess: [0, Math.PI, 2.6, 24, Math.PI, 2.5], scale: [5, 0.1, 0.6, 6, 0.2, 0.6] },
  cycler: { burns: 3, guess: [10.9, 0.167, 2.77, 79, 0, 0, 100, 0, 0], scale: [3, 0.1, 0.3, 100, 3, 0.4, 100, 3, 0.4] },
  constellation: { burns: 3, guess: [0, Math.PI, 0.5, 30, 0, 0, 30, 0, 0], scale: [5, 0.3, 0.4, 80, 3, 0.5, 80, 3, 0.5] },
  rescue: { burns: 3, guess: [10, 0, 2, 40, 0, 1, 5, 0, 0], scale: [60, 0.5, 1, 40, 3, 0.8, 30, 3, 0.5] },
  moonlanding: { burns: 1, guess: [5, Math.PI, 2.2], scale: [30, 0.2, 0.6] },
  trojan: { burns: 2, guess: [0, 0, 0.4, 500, Math.PI, 0.4], scale: [20, 0.1, 0.3, 300, 0.2, 0.3] },
  sundiver: { burns: 1, guess: [0, Math.PI, 5], scale: [5, 0.1, 1.5] },
  eventhorizon: { burns: 1, guess: [92, 0, 0.8], scale: [3, 0.1, 0.3] },
  juggler: { burns: 4, guess: [0, -0.52, 1.55, 294, 3.26, 0, 60, 1.73, 0, 60, 1.22, 1.93], scale: [200, 0.3, 0.4, 150, 0.4, 0.4, 150, 3, 0.6, 150, 3, 0.6] },
  'test-fuel': { burns: 2, guess: [5, 0, 2.6, 40, 0, 3], scale: [40, 0.2, 0.5, 60, 0.4, 1] },
  turn: { burns: 2, guess: [0.5, 0, 2.5, 36, 0, 2.0], scale: [5, 0.3, 1, 8, 0.3, 1] },
  moonshot: { burns: 1, guess: [5, 0, 4.2], scale: [10, 0.2, 1] },
  inertia: { burns: 3, guess: [106, Math.PI, 1.3, 63, Math.PI, 1.45, 2, 0, 0], scale: [10, 0.2, 0.5, 5, 0.2, 0.5, 5, 3, 0.3] },
  capture: { burns: 2, guess: [5, 0, 4.2, 78, Math.PI, 2.5], scale: [5, 0.2, 0.8, 8, 0.3, 0.8] },
  slingshot: { burns: 2, guess: [18, 0, 2.5, 10, 0, 0], scale: [5, 0.2, 0.5, 40, 3, 0.3] },
  twins: { burns: 2, guess: [5, 0, 6, 30, 0, 0], scale: [30, 0.5, 2, 60, 3, 1] },
  interplanetary: { burns: 2, guess: [15, 0, 1.9, 60, 0, 0], scale: [5, 0.2, 0.4, 60, 3, 0.3] },
  comet: { burns: 2, guess: [20, 0, 4, 200, 0, 0], scale: [60, 0.5, 2, 200, 3, 1] },
  tour: { burns: 3, guess: [5, 0, 3, 60, 0, 0, 60, 0, 0], scale: [30, 0.3, 1.5, 60, 3, 1, 60, 3, 1] },
};
for (const l of LEVELS) if (CHECK[l.id]) l.check = CHECK[l.id];

const only = process.argv[2];
const iters = +process.argv[3] || 1500;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  if (!level.check) { console.log(level.id, 'no check config'); continue; }
  const t0 = Date.now();
  const { best, p } = search(level, iters, 7);
  const budget = new Mission(level).dv0;
  console.log(`${level.id.padEnd(15)} ${best.won ? 'SOLVED ' : 'FAILED '} dv=${best.dv.toFixed(2)} / ${budget.toFixed(2)} par=${level.par} ` +
    `status=${best.status} t=${best.t.toFixed(0)} cost=${best.cost.toFixed(2)} (${Date.now() - t0}ms)`);
  console.log('   params', JSON.stringify(p.map(v => +v.toFixed(3))));
}
