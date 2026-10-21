// Rocket skins: hulls and engine flames, earned by finishing worlds. Clearing
// every mission in a world earns its hull; three stars on every mission earns
// its flame. Shared by the game (drawing, the Hangar) and the server, which
// grants skins from verified runs so the leaderboards only show earned ones.
// Skins are looks only: nothing here touches the physics.
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;

  // Hulls. `fill` is the hull's top-to-bottom gradient; `pattern` is painted
  // over it, clipped to the hull. `shape: 'needle'` is a longer nose and
  // bigger fins.
  const HULLS = [
    { id: 'classic', name: 'Classic', fill: ['#ffffff', '#eef2fa', '#b9c4dc'], line: '#7f8aa8', fin: '#d9e0ee', nozzle: '#3a4a72' },
    { id: 'cadet', name: 'Cadet', world: 0, need: 'clear', fill: ['#ffffff', '#eef2fa', '#b9c4dc'], line: '#7f8aa8', fin: '#ff8a3d', finLine: '#a8501a', nozzle: '#3a4a72', pattern: 'bands', ink: '#ff8a3d' },
    { id: 'checker', name: 'Checkerboard', world: 1, need: 'clear', fill: ['#ffffff', '#f2f4f8', '#c9cfdc'], line: '#3a3f4c', fin: '#262a33', finLine: '#0e1015', nozzle: '#262a33', pattern: 'checker', ink: '#262a33' },
    { id: 'nebula', name: 'Nebula', world: 2, need: 'clear', fill: ['#f0c8ff', '#a45cf0', '#4b1f8f'], line: '#2e1260', fin: '#f78cff', finLine: '#7a2a90', nozzle: '#241046', pattern: 'stars', ink: '#ffffff' },
    { id: 'hazard', name: 'Hazard', world: 3, need: 'clear', fill: ['#ffe97a', '#ffcc33', '#c89400'], line: '#5a4300', fin: '#1e1e22', finLine: '#000000', nozzle: '#1e1e22', pattern: 'hazard', ink: '#1e1e22' },
    { id: 'chrome', name: 'Chrome Needle', world: 4, need: 'clear', shape: 'needle', fill: ['#ffffff', '#9aa6bd', '#eef2fa', '#5d6a85'], line: '#4a5570', fin: '#c8a8ff', finLine: '#5b3f99', nozzle: '#2a3150', pattern: 'pinstripe', ink: '#8cf0ff' },
  ];

  // Flames: outer plume, pale core, and the exhaust particles' colour from
  // `hot` (just out of the nozzle) to `cool` (fading). `pulse` throbs.
  const FLAMES = [
    { id: 'standard', name: 'Standard', outer: [[255, 200, 70, 0.95], [255, 122, 26, 0.85], [255, 90, 20, 0]], core: [[255, 248, 200, 0.95], [255, 230, 140, 0]], hot: [255, 250, 60], cool: [255, 150, 0] },
    { id: 'blue', name: 'Cold Blue', world: 0, need: 'three', outer: [[140, 210, 255, 0.95], [50, 120, 255, 0.85], [30, 60, 255, 0]], core: [[235, 250, 255, 0.95], [170, 220, 255, 0]], hot: [210, 240, 255], cool: [60, 120, 255] },
    { id: 'crimson', name: 'Strontium Red', world: 1, need: 'three', outer: [[255, 110, 110, 0.95], [220, 20, 50, 0.85], [160, 0, 40, 0]], core: [[255, 225, 225, 0.95], [255, 140, 150, 0]], hot: [255, 200, 200], cool: [210, 20, 50] },
    { id: 'plasma', name: 'Plasma', world: 2, need: 'three', outer: [[255, 150, 255, 0.95], [190, 60, 255, 0.85], [110, 30, 255, 0]], core: [[255, 240, 255, 0.95], [255, 170, 255, 0]], hot: [255, 220, 255], cool: [170, 60, 255] },
    { id: 'boron', name: 'Boron Green', world: 3, need: 'three', outer: [[190, 255, 120, 0.95], [60, 220, 80, 0.85], [20, 160, 60, 0]], core: [[240, 255, 225, 0.95], [190, 255, 160, 0]], hot: [230, 255, 190], cool: [40, 200, 70] },
    { id: 'pulsar', name: 'Pulsar', world: 4, need: 'three', pulse: true, outer: [[140, 245, 255, 0.95], [120, 120, 255, 0.85], [200, 120, 255, 0]], core: [[255, 255, 255, 1], [190, 250, 255, 0]], hot: [235, 255, 255], cool: [170, 110, 255] },
  ];

  const HULL = Object.fromEntries(HULLS.map(h => [h.id, h]));
  const FLAME = Object.fromEntries(FLAMES.map(f => [f.id, f]));
  const DEFAULT = { hull: HULLS[0].id, flame: FLAMES[0].id };
  const ALL = HULLS.concat(FLAMES);
  const byId = (id) => HULL[id] || FLAME[id] || null;

  // ------------------------------------------------------------- unlocks
  const worldOf = (L) => (L.world != null ? L.world : 1);
  // How far a pilot is towards an item: missions cleared (or three-starred)
  // out of the world's missions. `stars` is { levelId: best stars }.
  function progressOf(item, stars, levels) {
    if (item.world == null) return { have: 0, of: 0, done: true };
    const ls = levels.filter(l => !l.test && worldOf(l) === item.world);
    const min = item.need === 'three' ? 3 : 1;
    const have = ls.filter(l => (stars[l.id] || 0) >= min).length;
    return { have, of: ls.length, done: ls.length > 0 && have === ls.length };
  }
  // Every item these stars have earned (defaults included).
  function earned(stars, levels) {
    return ALL.filter(it => progressOf(it, stars || {}, levels).done).map(it => it.id);
  }
  // A look made only of real items; anything unknown falls back to default.
  function cleanLook(look) {
    const l = look && typeof look === 'object' ? look : {};
    return { hull: HULL[l.hull] ? l.hull : DEFAULT.hull, flame: FLAME[l.flame] ? l.flame : DEFAULT.flame };
  }
  // The parts of a look its owner has actually earned.
  function shownLook(look, owned) {
    const l = cleanLook(look), has = (id) => byId(id).world == null || (owned || []).includes(id);
    return { hull: has(l.hull) ? l.hull : DEFAULT.hull, flame: has(l.flame) ? l.flame : DEFAULT.flame };
  }

  // ------------------------------------------------------------- drawing
  // The rocket points along +x with its middle at the origin, matching the
  // app icon. L is the half-length (9 in flight).
  function hullPath(g, L, hull) {
    const needle = hull.shape === 'needle', W = needle ? 3 : 3.4, tail = -L + 1, nose = L + (needle ? 8 : 4);
    g.beginPath();
    g.moveTo(nose, 0);
    g.bezierCurveTo(nose - 3, -W * 0.85, L * 0.2, -W * 1.08, -L * 0.3, -W);
    g.lineTo(tail, -W * 0.86);
    g.lineTo(tail, W * 0.86);
    g.lineTo(-L * 0.3, W);
    g.bezierCurveTo(L * 0.2, W * 1.08, nose - 3, W * 0.85, nose, 0);
    return { W, tail, nose };
  }

  function paintPattern(g, L, hull, d) {
    const { W, tail, nose } = d, ink = hull.ink;
    g.save(); g.clip();
    if (hull.pattern === 'bands') {
      g.fillStyle = ink;
      g.fillRect(L * 0.55, -W * 1.2, 1.6, W * 2.4);
      g.fillRect(tail, -W * 1.2, 2.2, W * 2.4);
    } else if (hull.pattern === 'checker') {
      const s = W;
      for (let x = tail, i = 0; x < nose; x += s * 1.4, i++) {
        g.fillStyle = ink;
        g.fillRect(x, i % 2 ? -W * 1.2 : 0, s * 1.4, W * 1.2);
      }
    } else if (hull.pattern === 'hazard') {
      g.strokeStyle = ink; g.lineWidth = 1.3;
      for (let x = tail - W * 2; x < L * 0.2; x += 3) { g.beginPath(); g.moveTo(x, W * 1.2); g.lineTo(x + W * 2.4, -W * 1.2); g.stroke(); }
    } else if (hull.pattern === 'stars') {
      g.fillStyle = ink;
      for (const [x, y, r] of [[-L * 0.6, -W * 0.4, 0.45], [-L * 0.1, W * 0.45, 0.35], [L * 0.55, -W * 0.3, 0.3], [-L * 0.35, W * 0.1, 0.25], [L * 0.75, W * 0.35, 0.25]]) {
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    } else if (hull.pattern === 'pinstripe') {
      g.strokeStyle = ink; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(tail, 0); g.lineTo(nose, 0); g.stroke();
    }
    g.restore();
  }

  // The rocket body. `payload`: the nose is the gold fairing holding cargo
  // (the same for every skin: it tells you there's something to drop).
  function drawRocket(g, L, payload, hull) {
    hull = hull || HULLS[0];
    const needle = hull.shape === 'needle', W = needle ? 3 : 3.4, tail = -L + 1;
    // Fins (behind the hull)
    g.fillStyle = hull.fin; g.strokeStyle = hull.finLine || hull.line; g.lineWidth = 0.8;
    const fl = needle ? 5.6 : 4.2, sweep = needle ? 3.6 : 2.6;
    for (const sgn of [-1, 1]) {
      g.beginPath();
      g.moveTo(-L * 0.15, sgn * W * 0.9);
      g.lineTo(tail - sweep, sgn * (W + fl));
      g.lineTo(tail - sweep + 0.4, sgn * (W + 1.6));
      g.lineTo(tail + 1, sgn * W);
      g.closePath(); g.fill(); g.stroke();
    }
    // Hull
    // Three colours: lit top, body, shaded underside. More: evenly spaced (a sheen).
    const gr = g.createLinearGradient(0, -W, 0, W), n = hull.fill.length;
    hull.fill.forEach((c, i) => gr.addColorStop(n === 3 ? [0, 0.55, 1][i] : i / (n - 1), c));
    g.fillStyle = gr; g.strokeStyle = hull.line; g.lineWidth = 0.9;
    const d = hullPath(g, L, hull);
    g.fill();
    if (hull.pattern) paintPattern(g, L, hull, d);
    hullPath(g, L, hull); g.stroke();
    // Nozzle
    g.fillStyle = hull.nozzle;
    g.fillRect(tail - 1.6, -W * 0.62, 1.8, W * 1.24);
    if (payload) {
      g.fillStyle = '#e8c45a'; g.strokeStyle = '#8a6a1a';
      g.beginPath();
      g.moveTo(L + 4, 0); g.bezierCurveTo(L + 1, -W * 0.9, L * 0.45, -W * 1.06, L * 0.15, -W * 1.04);
      g.lineTo(L * 0.15, W * 1.04); g.bezierCurveTo(L * 0.45, W * 1.06, L + 1, W * 0.9, L + 4, 0);
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.moveTo(L * 0.15, -W); g.lineTo(L * 0.15, W); g.stroke();
      g.lineWidth = 1;
      return;
    }
    // Porthole
    g.fillStyle = '#0b1338'; g.beginPath(); g.arc(L * 0.3, 0, 2.1, 0, TAU); g.fill();
    g.fillStyle = '#2fb8d8'; g.beginPath(); g.arc(L * 0.3, 0, 1.45, 0, TAU); g.fill();
    g.fillStyle = 'rgba(220,250,255,0.9)'; g.beginPath(); g.arc(L * 0.3 + 0.5, -0.5, 0.5, 0, TAU); g.fill();
    g.lineWidth = 1;
  }

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a == null ? c[3] : a})`;
  // How hard a pulsing flame is throbbing at time t (seconds): 0..1.
  const throb = (t) => 0.5 + 0.5 * Math.sin(t * 14);

  // The main engine's flame behind the nozzle; f is its size (throttle with
  // flicker), t the time in seconds (for pulsing flames).
  function drawFlame(g, L, f, flame, t) {
    flame = flame || FLAMES[0];
    if (flame.pulse) f *= 0.8 + 0.45 * throb(t || 0);
    const x0 = -L - 0.5, len = 24 * f, o = flame.outer, c = flame.core;
    const gr = g.createLinearGradient(x0, 0, x0 - len, 0);
    gr.addColorStop(0, rgba(o[0])); gr.addColorStop(0.55, rgba(o[1])); gr.addColorStop(1, rgba(o[2]));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x0, -2.6); g.quadraticCurveTo(x0 - len * 0.35, -2.4, x0 - len, 0); g.quadraticCurveTo(x0 - len * 0.35, 2.4, x0, 2.6); g.fill();
    const cg = g.createLinearGradient(x0, 0, x0 - len * 0.6, 0);
    cg.addColorStop(0, rgba(c[0])); cg.addColorStop(1, rgba(c[1]));
    g.fillStyle = cg;
    g.beginPath(); g.moveTo(x0, -1.3); g.quadraticCurveTo(x0 - len * 0.25, -1.1, x0 - len * 0.6, 0); g.quadraticCurveTo(x0 - len * 0.25, 1.1, x0, 1.3); g.fill();
  }

  // Exhaust particle colour, k from 1 (new) to 0 (gone).
  function sparkColor(flame, k, alpha) {
    const h = flame.hot, c = flame.cool, mix = (i) => Math.floor(c[i] + (h[i] - c[i]) * k);
    return `rgba(${mix(0)},${mix(1)},${mix(2)},${alpha})`;
  }

  // A rocket picture on a small canvas (Hangar tiles, leaderboard rows):
  // the hull pointing right with its flame lit. The canvas's CSS size sets
  // the picture's size.
  function drawIcon(canvas, look, opts) {
    opts = opts || {};
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext('2d'), l = cleanLook(look), hull = HULL[l.hull], flame = FLAME[l.flame];
    const L = 9, flameOn = opts.flame !== false;
    // The picture spans from the flame's tip to the nose.
    const left = -L - (flameOn ? 22 : 4), right = L + (hull.shape === 'needle' ? 8 : 4), tall = 2 * (3.4 + 4.6);
    const s = Math.min(w / (right - left), h / tall) * 0.95;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.translate(w / 2 - (left + right) / 2 * s, h / 2); g.scale(s, s);
    if (flameOn) drawFlame(g, L, opts.f != null ? opts.f : 0.9, flame, opts.t);
    drawRocket(g, L, false, hull);
  }

  const Skins = { HULLS, FLAMES, HULL, FLAME, ALL, DEFAULT, byId, progressOf, earned, cleanLook, shownLook, drawRocket, drawFlame, sparkColor, drawIcon };
  if (typeof module !== 'undefined' && module.exports) module.exports = Skins;
  else root.Skins = Skins;
})(typeof window !== 'undefined' ? window : globalThis);
