// Scripted autopilot for proving levels solvable headlessly.
// A script is a list of steps run in order; numbers in a script can come from
// a parameter vector so tools/check-scripted.js can search for values that win.
//
// Steps:
//   { coast: pred }                       coast until pred(m, ctx) is true
//   { burn: dir, until: pred, rel?: id }  thrust along dir until pred is true or
//                                         the stage runs dry
//     dir: 'pro' | 'retro' | 'out' | 'in' | number (offset from prograde)
//          | (m, ctx) => absolute angle
//     rel: body the direction is measured against (default: dominant body)
//     stage: true → when the stage runs dry, deploy and keep burning
//   { deploy: true }                      drop the spent stage
//   { drop: true }                        release the next cargo item
//   { launch: { lo, hi, body, turn?, kick?, dir?, dropWhen? } }  gravity turn
//                                         off the surface into an orbit with
//                                         pe ≥ lo or ap ≥ hi, deploying stages
//                                         as they run dry (or when dropWhen(m, orbit))
//   { wait: seconds }                     coast for a fixed time
//   { fn: (m, ctx) => void }              arbitrary action
//   { control: (m, ctx) => ({ done } | { thrust, angle, dt? }), max? }
//                                         free-form controller, one step at a time
'use strict';
globalThis.Phys = globalThis.Phys || require('../js/physics.js');
const { Mission } = require('../js/flight.js');

// Osculating orbit of an object about a body (by id).
function orb(m, id, o) {
  const s = o || m.ship, sys = m.sys;
  sys.update(m.t);
  const b = sys.byId[id], i = b.index;
  const rx = s.x - sys.px[i], ry = s.y - sys.py[i], vx = s.vx - sys.vx[i], vy = s.vy - sys.vy[i];
  const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy, gm = b.gm;
  const eps = v2 / 2 - gm / r, h = rx * vy - ry * vx;
  const e = Math.sqrt(Math.max(0, 1 + 2 * eps * h * h / (gm * gm)));
  const bound = eps < 0, a = bound ? -gm / (2 * eps) : Infinity;
  return {
    r, v: Math.sqrt(v2), bound, e, a, h,
    pe: bound ? a * (1 - e) : h * h / (gm * (1 + e)), ap: bound ? a * (1 + e) : Infinity,
    rising: rx * vx + ry * vy > 0, theta: Math.atan2(ry, rx), pro: Math.atan2(vy, vx), dir: h > 0 ? 1 : -1,
    period: bound ? 2 * Math.PI * Math.sqrt(a * a * a / gm) : Infinity,
  };
}

// Angle of a body around its parent (or of the ship around a body).
function phase(m, id, about) {
  const sys = m.sys; sys.update(m.t);
  const i = sys.byId[id].index, p = sys.byId[about].index;
  return Math.atan2(sys.py[i] - sys.py[p], sys.px[i] - sys.px[p]);
}
function shipPhase(m, about) {
  const sys = m.sys; sys.update(m.t);
  const p = sys.byId[about].index;
  return Math.atan2(m.ship.y - sys.py[p], m.ship.x - sys.px[p]);
}
const wrap = (a) => { a %= 2 * Math.PI; if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; return a; };

function aim(m, dir, rel) {
  const s = m.ship, sys = m.sys;
  sys.update(m.t);
  if (typeof dir === 'function') return dir(m);
  const i = rel ? sys.byId[rel].index : sys.dominant(s.x, s.y, m.t);
  const pro = Math.atan2(s.vy - sys.vy[i], s.vx - sys.vx[i]);
  const out = Math.atan2(s.y - sys.py[i], s.x - sys.px[i]);
  if (dir === 'pro') return pro;
  if (dir === 'retro') return pro + Math.PI;
  if (dir === 'out') return out;
  if (dir === 'in') return out + Math.PI;
  return pro + dir;
}

// Distance-like progress measure for the current goal (smaller is better).
function goalCost(m) {
  const g = m.currentGoal();
  if (!g) return 0;
  const o = g.craft ? m.craftById(g.craft) || m.ship : m.ship;
  const p = m.goalPoint(g);
  let d = Math.hypot(o.x - p.x, o.y - p.y);
  if (g.type === 'orbit' || g.type === 'spread') d = (m.goalErr != null ? m.goalErr : Math.max(0, g.rMin - d, d - g.rMax)) + 40 * (1 - m.holdTime / (g.confirm || 3));
  if (g.type === 'rendezvous') d += 10 * Math.hypot(o.vx - p.vx, o.vy - p.vy);
  if (g.type === 'hold') d = (m.goalErr != null ? m.goalErr : Math.max(0, d - g.r)) + 40 * (1 - m.holdTime / g.hold);
  if (g.type === 'escape') d = Math.max(0, g.r - d);
  if (g.site) {
    const b = m.sys.byId[g.body], a = g.site.angle + b.spin * m.t;
    d = Math.hypot(o.x - p.x - b.radius * Math.cos(a), o.y - p.y - b.radius * Math.sin(a));
  }
  return d;
}

