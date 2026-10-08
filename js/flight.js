// Mission simulation: the ship, its engines, and the level objectives.
// Pure logic (no rendering) so it can run headless in Node for testing.
(function (root) {
  'use strict';
  const Phys = root.Phys || (typeof require !== 'undefined' ? require('./physics.js') : null);

  const FIXED_DT = 1 / 120;      // step size while engines fire
  const MAX_COAST_DT = 0.25;     // largest coast step

  // Ship spec (level.ship):
  //   start: { landed: { body, angle } }
  //        | { orbit: { body, r, angle, dir?, speed? } }   speed = fraction of circular
  //        | { free: { x, y, vx?, vy? } }
  //   heading: initial heading in radians, or 'prograde' / 'retrograde' / 'up'
  //   stages: [{ dryMass, fuel, thrust, ve }]   (stage 0 fires first)
  //   rcs: { fuel, accel, maxRate }             (side thrusters)
  //   Gyro assist (Mission.gyro) damps spin automatically when there's no
  //   rotation input. It starts off; switching it on marks the run as
  //   assisted, which caps the rating at two stars.
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
      this.t = spec.start.t || 0; // a mission may begin mid-flight (used by tools)
      this.status = 'flying';   // flying | won | crashed | lost | timeout
      this.message = '';
      this.goalIndex = 0;
      this.holdTime = 0;
      this.events = [];
      this.thrusting = false;
      this.rotInput = 0;
      this.rotHeld = 0;    // seconds the current rotation input has been held
      this.rotLatch = 0;   // input that just stopped a spin; ignored until released
      this.gyro = false;
      this.assisted = false;
      this.debris = [];          // spent stages left behind after deploying
      this.cargo = (spec.cargo || []).map(c => Object.assign({}, c)); // aboard, not yet dropped
      this.crafts = [];          // dropped cargo, coasting on its own
      this.collected = new Set(); // fuel pickups already taken
      this.done = new Set();      // later goals a craft completed early (e.g. the second probe landed first)
      this.dvGained = 0;          // Δv added by pickups
      this.dvSpent = 0;           // Δv actually burned (thrust / mass, integrated)
      this.ship = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, omega: 0 };
      this.landed = null;
      this._initShip(spec);
      this.dv0 = this.dvRemaining();
      this.stageDv0 = this.stages.map((_, k) => this.stageDv(k));
    }

    _initShip(spec) {
      const sys = this.sys, s = this.ship;
      sys.update(this.t);
      if (spec.start.landed) {
        const b = sys.byId[spec.start.landed.body];
        this.landed = { body: b.index, theta0: spec.start.landed.angle };
        this._syncLanded();
        return;
      }
      if (spec.start.free) {
        const f = spec.start.free;
        s.x = f.x; s.y = f.y; s.vx = f.vx || 0; s.vy = f.vy || 0;
        s.angle = typeof spec.heading === 'number' ? spec.heading : 0;
        return;
      }
      const o = spec.start.orbit;
      const b = sys.byId[o.body], i = b.index;
      const dir = o.dir || 1, v = (o.speed || 1) * Math.sqrt(b.gm / o.r);
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

    cargoMass() { return this.cargo.reduce((a, c) => a + c.mass, 0); }

    mass() {
      let m = this.cargoMass();
      for (let i = this.stage; i < this.stages.length; i++) m += this.stages[i].dryMass + this.stages[i].fuel;
      return m;
    }

    // Tsiolkovsky Δv left across all remaining stages.
    dvRemaining() {
      let dv = 0;
      for (let k = this.stage; k < this.stages.length; k++) {
        let m = this.cargoMass();
        for (let i = k; i < this.stages.length; i++) m += this.stages[i].dryMass + this.stages[i].fuel;
        const st = this.stages[k];
        dv += st.ve * Math.log(m / (m - st.fuel));
      }
      return dv;
    }

    // Δv left in stage k alone, with every later stage still attached.
    stageDv(k) {
      if (k < this.stage) return 0;
      let m = this.cargoMass();
      for (let i = k; i < this.stages.length; i++) m += this.stages[i].dryMass + this.stages[i].fuel;
      const st = this.stages[k];
      return st.ve * Math.log(m / (m - st.fuel));
    }

    // Δv actually burned. Dropping cargo or a stage makes the rest of the
    // ship lighter (more Δv left in the tank), but that isn't Δv you spent.
    dvUsed() { return this.dvSpent; }

    // Can the current stage be dropped to fly the next one (e.g. a payload)?
    canDeploy() { return this.stage < this.stages.length - 1 && !this.landed && this.status === 'flying'; }

    // Cargo rides on the top stage, so it can only go once every stage below
    // it has been dropped: a rocket comes apart from the bottom up.
    canDrop() { return this.cargo.length > 0 && this.stage === this.stages.length - 1 && !this.landed && this.status === 'flying'; }

    // Drop the next piece of cargo. It has no engine: it keeps the ship's exact
    // position and velocity and coasts on its own, so the ship's predicted
    // path at the moment of release is exactly where the cargo will go.
    release() {
      if (!this.canDrop()) return null;
      const c = this.cargo.shift(), s = this.ship;
      const craft = { id: c.id, name: c.name, sprite: c.sprite || 'pod', x: s.x, y: s.y, vx: s.vx, vy: s.vy, angle: s.angle, alive: true };
      this.crafts.push(craft);
      this.events.push({ t: this.t, type: 'release', craft: c.id });
      return craft;
    }

    // A dropped craft, or a spent stage (goals can ask where a booster lands).
    craftById(id) { return this.crafts.find(c => c.id === id) || this.debris.find(d => d.id === id) || null; }

    // A dropped craft touched a body: that either completes its landing goal
    // or fails the mission if it still had work to do.
    _craftHit(c, idx) {
      const sys = this.sys, b = sys.bodies[idx], goals = this.level.goals;
      // Its impact goal, even if an earlier goal is still open (probes can
      // land in either order).
      for (let j = this.goalIndex; j < goals.length; j++) {
        const g = goals[j];
        if (g.craft !== c.id || g.type !== 'hit' || sys.byId[g.body].index !== idx || this.done.has(j)) continue;
        if (!this.siteOk(g, c.x, c.y, this.t)) {
          this.status = 'crashed'; this.message = c.name + ' missed the landing zone on ' + b.name + '.';
          return;
        }
        if (j === this.goalIndex) this._completeGoal(); else this.done.add(j);
        return;
      }
      if (this.level.goals.slice(this.goalIndex).some(q => q.craft === c.id)) {
        this.status = 'crashed'; this.message = c.name + ' crashed into ' + b.name + '.';
      }
    }

    // Separate: the spent stage drifts away as debris, control passes to the
    // next stage. A small spring push nudges the old stage backwards.
    deploy() {
      if (!this.canDeploy()) return false;
      const s = this.ship, push = 0.4, st = this.stageSpec;
      this.debris.push({
        id: st.id || 'stage' + (this.stage + 1), name: st.name || 'Booster',
        x: s.x, y: s.y, vx: s.vx - push * Math.cos(s.angle), vy: s.vy - push * Math.sin(s.angle),
        angle: s.angle, omega: s.omega + 0.6, alive: true, sprite: this.stageSpec.sprite || 'booster',
      });
      this.stage++;
      this.events.push({ t: this.t, type: 'deploy', stage: this.stage });
      const d = this.debris[this.debris.length - 1];
      d.fate = this.debrisFate(d);
      if (d.fate.kind === 'cross') {
        // It would miss this time around but its orbit crosses the protected
        // object's, so the two meet sooner or later. Fail now and say why.
        this.status = 'crashed';
        this.message = 'Your spent stage is stuck in an orbit that crosses ' + d.fate.name + '\'s. Sooner or later they collide.';
      }
      return true;
    }

    // Where will a spent stage end up? It has no engine, so this is known the
    // moment it's dropped. Fly a copy forward until it hits the ground (fine:
    // let it burn up), comes near a protected object ('hit'), or has gone round
    // once. A stage still in a bound orbit that crosses a protected object's
    // orbit will meet it eventually ('cross'). Returns the sampled path too.
    debrisFate(d0) {
      const sys = this.sys, prot = sys.bodies.filter(b => b.protect);
      const s = { x: d0.x, y: d0.y, vx: d0.vx, vy: d0.vy };
      sys.update(this.t);
      const H = sys.dominant(s.x, s.y, this.t), hb = sys.bodies[H];
      const orb = this.orbitAbout({ x: sys.px[H], y: sys.py[H], vx: sys.vx[H], vy: sys.vy[H] }, hb.id, s);
      const period = orb.bound ? 2 * Math.PI * Math.sqrt(Math.pow((orb.pe + orb.ap) / 2, 3) / hb.gm) : 0;
      const horizon = orb.bound ? Math.min(1.05 * period, 3000) : 600;
      const ts = [this.t], xs = [s.x], ys = [s.y];
      let t = this.t;
      const fate = (kind, extra) => Object.assign({ kind, t, ts, xs, ys, orbit: orb, host: H }, extra);
      for (let step = 0; step < 20000 && t < this.t + horizon; step++) {
        const dt = Phys.coastDt(sys, s, t, 0.002, 2);
        Phys.rk4(sys, s, t, dt, 0, 0);
        t += dt;
        ts.push(t); xs.push(s.x); ys.push(s.y);
        if (Phys.collision(sys, s.x, s.y, t) >= 0) return fate('ground');
        for (const b of prot) {
          const r = b.protectRadius || b.radius;
          if ((s.x - sys.px[b.index]) ** 2 + (s.y - sys.py[b.index]) ** 2 < r * r) return fate('hit', { body: b.index, name: b.name });
        }
        if (s.x * s.x + s.y * s.y > this.level.bounds * this.level.bounds) return fate('gone');
      }
      if (orb.bound) {
        for (const b of prot) {
          if (!b.orbit || b.parent !== H) continue;
          const r = b.protectRadius || b.radius, o = b.orbit;
          if (orb.pe <= o.a * (1 + o.e) + r && orb.ap >= o.a * (1 - o.e) - r) {
            return fate('cross', { body: b.index, name: b.name, band: [o.a * (1 - o.e) - r, o.a * (1 + o.e) + r] });
          }
        }
      }
      return fate('safe');
    }

    thrustAccel() { const st = this.stageSpec; return st ? st.thrust / this.mass() : 0; }

    // Advance the mission by `dt` seconds of game time.
    // controls: { thrust: bool, throttle: 0..1, rotate: -1|0|1 }
    advance(dt, controls) {
      if (this.status !== 'flying') return;
      const spec = this.level.ship;
      if (this.gyro && !this.landed) this.assisted = true;
      let remaining = dt;
      while (remaining > 1e-9 && this.status === 'flying') {
        const st = this.stageSpec;
        const firing = controls.thrust && st && st.fuel > 0 && controls.throttle > 0;
        const canRot = spec.canRotate !== false && spec.rcs && this.rcsFuel > 0 && !this.landed;
        // Counter-firing stops the spin dead at zero; keep holding and nothing
        // more happens until the key is released and pressed again.
        if (controls.rotate !== this.rotLatch) this.rotLatch = 0;
        const rotIn = this.rotLatch ? 0 : controls.rotate;
        if (rotIn === 0) this.rotHeld = 0;
        const rotating = canRot && rotIn !== 0;
        const gyroWork = canRot && this.gyro && !rotating && Math.abs(this.ship.omega) > 1e-4;
        let h;
        if (firing || rotating || gyroWork || this.landed) h = Math.min(remaining, FIXED_DT);
        else h = Math.min(remaining, Phys.coastDt(this.sys, this.ship, this.t, 0.002, MAX_COAST_DT));
        this.thrusting = firing;
        this.rotInput = rotating ? rotIn : 0;
        this._step(h, firing ? controls.throttle : 0, rotating ? rotIn : 0, gyroWork);
        remaining -= h;
      }
    }

    _step(h, throttle, rot, gyroWork) {
      const s = this.ship, sys = this.sys, spec = this.level.ship;

      // Side thrusters: torque → angular velocity → heading.
      if (spec.rcs && !this.landed) {
        const r = spec.rcs;
        if (rot !== 0) {
          // Thrusters ramp up while held: taps give fine nudges, holds turn fast.
          this.rotHeld += h;
          const a = r.accel * Math.min(1, 0.3 + this.rotHeld / 0.8);
          const w = s.omega + rot * a * h;
          if (s.omega !== 0 && Math.sign(w) !== Math.sign(s.omega)) {
            s.omega = 0;
            this.rotLatch = rot;
          } else s.omega = w;
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
        this.dvSpent += a * h;
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
          this.launchBody = b.index;
          this.liftoffT = this.t;
          this.events.push({ t: this.t, type: 'liftoff' });
        } else {
          this.t += h;
          this._syncLanded();
          if (this.t > this.level.tMax) { this.status = 'timeout'; this.message = 'Mission clock ran out.'; }
          return;
        }
      }

      Phys.rk4(sys, s, this.t, h, tax, tay);
      for (const d of this.debris) {
        if (!d.alive) continue;
        Phys.rk4(sys, d, this.t, h, 0, 0);
        d.angle += d.omega * h;
        const hit = Phys.collision(sys, d.x, d.y, this.t + h);
        if (hit >= 0) { d.alive = false; d.crashT = this.t + h; this.t += h; this._craftHit(d, hit); this.t -= h; }
        // Protected objects (e.g. a crewed station) must never be hit by debris.
        for (const b of sys.bodies) {
          if (!b.protect) continue;
          const r = b.protectRadius || b.radius;
          if ((d.x - sys.px[b.index]) ** 2 + (d.y - sys.py[b.index]) ** 2 < r * r) {
            d.alive = false; d.crashT = this.t + h;
            this.status = 'crashed'; this.message = 'Your spent stage hit ' + b.name + '.';
          }
        }
      }
      for (const c of this.crafts) {
        if (!c.alive) continue;
        Phys.rk4(sys, c, this.t, h, 0, 0);
        const hit = Phys.collision(sys, c.x, c.y, this.t + h);
        if (hit >= 0) { c.alive = false; c.hitT = this.t + h; c.hit = hit; this.t += h; this._craftHit(c, hit); this.t -= h; }
      }
      this.t += h;
      this._checks(h);
    }

    _checks(h) {
      if (this.status !== 'flying') return;
      const sys = this.sys, s = this.ship, L = this.level;
      sys.update(this.t);
      // Fuel pickups: fly through to top up the current stage by a fixed Δv.
      for (const b of sys.bodies) {
        if (!b.pickup || this.collected.has(b.index)) continue;
        const r = b.radius + 6;
        if ((s.x - sys.px[b.index]) ** 2 + (s.y - sys.py[b.index]) ** 2 < r * r) {
          this.collected.add(b.index);
          const st = this.stageSpec;
          if (st) {
            st.fuel += this.mass() * (Math.exp(b.dv / st.ve) - 1);
            this.dvGained += b.dv;
          }
          this.events.push({ t: this.t, type: 'pickup', dv: b.dv, body: b.index });
        }
      }
      // Keep-out zones (e.g. around a crewed station): the ship may not enter.
      for (const b of sys.bodies) {
        if (!b.keepOut) continue;
        if ((s.x - sys.px[b.index]) ** 2 + (s.y - sys.py[b.index]) ** 2 < b.keepOut * b.keepOut) {
          this.status = 'crashed'; this.message = 'You flew into ' + b.name + '\'s keep-out zone.';
          return;
        }
      }
      const hit = Phys.collision(sys, s.x, s.y, this.t);
      if (hit >= 0) {
        const pad = hit === this.ignoreBody ? sys.bodies[hit] : null;
        if (pad && Math.hypot(s.x - sys.px[hit], s.y - sys.py[hit]) > pad.radius * 0.99) {
          // Still clearing the launch pad.
        } else {
          const g = this.currentGoal();
          if (g && g.type === 'hit' && !g.craft && sys.byId[g.body].index === hit) {
            if (this.siteOk(g, s.x, s.y, this.t)) { this._completeGoal(); return; }
            this.status = 'crashed';
            this.message = 'Missed the landing zone on ' + sys.bodies[hit].name + '.';
            return;
          }
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
      // A goal may belong to a dropped craft instead of the ship ("the pod must…").
      const o = g && g.craft ? this.craftById(g.craft) : s;
      if (g && g.type === 'spread') this._spread(g, h);
      else if (g && o && o.alive !== false) {
        const ref = this.goalPoint(g);
        const dx = o.x - ref.x, dy = o.y - ref.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (g.type === 'reach' && d < g.r) this._completeGoal();
        else if (g.type === 'escape' && d > g.r) this._completeGoal();
        else if (g.type === 'hold') {
          // Park at a point (e.g. a Lagrange point): inside the zone AND
          // moving with it, so drifting through slowly doesn't count.
          const rv = Math.hypot(o.vx - ref.vx, o.vy - ref.vy);
          this.goalErr = Math.max(0, d - g.r) + 20 * Math.max(0, rv - (g.relVel || 1));
          if (d < g.r && rv < (g.relVel || 1)) {
            this.holdTime += h;
            if (this.holdTime >= g.hold) this._completeGoal();
          } else this.holdTime = 0;
        } else if (g.type === 'orbit') {
          // The whole orbit must fit in the band, not just where you are now:
          // its lowest and highest points (two-body orbit about the target)
          // must both lie inside it, in the required direction, confirmed for
          // a few seconds with the engine off.
          const orb = this.orbitAbout(ref, g.body, o);
          this.orbitNow = orb;
          const dirOk = !g.dir || g.dir === orb.dir;
          this.goalErr = orb.bound ? Math.max(0, g.rMin - orb.pe) + Math.max(0, orb.ap - g.rMax) + (dirOk ? 0 : 200) : 300;
          if (orb.bound && orb.pe >= g.rMin && orb.ap <= g.rMax && dirOk && (o !== s || !this.thrusting)) {
            this.holdTime += h;
            if (this.holdTime >= (g.confirm || 3)) this._completeGoal();
          } else this.holdTime = 0;
        } else if (g.type === 'rendezvous') {
          const dv = Math.hypot(o.vx - ref.vx, o.vy - ref.vy);
          if (d < g.dist && dv < g.relVel) this._completeGoal();
        }
      }

      if (this.status !== 'flying') return;
      if (Math.hypot(s.x, s.y) > L.bounds) { this.status = 'lost'; this.message = 'Lost in deep space.'; }
      else if (this.t > L.tMax) { this.status = 'timeout'; this.message = 'Mission clock ran out.'; }
    }

    // Constellation: every listed craft in an orbit inside the band, spaced
    // at least minSep radians apart around the body.
    spreadState(g) {
      const ref = this.goalPoint(g), list = g.crafts.map(id => this.craftById(id));
      let inBand = 0, err = 0;
      const angs = [];
      for (const c of list) {
        if (!c || !c.alive) { err += 300; continue; }
        const orb = this.orbitAbout(ref, g.body, c);
        const e = orb.bound ? Math.max(0, g.rMin - orb.pe) + Math.max(0, orb.ap - g.rMax) : 300;
        if (e === 0) inBand++;
        err += e;
        angs.push(Math.atan2(c.y - ref.y, c.x - ref.x));
      }
      let sep = Infinity;
      for (let i = 0; i < angs.length; i++) for (let j = i + 1; j < angs.length; j++) {
        let d = Math.abs(angs[i] - angs[j]) % (2 * Math.PI);
        sep = Math.min(sep, Math.min(d, 2 * Math.PI - d));
      }
      if (angs.length < 2) sep = 0;
      err += 100 * Math.max(0, g.minSep - sep);
      return { inBand, total: list.length, sep, err, ok: inBand === list.length && sep >= g.minSep };
    }

    _spread(g, h) {
      const st = this.spreadState(g);
      this.goalErr = st.err;
      if (st.ok) {
        this.holdTime += h;
        if (this.holdTime >= (g.confirm || 3)) this._completeGoal();
      } else this.holdTime = 0;
    }

    // Osculating two-body orbit of the ship about a body: distances of its
    // lowest (pe) and highest (ap) points from the body's centre.
    orbitAbout(ref, bodyId, obj) {
      const s = obj || this.ship, gm = this.sys.byId[bodyId].gm;
      const rx = s.x - ref.x, ry = s.y - ref.y, vx = s.vx - ref.vx, vy = s.vy - ref.vy;
      const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy;
      const eps = v2 / 2 - gm / r, h = rx * vy - ry * vx;
      const e = Math.sqrt(Math.max(0, 1 + 2 * eps * h * h / (gm * gm)));
      if (eps >= 0) return { bound: false, pe: h * h / (gm * (1 + e)), ap: Infinity, dir: h > 0 ? 1 : -1 };
      const a = -gm / (2 * eps);
      return { bound: true, pe: a * (1 - e), ap: a * (1 + e), dir: h > 0 ? 1 : -1 };
    }

    currentGoal() { return this.level.goals[this.goalIndex] || null; }

    // Position/velocity a goal is measured against at the current time.
    goalPoint(g, t) {
      const sys = this.sys;
      sys.update(t == null ? this.t : t);
      if (g.lagrange) {
        // Point sharing the body's orbit, `lead` radians ahead of it (L4 = +60°).
        const b = sys.byId[g.lagrange.body], i = b.index, p = b.parent;
        const c = Math.cos(g.lagrange.lead), sn = Math.sin(g.lagrange.lead);
        const rx = sys.px[i] - sys.px[p], ry = sys.py[i] - sys.py[p];
        const ux = sys.vx[i] - sys.vx[p], uy = sys.vy[i] - sys.vy[p];
        return {
          x: sys.px[p] + rx * c - ry * sn, y: sys.py[p] + rx * sn + ry * c,
          vx: sys.vx[p] + ux * c - uy * sn, vy: sys.vy[p] + ux * sn + uy * c, body: -1,
        };
      }
      if (g.body) {
        const i = sys.byId[g.body].index;
        return { x: sys.px[i], y: sys.py[i], vx: sys.vx[i], vy: sys.vy[i], body: i };
      }
      return { x: g.x, y: g.y, vx: 0, vy: 0, body: -1 };
    }

    // For a 'hit' goal with a landing site, is (x, y) at time t inside it?
    // site: { angle, width } in the body's own rotating frame.
    siteOk(g, x, y, t) {
      if (!g.site) return true;
      const sys = this.sys, b = sys.byId[g.body];
      sys.update(t);
      const a = Math.atan2(y - sys.py[b.index], x - sys.px[b.index]) - b.spin * t;
      let d = (a - g.site.angle) % (2 * Math.PI);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      return Math.abs(d) <= g.site.width / 2;
    }

    _completeGoal() {
      this.events.push({ t: this.t, type: 'goal', index: this.goalIndex });
      this.goalIndex++;
      while (this.done.has(this.goalIndex)) {
        this.events.push({ t: this.t, type: 'goal', index: this.goalIndex });
        this.goalIndex++;
      }
      this.holdTime = 0;
      if (this.goalIndex >= this.level.goals.length) {
        // A spent stage still on its way into a protected object spoils the win.
        const doomed = this.debris.find(d => d.alive && d.fate && d.fate.kind === 'hit');
        if (doomed) {
          this.status = 'crashed';
          this.message = 'Your spent stage is about to hit ' + doomed.fate.name + '.';
          return;
        }
        this.status = 'won';
        this.message = 'Mission complete!';
      }
    }

    // Score rewards finishing, fuel efficiency against par, speed and flying
    // without gyro assist. Max 6500.
    score() {
      if (this.status !== 'won') return 0;
      const L = this.level, used = Math.max(this.dvUsed(), 0.01);
      const fuel = 4000 * Math.min(1.25, L.par / used) / 1.25;
      const time = 1000 * Math.max(0, 1 - this.t / L.tMax);
      const unassisted = this.assisted ? 0 : 500;
      return Math.round((1000 + fuel + time + unassisted) / 10) * 10;
    }

    stars() {
      if (this.status !== 'won') return 0;
      const used = this.dvUsed(), par = this.level.par;
      if (used <= par && !this.assisted) return 3;
      if (used <= par * 1.4) return 2;
      return 1;
    }
  }

  const Flight = { Mission, FIXED_DT };
  if (typeof module !== 'undefined' && module.exports) module.exports = Flight;
  else root.Flight = Flight;
})(typeof window !== 'undefined' ? window : globalThis);
