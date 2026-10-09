// Thrusterz game client: rendering, input, HUD and menus.
(function () {
  'use strict';
  const { LEVELS, WORLDS } = Levels;
  const { Mission } = Flight;

  const WARPS = Replay.WARPS;
  const SIM_BUDGET_MS = 8;      // physics time allowed per frame
  const PRED_MS_BURNING = 70;   // how often the predicted path refreshes during a burn
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
    errorFrames: 0,     // consecutive frames that threw
    resultShown: false, endTime: 0,
    toastTimer: 0,
  };

  const keys = new Set();
  const touch = { rotL: false, rotR: false, burn: false };

  // ------------------------------------------------------------- progress
  const STORE = 'thrusterz.progress.v1';
  // Saved progress is checked field by field, so a corrupted or old save can
  // never break the menu: anything unrecognised is dropped.
  const RENAMED = { 'test-satellite': 'satellite', 'test-drop': 'releasepoint', 'test-stack': 'threestages', 'test-debris': 'clearstation' };
  function loadProgress() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE)); } catch (e) { raw = null; }
    return cleanProgress(raw);
  }
  function cleanProgress(raw) {
    const p = { unlocked: 0, stars: {}, best: {}, score: {}, learned: {}, tab: null };
    if (!raw || typeof raw !== 'object') return p;
    const ids = new Set(LEVELS.map(l => l.id));
    const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
    for (const key of ['stars', 'best', 'score']) {
      const src = raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
      for (const [k0, v] of Object.entries(src)) {
        const k = RENAMED[k0] || k0;
        if (!ids.has(k)) continue;
        const n = key === 'stars' ? num(v, 0, 3) : num(v, 0, 1e6);
        if (n != null) p[key][k] = key === 'stars' ? Math.round(n) : n;
      }
    }
    p.unlocked = num(raw.unlocked, 0, LEVELS.length - 1) || 0;
    if (raw.learned && typeof raw.learned === 'object') {
      for (const [k, v] of Object.entries(raw.learned)) { const n = num(v, 0, 1e4); if (n != null) p.learned[k] = n; }
    }
    if (raw.tab === 'test' || (typeof raw.tab === 'number' && WORLDS.some(w => w.n === raw.tab))) p.tab = raw.tab;
    return p;
  }
  // Saved locally (and to native storage in the app), then to the cloud.
  function saveProgress() { Online.Store.set(STORE, progress); Online.saveProgressSoon(); }
  // Fold in progress from elsewhere (cloud, native copy, another device).
  // Only ever adds: more stars, better bests.
  function mergeIn(other) {
    const merged = Sync.mergeProgress(progress, cleanProgress(other));
    if (JSON.stringify(merged) === JSON.stringify(Sync.mergeProgress(progress, {}))) return false;
    Object.assign(progress, merged);
    Online.Store.set(STORE, progress);
    if (state.screen === 'menu' && !$('menu').classList.contains('hidden')) showMenu();
    return true;
  }
  const progress = loadProgress();
  if (/[?&]unlock/.test(location.search)) progress.unlocked = LEVELS.length - 1;
  // ?unlock opens every world (for testing).
  const UNLOCK_ALL = /[?&]unlock/.test(location.search);

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
    state.endHandled = false;
    state.paused = false;
    state.overload = 0; state.predWall = 0; state.acc = 0;
    state.rec = new Replay.Recorder(level.id, Replay.levelHash(level));
    releaseTouch();
    buildRails();
    const m = state.mission;
    const zoom = Math.min(W, H) / level.view.span;
    state.cam.follow = true;
    state.cam.zoom = state.cam.tzoom = Math.max(zoom * 2.2, Math.min(W, H) / 420);
    state.cam.x = m.ship.x; state.cam.y = m.ship.y;
    if (level.startCam === 'overview') { overview(true); state.cam.x = state.cam.tx; state.cam.y = state.cam.ty; state.cam.zoom = state.cam.tzoom; }
    setupHud();
    show('hud');
    hide('menu'); hide('briefing'); hide('result'); hide('pause'); hide('help'); hide('board'); hide('profile');
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
    if (m.canDrop()) {
      state.rec.event('drop');
      const c = m.release();
      coachDone('drop');
      state.predDirty = true;
      c.path = Phys.predict(m.sys, c, m.t, 400, { bounds: m.level.bounds, maxSteps: 6000 });
      toast(c.name + ' released', 1.5);
      return;
    }
    if (!m.canDeploy()) { if (m.status === 'flying') toast(m.landed ? 'Launch first' : 'Nothing to deploy', 1.2); return; }
    state.rec.event('deploy');
    m.deploy();
    coachDone('deploy');
    state.predDirty = true;
    // Show where the spent stage will drift (it can hit things).
    const d = m.debris[m.debris.length - 1];
    d.path = d.fate;
    if (d.fate.kind === 'hit') toast('⚠ Spent stage on collision course with ' + d.fate.name, 3);
    else if (d.fate.kind !== 'cross') toast(m.stageSpec.name + ' deployed', 1.5);
  }

  function toggleGyro() {
    const m = state.mission;
    if (!m.level.ship.canRotate) { toast('No side thrusters on this ship', 1.5); return; }
    if (m.status !== 'flying') return;
    state.rec.event('gyro');
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
    // Capture the pointer so the release always reaches this button, even if
    // the finger slides off it or an overlay appears on top.
    btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } on(e); });
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

  // Phones don't fire a click for a tap made while another finger is down
  // (holding BURN or a rotate button), so pause, retry and every other button
  // would ignore it. Touch taps on buttons are handled on pointerup instead,
  // and the browser's own (possibly missing) click is swallowed.
  const pressed = new Map();
  let swallow = null;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const b = e.target.closest && e.target.closest('button');
    if (b && !b.closest('#touch')) pressed.set(e.pointerId, b);
  }, true);
  document.addEventListener('pointercancel', (e) => pressed.delete(e.pointerId), true);
  document.addEventListener('pointerup', (e) => {
    const b = pressed.get(e.pointerId);
    pressed.delete(e.pointerId);
    if (!b || b.disabled) return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (!t || t.closest('button') !== b) return;
    swallow = { el: b, until: performance.now() + 700 };
    b.click();
  }, true);
  document.addEventListener('click', (e) => {
    if (!e.isTrusted || !swallow || performance.now() > swallow.until) return;
    const b = e.target.closest && e.target.closest('button');
    if (b === swallow.el) { e.stopPropagation(); e.preventDefault(); swallow = null; }
  }, true);

  // Let go of every held touch control (when a menu or result card covers them).
  function releaseTouch() {
    for (const k of Object.keys(touch)) touch[k] = false;
    for (const b of document.querySelectorAll('#touch button.on')) b.classList.remove('on');
  }

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
  let frameNo = 0;
  // ?debug shows frame timing: fps, average and peak script time per frame.
  const DEBUG = /[?&]debug/.test(location.search);
  const perf = { js: 0, peak: 0, fps: 60 };
  function drawDebug() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 110, H - 22, 220, 18);
    ctx.fillStyle = perf.peak > 12 ? '#ffb35a' : '#7cf7d4'; ctx.textAlign = 'center';
    ctx.fillText(`${perf.fps.toFixed(0)} fps · js ${perf.js.toFixed(1)} ms · peak ${perf.peak.toFixed(1)}`, W / 2, H - 9);
    ctx.textAlign = 'left';
  }
  window.ThrusterzPerf = perf;
  function frame(now) {
    // Checking the canvas box forces a layout; a few times a second is plenty
    // (resize and ResizeObserver catch most changes immediately anyway).
    if (frameNo++ % 10 === 0) syncSize();
    const realDt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    // Schedule the next frame first and contain errors: a bug in one frame
    // must never stop the game loop (that reads as a frozen game).
    requestAnimationFrame(frame);
    const t0 = performance.now();
    try {
      if (state.screen === 'flight' && !state.paused && $('gate').classList.contains('hidden')) update(realDt);
      render(realDt);
      state.errorFrames = 0;
    } catch (e) {
      if (!state.loggedError) { state.loggedError = true; console.error(e); }
      // A bug that keeps firing would leave the mission unplayable: stop and
      // offer the pause menu (restart / quit) instead of a broken screen.
      if (++state.errorFrames > 30 && state.screen === 'flight' && !state.paused) {
        state.errorFrames = 0;
        state.paused = true; releaseTouch(); show('pause');
        toast('Something went wrong. Restart the mission to continue.', 4);
      }
    }
    perf.js = perf.js * 0.95 + (performance.now() - t0) * 0.05;
    perf.peak = Math.max(perf.peak * 0.995, performance.now() - t0);
    perf.fps = perf.fps * 0.95 + (realDt > 0 ? 1 / realDt : 60) * 0.05;
    if (DEBUG) drawDebug();
  }

  function update(realDt) {
    const m = state.mission;
    const level = m.level;
    const c = controls();
    if ((c.thrust || c.rotate) && state.warp > 0) { state.warp = 0; }
    // Physics gets a fixed slice of each frame. At high warp near a body the
    // simulation can need more steps than a phone can run in one frame; then
    // it falls a little behind real time instead of stalling the screen, and
    // if that keeps happening the warp steps down.
    // The simulation runs in fixed ticks so a run can be recorded and replayed
    // exactly (leaderboards re-fly every submitted run).
    const budgetEnd = performance.now() + SIM_BUDGET_MS;
    state.acc += realDt;
    let behind = false;
    while (state.acc >= Replay.TICK - 1e-9 && m.status === 'flying') {
      if (performance.now() > budgetEnd) { behind = true; state.acc = 0; break; }
      const tc = controls();
      state.rec.tick(state.warp, tc);
      m.advance(WARPS[state.warp] * Replay.TICK, tc);
      state.acc -= Replay.TICK;
    }
    // The moment a burn ends, show the exact coast path.
    if (state.wasThrusting && !m.thrusting) state.predDirty = true;
    state.wasThrusting = m.thrusting;
    state.overload = behind ? state.overload + 1 : 0;
    if (state.overload > 20 && state.warp > 0) {
      state.overload = 0;
      state.warp--;
      toast('Time warp lowered to ' + WARPS[state.warp] + '× to keep things smooth', 1.8);
    }

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
    // While burning, the path changes every frame but redrawing it a dozen
    // times a second looks the same and costs far less.
    const now = performance.now();
    if (state.predDirty || !state.pred || m.t - state.predT > horizon * 0.03 || (m.thrusting && now - state.predWall > PRED_MS_BURNING)) {
      state.predWall = now;
      computePrediction();
    }

    // The mission can also end outside advance() (e.g. a deploy that dooms the station).
    if (m.status !== 'flying' && !state.endHandled) { state.endHandled = true; onMissionEnd(); }
    if (m.status !== 'flying' && !state.resultShown && performance.now() - state.endTime > state.endDelay) showResult();

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
      // A body goal only needs that one body's position at each sample.
      const gi = g.body && !g.lagrange ? m.sys.byId[g.body].index : -1, q = { x: 0, y: 0 }, qp = [0, 0];
      for (let i = 0; i < p.ts.length; i++) {
        if (gi >= 0) { m.sys.posAt(gi, p.ts[i], qp); q.x = qp[0]; q.y = qp[1]; }
        else Object.assign(q, m.goalPoint(g, p.ts[i]));
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
      const bp = [0, 0];
      for (let i = 0; i < p.ts.length; i += 1) {
        m.sys.posAt(b.index, p.ts[i], bp);
        if ((p.xs[i] - bp[0]) ** 2 + (p.ys[i] - bp[1]) ** 2 < r2) { p.pickups.add(b.index); break; }
      }
    }
    // First point where the path enters a keep-out zone (zones can move, so
    // check each one where it will be at that moment).
    p.zone = null;
    for (const b of m.sys.bodies) {
      if (!b.keepOut) continue;
      const r2 = b.keepOut * b.keepOut, bp = [0, 0];
      const n = p.zone ? p.zone.i : p.ts.length;
      for (let i = 1; i < n; i++) {
        m.sys.posAt(b.index, p.ts[i], bp);
        if ((p.xs[i] - bp[0]) ** 2 + (p.ys[i] - bp[1]) ** 2 < r2) { p.zone = { i, body: b.index }; break; }
      }
    }
    state.pred = p;
  }

  // Did the ship itself end the mission by hitting its target?
  function shipImpactWin(m) { const g = m.level.goals[m.level.goals.length - 1]; return g.type === 'hit' && !g.craft; }

  // A small buzz on the phone (app only) when a mission ends.
  function haptic(won) { Bridge.haptic(won ? 'success' : 'heavy'); }

  function onMissionEnd() {
    const m = state.mission;
    haptic(m.status === 'won');
    state.endTime = performance.now();
    state.endDelay = 1600;
    // A spent stage doomed to hit something: pull back and let the player see
    // the crossing orbits before the result card covers them.
    if (m.debris.some(d => d.fate && d.fate.kind === 'cross')) { state.endDelay = 4500; overview(true); toast('⚠ ' + m.message, 4.5); }
    state.warp = 0;
    if (m.status === 'crashed' || (m.status === 'won' && shipImpactWin(m))) {
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
    if (state.mission && state.screen !== 'menu') drawBackdrop(state.mission.level);
    drawStars();
    if (!state.mission || state.screen === 'menu') { drawMenuBackdrop(); return; }
    const m = state.mission, sys = m.sys;
    sys.update(m.t);
    const F = frameBody();
    const fx = F >= 0 ? sys.px[F] : 0, fy = F >= 0 ? sys.py[F] : 0;
    // Display transform for a world point recorded at time t.
    const fp = [0, 0];
    const disp = (x, y, t) => {
      if (F < 0) return w2s(x, y);
      sys.posAt(F, t, fp);
      return w2s(x - fp[0] + fx, y - fp[1] + fy);
    };

    drawRails();
    drawGoals();
    drawTrail(disp);
    drawPrediction(disp);
    drawCrafts(disp);
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

  // World backdrops. World 2 (Payloads) flies through a green nebula with
  // distant planets: busy space, places to deliver things to. The picture is
  // painted once per level and screen size into an offscreen canvas, then
  // drifts very slightly with the camera.
  const backdrop = { key: '', canvas: null };
  function drawBackdrop(L) {
    const w = WORLDS.find(x => x.n === worldOf(L));
    if (!w || w.theme !== 'nebula') return;
    const M = 0.06; // drift margin, as a fraction of the screen
    const key = [W, H, DPR, L.id].join(':');
    if (backdrop.key !== key) { backdrop.canvas = paintNebula(Math.ceil(W * (1 + 2 * M)), Math.ceil(H * (1 + 2 * M)), seedOf(L.id)); backdrop.key = key; }
    const c = state.cam, k = 0.004;
    const ox = Math.max(-1, Math.min(1, -c.x * c.zoom * k / (W * M))) * W * M;
    const oy = Math.max(-1, Math.min(1, c.y * c.zoom * k / (H * M))) * H * M;
    ctx.drawImage(backdrop.canvas, -W * M + ox, -H * M + oy, backdrop.canvas.width / DPR, backdrop.canvas.height / DPR);
  }

  function seedOf(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 2147483646 + 1; }

  function paintNebula(w, h, seed) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * DPR); cv.height = Math.ceil(h * DPR);
    const g = cv.getContext('2d');
    g.scale(DPR, DPR);
    let x = seed;
    const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
    const base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#04110f'); base.addColorStop(0.55, '#050b10'); base.addColorStop(1, '#070612');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // Glowing gas along a wandering band across the screen.
    const ang = rnd() * Math.PI, cx = w * (0.35 + rnd() * 0.3), cy = h * (0.35 + rnd() * 0.3);
    const ux = Math.cos(ang), uy = Math.sin(ang), span = Math.hypot(w, h) * 0.6, S = Math.min(w, h);
    const hues = [[60, 200, 140], [90, 220, 120], [40, 170, 170], [150, 230, 110], [120, 90, 200], [200, 80, 170]];
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const t = (rnd() * 2 - 1) * span, off = (rnd() + rnd() + rnd() - 1.5) * S * 0.35;
      const px = cx + ux * t - uy * off + Math.sin(t / span * 5 + seed) * S * 0.12, py = cy + uy * t + ux * off;
      const r = S * (0.08 + rnd() * 0.3);
      const col = hues[rnd() < 0.82 ? Math.floor(rnd() * 4) : 4 + Math.floor(rnd() * 2)];
      const a = 0.035 + rnd() * 0.06;
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
      gr.addColorStop(0.5, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.4})`);
      gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    }
    // Dark dust lanes.
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 18; i++) {
      const t = (rnd() * 2 - 1) * span, off = (rnd() - 0.5) * S * 0.2;
      const px = cx + ux * t - uy * off, py = cy + uy * t + ux * off, r = S * (0.04 + rnd() * 0.12);
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, 'rgba(2,6,8,0.35)'); gr.addColorStop(1, 'rgba(2,6,8,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    }
    // Faint embedded stars, brighter where the gas is.
    for (let i = 0; i < 260; i++) {
      const px = rnd() * w, py = rnd() * h, b = rnd();
      g.fillStyle = `rgba(${b < 0.2 ? '200,255,220' : '255,255,255'},${0.15 + b * 0.35})`;
      g.fillRect(px, py, b > 0.93 ? 1.6 : 1, b > 0.93 ? 1.6 : 1);
    }
    // Distant planets: one big world low in a corner, a ringed one, a small moon.
    const corner = rnd() < 0.5 ? 1 : -1;
    paintPlanet(g, w * (corner > 0 ? 0.88 : 0.12), h * (0.86 + rnd() * 0.1), S * (0.2 + rnd() * 0.08), rnd, { ring: false });
    paintPlanet(g, w * (corner > 0 ? 0.12 + rnd() * 0.12 : 0.76 + rnd() * 0.12), h * (0.14 + rnd() * 0.18), S * (0.035 + rnd() * 0.025), rnd, { ring: true });
    paintPlanet(g, w * (0.4 + rnd() * 0.25), h * (0.08 + rnd() * 0.12), S * 0.012, rnd, { ring: false, plain: true });
    return cv;
  }

  function paintPlanet(g, px, py, r, rnd, o) {
    const pal = [['#3f8f7a', '#1b4a44', '#9fe0c0'], ['#8a7fd0', '#2e2a5a', '#c8c0ff'], ['#c9a46a', '#5a4022', '#ffe0a8'], ['#5fa0c8', '#1e3a5a', '#bfe4ff']];
    const [mid, dark, lite] = pal[Math.floor(rnd() * pal.length)];
    const lx = -0.5, ly = -0.6; // light comes from the upper left
    g.save();
    g.globalAlpha = 0.42;
    if (o.ring) {
      g.strokeStyle = 'rgba(220,230,210,0.35)'; g.lineWidth = Math.max(1, r * 0.18);
      g.beginPath(); g.ellipse(px, py, r * 2.1, r * 0.55, -0.35, Math.PI, TAU); g.stroke();
    }
    const body = g.createRadialGradient(px + lx * r * 0.5, py + ly * r * 0.5, r * 0.1, px, py, r);
    body.addColorStop(0, lite); body.addColorStop(0.45, mid); body.addColorStop(1, dark);
    g.fillStyle = body; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    if (!o.plain) {
      // Soft cloud bands, clipped to the disc.
      g.save(); g.beginPath(); g.arc(px, py, r, 0, TAU); g.clip();
      for (let i = 0; i < 7; i++) {
        const y = py - r + (i + rnd()) * (2 * r / 7);
        g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.05})`;
        g.fillRect(px - r, y, 2 * r, r * (0.05 + rnd() * 0.12));
      }
      // Night side.
      const night = g.createRadialGradient(px + lx * r * 0.7, py + ly * r * 0.7, r * 0.6, px + lx * r * 0.2, py + ly * r * 0.2, r * 1.6);
      night.addColorStop(0, 'rgba(0,0,0,0)'); night.addColorStop(1, 'rgba(0,4,6,0.85)');
      g.fillStyle = night; g.fillRect(px - r, py - r, 2 * r, 2 * r);
      g.restore();
      // Thin atmosphere rim.
      g.strokeStyle = 'rgba(160,240,200,0.25)'; g.lineWidth = Math.max(1, r * 0.03);
      g.beginPath(); g.arc(px, py, r, Math.PI * 0.85, Math.PI * 1.75); g.stroke();
    }
    if (o.ring) {
      g.strokeStyle = 'rgba(220,230,210,0.45)'; g.lineWidth = Math.max(1, r * 0.18);
      g.beginPath(); g.ellipse(px, py, r * 2.1, r * 0.55, -0.35, 0, Math.PI); g.stroke();
    }
    g.restore();
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
      const done = gi < m.goalIndex || m.done.has(gi), active = gi === m.goalIndex;
      if (done) return;
      const p = m.goalPoint(g);
      const [sx, sy] = w2s(p.x, p.y);
      const alpha = active ? 1 : 0.4;
      if (g.type === 'orbit' || g.type === 'spread') {
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
    // The path turns red where it would enter a keep-out zone.
    const zi = p.zone && p.zone.i > i0 ? p.zone.i : -1;
    for (let i = i0 + 1; i < p.ts.length; i++) {
      const [sx, sy] = disp(p.xs[i], p.ys[i], p.ts[i]);
      if (i === zi) {
        ctx.lineTo(sx, sy); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,107,107,0.85)';
        ctx.beginPath(); ctx.moveTo(sx, sy); lx = sx; ly = sy;
        continue;
      }
      if (Math.abs(sx - lx) + Math.abs(sy - ly) < 2 && i < p.ts.length - 1) continue;
      ctx.lineTo(sx, sy); lx = sx; ly = sy;
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const sys = m.sys;
    // Keep-out warning: where the zone will be when the path meets it.
    if (zi > 0) {
      const b = sys.bodies[p.zone.body], bp = [0, 0], t = p.ts[zi];
      sys.posAt(b.index, t, bp);
      const [gx, gy] = disp(bp[0], bp[1], t), [sx, sy] = disp(p.xs[zi], p.ys[zi], t);
      ctx.strokeStyle = 'rgba(255,107,107,0.6)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(gx, gy, b.keepOut * state.cam.zoom, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, TAU); ctx.fill();
      label('KEEP OUT · ' + fmtT(t - m.t), sx, sy - 14, '#ff7a7a');
    }
    // Impact marker.
    if (p.hit >= 0) {
      const [sx, sy] = disp(p.end.x, p.end.y, p.tEnd);
      // With cargo aboard that still has to hit something, the coast path is a
      // release preview for the next item in the hold.
      // A spent stage with a landing goal previews the same way before deploying.
      const g = m.currentGoal(), next = m.canDrop() ? m.cargo[0] : m.canDeploy() ? m.stageSpec : null;
      const dropGoal = next && next.id && m.level.goals.find((q, j) => j >= m.goalIndex && !m.done.has(j) && q.craft === next.id && q.type === 'hit');
      const preview = !!dropGoal;
      const tg = preview ? dropGoal : g && !g.craft ? g : null;
      const good = tg && tg.type === 'hit' && sys.byId[tg.body].index === p.hit && m.siteOk(tg, p.end.x, p.end.y, p.tEnd);
      ctx.strokeStyle = good ? '#7cf7d4' : '#ff5a5a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy + 6); ctx.moveTo(sx + 6, sy - 6); ctx.lineTo(sx - 6, sy + 6); ctx.stroke();
      const missedSite = !good && tg && tg.site && sys.byId[tg.body].index === p.hit;
      label((preview ? (m.canDrop() ? 'DROP NOW → ' : 'DEPLOY NOW → ') : '') + (good ? 'IMPACT ' : missedSite ? 'OFF TARGET ' : 'CRASH ') + sys.bodies[p.hit].name + ' · ' + fmtT(p.tEnd - m.t), sx, sy - 14, good ? '#7cf7d4' : '#ff7a7a');
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
      if (b.keepOut) {
        // Keep-out zone: a red dashed fence the ship must stay outside.
        const kr = b.keepOut * z;
        ctx.fillStyle = 'rgba(255,90,90,0.05)'; ctx.beginPath(); ctx.arc(sx, sy, kr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,107,107,0.55)'; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -performance.now() / 120;
        ctx.beginPath(); ctx.arc(sx, sy, kr, 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        if (kr > 30) label('KEEP OUT', sx, sy - kr - 8, 'rgba(255,107,107,0.8)');
      }
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

  // Dashed path of something coasting, recorded at release (inertial frame).
  function drawCoastPath(p, color, disp) {
    if (!p || p.ts.length < 2) return;
    const m = state.mission;
    ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.setLineDash([4, 6]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < p.ts.length; i += 2) {
      if (p.ts[i] < m.t) continue;
      const [sx, sy] = disp(p.xs[i], p.ys[i], p.ts[i]);
      if (started) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); started = true; }
    }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
  }

  // A spent stage whose orbit crosses a protected object's: ring the danger
  // band and mark where the two orbits meet.
  function drawThreat(f, disp) {
    const m = state.mission, sys = m.sys, b = sys.bodies[f.body];
    const pulse = 0.55 + 0.35 * Math.sin(performance.now() / 180);
    if (f.kind === 'cross') {
      const H = f.host;
      const [cx, cy] = w2s(sys.px[H], sys.py[H]);
      ctx.strokeStyle = 'rgba(255,90,90,' + (0.25 * pulse) + ')';
      ctx.lineWidth = Math.max(2, (f.band[1] - f.band[0]) * state.cam.zoom);
      ctx.beginPath(); ctx.arc(cx, cy, (f.band[0] + f.band[1]) / 2 * state.cam.zoom, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1;
      // Crossing points: where the stage's path passes through the station's orbit radius.
      // Where the stage's path enters the danger band.
      let prev = null;
      const inBand = (r) => r >= f.band[0] && r <= f.band[1];
      for (let i = 0; i < f.ts.length; i++) {
        sys.update(f.ts[i]);
        const r = inBand(Math.hypot(f.xs[i] - sys.px[H], f.ys[i] - sys.py[H]));
        if (prev !== null && r && !prev) {
          const [sx, sy] = disp(f.xs[i], f.ys[i], f.ts[i]);
          ctx.strokeStyle = 'rgba(255,90,90,' + pulse + ')'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(sx - 7, sy - 7); ctx.lineTo(sx + 7, sy + 7); ctx.moveTo(sx + 7, sy - 7); ctx.lineTo(sx - 7, sy + 7); ctx.stroke();
          ctx.lineWidth = 1;
        }
        prev = r;
      }
      sys.update(m.t);
    }
    const [bx, by] = w2s(sys.px[b.index], sys.py[b.index]);
    ctx.strokeStyle = 'rgba(255,90,90,' + pulse + ')'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by, Math.max(10, (b.protectRadius || b.radius) * state.cam.zoom), 0, TAU); ctx.stroke();
    ctx.lineWidth = 1;
    label('COLLISION RISK', bx, by - Math.max(14, (b.protectRadius || b.radius) * state.cam.zoom + 6), '#ff6b6b');
  }

  function drawCrafts(disp) {
    const m = state.mission;
    for (const d of m.debris) {
      if (d.alive) drawCoastPath(d.path, 'rgba(255,107,107,0.55)', disp);
      if (d.fate && (d.fate.kind === 'cross' || d.fate.kind === 'hit')) drawThreat(d.fate, disp);
    }
    for (const c of m.crafts) {
      if (c.alive) drawCoastPath(c.path, 'rgba(124,247,212,0.6)', disp);
      if (!c.alive) { if (!c.exploded) { c.exploded = true; explode(c.x, c.y, '#7cf7d4'); } continue; }
      const [sx, sy] = w2s(c.x, c.y);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-Math.atan2(c.vy, c.vx));
      ctx.fillStyle = '#e8c45a'; ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -4); ctx.lineTo(-4, 0); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      label(c.name, sx, sy - 10, '#7cf7d4');
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
      drawRocketBody(9, false);
      ctx.restore();
    }
    if (m.status === 'crashed' || (m.status === 'won' && shipImpactWin(m))) return;
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
    if (sat) drawSatelliteBody(); else drawRocketBody(L, m.canDeploy() || (m.landed && m.stages.length > 1));
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

  // `payload`: draw the gold fairing that holds the payload on the nose.
  function drawRocketBody(L, payload) {
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
    if (payload) {
      ctx.fillStyle = '#e8c45a'; ctx.strokeStyle = '#8a6a1a';
      ctx.beginPath(); ctx.moveTo(L + 3, 0); ctx.quadraticCurveTo(L, -4, 3, -4.2); ctx.lineTo(3, 4.2); ctx.quadraticCurveTo(L, 4, L + 3, 0);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(3, -4.2); ctx.lineTo(3, 4.2); ctx.stroke();
      return;
    }
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
    if (m.level.ship.canRotate || m.level.navMarkers) {
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
    drop: { key: (m) => `Path ends on target: press ${KEY('E')} to drop the ${m.cargo[0].name.toLowerCase()}`, touch: (m) => `Path ends on target: tap ${KEY('DROP')} to release the ${m.cargo[0].name.toLowerCase()}` },
    gravityturn: { key: (m) => `Tilt toward the horizon! Hold ${KEY(turnKey(m, false))}: orbit means going sideways fast`, touch: (m) => `Tilt toward the horizon! Hold ${KEY(turnKey(m, true))}: orbit means going sideways fast` },
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
  const LEARN_AFTER = { drop: 99, gravityturn: 2, deploy: 99, launch: 99, burn: 2, rotate: 3, counter: 4, warp: 3, camera: 2, frame: 2, gyro: 1 };

  // Which rotate control tilts the nose toward the way the launch body spins.
  function turnKey(m, touchUi) {
    const b = m.launchBody != null ? m.sys.bodies[m.launchBody] : null;
    const ccw = !b || b.spin >= 0;
    return touchUi ? (ccw ? '⟲' : '⟳') : (ccw ? 'A' : 'D');
  }

  // Angle between the nose and straight up from the body we launched from.
  function tiltFromVertical(m) {
    const b = m.sys.bodies[m.launchBody];
    m.sys.update(m.t);
    const up = Math.atan2(m.ship.y - m.sys.py[b.index], m.ship.x - m.sys.px[b.index]);
    let d = (m.ship.angle - up) % TAU;
    if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
    return Math.abs(d);
  }

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

  // Cargo aboard, and the coast path ends where the current cargo goal wants
  // it to land: time to press DROP. (Only impact goals have a body to land on.)
  function dropHint(m, g) {
    const p = state.pred;
    return !!g && g.craft && g.type === 'hit' && m.sys.byId[g.body].index === p.hit && m.siteOk(g, p.end.x, p.end.y, p.tEnd);
  }

  function updateCoach(dt, ctl) {
    const m = state.mission, c = state.coach, L = m.level, s = m.ship;
    const active = ctl.thrust || ctl.rotate;
    c.idle = active ? 0 : c.idle + dt;
    c.spinIdle = ctl.rotate || m.gyro ? 0 : c.spinIdle + dt;
    if (m.thrusting) coachDone(m.landed ? 'launch' : 'burn');
    if (!m.landed && m.events.some(e => e.type === 'liftoff')) coachDone('launch');
    if (m.launchBody != null && !m.landed && tiltFromVertical(m) > 0.6) coachDone('gravityturn');
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
    else if (m.canDrop() && state.pred && state.pred.hit >= 0 && dropHint(m, L.goals[m.goalIndex])) key = 'drop';
    else if (m.launchBody != null && L.ship.canRotate && wants('gravityturn') && m.t - m.liftoffT > 1.2
      && m.t - m.liftoffT < 40 && tiltFromVertical(m) < 0.35) key = 'gravityturn';
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
    if (L.ship.stages.length > 1) chips.push([t ? 'DEPLOY' : 'E', 'drop a spent stage']);
    if (L.ship.cargo && L.ship.cargo.length) chips.push([t ? 'DROP' : 'E', 'release cargo']);
    if (grav >= 2) chips.push(['V', 'reference frame']);
    if (L.ship.canRotate) chips.push(['G', 'gyro assist (★★ max)']);
    return chips.map(([k, d]) => `<span class="chip"><kbd>${k}</kbd> ${d}</span>`).join('');
  }

  // ------------------------------------------------------------------ HUD
  function setupHud() {
    const m = state.mission, L = m.level;
    $('hud-level').textContent = (L.test ? 'Test level' : (worldOf(L) > 1 ? worldOf(L) + '-' : 'Mission ') + missionNum(state.levelIndex)) + ' · ' + L.teaches;
    $('hud-name').textContent = L.name;
    $('gauge-rcs').style.display = L.ship.rcs ? '' : 'none';
    $('gyro-row').style.display = L.ship.canRotate ? '' : 'none';
    $('stage-row').style.display = L.ship.stages.length > 1 ? '' : 'none';
    $('cargo-row').style.display = L.ship.cargo && L.ship.cargo.length ? '' : 'none';
    // Multi-stage ships get one fuel gauge per stage; single-stage ships keep one Δv bar.
    const multi = L.ship.stages.length > 1;
    $('gauge-fuel').style.display = multi ? 'none' : '';
    $('stage-gauges').innerHTML = multi ? L.ship.stages.map((st, k) => `<div class="gauge" id="sg-${k}">
        <div class="glabel"><span>${st.name} Δv</span><span id="sg-v-${k}"></span></div>
        <div class="bar ${k === L.ship.stages.length - 1 ? 'payload' : ''}"><div id="sg-b-${k}"></div></div></div>`).join('') : '';
    $('gauge-fuel').classList.remove('spent');
    document.body.classList.toggle('no-rotate', !L.ship.canRotate);
    renderGoals();
  }

  function renderGoals() {
    const m = state.mission, L = m.level;
    const ul = $('hud-goals');
    ul.innerHTML = '';
    L.goals.forEach((g, i) => {
      const li = document.createElement('li');
      const done = i < m.goalIndex || m.done.has(i);
      li.className = done ? 'done' : i === m.goalIndex ? 'active' : '';
      li.innerHTML = `<span class="chk">${done ? '✓' : i === m.goalIndex ? '▸' : '·'}</span><span>${goalText(g, m)}</span>`;
      if (i === m.goalIndex && ['orbit', 'rendezvous', 'hold', 'escape', 'spread'].includes(g.type)) {
        li.innerHTML += `<div class="sub" id="goal-sub"></div>`;
      }
      ul.appendChild(li);
    });
    state.renderedGoal = m.goalIndex;
  }

  function goalText(g, m) {
    if (g.craft) {
      const c = (m.level.ship.cargo || []).concat(m.level.ship.stages).find(x => x.id === g.craft);
      return (c ? c.name : g.craft) + ': ' + goalText(Object.assign({}, g, { craft: null }), m);
    }
    const name = g.body ? m.sys.byId[g.body].name : (g.label || 'target');
    switch (g.type) {
      case 'hit': return g.site ? `Land in the zone on ${name}` : g.deorbit ? `Deorbit into ${name}` : 'Impact ' + name;
      case 'reach': return 'Reach ' + (g.label || name);
      case 'orbit': return `Orbit ${name} within ${g.rMin}–${g.rMax}${g.dir ? (g.dir > 0 ? ' counter-clockwise' : ' clockwise') : ''}`;
      case 'hold': return `Park at ${g.label || name} for ${g.hold}s`;
      case 'escape': return `Get ${g.r} from ${name}`;
      case 'rendezvous': return `Rendezvous with ${name}`;
      case 'spread': return `Spread ${g.crafts.length} satellites ≥${Math.round(g.minSep * 180 / Math.PI)}° apart, orbit ${g.rMin}–${g.rMax}`;
    }
    return '';
  }

  function updateHud() {
    const m = state.mission, L = m.level, s = m.ship, sys = m.sys;
    if (state.renderedGoal !== m.goalIndex || state.renderedDone !== m.done.size) { renderGoals(); state.renderedDone = m.done.size; }
    $('hud-time').textContent = fmtT(m.t);
    $('hud-warp').textContent = WARPS[state.warp] + '×';
    $('hud-warp').className = state.warp ? 'warn' : '';
    $('hud-frame').textContent = frameName();
    const dv = m.dvRemaining();
    if (L.ship.stages.length > 1) {
      // One gauge per stage; dropped stages grey out as jettisoned.
      m.stages.forEach((st, k) => {
        const v = m.stageDv(k);
        $('sg-v-' + k).textContent = k < m.stage ? 'jettisoned' : v.toFixed(2);
        $('sg-b-' + k).style.width = (100 * v / m.stageDv0[k]) + '%';
        $('sg-' + k).classList.toggle('spent', k < m.stage);
        $('sg-' + k).classList.toggle('active-stage', k === m.stage);
      });
    } else {
      $('hud-dv-label').textContent = 'Δv';
      $('hud-dv').textContent = dv.toFixed(2);
      $('bar-fuel').style.width = (100 * dv / m.dv0) + '%';
    }
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
    document.body.classList.toggle('can-deploy', m.canDeploy() || m.canDrop());
    const dropBtn = document.querySelector('#touch button.deploy');
    if (dropBtn) dropBtn.textContent = m.canDrop() ? 'DROP' : 'DEPLOY';
    if (L.ship.cargo && L.ship.cargo.length) {
      $('hud-cargo').textContent = m.cargo.length ? m.cargo.map(c => c.name).join(', ') + (isTouch() ? '' : ' · E drops') : 'all dropped';
    }
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
    $('hud-ref-label').textContent = eps < 0 && !L.zeroG ? 'Orbiting' : 'Near';
    $('hud-alt').textContent = (r - b.radius).toFixed(0);
    $('hud-spd').textContent = v.toFixed(2);
    // Zero-G: no orbit to speak of, so no high or low point.
    if (L.zeroG) { $('hud-ap').textContent = '–'; $('hud-pe').textContent = '–'; $('hud-pe').className = ''; }
    else if (eps < 0) {
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
    const subj = g && g.craft ? m.craftById(g.craft) : s;
    if (g && sub && g.type === 'spread') {
      const st = m.spreadState(g), pct = Math.min(100, 100 * m.holdTime / (g.confirm || 3));
      const sep = isFinite(st.sep) ? Math.round(st.sep * 180 / Math.PI) + '°' : '–';
      sub.innerHTML = `<div class="minibar"><div style="width:${pct}%"></div></div><span>in band <span class="${st.inBand === st.total ? 'ok' : 'warn'}">${st.inBand}/${st.total}</span> · spacing <span class="${st.sep >= g.minSep ? 'ok' : 'warn'}">${sep}</span></span>`;
    } else if (g && sub && !subj) {
      sub.innerHTML = `<span>Drop the ${goalText(g, m).split(':')[0]} when it's on the right path</span>`;
    } else if (g && sub) {
      const q = m.goalPoint(g);
      const d = Math.hypot(subj.x - q.x, subj.y - q.y);
      if (g.type === 'orbit') {
        // Show the orbit's lowest and highest points against the band.
        const o = m.orbitAbout(q, g.body, subj), conf = g.confirm || 3;
        const pct = Math.min(100, 100 * m.holdTime / conf);
        const fmt = (v) => (isFinite(v) ? v.toFixed(0) : '∞');
        const lowOk = o.pe >= g.rMin, highOk = o.bound && o.ap <= g.rMax, dirOk = !g.dir || g.dir === o.dir;
        const state = !dirOk ? '<span class="warn">wrong direction</span>'
          : lowOk && highOk ? (m.thrusting && subj === s ? 'engine off to lock' : '<span class="ok">locking orbit…</span>')
          : !o.bound ? '<span class="warn">escaping</span>' : '';
        sub.innerHTML = `<div class="minibar"><div style="width:${pct}%"></div></div>`
          + `<span>low <span class="${lowOk ? 'ok' : 'warn'}">${fmt(o.pe)}</span> · high <span class="${highOk ? 'ok' : 'warn'}">${fmt(o.ap)}</span></span> ${state}`;
      } else if (g.type === 'hold') {
        const pct = Math.min(100, 100 * m.holdTime / g.hold);
        const rv = Math.hypot(subj.vx - q.vx, subj.vy - q.vy), lim = g.relVel || 1;
        sub.innerHTML = `<div class="minibar"><div style="width:${pct}%"></div></div><span>${m.holdTime.toFixed(0)}/${g.hold}s · <span class="${d < g.r ? 'ok' : ''}">dist ${d.toFixed(0)}</span> · <span class="${rv < lim ? 'ok' : 'warn'}">rel v ${rv.toFixed(2)}</span></span>`;
      } else if (g.type === 'escape') {
        sub.innerHTML = `<span>distance ${d.toFixed(0)} / ${g.r}</span>`;
      } else if (g.type === 'rendezvous') {
        const rv = Math.hypot(subj.vx - q.vx, subj.vy - q.vy);
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

  // The menu shows one world at a time as tabs (plus the test levels). A
  // world opens once the world before it has earned enough stars; every
  // mission inside an open world is playable.
  const TEST_TAB = 'test';
  const worldStars = (n) => worldLevels(n).reduce((a, l) => a + (progress.stars[l.id] || 0), 0);
  function worldOpen(n) {
    const w = WORLDS.find(x => x.n === n);
    if (!w || !w.unlock || UNLOCK_ALL) return true;
    return worldOpen(n - 1) && worldStars(n - 1) >= w.unlock;
  }
  function levelOpen(i) { return LEVELS[i].test || worldOpen(worldOf(LEVELS[i])); }

  function defaultTab() {
    // The furthest open world that still has missions without stars.
    let tab = 1;
    for (const w of WORLDS) if (worldOpen(w.n) && worldLevels(w.n).some(l => !progress.stars[l.id])) { tab = w.n; }
    return tab;
  }

  function showMenu() {
    state.screen = 'menu';
    hide('hud'); hide('briefing'); hide('result'); hide('pause'); hide('help'); hide('board'); hide('profile');
    show('menu');
    const hasTests = LEVELS.some(l => l.test);
    if (state.menuTab == null || (state.menuTab !== TEST_TAB && !WORLDS.some(w => w.n === state.menuTab))) state.menuTab = progress.tab != null ? progress.tab : defaultTab();
    const tabs = $('world-tabs');
    tabs.innerHTML = '';
    for (const w of WORLDS) {
      const open = worldOpen(w.n), max = worldLevels(w.n).length * 3;
      const b = document.createElement('button');
      b.className = 'wtab w' + w.n + (state.menuTab === w.n ? ' active' : '') + (open ? '' : ' locked');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', state.menuTab === w.n);
      b.innerHTML = `<span class="wnum">World ${w.n}</span><span class="wname">${w.name}</span>`
        + `<span class="wstars">${open ? '★ ' + worldStars(w.n) + '/' + max : '🔒 ' + w.unlock + '★'}</span>`;
      b.onclick = () => selectTab(w.n);
      tabs.appendChild(b);
    }
    if (hasTests) {
      const b = document.createElement('button');
      b.className = 'wtab tests' + (state.menuTab === TEST_TAB ? ' active' : '');
      b.setAttribute('role', 'tab');
      b.innerHTML = '<span class="wnum">Test</span><span class="wname">In development</span>';
      b.onclick = () => selectTab(TEST_TAB);
      tabs.appendChild(b);
    }
    renderTab();
  }

  function selectTab(t) {
    state.menuTab = t; progress.tab = t; saveProgress();
    showMenu();
  }

  function renderTab() {
    const t = state.menuTab, grid = $('world-grid'), info = $('world-info');
    grid.innerHTML = '';
    grid.className = 'level-grid' + (t === TEST_TAB ? ' tests' : ' w' + t);
    const list = LEVELS.map((L, i) => [L, i]).filter(([L]) => t === TEST_TAB ? L.test : !L.test && worldOf(L) === t);
    const open = t === TEST_TAB || worldOpen(t);
    if (t === TEST_TAB) info.innerHTML = '<span class="k">Prototypes of upcoming mechanics</span>';
    else if (open) info.innerHTML = `<span class="k">${worldStars(t)} of ${list.length * 3} ★ earned</span>`;
    else {
      const w = WORLDS.find(x => x.n === t), have = worldStars(t - 1);
      info.innerHTML = `<span class="lock">🔒 Earn ${w.unlock} ★ in World ${t - 1} to open ${w.name}</span>`
        + `<div class="unlockbar"><div style="width:${Math.min(100, 100 * have / w.unlock)}%"></div></div>`
        + `<span class="k">${have} / ${w.unlock} ★ · ${Math.max(0, w.unlock - have)} to go</span>`;
    }
    grid.classList.toggle('locked', !open);
    const nextUp = open ? list.find(([L]) => !progress.stars[L.id]) : null;
    for (const [L, i] of list) {
      // Every mission in an open world is playable; the first uncleared one is marked next up.
      const stars = progress.stars[L.id] || 0;
      const next = nextUp && nextUp[1] === i;
      const card = document.createElement('button');
      card.className = 'level-card' + (stars ? ' cleared' : '') + (next ? ' next' : '') + (L.test ? ' test' : '');
      card.disabled = !open;
      card.innerHTML = `<div class="num">${L.test ? 'TEST' : String(missionNum(i)).padStart(2, '0')}</div>
        <div class="lname">${L.name}</div>
        <div class="lteach">${L.teaches}</div>
        <div class="lstars">${starStr(stars)}${next ? '<span class="nexttag">Next up</span>' : ''}</div>`;
      if (open) card.addEventListener('click', () => showBriefing(i));
      grid.appendChild(card);
    }
  }

  // Missions are numbered within their world: "World 2 · Mission 5 of 30".
  const worldOf = (L) => L.world || 1;
  const worldLevels = (n) => LEVELS.filter(l => !l.test && worldOf(l) === n);
  function missionNum(i) { return worldLevels(worldOf(LEVELS[i])).indexOf(LEVELS[i]) + 1; }
  function missionLabel(i) {
    const L = LEVELS[i];
    return L.test ? 'Test level' : `World ${worldOf(L)} · Mission ${missionNum(i)} of ${worldLevels(worldOf(L)).length}`;
  }
  function nextIndex(i) {
    const j = i + 1;
    return j < LEVELS.length && !!LEVELS[j].test === !!LEVELS[i].test && levelOpen(j) ? j : -1;
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
    releaseTouch();
    const m = state.mission, L = m.level;
    const won = m.status === 'won';
    const stars = m.stars();
    state.worldUnlocked = null;
    if (won) {
      const wasOpen = WORLDS.map(w => worldOpen(w.n));
      progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length - 1, state.levelIndex + 1));
      progress.stars[L.id] = Math.max(progress.stars[L.id] || 0, stars);
      const opened = WORLDS.find((w, k) => !wasOpen[k] && worldOpen(w.n));
      if (opened) { state.worldUnlocked = opened; progress.tab = opened.n; }
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
    if (state.worldUnlocked) $('res-msg').innerHTML += `<span class="unlocked">🔓 World ${state.worldUnlocked.n} · ${state.worldUnlocked.name} is open!</span>`;
    $('res-stats').innerHTML = `<span><span class="k">Δv used</span> ${m.dvUsed().toFixed(2)}</span>
      <span><span class="k">Time</span> ${fmtT(m.t)}</span>
      ${progress.best[L.id] ? `<span><span class="k">Best</span> ${progress.best[L.id].toFixed(2)}</span>` : ''}`;
    const hasNext = nextIndex(state.levelIndex) >= 0;
    $('btn-res-next').style.display = won && hasNext ? '' : 'none';
    $('btn-res-retry').className = won && hasNext ? '' : 'primary';
    show('result');
    $('res-online').innerHTML = '';
    if (won && !L.test) submitRun(L);
  }

  // ------------------------------------------------------------ phone gate
  // Phones play in landscape and fullscreen. Losing either (rotating back,
  // leaving fullscreen, switching apps) pauses the mission.
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fsSupported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  // Inside the native app (mobile/, for the app stores) the game is already
  // fullscreen, so it counts the same as a home-screen web app.
  const nativeApp = () => Bridge.inApp;
  const standalone = () => nativeApp() || window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
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
      state.paused = true; releaseTouch(); show('pause');
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
    if (state.paused) { releaseTouch(); show('pause'); state.screen = 'flight'; }
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

  // ---------------------------------------------------------- online
  document.body.classList.toggle('online', Online.available());
  Online.bindProgress(() => ({ unlocked: progress.unlocked, stars: progress.stars, best: progress.best, score: progress.score, learned: progress.learned }), mergeIn);
  const fmtVal = (kind, v) => (kind === 'time' ? fmtT(v) : Math.round(v).toLocaleString());

  async function submitRun(L) {
    const el = $('res-online');
    el.textContent = 'Checking your run for the leaderboard…';
    const r = await Online.submitRun(state.rec.toJSON());
    if (state.screen !== 'result') return;
    if (r.run) {
      el.innerHTML = `Leaderboard: <b>#${r.rank.score}</b> of ${r.total} by score · <b>#${r.rank.time}</b> fastest (${fmtT(r.best.time)})`;
    } else if (r.queued) el.textContent = 'Offline: your run will be submitted when you reconnect.';
    else if (r.unavailable) el.textContent = '';
    else el.textContent = 'Leaderboard: ' + r.error;
  }

  // Leaderboard screen for one mission.
  let boardLevel = null, boardKind = 'score', boardReturn = null;
  function showBoard(i, from) {
    boardLevel = LEVELS[i]; boardReturn = from;
    $('board-title').textContent = boardLevel.name;
    $('board-eyebrow').textContent = 'Leaderboard · ' + missionLabel(i);
    hide(from); show('board');
    loadBoard();
  }
  async function loadBoard() {
    const list = $('board-list'), me = $('board-me'), L = boardLevel, kind = boardKind;
    for (const b of document.querySelectorAll('.board-tabs button')) b.classList.toggle('active', b.dataset.kind === kind);
    list.innerHTML = '<li class="empty">Loading…</li>'; me.textContent = '';
    try {
      const r = await Online.board(L.id, kind);
      if (boardLevel !== L || boardKind !== kind) return;
      list.innerHTML = r.top.length ? '' : '<li class="empty">No runs yet. Be the first!</li>';
      for (const e of r.top) {
        const li = document.createElement('li');
        if (e.me) li.className = 'me';
        li.innerHTML = `<span class="rk">#${e.rank}</span><span class="nm"></span><span>${fmtVal(kind, e.value)}</span>`;
        li.querySelector('.nm').textContent = e.name;
        list.appendChild(li);
      }
      me.textContent = r.me ? `You: #${r.me.rank} of ${r.total} · ${fmtVal(kind, r.me.value)}` : (r.total ? `${r.total} pilots · finish the mission to get on the board` : '');
    } catch (e) {
      list.innerHTML = '';
      const li = document.createElement('li'); li.className = 'empty'; li.textContent = e.offline ? 'You\'re offline.' : e.message; list.appendChild(li);
    }
  }
  for (const b of document.querySelectorAll('.board-tabs button')) b.onclick = () => { boardKind = b.dataset.kind; loadBoard(); };
  $('btn-board-close').onclick = () => { hide('board'); show(boardReturn || 'menu'); };
  $('btn-brief-board').onclick = () => showBoard(state.levelIndex, 'briefing');
  $('btn-res-board').onclick = () => showBoard(state.levelIndex, 'result');

  // Pilot profile: name, Sign in with Apple, restore code.
  function renderProfile() {
    const a = Online.state.account, p = a && a.player;
    const total = Object.values(progress.stars).reduce((x, y) => x + y, 0);
    const max = LEVELS.filter(l => !l.test).length * 3;
    $('pf-name').textContent = p ? p.name : 'Pilot';
    $('pf-stats').innerHTML = `<span><span class="k">Stars</span> ${total} / ${max}</span><span><span class="k">Missions</span> ${Object.keys(progress.stars).length}</span>`;
    if (document.activeElement !== $('pf-name-input')) $('pf-name-input').value = p ? p.name : '';
    $('pf-code').textContent = p ? p.code : '····-····-····';
    $('pf-apple-row').style.display = Online.appleAvailable() ? '' : 'none';
    $('btn-pf-apple').style.display = p && p.apple ? 'none' : '';
    $('btn-pf-delete').style.display = p ? '' : 'none';
    $('pf-apple-state').textContent = p && p.apple ? '✓ Signed in with Apple. Your stars follow your Apple ID.' : '';
    const st = Online.state.status, el = $('pf-status');
    el.className = 'small' + (st === 'offline' ? ' warn' : '');
    el.textContent = !Online.available() ? 'Accounts and leaderboards work in the app and on the website.'
      : st === 'syncing' ? 'Syncing…' : st === 'synced' ? '✓ Your progress is saved to the cloud.'
      : st === 'offline' ? 'Offline. Your progress is safe on this device and will sync later.'
      : Online.state.lastError || '';
  }
  async function showProfile() {
    hide('menu'); show('profile'); renderProfile();
    if (Online.available()) {
      try { await Online.ensureAccount(); await Online.syncNow(); } catch (e) { /* status shows it */ }
      renderProfile();
    }
  }
  const busy = async (btn, fn) => {
    btn.disabled = true;
    try { await fn(); } catch (e) { $('pf-status').className = 'small warn'; $('pf-status').textContent = e.message; btn.disabled = false; return; }
    btn.disabled = false; renderProfile();
  };
  $('btn-profile').onclick = showProfile;
  // In the app, open the website's copy of the privacy policy in Safari.
  if (Bridge.inApp) {
    const a = document.querySelector('#profile a.plain');
    a.href = ((window.THRUSTERZ_CONFIG || {}).apiBase || '') + '/privacy.html';
    a.onclick = (e) => { e.preventDefault(); Bridge.open(a.href); };
  }
  $('btn-pf-close').onclick = () => { hide('profile'); showMenu(); };
  $('btn-pf-rename').onclick = () => busy($('btn-pf-rename'), async () => { await Online.rename($('pf-name-input').value); toast('Name saved', 1.2); });
  $('btn-pf-restore').onclick = () => busy($('btn-pf-restore'), async () => {
    const code = $('pf-restore-input').value.trim();
    if (!code) throw new Error('Enter a restore code first');
    await Online.restore(code);
    $('pf-restore-input').value = '';
    toast('Account restored. Your stars are back.', 2);
  });
  $('btn-pf-apple').onclick = () => busy($('btn-pf-apple'), async () => { await Online.signInWithApple(); toast('Signed in with Apple', 1.5); });
  $('btn-pf-delete').onclick = () => busy($('btn-pf-delete'), async () => {
    if (!Online.state.account) throw new Error('There is no online account on this device');
    if (!confirm('Delete your pilot account? Your name, leaderboard runs and cloud save are removed for good. Stars on this device stay.')) return;
    await Online.deleteAccount();
    toast('Account deleted', 1.5);
  });
  $('btn-pf-copy').onclick = async () => {
    const a = Online.state.account; if (!a) return;
    try { await navigator.clipboard.writeText(a.player.code); toast('Restore code copied', 1.2); } catch (e) { toast(a.player.code, 3); }
  };
  Online.onChange(() => { if (!$('profile').classList.contains('hidden')) renderProfile(); });

  // In the app, the native copy of progress survives the OS clearing WebView
  // storage; fold it back in, then sync with the cloud.
  Online.Store.getNative(STORE).then((p) => { if (p) mergeIn(p); }).finally(() => Online.start());

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
  window.Thrusterz = { state, startLevel, showMenu, levelCount: LEVELS.length };
})();
