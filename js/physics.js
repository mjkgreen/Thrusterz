// Thrusterz physics core.
// Units: G = 1. Distances in world units, time in seconds (at 1x warp).
// Celestial bodies move on analytic Kepler "rails" (deterministic, so the
// trajectory predictor and the real flight agree exactly). The ship is a test
// particle feeling the gravity of every massive body.
(function (root) {
  'use strict';

  function solveKepler(M, e) {
    if (e === 0) return M;
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 40; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
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
        o.cw = Math.cos(o.argp); o.sw = Math.sin(o.argp);
        o.w = reflex ? b.msys / p.msys : 0; // share of the relative orbit taken by the parent
        o.mu = o.n * o.n * o.a * o.a * o.a;   // effective two-body μ of the rail
      }
      // Sphere of influence (Laplace radius) for host-relative gravity.
      for (const b of this.bodies) {
        // Comparable-mass partners (binary stars) have no meaningful SOI.
        const ratio = b.orbit && b.gm > 0 ? b.gm / this.bodies[b.parent].gm : 0;
        b.soi = ratio > 0 && ratio < 0.25 ? b.orbit.a * Math.pow(ratio, 0.4) : Infinity;
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
      this._t = NaN;
    }

    // Relative orbit offset of body i from its parent at time t (into r*).
    _rel(i, t) {
      const o = this.bodies[i].orbit;
      const E = solveKepler(o.phase + o.n * t, o.e);
      const cE = Math.cos(E), sE = Math.sin(E);
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
        const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
        const f = this.bodies[i].gm / (r2 * r);
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
  }

  // One RK4 step of a particle under gravity plus a constant extra
  // acceleration (thrust) over the step.
  const _a = [0, 0];
  function rk4(sys, s, t, dt, tax, tay) {
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
      dt = Math.min(dt, Math.max(0.25 * (r - b.radius), 0.5) / v);
    }
    return Math.max(dt, dtMin);
  }

  // Index of a body the particle is inside, or -1.
  function collision(sys, x, y, t) {
    sys.update(t);
    for (const b of sys.bodies) {
      const dx = x - sys.px[b.index], dy = y - sys.py[b.index];
      if (b.pickup) continue; // collected by flying through, never collided with
      if (dx * dx + dy * dy < b.radius * b.radius) return b.index;
    }
    return -1;
  }

  // Coast prediction from state s at time t for `duration` seconds.
  // Returns flat sample arrays and the first impact (if any).
  function predict(sys, s0, t0, duration, opts) {
    opts = opts || {};
    const maxSteps = opts.maxSteps || 6000;
    const bounds = opts.bounds || Infinity;
    const s = { x: s0.x, y: s0.y, vx: s0.vx, vy: s0.vy };
    const ts = [t0], xs = [s.x], ys = [s.y];
    let t = t0, hit = -1;
    const tEnd = t0 + duration;
    for (let step = 0; step < maxSteps && t < tEnd; step++) {
      let dt = coastDt(sys, s, t, 0.002, opts.dtMax || 2);
      if (t + dt > tEnd) dt = tEnd - t;
      rk4(sys, s, t, dt, 0, 0);
      t += dt;
      ts.push(t); xs.push(s.x); ys.push(s.y);
      hit = collision(sys, s.x, s.y, t);
      if (hit >= 0 && hit !== opts.ignore) break;
      hit = -1;
      if (s.x * s.x + s.y * s.y > bounds * bounds) break;
    }
    return { ts, xs, ys, hit, tEnd: t, end: s };
  }

  const Phys = { System, rk4, coastDt, collision, predict, solveKepler };
  if (typeof module !== 'undefined' && module.exports) module.exports = Phys;
  else root.Phys = Phys;
})(typeof window !== 'undefined' ? window : globalThis);
