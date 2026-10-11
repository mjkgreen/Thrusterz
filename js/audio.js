// Sound effects and optional background music, all synthesised with Web
// Audio (no sound files). Browsers only start audio after a tap or key
// press, so everything stays silent until Sound.unlock() runs from one.
(function (root) {
  'use strict';
  const AC = root.AudioContext || root.webkitAudioContext;
  let ctx = null, master = null, sfxBus = null, musicBus = null, noise = null;
  let sfxVol = 0.8, musicVol = 0.5;
  const musicOn = () => musicVol > 0.001;
  let engine = null, rcs = null, crunch = null;

  function setup() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    // A little saturation for the crash, so it crunches rather than thuds.
    crunch = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(4 * x); }
    crunch.curve = curve; crunch.connect(sfxBus);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    // Two seconds of white noise, looped by the engine, side thrusters and bangs.
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let x = 12345;
    for (let i = 0; i < d.length; i++) { x = (x * 16807) % 2147483647; d[i] = x / 1073741823.5 - 1; }
    engine = loop(320, 'lowpass', 0.9);
    rcs = loop(2600, 'highpass', 0.6);
    return true;
  }

  // A looping noise source through a filter into a gain we can open and close.
  function loop(freq, type, q) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
    return { f, g, on: 0 };
  }

  const now = () => ctx.currentTime;
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(type, f0, f1, peak, attack, decay, when, bus, vibrato) {
    if (!ctx) return;
    const t = now() + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
    env(g, t, peak, attack, decay);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = vibrato; lg.gain.value = f0 * 0.012;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + attack + decay + 0.05);
    }
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + attack + decay + 0.05);
  }
  // A held note with its own envelope (attack, hold, release) and an optional
  // pitch bend at the end: the building block of the jingles.
  function note(type, n, at, len, peak, opts) {
    if (!ctx) return;
    opts = opts || {};
    const t = now() + at, o = ctx.createOscillator(), g = ctx.createGain(), f = hz(n);
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opts.bend) o.frequency.linearRampToValueAtTime(f * Math.pow(2, opts.bend / 12), t + len);
    if (opts.detune) o.detune.value = opts.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.setValueAtTime(peak, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + (opts.tail || 0.08));
    if (opts.vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = opts.vibrato; lg.gain.value = f * 0.02;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + len + 0.2);
    }
    o.connect(g); g.connect(opts.bus || sfxBus); o.start(t); o.stop(t + len + (opts.tail || 0.08) + 0.05);
  }
  function burst(type, f0, f1, peak, decay, when) {
    if (!ctx) return;
    const t = now() + (when || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + decay);
    env(g, t, peak, 0.005, decay);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t, Math.random() * 1.5); src.stop(t + decay + 0.1);
  }
  // A G F E on the flight track's buzzy square, through its echo feel, the
  // last note sagging down: the "you blew it" phrase, in key with the music.
  function fallPhrase(at) {
    const step = 60 / 112 / 4, steps = [[69, 2], [67, 2], [65, 2], [64, 6]];
    let t = at;
    steps.forEach(([n, len], i) => {
      const last = i === steps.length - 1, d = len * step;
      for (const det of [-9, 9]) note('sawtooth', n - 12, t, d, 0.06, { detune: det, bend: last ? -1.5 : 0, vibrato: last ? 5.5 : 0, tail: last ? 0.5 : 0.06 });
      note('square', n, t, d, 0.03, { bend: last ? -1.5 : 0, tail: last ? 0.4 : 0.05 });
      t += d;
    });
  }

  // ------------------------------------------------------------- music
  // Two tracks, crossfaded: a slow ambient pad for the menu and pause screen,
  // and a driving piece for flying. Both are generated live, so they never
  // repeat exactly. Each plays into its own gain under the music bus.
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let mode = 'menu', menuGain = null, flightGain = null, menuTrack = null, flightTrack = null;
  function buses() {
    if (menuGain) return;
    menuGain = ctx.createGain(); menuGain.gain.value = mode === 'menu' ? 1 : 0; menuGain.connect(musicBus);
    // The flight track runs through a filter and a level of its own, so a
    // crash can muffle it and a win can swell it, without stopping the beat.
    flightGain = ctx.createGain(); flightGain.gain.value = mode === 'flight' ? 1 : 0;
    flightFilter = ctx.createBiquadFilter(); flightFilter.type = 'lowpass'; flightFilter.frequency.value = 18000; flightFilter.Q.value = 0.7;
    flightLevel = ctx.createGain(); flightLevel.gain.value = 1;
    flightGain.connect(flightFilter); flightFilter.connect(flightLevel); flightLevel.connect(musicBus);
  }
  let flightFilter = null, flightLevel = null;
  // When the flight track is playing, the time of its next eighth note, so a
  // jingle lands on the beat; otherwise right away.
  function onBeat() {
    if (!flightTrack || mode !== 'flight' || !musicOn()) return 0;
    let t = flightTrack.next, st = flightTrack.step;
    while (st % 2) { t += STEP; st++; }
    return Math.max(0, t - now());
  }
  const playing = () => flightTrack && mode === 'flight' && musicOn();

  // Menu: four chords, eight seconds each, with sparse plucks through a long echo.
  const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]];
  const SCALE = [69, 72, 74, 76, 79, 81, 84];
  function startMenu() {
    if (menuTrack || !ctx) return;
    const echo = ctx.createDelay(2); echo.delayTime.value = 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(menuGain);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.4;
    lp.connect(menuGain);
    const tr = menuTrack = { echo, lp, bar: 0, timer: null, seed: 7 };
    const rnd = () => (tr.seed = (tr.seed * 16807) % 2147483647) / 2147483647;
    const bar = () => {
      if (menuTrack !== tr) return;
      const t = now() + 0.05, chord = CHORDS[tr.bar % CHORDS.length];
      for (const n of chord) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = hz(n - 12); o.detune.value = det;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 2.5);
          g.gain.setValueAtTime(0.018, t + 6); g.gain.linearRampToValueAtTime(0.0001, t + 8.6);
          o.connect(g); g.connect(lp); o.start(t); o.stop(t + 8.8);
        }
      }
      for (let k = 0; k < 4; k++) {
        if (rnd() < 0.45) continue;
        const o = ctx.createOscillator(), g = ctx.createGain(), at = t + k * 2 + rnd() * 0.6;
        o.type = 'sine'; o.frequency.value = hz(SCALE[Math.floor(rnd() * SCALE.length)]);
        env(g, at, 0.05, 0.01, 1.6);
        o.connect(g); g.connect(echo); g.connect(menuGain); o.start(at); o.stop(at + 1.8);
      }
      tr.bar++;
    };
    bar();
    tr.timer = setInterval(bar, 8000);
  }

  // Flight: A minor at 112 bpm. Pulsing eighth-note bass, a sixteenth-note
  // arpeggio through a dotted echo, kick / snare / hats, and a low pad. An
  // eight-bar loop (Am Am F G | Dm F Em E) that builds: the arpeggio joins
  // after four bars, and every eighth bar drops the drums for a breath.
  const BPM = 112, STEP = 60 / BPM / 4;
  const PROG = [[45, 57, 60, 64], [45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62],
    [38, 50, 53, 57], [41, 53, 57, 60], [40, 52, 55, 59], [40, 52, 56, 59]];
  const ARP = [1, 2, 3, 2, 1, 3, 2, 3, 1, 2, 3, 2, 4, 3, 2, 3];
  function startFlight() {
    if (flightTrack || !ctx) return;
    const echo = ctx.createDelay(1); echo.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(flightGain);
    const tr = flightTrack = { echo, step: 0, next: now() + 0.1, timer: null };
    const voice = (type, freq, at, len, peak, cutoff, out) => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, at); f.frequency.exponentialRampToValueAtTime(cutoff * 0.35, at + len);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(f); f.connect(g); g.connect(out || flightGain); o.start(at); o.stop(at + len + 0.05);
    };
    const hit = (type, f0, at, len, peak) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; f.type = type; f.frequency.value = f0;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      src.connect(f); f.connect(g); g.connect(flightGain); src.start(at, (at * 7.3) % 1.5); src.stop(at + len + 0.05);
    };
    const kick = (at) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(130, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.22);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.42, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      o.connect(g); g.connect(flightGain); o.start(at); o.stop(at + 0.35);
    };
    const schedule = () => {
      if (flightTrack !== tr) return;
      while (tr.next < now() + 0.25) {
        const at = tr.next, st = tr.step, bar = Math.floor(st / 16), s16 = st % 16, chord = PROG[bar % 8];
        const breath = bar % 8 === 7, built = bar >= 4;
        // Pad: the chord, held for the bar.
        if (s16 === 0) for (const n of chord.slice(1)) for (const det of [-7, 7]) {
          const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), len = STEP * 16;
          o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
          f.type = 'lowpass'; f.frequency.value = 900;
          g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.011, at + 0.25); g.gain.setValueAtTime(0.011, at + len - 0.2); g.gain.linearRampToValueAtTime(0.0001, at + len + 0.1);
          o.connect(f); f.connect(g); g.connect(flightGain); o.start(at); o.stop(at + len + 0.15);
        }
        // Bass: eighth notes, root with an octave jump on the off-beats.
        if (s16 % 2 === 0) voice('sawtooth', hz(chord[0] - 12 + (s16 % 4 === 2 ? 12 : 0)), at, STEP * 1.6, 0.13, 520);
        // Arpeggio: sixteenths over the chord, from bar five on.
        if (built && !breath) {
          const i = ARP[s16], n = i < 4 ? chord[i] + 12 : chord[1] + 24;
          voice('square', hz(n), at, STEP * 0.9, 0.028, 2200, echo);
          voice('square', hz(n), at, STEP * 0.9, 0.022, 2200);
        }
        if (!breath) {
          if (s16 === 0 || s16 === 8 || (s16 === 14 && bar % 2 === 1)) kick(at);
          if (s16 === 4 || s16 === 12) hit('bandpass', 1900, at, 0.14, 0.13);
          if (s16 % 2 === 1) hit('highpass', 7500, at, 0.035, s16 % 4 === 3 ? 0.05 : 0.03);
        } else if (s16 === 12) hit('highpass', 3000, at, 0.6, 0.05); // a swell into the next phrase
        tr.step++; tr.next += STEP;
      }
    };
    schedule();
    tr.timer = setInterval(schedule, 50);
  }

  function stopTrack(which) {
    const tr = which === 'menu' ? menuTrack : flightTrack;
    if (!tr) return;
    clearInterval(tr.timer);
    if (which === 'menu') menuTrack = null; else flightTrack = null;
    setTimeout(() => { try { tr.echo.disconnect(); if (tr.lp) tr.lp.disconnect(); } catch (e) { /* gone */ } }, 9000);
  }
  // Fade to the track for the current mode; stop the other once it's silent.
  function applyMusic() {
    if (!ctx) return;
    buses();
    musicBus.gain.setTargetAtTime(musicVol * 1.1, now(), 0.4);
    if (!musicOn()) { setTimeout(() => { if (!musicOn()) { stopTrack('menu'); stopTrack('flight'); } }, 1500); return; }
    const on = mode === 'flight' ? flightGain : menuGain, off = mode === 'flight' ? menuGain : flightGain;
    on.gain.setTargetAtTime(1, now(), 0.5); off.gain.setTargetAtTime(0, now(), 0.5);
    if (mode === 'flight') startFlight(); else startMenu();
    const was = mode;
    setTimeout(() => { if (mode === was) stopTrack(was === 'flight' ? 'menu' : 'flight'); }, 3000);
  }

  // iPhones mute web audio on the speaker when the ring/silent switch is on
  // (headphones still play). Asking for "playback" audio, like a music or
  // game app, plays through anyway: navigator.audioSession on iOS 17+, or a
  // looping silent <audio> element on older versions.
  let ignoreSilent = true, silentEl = null;
  function applySession() {
    try { if (navigator.audioSession) { navigator.audioSession.type = ignoreSilent ? 'playback' : 'ambient'; return; } } catch (e) { /* not allowed */ }
    if (!ignoreSilent) { if (silentEl) silentEl.pause(); return; }
    if (!silentEl) {
      // 0.5 s of silence as a WAV data URI.
      const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
      b.fill(128, 44);
      let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
      silentEl = document.createElement('audio');
      silentEl.src = 'data:audio/wav;base64,' + btoa(bin);
      silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.preload = 'auto';
    }
    const pr = silentEl.play(); if (pr && pr.catch) pr.catch(() => {});
  }

  const Sound = {
    // Call from a tap or key press (browsers' autoplay rule).
    unlock() {
      applySession();
      if (!setup()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      applyMusic();
    },
    // Volumes 0..1 (0 = off).
    configure(o) {
      if (o.sfxVol != null) sfxVol = Math.max(0, Math.min(1, +o.sfxVol));
      if (o.musicVol != null) musicVol = Math.max(0, Math.min(1, +o.musicVol));
      if (o.ignoreSilent != null && !!o.ignoreSilent !== ignoreSilent) { ignoreSilent = !!o.ignoreSilent; if (ctx) applySession(); }
      if (ctx) { sfxBus.gain.setTargetAtTime(sfxVol, now(), 0.05); applyMusic(); }
    },
    // Which music plays: 'menu' (menus, pause, results) or 'flight'.
    musicMode(m) { if (m === mode) return; mode = m; applyMusic(); },
    // Leaving the app or tab: go quiet; coming back resumes.
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    // Continuous sounds, set every frame: engine throttle (0 = off), side thrusters on/off.
    engine(level) {
      if (!ctx || !engine) return;
      const v = Math.max(0, Math.min(1, level));
      if (Math.abs(v - engine.on) < 0.01) return;
      engine.on = v;
      engine.g.gain.setTargetAtTime(v * 0.26, now(), v > 0 ? 0.04 : 0.09);
      engine.f.frequency.setTargetAtTime(220 + v * 520, now(), 0.08);
    },
    rcs(on) {
      if (!ctx || !rcs) return;
      const v = on ? 1 : 0;
      if (v === rcs.on) return;
      rcs.on = v;
      rcs.g.gain.setTargetAtTime(v * 0.07, now(), 0.02);
    },
    // One-shots.
    click() { tone('triangle', 1100, 900, 0.05, 0.002, 0.05); },
    stage() { tone('sine', 140, 38, 0.6, 0.005, 0.35); burst('lowpass', 1800, 200, 0.35, 0.25); },
    drop() { tone('square', 900, 600, 0.06, 0.002, 0.05); tone('sine', 420, 300, 0.12, 0.004, 0.12, 0.03); },
    pickup() { [0, 4, 7, 12].forEach((s, i) => tone('triangle', hz(72 + s), 0, 0.12, 0.005, 0.18, i * 0.06)); },
    warn() { tone('square', 660, 0, 0.05, 0.004, 0.09); tone('square', 660, 0, 0.05, 0.004, 0.09, 0.16); },
    // Controls: time warp up (rising) / down (falling), reference frame, camera.
    warp(dir) { const a = dir > 0 ? [880, 1320] : [1320, 880]; a.forEach((f, i) => tone('triangle', f, 0, 0.06, 0.003, 0.06, i * 0.05)); },
    frame() { tone('sine', 520, 0, 0.08, 0.003, 0.09); tone('sine', 780, 0, 0.06, 0.003, 0.12, 0.06); },
    camera() { burst('bandpass', 600, 2400, 0.08, 0.22); },
    // A probe or pod released: a sonar ping with a little echo.
    ping() {
      tone('sine', 1480, 1440, 0.14, 0.004, 0.9);
      tone('sine', 1480, 1440, 0.05, 0.004, 0.7, 0.32);
      tone('square', 900, 600, 0.03, 0.002, 0.04);
    },
    // Crash or keep-out zone ahead: a two-tone alert, sharper when closer.
    alarm(urgent) {
      const f = urgent ? 1180 : 940;
      tone('square', f, 0, urgent ? 0.07 : 0.05, 0.003, 0.08);
      tone('square', f * 0.75, 0, urgent ? 0.07 : 0.05, 0.003, 0.08, 0.11);
    },
    // A hold / orbit confirmation filling up: one tick per quarter, each higher.
    progress(step) { const n = [72, 76, 79, 84][Math.max(0, Math.min(3, step))]; tone('sine', hz(n), 0, 0.09, 0.004, 0.16); tone('triangle', hz(n + 12), 0, 0.03, 0.004, 0.1); },
    // One objective of several done: a short two-note "got it".
    objective() { note('triangle', 79, 0, 0.09, 0.12, { tail: 0.1 }); note('triangle', 84, 0.1, 0.22, 0.13, { tail: 0.25 }); note('sine', 91, 0.1, 0.22, 0.04, { tail: 0.3 }); },
    // Win, in the flight track's key (A minor, resolving to A major) and
    // timbre, on its beat: the music swells a little under a rising arpeggio
    // with a shimmer on top.
    win() {
      if (!ctx) return;
      const at = onBeat(), step = 60 / 112 / 4;
      if (playing()) {
        const t = now() + at;
        flightLevel.gain.setTargetAtTime(1.35, t, 0.15); flightLevel.gain.setTargetAtTime(1, t + 2.2, 0.6);
      }
      const notes = [57, 61, 64, 69, 73, 76, 81];
      notes.forEach((n, i) => {
        note('square', n, at + i * step, i === notes.length - 1 ? 1.4 : step * 1.6, 0.05, { tail: 0.4, vibrato: i === notes.length - 1 ? 5 : 0 });
        note('triangle', n, at + i * step, i === notes.length - 1 ? 1.4 : step * 1.6, 0.08, { tail: 0.4 });
      });
      for (const n of [57, 64, 69, 73]) note('sawtooth', n - 12, at + 6 * step, 1.6, 0.025, { detune: 6, tail: 0.8 });
      [93, 97, 100, 105].forEach((n, i) => note('sine', n, at + 6 * step + i * 0.09, 0.12, 0.03, { tail: 0.6 }));
    },
    // Crash: a muffled, spacey boom; the music sinks under water for a
    // moment (the beat keeps going), and a falling phrase in key, A G F E,
    // with the last note sagging. Stings, but belongs to the music.
    crash() {
      if (!ctx) return;
      const t = now();
      if (playing()) {
        flightFilter.frequency.cancelScheduledValues(t);
        flightFilter.frequency.setValueAtTime(18000, t);
        flightFilter.frequency.exponentialRampToValueAtTime(320, t + 0.35);
        flightFilter.frequency.setValueAtTime(320, t + 1.8);
        flightFilter.frequency.exponentialRampToValueAtTime(18000, t + 4);
      }
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(60, t + 1.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      src.connect(f); f.connect(g); g.connect(crunch); src.start(t, 0.3); src.stop(t + 1.9);
      tone('sine', 95, 30, 0.6, 0.005, 0.9);
      fallPhrase(onBeat() || 0.35);
    },
    // Out of time / lost in space: the music dips, then the falling phrase.
    fail() {
      if (!ctx) return;
      if (playing()) { const t = now(); flightLevel.gain.setTargetAtTime(0.45, t, 0.2); flightLevel.gain.setTargetAtTime(1, t + 2.5, 0.8); }
      burst('bandpass', 700, 250, 0.08, 0.6);
      fallPhrase(onBeat() || 0.2);
    },
  };

  root.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
