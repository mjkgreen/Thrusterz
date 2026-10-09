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

// 2b. posAt (one body, no side effects) matches the full update for every body.
{
  let worst = 0;
  for (const L of LEVELS) {
    const sys = new Phys.System(L.bodies), out = [0, 0];
    for (const t of [0, 77.7, 1234.5]) {
      sys.update(t);
      for (let i = 0; i < sys.bodies.length; i++) {
        sys.posAt(i, t, out);
        worst = Math.max(worst, Math.abs(out[0] - sys.px[i]), Math.abs(out[1] - sys.py[i]));
      }
    }
  }
  check('posAt matches update() for every body in every level', worst < 1e-9, `max err ${worst.toExponential(2)}`);
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

// 6. Deploying drops the booster's mass: the payload alone has its own Δv,
//    and the dropped stage keeps flying as debris.
{
  const L = LEVELS.find(l => l.id === 'satellite');
  const m = new Mission(L);
  const total = m.dvRemaining();
  m.landed = null; // pretend we're already flying
  m.stages[0].fuel = 0;
  const before = m.mass();
  const ok = m.deploy();
  const payloadDv = m.dvRemaining();
  check('deploy releases the payload', ok && m.stage === 1 && m.debris.length === 1 && m.mass() < before);
  check('payload keeps its own small tank', Math.abs(payloadDv - m.stageDv0[1]) < 0.01 && payloadDv < total / 2, `payload Δv=${payloadDv.toFixed(2)} of total ${total.toFixed(2)}`);
  check('cannot deploy past the last stage', !m.deploy());
}

// 7. Flying through a fuel canister adds its Δv once.
{
  const L = LEVELS.find(l => l.id === 'test-fuel');
  const m = new Mission(L);
  const can = m.sys.byId.canister;
  m.sys.update(m.t);
  const dv0 = m.dvRemaining();
  Object.assign(m.ship, { x: m.sys.px[can.index], y: m.sys.py[can.index], vx: m.sys.vx[can.index], vy: m.sys.vy[can.index] });
  m._checks(0);
  const gained = m.dvRemaining() - dv0;
  m._checks(0);
  check('canister adds its Δv', Math.abs(gained - can.dv) < 1e-6, `gained ${gained.toFixed(3)}`);
  check('canister is collected only once', Math.abs(m.dvRemaining() - dv0 - can.dv) < 1e-6 && m.collected.size === 1);
  check('pickup Δv is not counted as used', Math.abs(m.dvUsed()) < 1e-6);
}

// 8. Launch levels: a player-like gravity turn (climb, tilt over, keep
//    burning toward the horizon, top up at the high point) reaches a real
//    orbit, and on the satellite level only deploying the payload gets there.
{
  const fly = (L, deploy) => {
    const g = L.goals[0], gm = L.bodies[0].gm, lo = g.rMin + 8, hi = g.rMax - 15;
    const m = new Mission(L); let phase = 0;
    while (m.status === 'flying' && m.t < 900) {
      const s = m.ship, r = Math.hypot(s.x, s.y), radial = Math.atan2(s.y, s.x); let thrust = false;
      const v2 = s.vx * s.vx + s.vy * s.vy, a = 1 / (2 / r - v2 / gm), h = s.x * s.vy - s.y * s.vx;
      const e = Math.sqrt(Math.max(0, 1 - h * h / (gm * a))), pe = a * (1 - e), ap = a > 0 ? a * (1 + e) : Infinity;
      if (m.stageSpec.fuel <= 1e-9 && deploy && m.canDeploy()) m.deploy();
      if (phase === 0) {
        thrust = true;
        if (!m.landed && m.t > 1.25) { s.angle = radial + Math.min(0.6 + (m.t - 1.25) * 0.25, Math.PI / 2); s.omega = 0; }
        if ((!m.landed && (pe >= lo || ap >= hi)) || (m.stageSpec.fuel <= 1e-9 && !m.canDeploy())) phase = 1;
      } else if (phase === 1) { if (pe >= lo) phase = 3; else if (s.x * s.vx + s.y * s.vy <= 0) phase = 2; }
      else if (phase === 2) { s.angle = Math.atan2(s.vy, s.vx); s.omega = 0; thrust = pe < lo && m.stageSpec.fuel > 0; if (!thrust) phase = 3; }
      m.advance(thrust ? 1 / 120 : 0.1, { thrust, throttle: 1, rotate: 0 });
    }
    return m;
  };
  const ro = fly(LEVELS.find(l => l.id === 'reachorbit'), false);
  check('Reach Orbit: a gravity turn makes a real orbit', ro.status === 'won', `${ro.status} dv=${ro.dvUsed().toFixed(2)}`);
  const sat = LEVELS.find(l => l.id === 'satellite');
  const withDeploy = fly(sat, true), boosterOnly = fly(sat, false);
  check('Satellite: deploying reaches orbit', withDeploy.status === 'won', withDeploy.status);
  check('Satellite: the booster alone cannot', boosterOnly.status !== 'won', boosterOnly.status);
}

// 9. Passing through an orbit band on a path that doesn't stay there must not
//    count: a ship coasting on an ellipse that crosses the band never wins.
{
  const L = LEVELS.find(l => l.id === 'turn'); // band 180-230 around Terra
  const m = new Mission(L);
  const s = m.ship, v = Math.hypot(s.vx, s.vy);
  s.vx *= 1.25; s.vy *= 1.25; // ellipse from 90 out past the band
  let inBand = 0;
  while (m.status === 'flying' && m.t < 600) {
    m.advance(0.25, { thrust: false, throttle: 1, rotate: 0 });
    const r = Math.hypot(s.x, s.y); if (r >= 180 && r <= 230) inBand += 0.25;
  }
  check('sweeping through an orbit band does not win', m.status !== 'won' && inBand > 30, `${m.status}, ${inBand.toFixed(0)}s spent inside the band`);
}

// 10. Wrong Way's intended route (climb high, reverse where you're slow, fall
//     back and circularize) wins within the tank. The random search in
//     check-levels.js can't find this three-burn route on its own.
{
  const L = LEVELS.find(l => l.id === 'wrongway');
  const m = new Mission(L), s = m.ship, gm = 20000, apoTarget = 1000;
  let phase = 0;
  while (m.status === 'flying' && m.t < L.tMax) {
    const r = Math.hypot(s.x, s.y), v2 = s.vx * s.vx + s.vy * s.vy, a = 1 / (2 / r - v2 / gm), h = s.x * s.vy - s.y * s.vx;
    const e = Math.sqrt(Math.max(0, 1 - h * h / (gm * a))), apo = a * (1 + e), peri = a * (1 - e);
    let thrust = false;
    if (phase === 0) { s.angle = Math.atan2(s.vy, s.vx); thrust = apo < apoTarget; if (!thrust) phase = 1; }
    else if (phase === 1) { if (r > apoTarget * 0.995) phase = 2; }
    else if (phase === 2) { s.angle = Math.atan2(s.x, -s.y); thrust = true; if (h > 0 && peri > 130) { phase = 3; thrust = false; } }
    else if (phase === 3) { if (r < 135 && h > 0) phase = 4; }
    else if (phase === 4) { s.angle = Math.atan2(s.vy, s.vx) + Math.PI; thrust = apo > 150; if (!thrust) phase = 5; }
    s.omega = 0;
    m.advance(thrust ? 1 / 120 : 0.1, { thrust, throttle: 1, rotate: 0 });
  }
  check('Wrong Way: the climb-high route wins', m.status === 'won', `${m.status} dv=${m.dvUsed().toFixed(2)}`);
}

// 11. World 2 previews.
{
  const orb = (s, gm) => { const r = Math.hypot(s.x, s.y), v2 = s.vx * s.vx + s.vy * s.vy, a = 1 / (2 / r - v2 / gm), h = s.x * s.vy - s.y * s.vx, e = Math.sqrt(Math.max(0, 1 - h * h / (gm * a))); return { r, pe: a * (1 - e), ap: a > 0 ? a * (1 + e) : Infinity }; };

  // Stacks: each stage delivers its advertised Δv with everything above it aboard.
  const stack = new Mission(LEVELS.find(l => l.id === 'threestages'));
  const want = [4.5, 4, 3];
  check('stack: every stage has its own Δv', stack.stageDv0.every((v, k) => Math.abs(v - want[k]) < 1e-6), stack.stageDv0.map(v => v.toFixed(2)).join(' / '));

  // Release Point: drop the pod on a path into the zone, then climb back to orbit.
  const drop = new Mission(LEVELS.find(l => l.id === 'releasepoint'));
  { const m = drop, s = m.ship; let ph = 0;
    while (m.status === 'flying' && m.t < 300) {
      const o = orb(s, 20000); let thrust = false;
      if (ph === 0 && m.t >= 28) ph = 1;
      if (ph === 1) { s.angle = Math.atan2(s.vy, s.vx) + Math.PI; thrust = o.pe > 45; if (!thrust) { m.release(); ph = 2; } }
      else if (ph === 2) { s.angle = Math.atan2(s.vy, s.vx); thrust = o.pe < 70; if (!thrust) ph = 3; }
      s.omega = 0;
      m.advance(thrust ? 1 / 120 : 0.1, { thrust, throttle: 1, rotate: 0 });
    } }
  check('Release Point: pod lands in the zone, ship recovers', drop.status === 'won', `${drop.status} ${drop.message}`);
  const lazy = new Mission(LEVELS.find(l => l.id === 'releasepoint'));
  lazy.release();
  while (lazy.status === 'flying' && lazy.t < 200) lazy.advance(0.25, { thrust: false, throttle: 1, rotate: 0 });
  check('Release Point: a pod dropped from orbit never lands', lazy.status !== 'won', lazy.status);

  // Clear the Station: dropping the booster at once hits the station; burning it first is safe.
  const fly = (careful) => {
    const m = new Mission(LEVELS.find(l => l.id === 'clearstation')), s = m.ship; let ph = careful ? 0 : 1;
    if (!careful) m.deploy();
    while (m.status === 'flying' && m.t < 1200) {
      const o = orb(s, 20000); let thrust = false;
      if (ph === 0) { s.angle = Math.atan2(s.vy, s.vx); thrust = o.ap < 300; if (m.stageSpec.fuel <= 1e-9) { m.deploy(); ph = 1; } else if (!thrust) { m.deploy(); ph = 2; } }
      if (ph === 1) { s.angle = Math.atan2(s.vy, s.vx); thrust = o.ap < 300; if (!thrust) ph = 2; }
      else if (ph === 2) { if (s.x * s.vx + s.y * s.vy <= 0 && o.r > 270) ph = 3; }
      else if (ph === 3) { s.angle = Math.atan2(s.vy, s.vx); thrust = o.pe < 285; if (!thrust) ph = 4; }
      s.omega = 0;
      m.advance(thrust ? 1 / 120 : 0.1, { thrust, throttle: 1, rotate: 0 });
    }
    return m;
  };
  const naive = fly(false), careful = fly(true);
  check('Clear the Station: an early drop hits the station', naive.status === 'crashed' && /station/i.test(naive.message), naive.message);
  check('Clear the Station: burning the booster first is safe', careful.status === 'won', careful.status);
  // A stage that misses on its first pass but whose orbit still crosses the
  // station's would hit it eventually, so the mission fails straight away.
  const cross = new Mission(LEVELS.find(l => l.id === 'clearstation'));
  cross.ship.angle += Math.PI / 4;
  cross.deploy();
  check('Clear the Station: a stage left on a crossing orbit fails', cross.debris[0].fate.kind === 'cross' && cross.status === 'crashed', cross.debris[0].fate.kind + ' ' + cross.message);
}

// 12. Every World 2 mission has a scripted flight plan that still wins
//     (tools/proofs.js; re-tune with tools/check-scripted.js).
{
  const AP = require('./autopilot.js');
  const PROOFS = require('./proofs.js');
  const w2 = LEVELS.filter(l => l.world === 2);
  const missing = w2.filter(l => !PROOFS[l.id]).map(l => l.id);
  check('every World 2 mission has a proof', missing.length === 0, missing.join(', '));
  const lost = [];
  for (const L of w2) {
    if (!PROOFS[L.id]) continue;
    const r = AP.fly(L, PROOFS[L.id].script(PROOFS[L.id].p, AP), PROOFS[L.id].opts);
    if (!r.won) lost.push(`${L.id} (${r.status}: ${r.message})`);
  }
  check(`World 2: all ${w2.length} proofs win`, lost.length === 0, lost.join('; '));
}

process.exit(failed ? 1 : 0);
