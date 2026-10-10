// Sound effects and optional background music, all synthesised with Web
// Audio (no sound files). Browsers only start audio after a tap or key
// press, so everything stays silent until Sound.unlock() runs from one.
(function (root) {
  'use strict';
  const AC = root.AudioContext || root.webkitAudioContext;
  let ctx = null, master = null, sfxBus = null, musicBus = null, noise = null;
  let sfxVol = 0.8, musicVol = 0.5, music = null;
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
  // A noise explosion through the saturator: the crash.
  function boom(when) {
    if (!ctx) return;
    const t = now() + (when || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.4, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(f); f.connect(g); g.connect(crunch); src.start(t, 0.3); src.stop(t + 1.5);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(1.2, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(og); og.connect(crunch); o.start(t); o.stop(t + 1);
  }
  // "Wah wah wah waaah": four falling notes on a buzzy horn, the last one
  // sagging. Cheeky enough to sting a little.
  function fanfail(at) {
    const steps = [[67, 0.26], [66, 0.26], [65, 0.26], [64, 0.9]];
    let t = at;
    steps.forEach(([n, len], i) => {
      const last = i === steps.length - 1;
      for (const det of [-8, 8]) note('sawtooth', n - 12, t, len, 0.09, { detune: det, bend: last ? -2 : 0, vibrato: last ? 6 : 0, tail: last ? 0.25 : 0.05 });
      note('square', n - 24, t, len, 0.05, { bend: last ? -2 : 0 });
      t += len + 0.04;
    });
  }

  // ------------------------------------------------------------- music
  // A slow ambient pad (four chords, eight seconds each) with sparse plucks
  // through a long echo. Quiet, and generated live, so it never repeats exactly.
  const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]];
  const SCALE = [69, 72, 74, 76, 79, 81, 84];
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function startMusic() {
    if (music || !ctx) return;
    const echo = ctx.createDelay(2); echo.delayTime.value = 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(musicBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.4;
    lp.connect(musicBus);
    music = { echo, lp, bar: 0, timer: null, seed: 7 };
    const rnd = () => (music.seed = (music.seed * 16807) % 2147483647) / 2147483647;
    const bar = () => {
      if (!music) return;
      const t = now() + 0.05, chord = CHORDS[music.bar % CHORDS.length];
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
        o.connect(g); g.connect(echo); g.connect(musicBus); o.start(at); o.stop(at + 1.8);
      }
      music.bar++;
    };
    bar();
    music.timer = setInterval(bar, 8000);
  }
  function stopMusic() {
    if (!music) return;
    clearInterval(music.timer);
    const m = music; music = null;
    setTimeout(() => { try { m.echo.disconnect(); m.lp.disconnect(); } catch (e) { /* gone */ } }, 9000);
  }
  function applyMusic() {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(musicVol * 1.1, now(), 0.4);
    if (musicOn()) startMusic(); else setTimeout(() => { if (!musicOn()) stopMusic(); }, 1500);
  }

  const Sound = {
    // Call from a tap or key press (browsers' autoplay rule).
    unlock() {
      if (!setup()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      applyMusic();
    },
    // Volumes 0..1 (0 = off).
    configure(o) {
      if (o.sfxVol != null) sfxVol = Math.max(0, Math.min(1, +o.sfxVol));
      if (o.musicVol != null) musicVol = Math.max(0, Math.min(1, +o.musicVol));
      if (ctx) { sfxBus.gain.setTargetAtTime(sfxVol, now(), 0.05); applyMusic(); }
    },
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
    // Win: a bouncy fanfare (da-da-da DA, da-DAAA) over a bass hop, with sparkle.
    win() {
      const lead = [[67, 0, 0.11], [72, 0.12, 0.11], [76, 0.24, 0.11], [79, 0.36, 0.3], [76, 0.7, 0.12], [84, 0.84, 0.7]];
      for (const [n, at, len] of lead) {
        note('square', n, at, len, 0.07, { tail: 0.12, vibrato: len > 0.5 ? 5.5 : 0 });
        note('triangle', n, at, len, 0.11, { tail: 0.15 });
      }
      for (const [n, at, len] of [[48, 0, 0.3], [55, 0.36, 0.3], [48, 0.84, 0.75]]) note('triangle', n, at, len, 0.16, { tail: 0.2 });
      for (const n of [76, 79]) note('triangle', n, 0.84, 0.7, 0.06, { tail: 0.3 });
      [96, 100, 103, 108].forEach((n, i) => note('sine', n, 1.0 + i * 0.07, 0.08, 0.035, { tail: 0.25 }));
    },
    // Crash: a crunchy explosion, then the wah-wah.
    crash() { boom(0); fanfail(0.55); },
    // Out of time / lost in space: just the wah-wah, after a sigh of static.
    fail() { burst('bandpass', 900, 300, 0.12, 0.4); fanfail(0.25); },
  };

  root.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
