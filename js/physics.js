// Thrusterz physics core.
// Units: G = 1. Distances in world units, time in seconds (at 1x warp).
// Celestial bodies move on analytic Kepler "rails" (deterministic, so the
// trajectory predictor and the real flight agree exactly). The ship is a test
// particle feeling the gravity of every massive body.
(function (root) {
  'use strict';
  // Deterministic sin/cos/exp/log (see dmath.js): replays must match on every engine.
  const DM = root.DMath || (typeof require !== 'undefined' ? require('./dmath.js') : null);

  function solveKepler(M, e) {
    if (e === 0) return M;
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 40; i++) {
      const dE = (E - e * DM.sin(E) - M) / (1 - e * DM.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    return E;
  }

  // Body definition:
  //   { id, name, gm, radius, color, spin?, x?, y?,
  //     orbit?: { parent, a, e?, phase?, argp?, dir?, n?, mu?, reflex? } }
  // phase = mean anomaly at t=0, argp = rotation of periapsis, dir = +1 CCW / -1 CW.
  // With reflex (default on) a massive child and its parent both orbit their
  // shared barycenter, so a planet is tugged by its moon just like the ship is
  // — the ship then only feels the moon's *tidal* effect while orbiting the
  // planet, as in reality. Binary stars fall out of the same rule.
  const _tmp = [0, 0];

  // Contact radius: a black hole's event horizon can be much larger than the
  // body drawn at its centre. Plain bodies just use their radius.
  const hitR = (b) => b.horizon || b.radius;

  class System {
    constructor(defs) {
      this.bodies = defs.map((d, i) => Object.assign({}, d, {
        index: i, orbit: d.orbit ? Object.assign({}, d.orbit) : null,
        spin: d.spin || 0, gm: d.gm || 0, x: d.x || 0, y: d.y || 0, children: [],
      }));
      this.byId = {};
      for (const b of this.bodies) this.byId[b.id] = b;
      for (const b of this.bodies) {
        if (!b.orbit) continue;
        const p = this.byId[b.orbit.parent];
        if (!p) throw new Error('Unknown parent ' + b.orbit.parent);
        b.parent = p.index;
        p.children.push(b.index);
      }
      // Topological order so parents are evaluated before children.
      this.order = [];
      const seen = new Set();
      const visit = (b) => {
        if (seen.has(b.index)) return;
        if (b.orbit) visit(this.bodies[b.parent]);
        seen.add(b.index); this.order.push(b.index);
      };
      this.bodies.forEach(visit);
      // Subsystem masses (body + reflex-coupled descendants), leaves first.
      for (let k = this.order.length - 1; k >= 0; k--) {
        const b = this.bodies[this.order[k]];
        b.msys = b.gm;
        for (const c of b.children) if (this.bodies[c].orbit.reflex !== false) b.msys += this.bodies[c].msys;
      }
      for (const b of this.bodies) {
        const o = b.orbit;
        if (!o) continue;
        const p = this.bodies[b.parent];
        o.e = o.e || 0; o.phase = o.phase || 0; o.argp = o.argp || 0; o.dir = o.dir || 1;
        const reflex = o.reflex !== false && b.msys > 0;
        if (!o.n) o.n = Math.sqrt((o.mu != null ? o.mu : p.gm + (reflex ? b.msys : 0)) / (o.a * o.a * o.a));
        o.b = o.a * Math.sqrt(1 - o.e * o.e);
        o.cw = DM.cos(o.argp); o.sw = DM.sin(o.argp);
        o.w = reflex ? b.msys / p.msys : 0; // share of the relative orbit taken by the parent
        o.mu = o.n * o.n * o.a * o.a * o.a;   // effective two-body μ of the rail
      }
      // Sphere of influence (Laplace radius) for host-relative gravity.
      for (const b of this.bodies) {
        // Comparable-mass partners (binary stars) have no meaningful SOI.
        const ratio = b.orbit && b.gm > 0 ? b.gm / this.bodies[b.parent].gm : 0;
        b.soi = ratio > 0 && ratio < 0.25 ? b.orbit.a * DM.pow(ratio, 0.4) : Infinity;
        b.depth = b.orbit ? 1 + (this.bodies[b.parent].depth || 0) : 0;
      }
      const n = this.bodies.length;
      // Nominal = subsystem barycenter; p* = actual body centre.
      this.nx = new Float64Array(n); this.ny = new Float64Array(n);
      this.nvx = new Float64Array(n); this.nvy = new Float64Array(n);
      this.px = new Float64Array(n); this.py = new Float64Array(n);
      this.vx = new Float64Array(n); this.vy = new Float64Array(n);
      this.rx = new Float64Array(n); this.ry = new Float64Array(n);
      this.rvx = new Float64Array(n); this.rvy = new Float64Array(n);
      this.rax = new Float64Array(n); this.ray = new Float64Array(n);
      this.nax = new Float64Array(n); this.nay = new Float64Array(n);
      this.ax = new Float64Array(n); this.ay = new Float64Array(n);
      this.hostable = this.bodies.filter(b => b.soi < Infinity).sort((a, b) => b.depth - a.depth).map(b => b.index);
      this.grav = this.bodies.filter(b => b.gm > 0).map(b => b.index);
      // Experimental mechanics (all empty on the regular worlds, so their
      // code paths are exactly as before).
      //   atmosphere: { height, density, heatLimit, scale? }  drag layer above the surface
      //   kind 'wormhole' + link: entering one mouth puts you out of the other
      //   pw: strong-gravity radius (Paczyński–Wiita pull, gm / (r − pw)²)
      this.atmo = this.bodies.filter(b => b.atmosphere).map(b => b.index);
      for (const i of this.atmo) {
        const A = this.bodies[i].atmosphere = Object.assign({}, this.bodies[i].atmosphere);
        A.scale = A.scale || A.height / 4;
        A.top = DM.exp(-A.height / A.scale); // density reaches zero at the top of the layer
      }
      this.worm = this.bodies.filter(b => b.kind === 'wormhole' && b.link).map(b => b.index);
      this.drag = this.atmo.length ? (x, y, vx, vy, t, out) => this.dragAccel(x, y, vx, vy, t, out) : null;
      this._t = NaN;
    }

    // Relative orbit offset of body i from its parent at time t (into r*).
    _rel(i, t) {
      const o = this.bodies[i].orbit;
      const E = solveKepler(o.phase + o.n * t, o.e);
      const cE = DM.cos(E), sE = DM.sin(E);
      const Ed = o.n / (1 - o.e * cE);
      const x = o.a * (cE - o.e), ux = -o.a * sE * Ed;
      let y = o.b * sE, uy = o.b * cE * Ed;
      if (o.dir < 0) { y = -y; uy = -uy; }
      this.rx[i] = x * o.cw - y * o.sw; this.ry[i] = x * o.sw + y * o.cw;
      this.rvx[i] = ux * o.cw - uy * o.sw; this.rvy[i] = ux * o.sw + uy * o.cw;
      const r2 = this.rx[i] * this.rx[i] + this.ry[i] * this.ry[i];
      const f = -o.mu / (r2 * Math.sqrt(r2));
      this.rax[i] = f * this.rx[i]; this.ray[i] = f * this.ry[i];
    }

    // Fill px/py/vx/vy with body states at time t.
    update(t) {
      if (t === this._t) return;
      this._t = t;
      const { nx, ny, nvx, nvy, nax, nay, px, py, vx, vy, ax, ay, rx, ry, rvx, rvy, rax, ray } = this;
      for (const i of this.order) {
        const b = this.bodies[i], o = b.orbit;
        if (!o) { nx[i] = b.x; ny[i] = b.y; nvx[i] = nvy[i] = nax[i] = nay[i] = 0; continue; }
        this._rel(i, t);
        const p = b.parent, k = 1 - o.w;
        nx[i] = nx[p] + rx[i] * k; ny[i] = ny[p] + ry[i] * k;
        nvx[i] = nvx[p] + rvx[i] * k; nvy[i] = nvy[p] + rvy[i] * k;
        nax[i] = nax[p] + rax[i] * k; nay[i] = nay[p] + ray[i] * k;
      }
      for (const i of this.order) {
        let x = nx[i], y = ny[i], u = nvx[i], v = nvy[i], g = nax[i], h = nay[i];
        for (const c of this.bodies[i].children) {
          const w = this.bodies[c].orbit.w;
          if (!w) continue;
          x -= rx[c] * w; y -= ry[c] * w; u -= rvx[c] * w; v -= rvy[c] * w; g -= rax[c] * w; h -= ray[c] * w;
        }
        px[i] = x; py[i] = y; vx[i] = u; vy[i] = v; ax[i] = g; ay[i] = h;
      }
    }

    // Position of one body at time t without touching the cached state of the
    // others (update() recomputes every body). Used for drawing many points
    // relative to one moving body. out = [x, y].
    posAt(i, t, out) {
      const b = this.bodies[i];
      let x, y;
      if (!b.orbit) { x = b.x; y = b.y; } else {
        // Nominal (barycentre) position: walk up the parent chain.
        this._nominalAt(i, t, out);
        x = out[0]; y = out[1];
      }
      // A massive child pulls its parent off the barycentre (reflex).
      for (const c of b.children) {
        const w = this.bodies[c].orbit.w;
        if (!w) continue;
        this._relAt(c, t, _tmp);
        x -= _tmp[0] * w; y -= _tmp[1] * w;
      }
      out[0] = x; out[1] = y;
      return out;
    }

    _nominalAt(i, t, out) {
      const b = this.bodies[i];
      if (!b.orbit) { out[0] = b.x; out[1] = b.y; return out; }
      this._nominalAt(b.parent, t, out);
      const px = out[0], py = out[1];
      this._relAt(i, t, out);
      const k = 1 - b.orbit.w;
      out[0] = px + out[0] * k; out[1] = py + out[1] * k;
      return out;
    }

    // Relative orbit offset of body i from its parent at t, into out (no side effects).
    _relAt(i, t, out) {
      const o = this.bodies[i].orbit;
      const E = solveKepler(o.phase + o.n * t, o.e);
      const x = o.a * (DM.cos(E) - o.e);
      let y = o.b * DM.sin(E);
      if (o.dir < 0) y = -y;
      out[0] = x * o.cw - y * o.sw; out[1] = x * o.sw + y * o.cw;
      return out;
    }

    // Innermost body whose sphere of influence contains (x, y), or -1.
    host(x, y, t) {
      this.update(t);
      for (const i of this.hostable) {
        const dx = x - this.px[i], dy = y - this.py[i], s = this.bodies[i].soi;
        if (dx * dx + dy * dy < s * s) return i;
      }
      return -1;
    }

    // Gravitational acceleration on a test particle at (x, y), time t.
    // Bodies ride rails, so they don't respond to each other's pull exactly as
    // n-body physics would. To stay consistent, the ship's acceleration is
    // taken relative to its host body: the host's own (rails) acceleration,
    // plus the host's pull, plus the *tidal* pull of every other body.
    accel(x, y, t, out) {
      this.update(t);
      const H = this.host(x, y, t);
      let ax = 0, ay = 0;
      for (const i of this.grav) {
        const dx = this.px[i] - x, dy = this.py[i] - y;
        const r2 = dx * dx + dy * dy, r = Math.sqrt(r2), pw = this.bodies[i].pw;
        // Strong gravity near a black hole: pulls harder than Newton close in,
        // so orbits inside 3·pw are unstable and a close pass can whirl round.
        const f = pw ? this.bodies[i].gm / (Math.max(r - pw, 0.1 * pw) ** 2 * r) : this.bodies[i].gm / (r2 * r);
        ax += f * dx; ay += f * dy;
        if (H >= 0 && i !== H) {
          const hx = this.px[i] - this.px[H], hy = this.py[i] - this.py[H];
          const h2 = hx * hx + hy * hy, hf = this.bodies[i].gm / (h2 * Math.sqrt(h2));
          ax -= hf * hx; ay -= hf * hy;
        }
      }
      if (H >= 0) { ax += this.ax[H]; ay += this.ay[H]; }
      out[0] = ax; out[1] = ay;
    }

    // Body with the strongest pull at (x, y), time t — the natural reference
    // for "prograde", altitude, etc.
    dominant(x, y, t) {
      this.update(t);
      let best = -1, bestA = -1;
      for (const i of this.grav) {
        const dx = this.px[i] - x, dy = this.py[i] - y;
        const a = this.bodies[i].gm / (dx * dx + dy * dy);
        if (a > bestA) { bestA = a; best = i; }
      }
      return best;
    }

    period(i) { const o = this.bodies[i].orbit; return o ? 2 * Math.PI / o.n : Infinity; }

    // Air density of body i's atmosphere at (x, y), time t (0 outside it).
    density(i, x, y, t) {
      this.update(t);
      const b = this.bodies[i], A = b.atmosphere;
      const dx = x - this.px[i], dy = y - this.py[i], h = Math.sqrt(dx * dx + dy * dy) - b.radius;
      if (h >= A.height) return 0;
      return A.density * (DM.exp(-Math.max(h, 0) / A.scale) - A.top);
    }

    // Drag from every atmosphere: −ρ·|u|·u, u = velocity relative to the body.
    dragAccel(x, y, vx, vy, t, out) {
      out[0] = 0; out[1] = 0;
      for (const i of this.atmo) {
        const rho = this.density(i, x, y, t);
        if (rho <= 0) continue;
        const ux = vx - this.vx[i], uy = vy - this.vy[i], u = Math.sqrt(ux * ux + uy * uy);
        out[0] -= rho * u * ux; out[1] -= rho * u * uy;
      }
    }

    // Heating ρ·u³ (drag power per unit mass) and the atmosphere causing it.
    heat(x, y, vx, vy, t) {
      let q = 0, body = -1;
      for (const i of this.atmo) {
        const rho = this.density(i, x, y, t);
        if (rho <= 0) continue;
        const ux = vx - this.vx[i], uy = vy - this.vy[i], u = Math.sqrt(ux * ux + uy * uy);
        if (rho * u * u * u > q) { q = rho * u * u * u; body = i; }
      }
      return { q, body };
    }
  }

  // Wormholes: an object inside a mouth comes out of the linked mouth with
  // the same velocity relative to the mouth, just outside it along that
  // velocity (so it flies straight on out). Returns the exit body index, or -1.
  function wormhole(sys, s, t) {
    if (!sys.worm.length) return -1;
    sys.update(t);
    for (const i of sys.worm) {
      const b = sys.bodies[i], dx = s.x - sys.px[i], dy = s.y - sys.py[i];
      if (dx * dx + dy * dy >= b.radius * b.radius) continue;
      const j = sys.byId[b.link].index, e = sys.bodies[j];
      const ux = s.vx - sys.vx[i], uy = s.vy - sys.vy[i], u = Math.sqrt(ux * ux + uy * uy);
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = u > 1e-9 ? ux / u : dx / d, ny = u > 1e-9 ? uy / u : dy / d;
      s.x = sys.px[j] + nx * e.radius * 1.2; s.y = sys.py[j] + ny * e.radius * 1.2;
      s.vx = sys.vx[j] + ux; s.vy = sys.vy[j] + uy;
      return j;
    }
    return -1;
  }

  // One RK4 step of a particle under gravity plus a constant extra
  // acceleration (thrust) over the step.
  const _a = [0, 0], _f = [0, 0];
  function rk4(sys, s, t, dt, tax, tay, fx) {
    if (fx) { rk4x(sys, s, t, dt, tax, tay, fx); return; }
    const { x, y, vx, vy } = s;
    sys.accel(x, y, t, _a);
    const k1vx = _a[0] + tax, k1vy = _a[1] + tay;
    const h = dt / 2;
    sys.accel(x + vx * h, y + vy * h, t + h, _a);
    const k2vx = _a[0] + tax, k2vy = _a[1] + tay;
    const v2x = vx + k1vx * h, v2y = vy + k1vy * h;
    sys.accel(x + v2x * h, y + v2y * h, t + h, _a);
    const k3vx = _a[0] + tax, k3vy = _a[1] + tay;
    const v3x = vx + k2vx * h, v3y = vy + k2vy * h;
    const v4x = vx + k3vx * dt, v4y = vy + k3vy * dt;
    sys.accel(x + v4x * dt, y + v4y * dt, t + dt, _a);
    const k4vx = _a[0] + tax, k4vy = _a[1] + tay;
    s.x = x + dt / 6 * (vx + 2 * v2x + 2 * v3x + v4x);
    s.y = y + dt / 6 * (vy + 2 * v2y + 2 * v3y + v4y);
    s.vx = vx + dt / 6 * (k1vx + 2 * k2vx + 2 * k3vx + k4vx);
    s.vy = vy + dt / 6 * (k1vy + 2 * k2vy + 2 * k3vy + k4vy);
  }

  // RK4 with an extra, velocity-dependent acceleration fx(x, y, vx, vy, t, out)
  // (atmospheric drag, sunlight on a sail) on top of gravity and thrust.
  function rk4x(sys, s, t, dt, tax, tay, fx) {
    const { x, y, vx, vy } = s;
    sys.accel(x, y, t, _a); fx(x, y, vx, vy, t, _f);
    const k1vx = _a[0] + _f[0] + tax, k1vy = _a[1] + _f[1] + tay;
    const h = dt / 2;
    const v2x = vx + k1vx * h, v2y = vy + k1vy * h;
    sys.accel(x + vx * h, y + vy * h, t + h, _a); fx(x + vx * h, y + vy * h, v2x, v2y, t + h, _f);
    const k2vx = _a[0] + _f[0] + tax, k2vy = _a[1] + _f[1] + tay;
    const v3x = vx + k2vx * h, v3y = vy + k2vy * h;
    sys.accel(x + v2x * h, y + v2y * h, t + h, _a); fx(x + v2x * h, y + v2y * h, v3x, v3y, t + h, _f);
    const k3vx = _a[0] + _f[0] + tax, k3vy = _a[1] + _f[1] + tay;
    const v4x = vx + k3vx * dt, v4y = vy + k3vy * dt;
    sys.accel(x + v3x * dt, y + v3y * dt, t + dt, _a); fx(x + v3x * dt, y + v3y * dt, v4x, v4y, t + dt, _f);
    const k4vx = _a[0] + _f[0] + tax, k4vy = _a[1] + _f[1] + tay;
    s.x = x + dt / 6 * (vx + 2 * v2x + 2 * v3x + v4x);
    s.y = y + dt / 6 * (vy + 2 * v2y + 2 * v3y + v4y);
    s.vx = vx + dt / 6 * (k1vx + 2 * k2vx + 2 * k3vx + k4vx);
    s.vy = vy + dt / 6 * (k1vy + 2 * k2vy + 2 * k3vy + k4vy);
  }

  // Adaptive coast step size: small near massive bodies and when about to
  // touch any body, large in empty space.
  function coastDt(sys, s, t, dtMin, dtMax) {
    sys.update(t);
    let dt = dtMax;
    for (const b of sys.bodies) {
      const i = b.index;
      const dx = s.x - sys.px[i], dy = s.y - sys.py[i];
      const r = Math.sqrt(dx * dx + dy * dy);
      if (b.gm > 0) dt = Math.min(dt, 0.015 * Math.sqrt(r * r * r / b.gm));
      const rvx = s.vx - sys.vx[i], rvy = s.vy - sys.vy[i];
      const v = Math.sqrt(rvx * rvx + rvy * rvy) + 1e-9;
      dt = Math.min(dt, Math.max(0.25 * (r - hitR(b)), 0.5) / v);
    }
    return Math.max(dt, dtMin);
  }

  // Index of a body the particle is inside, or -1.
  function collision(sys, x, y, t) {
    sys.update(t);
    for (const b of sys.bodies) {
      const dx = x - sys.px[b.index], dy = y - sys.py[b.index];
      if (b.pickup || b.kind === 'wormhole') continue; // flown through, never collided with
      const R = hitR(b);
      if (dx * dx + dy * dy < R * R) return b.index;
    }
    return -1;
  }

  // Coast prediction from state s at time t for `duration` seconds.
  // Returns flat sample arrays and the first impact (if any).
  // opts.fx: extra acceleration (default: the system's drag, if any).
  // opts.heat: stop where heating passes an atmosphere's limit (burn: sample index).
  // Wormhole jumps are followed; jumps lists the sample index after each one.
  function predict(sys, s0, t0, duration, opts) {
    opts = opts || {};
    const maxSteps = opts.maxSteps || 6000;
    const bounds = opts.bounds || Infinity;
    const s = { x: s0.x, y: s0.y, vx: s0.vx, vy: s0.vy };
    const ts = [t0], xs = [s.x], ys = [s.y];
    let t = t0, hit = -1, burn = null;
    const tEnd = t0 + duration, jumps = [];
    const fx = opts.fx !== undefined ? opts.fx : sys.drag;
    for (let step = 0; step < maxSteps && t < tEnd; step++) {
      let dt = coastDt(sys, s, t, 0.002, opts.dtMax || 2);
      if (t + dt > tEnd) dt = tEnd - t;
      rk4(sys, s, t, dt, 0, 0, fx);
      t += dt;
      if (sys.worm.length && wormhole(sys, s, t) >= 0) jumps.push(ts.length);
      ts.push(t); xs.push(s.x); ys.push(s.y);
      if (opts.heat && sys.atmo.length) {
        const q = sys.heat(s.x, s.y, s.vx, s.vy, t);
        if (q.body >= 0 && q.q > sys.bodies[q.body].atmosphere.heatLimit) { burn = { i: ts.length - 1, body: q.body }; break; }
      }
      hit = collision(sys, s.x, s.y, t);
      if (hit >= 0 && hit !== opts.ignore) break;
      hit = -1;
      if (s.x * s.x + s.y * s.y > bounds * bounds) break;
    }
    return { ts, xs, ys, hit, tEnd: t, end: s, jumps, burn };
  }

  const Phys = { System, rk4, coastDt, collision, predict, solveKepler, wormhole, hitR };
  if (typeof module !== 'undefined' && module.exports) module.exports = Phys;
  else root.Phys = Phys;
})(typeof window !== 'undefined' ? window : globalThis);