// Run a script. Returns the mission plus a cost for searching (lower is better;
// a win costs just its Δv).
function fly(level, steps, opts) {
  opts = opts || {};
  const m = new Mission(level);
  const ctx = { k: 0, t0: 0, step: null, best: Infinity, goalAt: 0 };
  const tEnd = opts.tMax || level.tMax;
  const coastDt = opts.coastDt || 0.25;
  let launch = null;
  const fuel = () => m.stageSpec && m.stageSpec.fuel > 1e-9;
  while (m.status === 'flying' && m.t < tEnd) {
    let st = steps[ctx.k];
    if (st !== ctx.step) { ctx.step = st; ctx.t0 = m.t; launch = null; }
    let thrust = false, dt = coastDt;
    if (!st) { /* script finished: coast out the clock */ dt = 0.5; }
    else if (st.coast) { if (st.coast(m, ctx)) { ctx.k++; continue; } }
    else if (st.wait != null) { if (m.t - ctx.t0 >= st.wait) { ctx.k++; continue; } dt = Math.min(coastDt, st.wait - (m.t - ctx.t0) + 1e-6); }
    else if (st.deploy) { m.deploy(); ctx.k++; continue; }
    else if (st.drop) { m.release(); ctx.k++; continue; }
    else if (st.fn) { st.fn(m, ctx); ctx.k++; continue; }
    else if (st.control) {
      // Free-form controller: returns { done } or { thrust, angle }.
      const c = st.control(m, ctx);
      if (c.done || (st.max != null && m.t - ctx.t0 >= st.max)) { ctx.k++; continue; }
      if (c.thrust && fuel()) { m.ship.angle = c.angle; m.ship.omega = 0; thrust = true; dt = 1 / 120; }
      else dt = c.dt || 0.1;
    }
    else if (st.burn != null) {
      if (!fuel() && st.stage && m.canDeploy()) m.deploy();
      if (!fuel() || (st.until && st.until(m, ctx))) { ctx.k++; continue; }
      if (st.max != null && m.t - ctx.t0 >= st.max) { ctx.k++; continue; }
      m.ship.angle = aim(m, st.burn, st.rel); m.ship.omega = 0;
      thrust = true; dt = 1 / 120;
    } else if (st.launch) {
      // Climb straight up, tilt over gradually, burn toward the horizon until
      // the orbit is high enough (or the high point is), then coast to the top
      // of the arc and burn prograde until the low point clears lo.
      const L = st.launch, o = orb(m, L.body);
      if (!launch) launch = { phase: 0 };
      if (!fuel() && m.canDeploy() && !m.landed) m.deploy();
      if (L.dropWhen && m.canDeploy() && L.dropWhen(m, o)) m.deploy();
      if (launch.phase === 0) {
        thrust = fuel();
        if (!m.landed && m.t - ctx.t0 > (L.kick || 1.25)) {
          m.ship.angle = o.theta + Math.min(0.6 + (m.t - ctx.t0 - (L.kick || 1.25)) * (L.turn || 0.25), Math.PI / 2) * (L.dir || 1);
          m.ship.omega = 0;
        }
        if ((!m.landed && (o.pe >= L.lo || o.ap >= L.hi)) || !fuel() && !m.canDeploy()) launch.phase = 1;
      } else if (launch.phase === 1) { if (o.pe >= L.lo) { ctx.k++; continue; } if (!o.rising) launch.phase = 2; }
      else if (launch.phase === 2) {
        m.ship.angle = o.pro; m.ship.omega = 0;
        thrust = o.pe < L.lo && fuel();
        if (!thrust && !fuel() && m.canDeploy()) { m.deploy(); thrust = fuel(); }
        if (!thrust) { ctx.k++; continue; }
      }
      dt = thrust ? 1 / 120 : 0.1;
    }
    if (!thrust) m.ship.omega = 0;
    m.advance(dt, { thrust, throttle: 1, rotate: 0 });
    if (m.goalIndex > ctx.goalAt) { ctx.goalAt = m.goalIndex; ctx.best = Infinity; }
    ctx.best = Math.min(ctx.best, goalCost(m));
  }
  const won = m.status === 'won';
  const cost = won ? m.dvUsed() : 1000 * (level.goals.length - m.goalIndex - m.done.size) + Math.min(ctx.best, 900) + m.dvUsed() * 0.1;
  return { m, won, cost, dv: m.dvUsed(), status: m.status, message: m.message };
}

module.exports = { fly, orb, phase, shipPhase, wrap, aim, goalCost };
