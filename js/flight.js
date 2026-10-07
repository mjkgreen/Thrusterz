// Mission simulation: the ship, its engines, and the level objectives.
// Pure logic (no rendering) so it can run headless in Node for testing.
(function (root) {
  'use strict';
  const Phys = root.Phys || (typeof require !== 'undefined' ? require('./physics.js') : null);

  const FIXED_DT = 1 / 120;      // step size while engines fire
  const MAX_COAST_DT = 0.25;     // largest coast step

  // Ship spec (level.ship):
  //   start: { landed: { body, angle } } | { orbit: { body, r, angle, dir } }
  //   heading: initial heading in radians, or 'prograde' / 'retrograde' / 'up'
  //   stages: [{ dryMass, fuel, thrust, ve }]   (stage 0 fires first)
  //   rcs: { fuel, accel, maxRate }             (side thrusters)
  //   gyro: true → spin is damped automatically when no rotation input;
  //         false → no damping; 'toggle' → player can switch it (Mission.gyro)
  //   canRotate: false → side thrusters unavailable
  class Mission {
    constructor(level) {
      this.level = level;
      this.sys = new Phys.System(level.bodies);
      const spec = level.ship;
      this.stages = spec.stages.map(s => Object.assign({}, s, { fuel0: s.fuel }));
      this.stage = 0;
      this.rcsFuel = spec.rcs ? spec.rcs.fuel : 0;
      this.rcsFuel0 = this.rcsFuel;
      this.t = 0;
      this.status = 'flying';   // flying | won | crashed | lost | timeout
      this.message = '';
      this.goalIndex = 0;
      this.holdTime = 0;
      this.events = [];
      this.thrusting = false;
      this.rotInput = 0;
      this.gyro = spec.gyro !== false; // 'toggle' starts on
      this.ship = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, omega: 0 };
      this.landed = null;
      this._initShip(spec);
      this.dv0 = this.dvRemaining();
    }

    _initShip(spec) {
      const sys = this.sys, s = this.ship;
      sys.update(0);
      if (spec.start.landed) {
        const b = sys.byId[spec.start.landed.body];
        this.landed = { body: b.index, theta0: spec.start.landed.angle };
        this._syncLanded();
        return;
      }
      const o = spec.start.orbit;
      const b = sys.byId[o.body], i = b.index;
      const dir = o.dir || 1, v = Math.sqrt(b.gm / o.r);
      s.x = sys.px[i] + o.r * Math.cos(o.angle);
      s.y = sys.py[i] + o.r * Math.sin(o.angle);
      s.vx = sys.vx[i] - dir * v * Math.sin(o.angle);
      s.vy = sys.vy[i] + dir * v * Math.cos(o.angle);
      const h = spec.heading;
      const pro = Math.atan2(s.vy - sys.vy[i], s.vx - sys.vx[i]);
      if (h === 'prograde' || h == null) s.angle = pro;
      else if (h === 'retrograde') s.angle = pro + Math.PI;
      else if (h === 'up') s.angle = o.angle;
      else s.angle = h;
    }

    // Keep a landed ship glued to its (possibly spinning, moving) body.
    _syncLanded() {
      const sys = this.sys, s = this.ship, L = this.landed;
      const b = sys.bodies[L.body];
      sys.update(this.t);
      const th = L.theta0 + b.spin * this.t;
      const R = b.radius * 1.0005;
      s.x = sys.px[L.body] + R * Math.cos(th);
      s.y = sys.py[L.body] + R * Math.sin(th);
      s.vx = sys.vx[L.body] - b.spin * R * Math.sin(th);
      s.vy = sys.vy[L.body] + b.spin * R * Math.cos(th);
      s.angle = th;
      s.omega = b.spin;
    }

    get stageSpec() { return this.stages[this.stage]; }

    mass() {
      let m = 0;
      for (let i = this.stage; i < this.stages.length; i++) m += this.stages[i].dryMass + this.stages[i].fuel;
      return m;
    }

    // Tsiolkovsky Δv left across all remaining stages.
    dvRemaining() {
      let dv = 0;
      for (let k = this.stage; k < this.stages.length; k++) {
        let m = 0;
        for (let i = k; i < this.stages.length; i++) m += this.stages[i].dryMass + this.stages[i].fuel;
        const st = this.stages[k];
        dv += st.ve * Math.log(m / (m - st.fuel));
      }
      return dv;
    }

    dvUsed() { return this.dv0 - this.dvRemaining(); }

    thrustAccel() { const st = this.stageSpec; return st ? st.thrust / this.mass() : 0; }

    // Advance the mission by `dt` seconds of game time.
    // controls: { thrust: bool, throttle: 0..1, rotate: -1|0|1 }
    advance(dt, controls) {
      if (this.status !== 'flying') return;
      const spec = this.level.ship;
      let remaining = dt;
      while (remaining > 1e-9 && this.status === 'flying') {
        const st = this.stageSpec;
        const firing = controls.thrust && st && st.fuel > 0 && controls.throttle > 0;
        const canRot = spec.canRotate !== false && spec.rcs && this.rcsFuel > 0 && !this.landed;
        const rotating = canRot && controls.rotate !== 0;
        const gyroWork = canRot && this.gyro && !rotating && Math.abs(this.ship.omega) > 1e-4;
        let h;
        if (firing || rotating || gyroWork || this.landed) h = Math.min(remaining, FIXED_DT);
        else h = Math.min(remaining, Phys.coastDt(this.sys, this.ship, this.t, 0.002, MAX_COAST_DT));
        this.thrusting = firing;
        this.rotInput = rotating ? controls.rotate : 0;
        this._step(h, firing ? controls.throttle : 0, rotating ? controls.rotate : 0, gyroWork);
        remaining -= h;
      }
    }

    _step(h, throttle, rot, gyroWork) {
      const s = this.ship, sys = this.sys, spec = this.level.ship;

      // Side thrusters: torque → angular velocity → heading.
      if (spec.rcs && !this.landed) {
        const r = spec.rcs;
        if (rot !== 0) {
          s.omega += rot * r.accel * h;
          this.rcsFuel = Math.max(0, this.rcsFuel - h);
        } else if (gyroWork) {
          const dw = Math.min(Math.abs(s.omega), r.accel * 1.5 * h);
          s.omega -= Math.sign(s.omega) * dw;
          this.rcsFuel = Math.max(0, this.rcsFuel - 0.25 * h);
        }
        if (this.gyro && r.maxRate) s.omega = Math.max(-r.maxRate, Math.min(r.maxRate, s.omega));
        s.angle += s.omega * h;
      }

      // Main engine.
      let tax = 0, tay = 0;
      if (throttle > 0) {
        const st = this.stageSpec;
        const a = st.thrust * throttle / this.mass();
        tax = a * Math.cos(s.angle); tay = a * Math.sin(s.angle);
        st.fuel = Math.max(0, st.fuel - st.thrust * throttle / st.ve * h);
      }

      if (this.landed) {
        // Lift off once thrust beats local gravity.
        const b = sys.bodies[this.landed.body];
        const g = b.gm / (b.radius * b.radius);
        if (throttle > 0 && Math.hypot(tax, tay) > g) {
          this._syncLanded();
          this.landed = null;
          this.ignoreBody = b.index;
          this.events.push({ t: this.t, type: 'liftoff' });
        } else {
          this.t += h;
          this._syncLanded();
          if (this.t > this.level.tMax) { this.status = 'timeout'; this.message = 'Mission clock ran out.'; }
          return;
        }
      }

      Phys.rk4(sys, s, this.t, h, tax, tay);
      this.t += h;
      this._checks(h);
    }

    _checks(h) {
      const sys = this.sys, s = this.ship, L = this.level;
      sys.update(this.t);
      const hit = Phys.collision(sys, s.x, s.y, this.t);
      if (hit >= 0) {
        const pad = hit === this.ignoreBody ? sys.bodies[hit] : null;
        if (pad && Math.hypot(s.x - sys.px[hit], s.y - sys.py[hit]) > pad.radius * 0.99) {
          // Still clearing the launch pad.
        } else {
          const g = this.currentGoal();
          if (g && g.type === 'hit' && sys.byId[g.body].index === hit) { this._completeGoal(); return; }
          this.status = 'crashed';
          this.message = 'Crashed into ' + sys.bodies[hit].name + '.';
          return;
        }
      } else if (this.ignoreBody != null) {
        const b = sys.bodies[this.ignoreBody];
        const d = Math.hypot(s.x - sys.px[b.index], s.y - sys.py[b.index]);
        if (d > b.radius * 1.05) this.ignoreBody = null;
      }

      const g = this.currentGoal();
      if (g) {
        const ref = this.goalPoint(g);
        const dx = s.x - ref.x, dy = s.y - ref.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (g.type === 'reach' && d < g.r) this._completeGoal();
        else if (g.type === 'orbit') {
          if (d >= g.rMin && d <= g.rMax) {
            this.holdTime += h;
            if (this.holdTime >= g.hold) this._completeGoal();
          } else this.holdTime = 0;
        } else if (g.type === 'rendezvous') {
          const dv = Math.hypot(s.vx - ref.vx, s.vy - ref.vy);
          if (d < g.dist && dv < g.relVel) this._completeGoal();
        }
      }

      if (this.status !== 'flying') return;
      if (Math.hypot(s.x, s.y) > L.bounds) { this.status = 'lost'; this.message = 'Lost in deep space.'; }
      else if (this.t > L.tMax) { this.status = 'timeout'; this.message = 'Mission clock ran out.'; }
    }

    currentGoal() { return this.level.goals[this.goalIndex] || null; }

    // Position/velocity a goal is measured against at the current time.
    goalPoint(g, t) {
      const sys = this.sys;
      sys.update(t == null ? this.t : t);
      if (g.body) {
        const i = sys.byId[g.body].index;
        return { x: sys.px[i], y: sys.py[i], vx: sys.vx[i], vy: sys.vy[i], body: i };
      }
      return { x: g.x, y: g.y, vx: 0, vy: 0, body: -1 };
    }

    _completeGoal() {
      this.events.push({ t: this.t, type: 'goal', index: this.goalIndex });
      this.goalIndex++;
      this.holdTime = 0;
      if (this.goalIndex >= this.level.goals.length) {
        this.status = 'won';
        this.message = 'Mission complete!';
      }
    }

    stars() {
      if (this.status !== 'won') return 0;
      const used = this.dvUsed(), par = this.level.par;
      if (used <= par) return 3;
      if (used <= par * 1.4) return 2;
      return 1;
    }
  }

  const Flight = { Mission, FIXED_DT };
  if (typeof module !== 'undefined' && module.exports) module.exports = Flight;
  else root.Flight = Flight;
})(typeof window !== 'undefined' ? window : globalThis);
