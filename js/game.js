// Thrusterz game client: rendering, input, HUD and menus.
(function () {
  'use strict';
  const { LEVELS } = Levels;
  const { Mission } = Flight;

  const WARPS = [1, 2, 5, 10, 25, 50, 100];
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);

  const canvas = $('view');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  // ---------------------------------------------------------------- state
  const state = {
    screen: 'menu',
    levelIndex: 0,
    mission: null,
    paused: false,
    warp: 0,
    throttle: 1,
    coach: { done: new Set(), key: null, idle: 0, spinIdle: 0 },
    frameMode: 'auto',     // 'auto' | 'inertial' | body index
    predictScale: 1,
    cam: { x: 0, y: 0, zoom: 1, follow: true, tx: 0, ty: 0, tzoom: 1 },
    pred: null, predT: -1, predDirty: true,
    trail: [],
    particles: [],
    rails: [],
    stars: [],
    resultShown: false, endTime: 0,
    toastTimer: 0,
  };

  const keys = new Set();
  const touch = { rotL: false, rotR: false, burn: false };

  // ------------------------------------------------------------- progress
  const STORE = 'thrusterz.progress.v1';
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE)) || { unlocked: 0, stars: {}, best: {} }; }
    catch (e) { return { unlocked: 0, stars: {}, best: {} }; }
  }
  function saveProgress() { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) { /* ignore */ } }
  const progress = loadProgress();
  if (/[?&]unlock/.test(location.search)) progress.unlocked = LEVELS.length - 1;

  // ---------------------------------------------------------------- setup
  // The canvas fills the screen through CSS; its pixel buffer must always match
  // the box it is actually shown in, or everything is drawn stretched. Phones
  // change that box after the resize event (rotation, browser bars, entering
  // fullscreen), so the frame loop re-checks it every frame.
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width || window.innerWidth; H = r.height || window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  }
  function syncSize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (Math.abs(r.width - W) > 0.5 || Math.abs(r.height - H) > 0.5 || dpr !== DPR) resize();
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();

  function makeStars() {
    let seed = 12345;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    state.stars = [];
    for (let i = 0; i < 420; i++) {
      state.stars.push({ x: rnd(), y: rnd(), z: 0.2 + rnd() * 0.8, b: 0.3 + rnd() * 0.7, c: rnd() < 0.15 ? (rnd() < 0.5 ? '#ffd9a8' : '#a8c8ff') : '#ffffff' });
    }
  }
  makeStars();

  // ---------------------------------------------------------------- level
  function startLevel(i) {
    state.levelIndex = i;
    const level = LEVELS[i];
    state.mission = new Mission(level);
    state.warp = 0;
    state.throttle = 1;
    state.coach = { done: new Set(), key: null, idle: 0, spinIdle: 0 };
    state.eventsSeen = 0;
    state.frameMode = 'auto';
    state.predictScale = 1;
    state.trail = [];
    state.particles = [];
    state.pred = null; state.predDirty = true;
    state.resultShown = false;
    state.paused = false;
    buildRails();
    const m = state.mission;
    const zoom = Math.min(W, H) / level.view.span;
    state.cam.follow = true;
    state.cam.zoom = state.cam.tzoom = Math.max(zoom * 2.2, Math.min(W, H) / 420);
    state.cam.x = m.ship.x; state.cam.y = m.ship.y;
    if (level.startCam === 'overview') { overview(true); state.cam.x = state.cam.tx; state.cam.y = state.cam.ty; state.cam.zoom = state.cam.tzoom; }
    setupHud();
    show('hud');
    hide('menu'); hide('briefing'); hide('result'); hide('pause'); hide('help');
    state.screen = 'flight';
    $('coach').classList.remove('show');
  }

  // Precompute each orbiting body's path relative to its parent barycenter.
  function buildRails() {
    const sys = state.mission.sys;
    state.rails = [];
    for (const b of sys.bodies) {
      if (!b.orbit || b.hidden || b.noRail) continue;
      const P = sys.period(b.index), pts = [];
      const N = b.orbit.e > 0.3 ? 240 : 128;
      for (let k = 0; k <= N; k++) {
        const t = P * k / N;
        sys.update(t);
        pts.push([sys.px[b.index] - sys.nx[b.parent], sys.py[b.index] - sys.ny[b.parent]]);
      }
      state.rails.push({ body: b.index, parent: b.parent, pts });
    }
    sys.update(0);
  }

  // ------------------------------------------------------- frame / camera
  // The reference frame body, or -1 for inertial.
  function frameBody() {
    const m = state.mission;
    if (state.frameMode === 'inertial') return -1;
    if (state.frameMode === 'auto') {
      // Innermost sphere of influence; outside all of them, the body pulling
      // hardest (e.g. the star you're orbiting).
      const h = m.sys.host(m.ship.x, m.ship.y, m.t);
      return h >= 0 ? h : m.sys.dominant(m.ship.x, m.ship.y, m.t);
    }
    return state.frameMode;
  }

  function frameName() {
    const f = frameBody();
    const name = f < 0 ? 'Inertial' : state.mission.sys.bodies[f].name;
    return state.frameMode === 'auto' ? 'Auto · ' + name : name;
  }

  function deployPayload() {
    const m = state.mission;
    if (!m.deploy()) { if (m.status === 'flying') toast(m.landed ? 'Launch first' : 'Nothing to deploy', 1.2); return; }
    coachDone('deploy');
    state.predDirty = true;
    toast(m.stageSpec.name + ' deployed', 1.5);
  }

  function toggleGyro() {
    const m = state.mission;
    if (!m.level.ship.canRotate) { toast('No side thrusters on this ship', 1.5); return; }
    m.gyro = !m.gyro;
    coachDone('gyro');
    toast(m.gyro ? 'Gyro assist ON · this run is capped at ★★' : 'Gyro assist OFF', 2);
  }

  function cycleFrame() {
    const sys = state.mission.sys;
    const opts = ['auto', 'inertial', ...sys.grav.filter(i => !sys.bodies[i].hidden)];
    const k = opts.indexOf(state.frameMode);
    state.frameMode = opts[(k + 1) % opts.length];
    state.predDirty = true;
    toast('Reference frame: ' + frameName(), 1.5);
  }

  function w2s(x, y) {
    const c = state.cam;
    return [(x - c.x) * c.zoom + W / 2, H / 2 - (y - c.y) * c.zoom];
  }
  function s2w(sx, sy) {
    const c = state.cam;
    return [(sx - W / 2) / c.zoom + c.x, (H / 2 - sy) / c.zoom + c.y];
  }

  // -------------------------------------------------------------- input
  const KEYMAP = {
    Space: 'burn', ArrowLeft: 'rotL', KeyA: 'rotL', ArrowRight: 'rotR', KeyD: 'rotR',
  };
  window.addEventListener('keydown', (e) => {
    if (state.screen === 'briefing' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); startLevel(state.levelIndex); return; }
    if (state.screen === 'result' && e.code === 'Enter') { e.preventDefault(); $('btn-res-next').click(); return; }
    if (state.screen !== 'flight') return;
    if (KEYMAP[e.code] || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat && !['KeyW', 'KeyS'].includes(e.code)) { keys.add(e.code); return; }
    keys.add(e.code);
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') startPulse(1);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') startPulse(-1);
    const m = state.mission;
    switch (e.code) {
      case 'Escape': togglePause(); break;
      case 'KeyR': startLevel(state.levelIndex); break;
      case 'Period': case 'Equal': setWarp(state.warp + 1); break;
      case 'Comma': case 'Minus': setWarp(state.warp - 1); break;
      case 'KeyW': case 'ShiftLeft': state.throttle = Math.min(1, Math.round(state.throttle * 10 + 1) / 10); break;
      case 'KeyS': case 'ControlLeft': state.throttle = Math.max(0.1, Math.round(state.throttle * 10 - 1) / 10); break;
      case 'KeyZ': state.throttle = 1; break;
      case 'KeyG': toggleGyro(); break;
      case 'KeyE': deployPayload(); break;
      case 'KeyV': cycleFrame(); coachDone('frame'); break;
      case 'KeyF': followShip(); break;
      case 'KeyO': overview(); break;
      case 'BracketLeft': state.predictScale = Math.max(0.25, state.predictScale / 1.5); state.predDirty = true; break;
      case 'BracketRight': state.predictScale = Math.min(6, state.predictScale * 1.5); state.predDirty = true; break;
      case 'KeyH': show('help'); state.paused = true; break;
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  function followShip() {
    state.cam.follow = true;
    state.cam.tzoom = Math.max(state.cam.zoom, Math.min(W, H) / 420);
    coachDone('camera');
  }

  function overview(auto) {
    if (!auto) coachDone('camera');
    const v = state.mission.level.view;
    state.cam.follow = false;
    state.cam.tx = v.x; state.cam.ty = v.y;
    state.cam.tzoom = Math.min(W, H) / v.span;
  }

  // Mouse: wheel zoom, drag to pan.
  let drag = null;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const c = state.cam, f = Math.exp(-e.deltaY * 0.0015);
    const nz = Math.max(0.02, Math.min(40, c.tzoom * f));
    if (!c.follow) {
      const [wx, wy] = s2w(e.clientX, e.clientY);
      c.tx = wx - (wx - c.tx) * c.zoom / nz; c.ty = wy - (wy - c.ty) * c.zoom / nz;
      c.x = c.tx; c.y = c.ty;
    }
    c.tzoom = nz; c.zoom = nz;
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    drag = { x: e.clientX, y: e.clientY, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    const c = state.cam;
    if (c.follow) { c.follow = false; c.tx = c.x; c.ty = c.y; }
    c.tx -= dx / c.zoom; c.ty += dy / c.zoom; c.x = c.tx; c.y = c.ty;
    drag.x = e.clientX; drag.y = e.clientY;
  });
  window.addEventListener('pointerup', () => { drag = null; });

  // Touch: on-screen buttons + pinch zoom.
  for (const btn of document.querySelectorAll('#touch button')) {
    const k = btn.dataset.key;
    const on = (e) => {
      e.preventDefault();
      if (k === 'warpUp') setWarp(state.warp + 1);
      else if (k === 'warpDown') setWarp(state.warp - 1);
      else if (k === 'frame') { if (state.mission) { cycleFrame(); coachDone('frame'); } }
      else if (k === 'gyro') { if (state.mission) toggleGyro(); }
      else if (k === 'deploy') { if (state.mission) deployPayload(); }
      else if (k === 'cam') { if (state.mission) (state.cam.follow ? overview() : followShip()); }
      else {
        touch[k] = true;
        if (k === 'rotL') startPulse(1);
        if (k === 'rotR') startPulse(-1);
      }
      btn.classList.add('on');
    };
    const off = (e) => { e.preventDefault(); if (k in touch) touch[k] = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
  }
  let pinch = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: state.cam.tzoom };
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (pinch && e.touches.length === 2) {
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      state.cam.tzoom = state.cam.zoom = Math.max(0.02, Math.min(40, pinch.z * d / pinch.d));
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = null; }, { passive: true });
  const isTouch = () => document.body.classList.contains('touch');
  if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  window.addEventListener('touchstart', () => {
    if (!isTouch()) { document.body.classList.add('touch'); state.coach.id = null; updateGate(); }
  }, { once: true, passive: true });

  // A quick tap still fires the side thrusters for a minimum pulse, so every
  // tap is the same small, repeatable nudge.
  const PULSE_MS = 80;
  const pulse = { dir: 0, until: 0 };
  function startPulse(dir) { pulse.dir = dir; pulse.until = performance.now() + PULSE_MS; }

  function controls() {
    let rotate = ((keys.has('ArrowLeft') || keys.has('KeyA') || touch.rotL) ? 1 : 0) -
                 ((keys.has('ArrowRight') || keys.has('KeyD') || touch.rotR) ? 1 : 0);
    if (!rotate && pulse.dir && performance.now() < pulse.until) rotate = pulse.dir;
    return { thrust: keys.has('Space') || touch.burn, throttle: state.throttle, rotate };
  }

  function setWarp(k) {
    const m = state.mission;
    k = Math.max(0, Math.min(WARPS.length - 1, k));
    const c = controls();
    if (k > 0 && (c.thrust || c.rotate)) { toast('Can\'t warp while thrusters fire', 1.2); return; }
    if (k > 0 && m.status !== 'flying') return;
    state.warp = k;
    if (k > 0) coachDone('warp');
  }

  // ---------------------------------------------------------------- update
  let lastTime = performance.now();
  function frame(now) {
    syncSize();
    const realDt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (state.screen === 'flight' && !state.paused && $('gate').classList.contains('hidden')) update(realDt);
    render(realDt);
    requestAnimationFrame(frame);
  }

  function update(realDt) {
    const m = state.mission;
    const level = m.level;
    const c = controls();
    if ((c.thrust || c.rotate) && state.warp > 0) { state.warp = 0; }
    const wasFlying = m.status === 'flying';
    const dvBefore = m.dvRemaining();
    m.advance(realDt * WARPS[state.warp], c);

    if (m.dvRemaining() < dvBefore - 1e-9) state.predDirty = true;
    for (; state.eventsSeen < m.events.length; state.eventsSeen++) {
      const ev = m.events[state.eventsSeen];
      if (ev.type === 'pickup') {
        toast('+' + ev.dv.toFixed(1) + ' Δv collected', 1.8);
        confetti(m.ship.x, m.ship.y);
        state.predDirty = true;
      }
    }
    updateCoach(realDt, c);
    if (m.thrusting) spawnExhaust(realDt);
    if (m.rotInput) spawnRcs(m.rotInput);

    // Trail (inertial positions, drawn in the current frame).
    const last = state.trail[state.trail.length - 1];
    if (!m.landed && (!last || m.t - last.t > 0.2 * Math.max(1, WARPS[state.warp] / 5))) {
      state.trail.push({ t: m.t, x: m.ship.x, y: m.ship.y });
      if (state.trail.length > 1500) state.trail.shift();
    }

    // Prediction: recompute when burning, or as the coast eats into it.
    const horizon = level.predict * state.predictScale;
    if (state.predDirty || !state.pred || m.t - state.predT > horizon * 0.03 || m.thrusting) computePrediction();

    if (wasFlying && m.status !== 'flying') onMissionEnd();
    if (m.status !== 'flying' && !state.resultShown && performance.now() - state.endTime > 1600) showResult();

    updateParticles(realDt);
    updateCamera(realDt);
    updateHud();
  }

  function computePrediction() {
    const m = state.mission, level = m.level;
    state.predDirty = false;
    state.predT = m.t;
    if (m.landed || m.status !== 'flying') { state.pred = null; return; }
    const horizon = level.predict * state.predictScale;
    const p = Phys.predict(m.sys, m.ship, m.t, horizon, { bounds: level.bounds, maxSteps: 8000, ignore: m.ignoreBody });
    // Closest approach to the active goal.
    const g = m.currentGoal();
    let ca = null;
    if (g) {
      // Escape goals care about the farthest point, everything else the nearest.
      const sign = g.type === 'escape' ? -1 : 1;
      let best = Infinity, bi = -1;
      for (let i = 0; i < p.ts.length; i++) {
        const q = m.goalPoint(g, p.ts[i]);
        const d = Math.hypot(p.xs[i] - q.x, p.ys[i] - q.y);
        if (sign * d < best) { best = sign * d; bi = i; }
      }
      if (bi > 0) ca = { i: bi, t: p.ts[bi], d: sign * best, goal: g, far: sign < 0 };
    }
    p.ca = ca;
    p.pickups = new Set();
    for (const b of m.sys.bodies) {
      if (!b.pickup || m.collected.has(b.index)) continue;
      const r2 = (b.radius + 6) ** 2;
      for (let i = 0; i < p.ts.length; i += 1) {
        m.sys.update(p.ts[i]);
        if ((p.xs[i] - m.sys.px[b.index]) ** 2 + (p.ys[i] - m.sys.py[b.index]) ** 2 < r2) { p.pickups.add(b.index); break; }
      }
    }
    state.pred = p;
  }

  function onMissionEnd() {
    const m = state.mission;
    state.endTime = performance.now();
    state.warp = 0;
    if (m.status === 'crashed' || (m.status === 'won' && m.level.goals[m.level.goals.length - 1].type === 'hit')) {
      explode(m.ship.x, m.ship.y, m.status === 'won' ? '#9cf7c4' : '#ffb35a');
    }
    if (m.status === 'won') confetti(m.ship.x, m.ship.y);
  }

  function updateCamera(dt) {
    const c = state.cam, m = state.mission;
    const k = 1 - Math.exp(-dt * 6);
    if (c.follow) { c.tx = m.ship.x; c.ty = m.ship.y; }
    // When following, track the ship rigidly so it never lags at high warp.
    if (c.follow) { c.x = c.tx; c.y = c.ty; }
    else { c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; }
    c.zoom += (c.tzoom - c.zoom) * k;
  }

  // ------------------------------------------------------------ particles
  function spawnExhaust(dt) {
    const s = state.mission.ship;
    const n = Math.ceil(60 * dt * state.throttle) + 1;
    const z = state.cam.zoom;
    for (let i = 0; i < n; i++) {
      const a = s.angle + Math.PI + (Math.random() - 0.5) * 0.5;
      const sp = (40 + Math.random() * 60) / z;
      state.particles.push({
        x: s.x - Math.cos(s.angle) * 7 / z, y: s.y - Math.sin(s.angle) * 7 / z,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.25, age: 0, size: 2 + Math.random() * 2.5, kind: 'fire',
      });
    }
  }
  function spawnRcs(dir) {
    const s = state.mission.ship, z = state.cam.zoom;
    for (const side of [1, -1]) {
      const fwd = side; // nose and tail fire opposite ways
      const ox = Math.cos(s.angle) * 6 * fwd / z, oy = Math.sin(s.angle) * 6 * fwd / z;
      const a = s.angle + Math.PI / 2 * -dir * fwd;
      state.particles.push({
        x: s.x + ox, y: s.y + oy, vx: Math.cos(a) * 50 / z, vy: Math.sin(a) * 50 / z,
        life: 0.18, age: 0, size: 1.6, kind: 'rcs',
      });
    }
  }
  function explode(x, y, color) {
    const z = state.cam.zoom;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * TAU, sp = (20 + Math.random() * 120) / z;
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 1.2, age: 0, size: 2 + Math.random() * 3, kind: 'boom', color });
    }
  }
  function confetti(x, y) {
    const z = state.cam.zoom, cols = ['#7cf7d4', '#ffd166', '#f78cff', '#8cb8ff'];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU, sp = (30 + Math.random() * 90) / z;
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2 + Math.random(), age: 0, size: 2.5, kind: 'conf', color: cols[i % 4] });
    }
  }
  function updateParticles(dt) {
    const ps = state.particles;
    for (const p of ps) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; }
    state.particles = ps.filter(p => p.age < p.life);
  }

  // ---------------------------------------------------------------- render
  function render(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, W, H);
    drawStars();
    if (!state.mission || state.screen === 'menu') { drawMenuBackdrop(); return; }
    const m = state.mission, sys = m.sys;
    sys.update(m.t);
    const F = frameBody();
    const fx = F >= 0 ? sys.px[F] : 0, fy = F >= 0 ? sys.py[F] : 0;
    // Display transform for a world point recorded at time t.
    const disp = (x, y, t) => {
      if (F < 0) return w2s(x, y);
      sys.update(t);
      const ox = sys.px[F], oy = sys.py[F];
      return w2s(x - ox + fx, y - oy + fy);
    };

    drawRails();
    drawGoals();
    drawTrail(disp);
    drawPrediction(disp);
    sys.update(m.t);
    drawBodies();
    drawParticles();
    drawShip();
    drawNavMarkers();
    drawEdgeIndicator();
  }

  function drawStars() {
    const c = state.cam;
    for (const s of state.stars) {
      const x = ((s.x * W * 1.3 - c.x * c.zoom * 0.02 * s.z) % W + W) % W;
      const y = ((s.y * H * 1.3 + c.y * c.zoom * 0.02 * s.z) % H + H) % H;
      ctx.globalAlpha = s.b * 0.8;
      ctx.fillStyle = s.c;
      ctx.fillRect(x, y, s.z * 1.6, s.z * 1.6);
    }
    ctx.globalAlpha = 1;
  }

  function drawMenuBackdrop() {
    // Decorative orbiting dots behind the menu.
    const t = performance.now() / 1000, cx = W / 2, cy = H * 0.55;
    ctx.strokeStyle = 'rgba(120,160,255,0.08)';
    ctx.lineWidth = 1;
    for (const r of [140, 230, 340, 470]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    g.addColorStop(0, 'rgba(255,207,90,0.5)'); g.addColorStop(1, 'rgba(255,207,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 60, 0, TAU); ctx.fill();
    [[140, 0.5, '#4f8fe0'], [230, 0.28, '#d9694a'], [340, 0.16, '#d8b67a'], [470, 0.09, '#9fe0f0']].forEach(([r, w, col], i) => {
      const a = t * w + i * 1.7;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 5, 0, TAU); ctx.fill();
    });
  }

  function drawRails() {
    const sys = state.mission.sys;
    ctx.lineWidth = 1;
    for (const r of state.rails) {
      const b = sys.bodies[r.body];
      const cx = sys.nx[r.parent], cy = sys.ny[r.parent];
      ctx.strokeStyle = b.kind === 'station' ? 'rgba(230,230,240,0.18)' : hexA(b.color, 0.22);
      ctx.setLineDash(b.kind === 'comet' ? [4, 6] : []);
      ctx.beginPath();
      r.pts.forEach(([x, y], i) => {
        const [sx, sy] = w2s(cx + x, cy + y);
        if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawGoals() {
    const m = state.mission, sys = m.sys, z = state.cam.zoom;
    const t = performance.now() / 1000;
    m.level.goals.forEach((g, gi) => {
      const done = gi < m.goalIndex, active = gi === m.goalIndex;
      if (done) return;
      const p = m.goalPoint(g);
      const [sx, sy] = w2s(p.x, p.y);
      const alpha = active ? 1 : 0.4;
      if (g.type === 'orbit') {
        ctx.fillStyle = `rgba(124,247,212,${0.07 * alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, g.rMax * z, 0, TAU); ctx.arc(sx, sy, g.rMin * z, 0, TAU, true);
        ctx.fill();
        ctx.strokeStyle = `rgba(124,247,212,${0.45 * alpha})`;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(sx, sy, g.rMax * z, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx, sy, g.rMin * z, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      } else if (g.type === 'escape') {
        ctx.strokeStyle = `rgba(247,140,255,${0.55 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 15;
        ctx.beginPath(); ctx.arc(sx, sy, g.r * z, 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineWidth = 1;
        label(g.label || 'Escape', sx, sy - g.r * z - 8, `rgba(247,140,255,${alpha})`);
      } else if (g.type === 'reach' || g.type === 'rendezvous' || g.type === 'hold') {
        const r = (g.type === 'rendezvous' ? g.dist : g.r) * z;
        ctx.strokeStyle = `rgba(247,140,255,${0.7 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(r, 6), 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        if (!g.body) {
          // Jump gate: rotating ring.
          ctx.strokeStyle = `rgba(247,140,255,${0.35 * alpha})`;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath(); ctx.arc(sx, sy, Math.max(r * (0.35 + k * 0.18), 3), t * (k + 1) * 0.7, t * (k + 1) * 0.7 + 4); ctx.stroke();
          }
        }
        if (g.label) label(g.label, sx, sy - Math.max(r, 6) - 8, `rgba(247,140,255,${alpha})`);
        ctx.lineWidth = 1;
      } else if (g.type === 'hit' && g.site) {
        // Landing strip painted on the (spinning) surface.
        const b = sys.bodies[p.body], R = b.radius * z;
        const a = g.site.angle + b.spin * m.t;
        ctx.strokeStyle = active ? '#7cf7d4' : 'rgba(124,247,212,0.4)';
        ctx.lineWidth = Math.max(3, R * 0.08);
        ctx.beginPath(); ctx.arc(sx, sy, R + ctx.lineWidth / 2, -a - g.site.width / 2, -a + g.site.width / 2); ctx.stroke();
        ctx.lineWidth = 1;
        const fx = sx + Math.cos(a) * (R + 4), fy = sy - Math.sin(a) * (R + 4);
        ctx.strokeStyle = '#7cf7d4';
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * 14, fy - Math.sin(a) * 14); ctx.stroke();
        label(g.label || 'Landing zone', fx + Math.cos(a) * 30, fy - Math.sin(a) * 30, '#7cf7d4');
      } else if (g.type === 'hit' && active) {
        const b = sys.bodies[p.body];
        const r = b.radius * z + 8 + Math.sin(t * 4) * 3;
        ctx.strokeStyle = 'rgba(247,140,255,0.8)';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + t * 0.5;
          ctx.beginPath(); ctx.arc(sx, sy, r, a - 0.3, a + 0.3); ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
    });
  }

  function drawTrail(disp) {
    const tr = state.trail;
    if (tr.length < 2) return;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,190,110,0.35)';
    ctx.beginPath();
    tr.forEach((p, i) => {
      const [sx, sy] = disp(p.x, p.y, p.t);
      if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
    });
    const s = state.mission.ship;
    const [sx, sy] = w2s(s.x, s.y);
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }

  function drawPrediction(disp) {
    const p = state.pred, m = state.mission;
    if (!p) return;
    // Only draw the part still ahead of us.
    let i0 = 0;
    while (i0 < p.ts.length - 1 && p.ts[i0 + 1] <= m.t) i0++;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 6]);
    const grad = m.thrusting ? 'rgba(255,220,120,0.9)' : 'rgba(125,200,255,0.85)';
    ctx.strokeStyle = grad;
    ctx.beginPath();
    const [s0x, s0y] = w2s(m.ship.x, m.ship.y);
    ctx.moveTo(s0x, s0y);
    let lx = s0x, ly = s0y;
    for (let i = i0 + 1; i < p.ts.length; i++) {
      const [sx, sy] = disp(p.xs[i], p.ys[i], p.ts[i]);
      if (Math.abs(sx - lx) + Math.abs(sy - ly) < 2 && i < p.ts.length - 1) continue;
      ctx.lineTo(sx, sy); lx = sx; ly = sy;
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const sys = m.sys;
    // Impact marker.
    if (p.hit >= 0) {
      const [sx, sy] = disp(p.end.x, p.end.y, p.tEnd);
      const g = m.currentGoal();
      const good = g && g.type === 'hit' && sys.byId[g.body].index === p.hit && m.siteOk(g, p.end.x, p.end.y, p.tEnd);
      ctx.strokeStyle = good ? '#7cf7d4' : '#ff5a5a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy + 6); ctx.moveTo(sx + 6, sy - 6); ctx.lineTo(sx - 6, sy + 6); ctx.stroke();
      const missedSite = !good && g && g.site && sys.byId[g.body].index === p.hit;
      label((good ? 'IMPACT ' : missedSite ? 'OFF TARGET ' : 'CRASH ') + sys.bodies[p.hit].name + ' · ' + fmtT(p.tEnd - m.t), sx, sy - 14, good ? '#7cf7d4' : '#ff7a7a');
      ctx.lineWidth = 1;
    }
    // Closest approach + ghost of the target at that moment.
    const ca = p.ca;
    if (ca && ca.t > m.t && !(p.hit >= 0 && ca.i >= p.ts.length - 2)) {
      const [sx, sy] = disp(p.xs[ca.i], p.ys[ca.i], ca.t);
      const q = m.goalPoint(ca.goal, ca.t);
      const [gx, gy] = disp(q.x, q.y, ca.t);
      ctx.strokeStyle = 'rgba(247,140,255,0.8)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(gx, gy); ctx.stroke();
      ctx.setLineDash([]);
      if (q.body >= 0) {
        const b = sys.bodies[q.body];
        ctx.strokeStyle = hexA(b.color, 0.7);
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(gx, gy, Math.max(b.radius * state.cam.zoom, 4), 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#f78cff';
      ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, TAU); ctx.fill();
      label((ca.far ? 'farthest ' : 'closest ') + ca.d.toFixed(0) + ' · ' + fmtT(ca.t - m.t), sx, sy + 16, '#f78cff');
    }
  }

  function drawBodies() {
    const sys = state.mission.sys, z = state.cam.zoom;
    for (const b of sys.bodies) {
      if (b.hidden || b.radius <= 0) continue;
      const [sx, sy] = w2s(sys.px[b.index], sys.py[b.index]);
      const r = Math.max(b.radius * z, b.kind === 'station' ? 0 : 2.5);
      if (sx < -r - 200 || sx > W + r + 200 || sy < -r - 200 || sy > H + r + 200) continue;
      if (b.kind === 'station') { drawStation(sx, sy, b); continue; }
      if (b.kind === 'rock') { drawRock(sx, sy, r, b); continue; }
      if (b.pickup) { if (!state.mission.collected.has(b.index)) drawCanister(sx, sy, b); continue; }
      if (b.kind === 'blackhole') { drawBlackHole(sx, sy, r, b); continue; }
      const isStar = b.gm >= 30000 && /#ff/.test(b.color);
      if (b.kind === 'comet') drawCometTail(b, sx, sy, r);
      // Glow / atmosphere.
      const glowR = r * (isStar ? 3.2 : 1.35);
      const gl = ctx.createRadialGradient(sx, sy, r * 0.8, sx, sy, glowR);
      gl.addColorStop(0, hexA(b.color, isStar ? 0.55 : 0.25)); gl.addColorStop(1, hexA(b.color, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, TAU); ctx.fill();
      // Body, lit from the upper left.
      const g = ctx.createRadialGradient(sx - r * 0.4, sy - r * 0.4, r * 0.1, sx, sy, r);
      g.addColorStop(0, isStar ? '#fffbe8' : shade(b.color, 1.35));
      g.addColorStop(0.7, b.color);
      g.addColorStop(1, isStar ? b.color : shade(b.color, 0.45));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
      // Spin markers so rotation is visible.
      if (b.spin && r > 8) {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, r * 0.08);
        const a0 = b.spin * state.mission.t;
        for (let k = 0; k < 3; k++) {
          const a = a0 + k * TAU / 3;
          ctx.beginPath(); ctx.arc(sx + Math.cos(a) * r * 0.5, sy - Math.sin(a) * r * 0.5, r * 0.18, 0, TAU); ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
      label(b.name, sx, sy + r + 14, 'rgba(220,228,255,0.75)');
    }
  }

  // Fuel canister: glows green when the predicted path will collect it.
  function drawCanister(sx, sy, b) {
    const t = performance.now() / 1000, hit = state.pred && state.pred.pickups && state.pred.pickups.has(b.index);
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 22);
    glow.addColorStop(0, hit ? 'rgba(124,247,212,0.55)' : 'rgba(255,179,90,0.5)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.sin(t * 1.5) * 0.3);
    ctx.fillStyle = '#ffb35a'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-4, -7, 8, 14, 2.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a4a10'; ctx.fillRect(-4, -2, 8, 1.5);
    ctx.restore();
    if (hit) { ctx.strokeStyle = '#7cf7d4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 13, 0, TAU); ctx.stroke(); ctx.lineWidth = 1; }
    label('+' + b.dv + ' Δv', sx, sy + 24, hit ? '#7cf7d4' : '#ffb35a');
  }

  // Black hole: a dark disc inside a glowing, slowly turning accretion disc.
  function drawBlackHole(sx, sy, r, b) {
    const t = performance.now() / 1000, R = Math.max(r, 6);
    const halo = ctx.createRadialGradient(sx, sy, R, sx, sy, R * 9);
    halo.addColorStop(0, 'rgba(255,170,90,0.35)'); halo.addColorStop(0.4, 'rgba(180,90,255,0.12)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sx, sy, R * 9, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.35);
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(255,${190 - k * 40},${120 - k * 30},${0.75 - k * 0.2})`;
      ctx.lineWidth = Math.max(1.5, R * (0.55 - k * 0.12));
      ctx.setLineDash([R * 1.6, R * 0.9]); ctx.lineDashOffset = -t * 30 * (k + 1);
      ctx.beginPath(); ctx.ellipse(0, 0, R * (2.6 + k * 0.9), R * (0.8 + k * 0.28), 0, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, R * 1.08, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1;
    label(b.name, sx, sy + R * 3.2 + 12, 'rgba(220,228,255,0.75)');
  }

  // Irregular asteroid: a lumpy polygon whose shape is fixed per rock.
  function drawRock(sx, sy, r, b) {
    const t = state.mission.t, k = b.index;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * (0.2 + (k % 5) * 0.08) * (k % 2 ? 1 : -1));
    ctx.fillStyle = shade(b.color, 0.9 + (k % 3) * 0.12);
    ctx.beginPath();
    for (let j = 0; j < 9; j++) {
      const a = j / 9 * TAU, rr = r * (0.75 + 0.25 * Math.sin(k * 12.9898 + j * 4.1414) ** 2);
      if (j) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.arc(r * 0.25, r * 0.2, r * 0.22, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawStation(sx, sy, b) {
    const t = performance.now() / 1000;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.3);
    ctx.fillStyle = '#cfd6e6'; ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = '#5b8de0'; ctx.fillRect(-12, -2, 7, 4); ctx.fillRect(5, -2, 7, 4);
    ctx.restore();
    label(b.name, sx, sy + 18, 'rgba(220,228,255,0.75)');
  }

  function drawCometTail(b, sx, sy, r) {
    const sys = state.mission.sys;
    const sun = sys.bodies[b.parent];
    const dx = sys.px[b.index] - sys.px[sun.index], dy = sys.py[b.index] - sys.py[sun.index];
    const d = Math.hypot(dx, dy), len = Math.min(220, 5e5 / (d * d) * 40 + 30);
    const ux = dx / d, uy = -dy / d;
    const g = ctx.createLinearGradient(sx, sy, sx + ux * len, sy + uy * len);
    g.addColorStop(0, 'rgba(200,240,255,0.55)'); g.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - uy * r, sy + ux * r);
    ctx.lineTo(sx + ux * len - uy * r * 3, sy + uy * len + ux * r * 3);
    ctx.lineTo(sx + ux * len + uy * r * 3, sy + uy * len - ux * r * 3);
    ctx.lineTo(sx + uy * r, sy - ux * r);
    ctx.fill();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const [sx, sy] = w2s(p.x, p.y);
      const k = 1 - p.age / p.life;
      if (p.kind === 'fire') {
        ctx.fillStyle = `rgba(255,${Math.floor(150 + 100 * k)},${Math.floor(60 * k)},${k * 0.8})`;
      } else if (p.kind === 'rcs') {
        ctx.fillStyle = `rgba(220,235,255,${k * 0.9})`;
      } else {
        ctx.fillStyle = hexA(p.color, k);
      }
      const s = p.size * (p.kind === 'fire' ? (0.5 + k) : 1);
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }

  function drawShip() {
    const m = state.mission, s = m.ship;
    for (const d of m.debris) {
      if (!d.alive) {
        if (!d.exploded) { d.exploded = true; explode(d.x, d.y, '#ffb35a'); }
        continue;
      }
      const [dx, dy] = w2s(d.x, d.y);
      ctx.save(); ctx.globalAlpha = 0.75; ctx.translate(dx, dy); ctx.rotate(-d.angle);
      drawRocketBody(9);
      ctx.restore();
    }
    if (m.status === 'crashed' || (m.status === 'won' && m.level.goals[m.level.goals.length - 1].type === 'hit')) return;
    const [sx, sy] = w2s(s.x, s.y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-s.angle);
    const sat = m.stageSpec && m.stageSpec.sprite === 'satellite';
    const L = sat ? 4 : 9;
    if (m.thrusting) {
      const f = (0.7 + Math.random() * 0.5) * state.throttle;
      const g = ctx.createLinearGradient(-L, 0, -L - 22 * f, 0);
      g.addColorStop(0, 'rgba(255,255,220,0.95)'); g.addColorStop(0.4, 'rgba(255,170,60,0.8)'); g.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-L + 1, -3.5); ctx.lineTo(-L - 22 * f, 0); ctx.lineTo(-L + 1, 3.5); ctx.fill();
    }
    if (sat) drawSatelliteBody(); else drawRocketBody(L);
    ctx.restore();
  }

  // Satellite: a gold-foil box with two solar panels and a small nozzle.
  function drawSatelliteBody() {
    ctx.fillStyle = '#4f7fd8'; ctx.strokeStyle = '#9fc0ff'; ctx.lineWidth = 0.8;
    ctx.fillRect(-2.5, -13, 5, 8); ctx.strokeRect(-2.5, -13, 5, 8);
    ctx.fillRect(-2.5, 5, 5, 8); ctx.strokeRect(-2.5, 5, 5, 8);
    ctx.fillStyle = '#e8c45a'; ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(-4, -4.5, 8, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(-6.5, -3); ctx.lineTo(-6.5, 3); ctx.lineTo(-4, 2); ctx.fill();
    ctx.strokeStyle = '#e9edf7'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(7, 0); ctx.stroke();
  }

  function drawRocketBody(L) {
    // Body
    ctx.fillStyle = '#e9edf7';
    ctx.strokeStyle = '#7f8aa8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L + 3, 0);
    ctx.quadraticCurveTo(L, -4, 2, -4.2);
    ctx.lineTo(-L + 1, -4.2);
    ctx.lineTo(-L + 1, 4.2);
    ctx.lineTo(2, 4.2);
    ctx.quadraticCurveTo(L, 4, L + 3, 0);
    ctx.fill(); ctx.stroke();
    // Fins
    ctx.fillStyle = '#e0574a';
    ctx.beginPath(); ctx.moveTo(-L + 1, -4.2); ctx.lineTo(-L - 3, -8); ctx.lineTo(-L + 5, -4.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L + 1, 4.2); ctx.lineTo(-L - 3, 8); ctx.lineTo(-L + 5, 4.2); ctx.fill();
    // Window
    ctx.fillStyle = '#4fc3ff';
    ctx.beginPath(); ctx.arc(3, 0, 1.8, 0, TAU); ctx.fill();
  }

  // Prograde / retrograde / target markers around the ship.
  function drawNavMarkers() {
    const m = state.mission, s = m.ship, sys = m.sys;
    if (m.landed || m.status !== 'flying') return;
    const ref = sys.dominant(s.x, s.y, m.t);
    sys.update(m.t);
    const rvx = s.vx - sys.vx[ref], rvy = s.vy - sys.vy[ref];
    const [sx, sy] = w2s(s.x, s.y);
    const R = 34;
    const pa = Math.atan2(rvy, rvx);
    const mark = (a, draw) => { const x = sx + Math.cos(a) * R, y = sy - Math.sin(a) * R; draw(x, y); };
    ctx.lineWidth = 1.5;
    if (m.level.ship.canRotate) {
      mark(pa, (x, y) => {
        ctx.strokeStyle = '#8df57a';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y - 9); ctx.moveTo(x - 5, y); ctx.lineTo(x - 9, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 9, y); ctx.stroke();
      });
      mark(pa + Math.PI, (x, y) => {
        ctx.strokeStyle = '#f5d47a';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 3.5, y - 3.5); ctx.lineTo(x + 3.5, y + 3.5); ctx.moveTo(x + 3.5, y - 3.5); ctx.lineTo(x - 3.5, y + 3.5); ctx.stroke();
      });
      const g = m.currentGoal();
      if (g) {
        const q = m.goalPoint(g);
        const ta = Math.atan2(q.y - s.y, q.x - s.x);
        mark(ta, (x, y) => {
          ctx.fillStyle = '#f78cff';
          ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill();
        });
      }
      // Heading tick.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(s.angle) * (R - 5), sy - Math.sin(s.angle) * (R - 5));
      ctx.lineTo(sx + Math.cos(s.angle) * (R + 5), sy - Math.sin(s.angle) * (R + 5));
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // Arrow at the screen edge pointing to the ship when it's off-screen.
  function drawEdgeIndicator() {
    const s = state.mission.ship;
    const [sx, sy] = w2s(s.x, s.y);
    if (sx > 0 && sx < W && sy > 0 && sy < H) return;
    const cx = W / 2, cy = H / 2, a = Math.atan2(sy - cy, sx - cx);
    const ex = cx + Math.cos(a) * (Math.min(W, H) / 2 - 30), ey = cy + Math.sin(a) * (Math.min(W, H) / 2 - 30);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.fill();
    ctx.restore();
    label('ship (F)', ex, ey + 20, '#ffd166');
  }

  function label(text, x, y, color) {
    ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5,6,13,0.6)';
    const w = ctx.measureText(text).width;
    ctx.fillRect(x - w / 2 - 3, y - 10, w + 6, 14);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // ---------------------------------------------------------------- coach
  // Big contextual prompts that teach the controls, each one dismissed by
  // doing the thing. Mastered prompts stop appearing in later missions.
  const KEY = (k) => `<kbd class="big">${k}</kbd>`;
  const HINTS = {
    deploy: { key: (m) => `${m.stageSpec.name} empty! Press ${KEY('E')} to deploy the ${m.stages[m.stage + 1].name.toLowerCase()}`, touch: (m) => `${m.stageSpec.name} empty! Tap ${KEY('DEPLOY')} to release the ${m.stages[m.stage + 1].name.toLowerCase()}` },
    launch: { key: () => `Press and hold ${KEY('SPACE')} to launch`, touch: () => `Press and hold ${KEY('BURN')} to launch` },
    burn: { key: () => `Hold ${KEY('SPACE')} to fire the main engine`, touch: () => `Hold ${KEY('BURN')} to fire the main engine` },
    rotate: { key: () => `${KEY('A')} ${KEY('D')} fire side thrusters to rotate`, touch: () => `${KEY('⟲')} ${KEY('⟳')} fire side thrusters to rotate` },
    // Positive spin is counter-clockwise (A / ⟲), so the cure is D / ⟳, and vice versa.
    counter: { key: (m) => `Still spinning! Hold ${KEY(m.ship.omega > 0 ? 'D' : 'A')} and it stops at zero`, touch: (m) => `Still spinning! Hold ${KEY(m.ship.omega > 0 ? '⟳' : '⟲')} and it stops at zero` },
    warp: { key: () => `Press ${KEY('.')} to speed up time, ${KEY(',')} to slow down`, touch: () => `Tap ${KEY('»')} to speed up time, ${KEY('«')} to slow down` },
    camera: { key: () => `Press ${KEY('O')} for an overview, ${KEY('F')} to follow your ship`, touch: () => `Tap ${KEY('◎')} to switch between overview and following your ship` },
    frame: { key: () => `Press ${KEY('V')} to view your path relative to another body`, touch: () => `Tap ${KEY('V')} to view your path relative to another body` },
    gyro: { key: () => `${KEY('G')} gyro assist stops spin for you (caps the run at ★★)`, touch: () => `${KEY('G')} gyro assist stops spin for you (caps the run at ★★)` },
  };
  const LEARN_AFTER = { deploy: 99, launch: 99, burn: 2, rotate: 3, counter: 4, warp: 3, camera: 2, frame: 2, gyro: 1 };

  function learned(k) { return (progress.learned && progress.learned[k]) || 0; }

  function coachDone(k) {
    const c = state.coach;
    if (c.done.has(k)) return;
    c.done.add(k);
    progress.learned = progress.learned || {};
    progress.learned[k] = learned(k) + 1;
    saveProgress();
  }

  // A mission that introduces a control always prompts for it.
  function wants(k) {
    if (state.coach.done.has(k)) return false;
    const intro = state.mission && state.mission.level.introduces;
    return (intro && intro.includes(k)) || learned(k) < LEARN_AFTER[k];
  }

  function updateCoach(dt, ctl) {
    const m = state.mission, c = state.coach, L = m.level, s = m.ship;
    const active = ctl.thrust || ctl.rotate;
    c.idle = active ? 0 : c.idle + dt;
    c.spinIdle = ctl.rotate || m.gyro ? 0 : c.spinIdle + dt;
    if (m.thrusting) coachDone(m.landed ? 'launch' : 'burn');
    if (!m.landed && m.events.some(e => e.type === 'liftoff')) coachDone('launch');
    if (ctl.rotate) {
      coachDone('rotate');
      if (c.key === 'counter' && Math.sign(ctl.rotate) !== Math.sign(s.omega)) coachDone('counter');
    }
    const spinning = Math.abs(s.omega) > 0.3 && !m.landed;
    if (c.key === 'counter' && !spinning) coachDone('counter');

    const grav = m.sys.grav.filter(i => !m.sys.bodies[i].hidden).length;
    let key = null;
    if (m.status !== 'flying') key = null;
    else if (m.landed) key = 'launch';
    else if (m.canDeploy() && m.stageSpec.fuel <= 1e-9) key = 'deploy';
    else if (L.ship.canRotate && wants('rotate') && m.t > 0.5) key = 'rotate';
    else if (L.ship.canRotate && spinning && c.spinIdle > 1.2 && wants('counter')) key = 'counter';
    else if (wants('burn') && m.dvUsed() < 1e-6 && m.t > 2) key = 'burn';
    else if (c.idle > 5 && state.warp === 0 && wants('warp')) key = 'warp';
    else if (c.idle > 2 && m.dvUsed() > 0.3 && wants('camera')) key = 'camera';
    else if (grav >= 2 && c.idle > 3 && wants('frame')) key = 'frame';
    else if (L.ship.canRotate && m.t > 25 && c.idle > 2 && wants('gyro') && state.levelIndex >= 5) key = 'gyro';
    const id = key === 'counter' ? key + Math.sign(s.omega) : key;
    if (id === c.id) return;
    c.key = key; c.id = id;
    const el = $('coach');
    if (key) { $('coach-text').innerHTML = HINTS[key][isTouch() ? 'touch' : 'key'](m); el.classList.add('show'); }
    else el.classList.remove('show');
  }

  // Keycap chips listing the controls a mission uses (briefing screen).
  function controlChips(L) {
    const t = isTouch();
    const chips = [[t ? 'BURN' : 'SPACE', 'main engine']];
    if (L.ship.canRotate) chips.push([t ? '⟲ ⟳' : 'A D', 'rotate'], [t ? '« »' : ', .', 'time warp']);
    else chips.push([t ? '« »' : ', .', 'time warp']);
    const grav = L.bodies.filter(b => b.gm > 0 && !b.hidden).length;
    chips.push([t ? '◎' : 'F O', 'follow / overview']);
    if (L.ship.stages.length > 1) chips.push([t ? 'DEPLOY' : 'E', 'deploy payload']);
    if (grav >= 2) chips.push(['V', 'reference frame']);
    if (L.ship.canRotate) chips.push(['G', 'gyro assist (★★ max)']);
    return chips.map(([k, d]) => `<span class="chip"><kbd>${k}</kbd> ${d}</span>`).join('');
  }

  // ------------------------------------------------------------------ HUD
  function setupHud() {
    const m = state.mission, L = m.level;
    $('hud-level').textContent = (L.test ? 'Test level' : 'Mission ' + (state.levelIndex + 1)) + ' · ' + L.teaches;
    $('hud-name').textContent = L.name;
    $('gauge-rcs').style.display = L.ship.rcs ? '' : 'none';
    $('gyro-row').style.display = L.ship.canRotate ? '' : 'none';
    $('stage-row').style.display = L.ship.stages.length > 1 ? '' : 'none';
    document.body.classList.toggle('no-rotate', !L.ship.canRotate);
    renderGoals();
  }

  function renderGoals() {
    const m = state.mission, L = m.level;
    const ul = $('hud-goals');
    ul.innerHTML = '';
    L.goals.forEach((g, i) => {
      const li = document.createElement('li');
      li.className = i < m.goalIndex ? 'done' : i === m.goalIndex ? 'active' : '';
      li.innerHTML = `<span class="chk">${i < m.goalIndex ? '✓' : i === m.goalIndex ? '▸' : '·'}</span><span>${goalText(g, m)}</span>`;
      if (i === m.goalIndex && ['orbit', 'rendezvous', 'hold', 'escape'].includes(g.type)) {
        li.innerHTML += `<div class="sub" id="goal-sub"></div>`;
      }
      ul.appendChild(li);
    });
    state.renderedGoal = m.goalIndex;
  }

  function goalText(g, m) {
    const name = g.body ? m.sys.byId[g.body].name : (g.label || 'target');
    switch (g.type) {
      case 'hit': return g.site ? `Land in the zone on ${name}` : 'Impact ' + name;
      case 'reach': return 'Reach ' + (g.label || name);
      case 'orbit': return `Orbit ${name} ${g.rMin}–${g.rMax}${g.dir ? (g.dir > 0 ? ' counter-clockwise' : ' clockwise') : ''} for ${g.hold}s`;
      case 'hold': return `Hold within ${g.r} of ${g.label || name} for ${g.hold}s`;
      case 'escape': return `Get ${g.r} from ${name}`;
      case 'rendezvous': return `Rendezvous with ${name}`;
    }
    return '';
  }

  function updateHud() {
    const m = state.mission, L = m.level, s = m.ship, sys = m.sys;
    if (state.renderedGoal !== m.goalIndex) renderGoals();
    $('hud-time').textContent = fmtT(m.t);
    $('hud-warp').textContent = WARPS[state.warp] + '×';
    $('hud-warp').className = state.warp ? 'warn' : '';
    $('hud-frame').textContent = frameName();
    const dv = m.dvRemaining();
    $('hud-dv').textContent = dv.toFixed(2);
    $('bar-fuel').style.width = (100 * dv / m.dv0) + '%';
    if (L.ship.rcs) {
      $('hud-rcs').textContent = m.rcsFuel.toFixed(1) + 's';
      $('bar-rcs').style.width = (100 * m.rcsFuel / m.rcsFuel0) + '%';
    }
    $('hud-throttle').textContent = Math.round(state.throttle * 100) + '%';
    $('bar-throttle').style.width = (state.throttle * 100) + '%';
    const spin = m.ship.omega * 180 / Math.PI;
    $('hud-spin').textContent = Math.abs(spin) < 0.05 ? '0°/s' : (spin > 0 ? '⟲ ' : '⟳ ') + Math.abs(spin).toFixed(1) + '°/s';
    $('hud-spin').className = Math.abs(spin) < 0.05 ? 'ok' : Math.abs(spin) > 30 ? 'warn' : '';
    $('hud-gyro').textContent = m.gyro ? 'ON · max ★★' : (m.assisted ? 'OFF · max ★★' : 'OFF');
    $('hud-gyro').className = m.gyro || m.assisted ? 'warn' : '';
    $('btn-gyro').classList.toggle('on', m.gyro);
    document.body.classList.toggle('can-deploy', m.canDeploy());
    if (L.ship.stages.length > 1) {
      $('hud-stage').textContent = m.stageSpec.name + (m.canDeploy() ? (isTouch() ? '' : ' · E deploys ' + m.stages[m.stage + 1].name) : '');
    }
    $('btn-gyro').style.visibility = L.ship.canRotate ? '' : 'hidden';

    // Osculating orbit about the dominant body.
    const ref = sys.dominant(s.x, s.y, m.t);
    sys.update(m.t);
    const b = sys.bodies[ref];
    const rx = s.x - sys.px[ref], ry = s.y - sys.py[ref];
    const vx = s.vx - sys.vx[ref], vy = s.vy - sys.vy[ref];
    const r = Math.hypot(rx, ry), v = Math.hypot(vx, vy);
    const eps = v * v / 2 - b.gm / r;
    const hmom = rx * vy - ry * vx;
    const e = Math.sqrt(Math.max(0, 1 + 2 * eps * hmom * hmom / (b.gm * b.gm)));
    $('hud-ref').textContent = b.name;
    $('hud-ref-label').textContent = eps < 0 ? 'Orbiting' : 'Near';
    $('hud-alt').textContent = (r - b.radius).toFixed(0);
    $('hud-spd').textContent = v.toFixed(2);
    if (eps < 0) {
      const a = -b.gm / (2 * eps);
      $('hud-ap').textContent = (a * (1 + e) - b.radius).toFixed(0);
      const pe = a * (1 - e) - b.radius;
      $('hud-pe').textContent = pe.toFixed(0);
      $('hud-pe').className = pe < 0 ? 'warn' : '';
    } else {
      $('hud-ap').textContent = 'escape';
      const pe = hmom * hmom / (b.gm * (1 + e)) - b.radius;
      $('hud-pe').textContent = pe.toFixed(0);
      $('hud-pe').className = pe < 0 ? 'warn' : '';
    }

    // Goal-specific live readouts.
    const g = m.currentGoal();
    const sub = $('goal-sub');
    if (g && sub) {
      const q = m.goalPoint(g);
      const d = Math.hypot(s.x - q.x, s.y - q.y);
      if (g.type === 'orbit' || g.type === 'hold') {
        const pct = Math.min(100, 100 * m.holdTime / g.hold);
        const wrongWay = g.dir && (((s.x - q.x) * (s.vy - q.vy) - (s.y - q.y) * (s.vx - q.vx) > 0 ? 1 : -1) !== g.dir);
        sub.innerHTML = `<div class="minibar"><div style="width:${pct}%"></div></div><span>${m.holdTime.toFixed(0)}/${g.hold}s · ${g.type === 'hold' ? 'dist' : 'r'}=${d.toFixed(0)}</span>${wrongWay ? ' <span class="warn">wrong direction</span>' : ''}`;
      } else if (g.type === 'escape') {
        sub.innerHTML = `<span>distance ${d.toFixed(0)} / ${g.r}</span>`;
      } else if (g.type === 'rendezvous') {
        const rv = Math.hypot(s.vx - q.vx, s.vy - q.vy);
        sub.innerHTML = `<span class="${d < g.dist ? 'ok' : ''}">dist ${d.toFixed(1)}</span> · <span class="${rv < g.relVel ? 'ok' : ''}">rel v ${rv.toFixed(2)}</span>`;
      }
    }
    const p = state.pred;
    let tgt = '';
    if (m.landed) tgt = isTouch() ? 'Hold BURN to lift off' : 'Hold SPACE to lift off';
    else if (p && p.ca) tgt = isTouch()
      ? `${p.ca.far ? 'Farthest' : 'Closest'} <b>${p.ca.d.toFixed(0)}</b> · ${fmtT(p.ca.t - m.t)}`
      : `${p.ca.far ? 'Farthest point' : 'Closest approach'} <b>${p.ca.d.toFixed(0)}</b> in ${fmtT(p.ca.t - m.t)}`;
    if (dv <= 1e-6 && m.status === 'flying') tgt += '<div class="warn">Out of fuel — R to retry</div>';
    $('hud-target').innerHTML = tgt;
  }

  function toast(msg, secs) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove('show'), secs * 1000);
  }

  // -------------------------------------------------------------- screens
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }

  function showMenu() {
    state.screen = 'menu';
    hide('hud'); hide('briefing'); hide('result'); hide('pause'); hide('help');
    show('menu');
    const grid = $('level-grid'), tests = $('test-grid');
    grid.innerHTML = ''; tests.innerHTML = '';
    const nextUp = LEVELS.findIndex(l => !l.test && !progress.stars[l.id]);
    LEVELS.forEach((L, i) => {
      // Every mission is open; the first uncleared one is highlighted as next up.
      const stars = progress.stars[L.id] || 0;
      const next = i === nextUp;
      const card = document.createElement('button');
      card.className = 'level-card' + (stars ? ' cleared' : '') + (next ? ' next' : '') + (L.test ? ' test' : '');
      card.innerHTML = `<div class="num">${L.test ? 'TEST' : String(i + 1).padStart(2, '0')}</div>
        <div class="lname">${L.name}</div>
        <div class="lteach">${L.teaches}</div>
        <div class="lstars">${starStr(stars)}${next ? '<span class="nexttag">Next up</span>' : ''}</div>`;
      card.addEventListener('click', () => showBriefing(i));
      (L.test ? tests : grid).appendChild(card);
    });
  }

  const CAMPAIGN = LEVELS.filter(l => !l.test).length;
  function missionLabel(i) { return LEVELS[i].test ? 'Test level' : 'Mission ' + (i + 1) + ' of ' + CAMPAIGN; }
  function nextIndex(i) {
    const j = i + 1;
    return j < LEVELS.length && !!LEVELS[j].test === !!LEVELS[i].test ? j : -1;
  }

  function starStr(n) { return '★'.repeat(n) + '<span class="dim">' + '★'.repeat(3 - n) + '</span>'; }

  function showBriefing(i) {
    state.levelIndex = i;
    state.screen = 'briefing';
    const L = LEVELS[i];
    hide('menu'); hide('result'); hide('hud');
    $('brief-num').textContent = missionLabel(i);
    $('brief-name').textContent = L.name;
    $('brief-teaches').textContent = L.teaches;
    $('brief-intro').textContent = L.intro;
    $('brief-obj').textContent = L.objective;
    const tank = new Mission(L).dv0;
    $('brief-stats').innerHTML = `<span><span class="k">Δv</span> ${tank.toFixed(1)}</span>
      <span><span class="k">★★★ under</span> ${L.par}</span>
      ${L.ship.canRotate ? '<span><span class="k">Gyro assist</span> optional, max ★★</span>' : ''}`;
    $('brief-controls').innerHTML = controlChips(L);
    show('briefing');
  }

  function showResult() {
    state.resultShown = true;
    const m = state.mission, L = m.level;
    const won = m.status === 'won';
    const stars = m.stars();
    if (won) {
      progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length - 1, state.levelIndex + 1));
      progress.stars[L.id] = Math.max(progress.stars[L.id] || 0, stars);
      if (!progress.best[L.id] || m.dvUsed() < progress.best[L.id]) progress.best[L.id] = m.dvUsed();
      progress.score = progress.score || {};
      state.newBest = m.score() > (progress.score[L.id] || 0);
      if (state.newBest) progress.score[L.id] = m.score();
      saveProgress();
    }
    state.screen = 'result';
    $('res-title').textContent = won ? 'Mission complete' : 'Mission failed';
    $('res-title').className = won ? 'ok' : 'bad';
    $('res-stars').innerHTML = won ? starStr(stars) : '';
    $('res-score').innerHTML = won
      ? `<span class="k">SCORE</span>${m.score().toLocaleString()}<span class="pb">${state.newBest ? 'New best!' : 'Best ' + (progress.score[L.id] || 0).toLocaleString()}</span>`
      : '';
    $('res-msg').textContent = !won ? m.message
      : stars === 3 ? 'Textbook flying.'
      : m.assisted && m.dvUsed() <= L.par ? 'Gyro assist was on, so this run tops out at two stars. Fly without it for three.'
      : `Use ≤ ${L.par} Δv${m.assisted ? ' without gyro assist' : ''} for three stars.`;
    $('res-stats').innerHTML = `<span><span class="k">Δv used</span> ${m.dvUsed().toFixed(2)}</span>
      <span><span class="k">Time</span> ${fmtT(m.t)}</span>
      ${progress.best[L.id] ? `<span><span class="k">Best</span> ${progress.best[L.id].toFixed(2)}</span>` : ''}`;
    const hasNext = nextIndex(state.levelIndex) >= 0;
    $('btn-res-next').style.display = won && hasNext ? '' : 'none';
    $('btn-res-retry').className = won && hasNext ? '' : 'primary';
    show('result');
  }

  // ------------------------------------------------------------ phone gate
  // Phones play in landscape and fullscreen. Losing either (rotating back,
  // leaving fullscreen, switching apps) pauses the mission.
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fsSupported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const standalone = () => window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  const isPhone = () => isTouch() && Math.min(screen.width, screen.height) < 600;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let fsUnavailable = false; // set when the browser refuses fullscreen

  function gateReason() {
    if (!isTouch()) return null;
    if (isPhone() && window.innerHeight > window.innerWidth) return 'rotate';
    if (!fsEl() && !standalone() && fsSupported() && !fsUnavailable) return 'fullscreen';
    return null;
  }

  function pauseMission() {
    if (state.screen === 'flight' && !state.paused && !state.resultShown) {
      state.paused = true; show('pause');
    }
  }

  function updateGate() {
    const reason = gateReason();
    if (!reason) { hide('gate'); return; }
    pauseMission();
    keys.clear(); for (const k in touch) touch[k] = false;
    if (reason === 'rotate') {
      $('gate-icon').textContent = '⟳';
      $('gate-title').textContent = 'Rotate your phone';
      $('gate-msg').textContent = 'Thrusterz plays sideways. Turn your phone to landscape.';
      $('btn-gate').classList.add('hidden');
      $('gate-tip').textContent = isIOS() && !standalone() ? 'For true full screen on iPhone: Share → Add to Home Screen, then launch Thrusterz from there.' : '';
    } else {
      $('gate-icon').textContent = '⛶';
      $('gate-title').textContent = state.screen === 'flight' ? 'Paused' : 'Full screen';
      $('gate-msg').textContent = 'Thrusterz needs the whole screen so your thumbs have room.';
      $('btn-gate').classList.remove('hidden');
      $('gate-tip').textContent = '';
    }
    $('gate').dataset.reason = reason;
    show('gate');
  }

  async function enterFullscreen() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else fsUnavailable = true;
    } catch (e) { fsUnavailable = true; }
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* not allowed here */ }
    setTimeout(updateGate, 150);
  }

  $('btn-gate').onclick = enterFullscreen;
  ['resize', 'orientationchange'].forEach(ev => window.addEventListener(ev, updateGate));
  document.addEventListener('fullscreenchange', updateGate);
  document.addEventListener('webkitfullscreenchange', updateGate);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseMission(); });
  window.addEventListener('blur', pauseMission);

  function togglePause() {
    state.paused = !state.paused;
    if (state.paused) { show('pause'); state.screen = 'flight'; }
    else { hide('pause'); hide('help'); }
  }

  $('btn-brief-go').onclick = () => startLevel(state.levelIndex);
  $('btn-brief-back').onclick = showMenu;
  $('btn-res-menu').onclick = showMenu;
  $('btn-res-retry').onclick = () => { hide('result'); startLevel(state.levelIndex); };
  $('btn-res-next').onclick = () => { hide('result'); showBriefing(nextIndex(state.levelIndex)); };
  $('btn-resume').onclick = togglePause;
  $('btn-restart').onclick = () => { hide('pause'); startLevel(state.levelIndex); };
  $('btn-quit').onclick = () => { state.paused = false; showMenu(); };
  $('btn-help').onclick = () => { hide('pause'); show('help'); };
  $('btn-help-menu').onclick = () => show('help');
  $('btn-help-close').onclick = () => {
    hide('help');
    if (state.screen === 'flight' && state.paused) { state.paused = false; }
  };
  $('btn-pause').onclick = togglePause;
  $('btn-gyro').onclick = () => { if (state.mission) toggleGyro(); };

  // ---------------------------------------------------------------- utils
  function fmtT(t) {
    t = Math.max(0, t);
    if (t < 60) return t.toFixed(1) + 's';
    const mnt = Math.floor(t / 60), sec = Math.floor(t % 60);
    return mnt + 'm' + String(sec).padStart(2, '0') + 's';
  }
  function parseHex(c) {
    const h = c.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function hexA(c, a) { const [r, g, b] = parseHex(c); return `rgba(${r},${g},${b},${a})`; }
  function shade(c, k) {
    const [r, g, b] = parseHex(c).map(v => Math.max(0, Math.min(255, Math.round(v * k))));
    return `rgb(${r},${g},${b})`;
  }

  // ---------------------------------------------------------------- boot
  const qs = new URLSearchParams(location.search);
  if (qs.has('level')) {
    const i = Math.max(0, Math.min(LEVELS.length - 1, (+qs.get('level') || 1) - 1));
    progress.unlocked = Math.max(progress.unlocked, i);
    startLevel(i);
  } else showMenu();
  updateGate();
  requestAnimationFrame(frame);

  // Expose for debugging / automated testing.
  window.Thrusterz = { state, startLevel, showMenu };
})();
