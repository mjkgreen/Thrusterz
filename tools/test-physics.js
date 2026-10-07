// Sanity tests for the physics core: node tools/test-physics.js
'use strict';
const Phys = require('../js/physics.js');
globalThis.Phys = Phys;
const { Mission } = require('../js/flight.js');
const { LEVELS } = require('../js/levels.js');
let failed = 0;
const check = (name, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) failed++; };

// 1. Circular orbit around a lone planet conserves energy and radius.
{
  const sys = new Phys.System([{ id: 'p', name: 'P', gm: 20000, radius: 50 }]);
  const s = { x: 100, y: 0, vx: 0, vy: Math.sqrt(200) };
  const E0 = 100 - 200;
  let t = 0;
  while (t < 1000) { const dt = Phys.coastDt(sys, s, t, 0.002, 0.25); Phys.rk4(sys, s, t, dt, 0, 0); t += dt; }
  const r = Math.hypot(s.x, s.y), E = (s.vx * s.vx + s.vy * s.vy) / 2 - 20000 / r;
  check('circular orbit energy drift < 0.1%', Math.abs(E - E0) / Math.abs(E0) < 1e-3, `E=${E.toFixed(4)}`);
}

// 2. Rails velocity is the time derivative of rails position (incl. eccentric + reflex).
{
  const L = LEVELS.find(l => l.id === 'comet');
  const sys = new Phys.System(L.bodies.concat([{ id: 'm', name: 'M', gm: 500, radius: 5, orbit: { parent: 'iris', a: 40 } }]));
  let worst = 0;
  for (const t of [0, 13.7, 420, 1999]) {
    const h = 1e-4;
    sys.update(t + h); const ax = Array.from(sys.px), ay = Array.from(sys.py);
    sys.update(t - h); const bx = Array.from(sys.px), by = Array.from(sys.py);
    sys.update(t);
    for (let i = 0; i < sys.bodies.length; i++) {
      worst = Math.max(worst, Math.abs((ax[i] - bx[i]) / (2 * h) - sys.vx[i]), Math.abs((ay[i] - by[i]) / (2 * h) - sys.vy[i]));
    }
  }
  check('rails velocity matches position derivative', worst < 1e-3, `max err ${worst.toExponential(2)}`);
}

// 3. Every orbital level's parking orbit is stable while coasting.
for (const L of LEVELS) {
  if (!L.ship.start.orbit || L.ship.start.orbit.speed) continue;
  const m = new Mission(L);
  const host = m.sys.byId[L.ship.start.orbit.body].index, r0 = L.ship.start.orbit.r;
  let worst = 0;
  while (m.status === 'flying' && m.t < 400) {
    m.advance(0.5, { thrust: false, throttle: 1, rotate: 0 });
    m.sys.update(m.t);
    worst = Math.max(worst, Math.abs(Math.hypot(m.ship.x - m.sys.px[host], m.ship.y - m.sys.py[host]) - r0) / r0);
  }
  check(`${L.id}: parking orbit stable for 400s`, m.status === 'flying' && worst < 0.1, `max radius drift ${(worst * 100).toFixed(1)}%`);
}

// 4. Rocket equation: burning the whole tank yields the advertised Δv.
{
  const L = LEVELS.find(l => l.id === 'turn');
  const m = new Mission(L);
  const vx0 = m.ship.vx, vy0 = m.ship.vy, dv0 = m.dv0;
  // Burn in deep space conditions: disable gravity by moving far away.
  m.sys.grav = [];
  while (m.dvRemaining() > 1e-9) m.advance(0.1, { thrust: true, throttle: 1, rotate: 0 });
  const dv = Math.hypot(m.ship.vx - vx0, m.ship.vy - vy0);
  check('full-tank burn gives budgeted Δv', Math.abs(dv - dv0) < 0.05, `dv=${dv.toFixed(3)} budget=${dv0.toFixed(3)}`);
}

// 5. Gyro assist caps the rating at two stars.
{
  const L = LEVELS.find(l => l.id === 'deorbit');
  const fly = (gyro) => {
    const m = new Mission(L);
    m.gyro = gyro;
    const s = m.ship; s.angle += Math.PI;
    while (m.status === 'flying') m.advance(0.05, { thrust: m.t < 2.8, throttle: 1, rotate: 0 });
    return m;
  };
  const plain = fly(false), assisted = fly(true);
  check('unassisted deorbit earns 3 stars', plain.stars() === 3, `status=${plain.status} dv=${plain.dvUsed().toFixed(2)}`);
  check('gyro-assisted run is capped at 2 stars', assisted.status === 'won' && assisted.stars() === 2);
}

process.exit(failed ? 1 : 0);
