// Rocket skins: hull, engine flame, trail and side-thruster (RCS) puffs.
// Most are earned: clearing every mission in a world earns its hull, three
// stars on every mission earns its flame, and total-star milestones earn
// trails and thruster puffs. A few are sold in the Shop (see PRODUCTS).
// Shared by the game (drawing, the Hangar, the Shop) and the server, which
// grants skins from verified runs and verified purchases, so the
// leaderboards only show real ones. Skins are looks only: nothing here
// touches the physics.
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;

  // How an item is earned: { world, need: 'clear' | 'three' } finishes a
  // world; { stars: n } is n stars in total; { shop: true } is bought.
  // No rule: standard issue.

  // Hulls. `fill` is the hull's top-to-bottom gradient; `pattern` is painted
  // over it, clipped to the hull. `shape: 'needle'` is a longer nose and
  // bigger fins.
  const HULLS = [
    { id: 'classic', name: 'Classic', fill: ['#ffffff', '#eef2fa', '#b9c4dc'], line: '#7f8aa8', fin: '#d9e0ee', nozzle: '#3a4a72' },
    { id: 'cadet', name: 'Cadet', shop: true, fill: ['#ffffff', '#eef2fa', '#b9c4dc'], line: '#7f8aa8', fin: '#ff8a3d', finLine: '#a8501a', nozzle: '#3a4a72', pattern: 'bands', ink: '#ff8a3d' },
    { id: 'checker', name: 'Checkerboard', world: 1, need: 'clear', fill: ['#ffffff', '#f2f4f8', '#c9cfdc'], line: '#3a3f4c', fin: '#262a33', finLine: '#0e1015', nozzle: '#262a33', pattern: 'checker', ink: '#262a33' },
    { id: 'nebula', name: 'Nebula', world: 2, need: 'clear', fill: ['#f0c8ff', '#a45cf0', '#4b1f8f'], line: '#2e1260', fin: '#f78cff', finLine: '#7a2a90', nozzle: '#241046', pattern: 'stars', ink: '#ffffff' },
    { id: 'hazard', name: 'Hazard', world: 3, need: 'clear', fill: ['#ffe97a', '#ffcc33', '#c89400'], line: '#5a4300', fin: '#1e1e22', finLine: '#000000', nozzle: '#1e1e22', pattern: 'hazard', ink: '#1e1e22' },
    { id: 'chrome', name: 'Chrome Needle', world: 4, need: 'clear', shape: 'needle', fill: ['#ffffff', '#9aa6bd', '#eef2fa', '#5d6a85'], line: '#4a5570', fin: '#c8a8ff', finLine: '#5b3f99', nozzle: '#2a3150', pattern: 'pinstripe', ink: '#8cf0ff' },
    // Shop
    { id: 'retro', name: 'Retro Red', shop: true, fill: ['#ffffff', '#f4f1ea', '#cfc8b8'], line: '#7a2020', fin: '#d62828', finLine: '#7a1010', nozzle: '#3a3a3a', pattern: 'bands', ink: '#d62828' },
    { id: 'stealth', name: 'Stealth', shop: true, fill: ['#4a4f5c', '#2a2e38', '#14161c'], line: '#0a0b0f', fin: '#22252e', finLine: '#000000', nozzle: '#0a0b0f', window: '#ff4040', pattern: 'pinstripe', ink: '#ff4040' },
    { id: 'tiger', name: 'Tiger', shop: true, fill: ['#ffc070', '#ff8c1a', '#b85a00'], line: '#4a2400', fin: '#1a1410', finLine: '#000000', nozzle: '#1a1410', pattern: 'tiger', ink: '#1a1410' },
  ];

  // Flames: outer plume, pale core, and the exhaust particles' colour from
  // `hot` (just out of the nozzle) to `cool` (fading). `pulse` throbs.
  const FLAMES = [
    { id: 'standard', name: 'Standard', outer: [[255, 200, 70, 0.95], [255, 122, 26, 0.85], [255, 90, 20, 0]], core: [[255, 248, 200, 0.95], [255, 230, 140, 0]], hot: [255, 250, 60], cool: [255, 150, 0] },
    { id: 'blue', name: 'Cold Blue', shop: true, outer: [[140, 210, 255, 0.95], [50, 120, 255, 0.85], [30, 60, 255, 0]], core: [[235, 250, 255, 0.95], [170, 220, 255, 0]], hot: [210, 240, 255], cool: [60, 120, 255] },
    { id: 'crimson', name: 'Strontium Red', world: 1, need: 'three', outer: [[255, 110, 110, 0.95], [220, 20, 50, 0.85], [160, 0, 40, 0]], core: [[255, 225, 225, 0.95], [255, 140, 150, 0]], hot: [255, 200, 200], cool: [210, 20, 50] },
    { id: 'plasma', name: 'Plasma', world: 2, need: 'three', outer: [[255, 150, 255, 0.95], [190, 60, 255, 0.85], [110, 30, 255, 0]], core: [[255, 240, 255, 0.95], [255, 170, 255, 0]], hot: [255, 220, 255], cool: [170, 60, 255] },
    { id: 'boron', name: 'Boron Green', world: 3, need: 'three', outer: [[190, 255, 120, 0.95], [60, 220, 80, 0.85], [20, 160, 60, 0]], core: [[240, 255, 225, 0.95], [190, 255, 160, 0]], hot: [230, 255, 190], cool: [40, 200, 70] },
    { id: 'pulsar', name: 'Pulsar', world: 4, need: 'three', pulse: true, outer: [[140, 245, 255, 0.95], [120, 120, 255, 0.85], [200, 120, 255, 0]], core: [[255, 255, 255, 1], [190, 250, 255, 0]], hot: [235, 255, 255], cool: [170, 110, 255] },
    // Shop
    { id: 'sunset', name: 'Sunset', shop: true, outer: [[255, 170, 120, 0.95], [255, 80, 140, 0.85], [160, 60, 220, 0]], core: [[255, 240, 210, 0.95], [255, 190, 150, 0]], hot: [255, 220, 160], cool: [230, 60, 150] },
    { id: 'ghost', name: 'Ghost', shop: true, outer: [[235, 240, 255, 0.7], [190, 200, 255, 0.45], [160, 170, 255, 0]], core: [[255, 255, 255, 0.95], [230, 235, 255, 0]], hot: [250, 250, 255], cool: [170, 180, 240] },
  ];

  // Trails: the line behind the ship showing where it has been. `fade`
  // dims the older end; `rainbow` cycles colour along it; `glow` adds a
  // soft wide stroke under it.
  const TRAILS = [
    { id: 'faint', name: 'Standard', color: [255, 190, 110], alpha: 0.35, width: 1.5 },
    { id: 'comet', name: 'Comet', stars: 100, color: [120, 230, 255], alpha: 0.85, width: 2, fade: true, glow: true },
    { id: 'aurora', name: 'Aurora', stars: 300, color: [140, 255, 200], alpha: 0.8, width: 2.2, fade: true, glow: true, rainbow: true },
    { id: 'neon', name: 'Neon', shop: true, color: [255, 80, 200], alpha: 0.9, width: 1.8, glow: true },
  ];

  // Side-thruster puffs: `kind` 'puff' (small squares), 'spark' (longer,
  // streaky) or 'ring' (little circles).
  const RCSES = [
    { id: 'puff', name: 'Standard', color: [220, 235, 255], kind: 'puff', life: 0.18, size: 1.6 },
    { id: 'sparks', name: 'Gold Sparks', stars: 200, color: [255, 210, 90], kind: 'spark', life: 0.35, size: 1.8 },
    // Shop
    { id: 'rings', name: 'Halo Rings', shop: true, color: [140, 240, 255], kind: 'ring', life: 0.3, size: 2.2 },
    { id: 'neondust', name: 'Neon Dust', shop: true, color: [255, 90, 210], kind: 'spark', life: 0.4, size: 1.6 },
  ];

  // Slots in a look, and the items each takes.
  const SLOTS = { hull: HULLS, flame: FLAMES, trail: TRAILS, rcs: RCSES };
  const TABLE = Object.fromEntries(Object.entries(SLOTS).map(([k, list]) => [k, Object.fromEntries(list.map(it => [it.id, it]))]));
  const HULL = TABLE.hull, FLAME = TABLE.flame, TRAIL = TABLE.trail, RCS = TABLE.rcs;
  const DEFAULT = Object.fromEntries(Object.entries(SLOTS).map(([k, list]) => [k, list[0].id]));
  const ALL = [].concat(...Object.values(SLOTS));
  const SLOT_OF = Object.fromEntries(Object.entries(SLOTS).flatMap(([k, list]) => list.map(it => [it.id, k])));
  const byId = (id) => (SLOT_OF[id] ? TABLE[SLOT_OF[id]][id] : null);
  const slotOf = (id) => SLOT_OF[id] || null;
  const standard = (it) => it.world == null && it.stars == null && !it.shop;

  // ------------------------------------------------------------- shop
  // Products sold in the Shop (non-consumable App Store in-app purchases;
  // the ids are the App Store Connect product ids). `skins`: skins it
  // grants. `world`: opens that world now. `worlds: 'all'`: opens every
  // world, future ones too. `price` is a fallback label; the store's own
  // localized price is shown when the store is reachable.
  const P = 'com.thrusterz.app.';
  const SHOP_SKINS = ALL.filter(it => it.shop).map(it => it.id);
  const PRODUCTS = [
    { id: P + 'hull.cadet', name: 'Cadet hull', skins: ['cadet'], price: '$0.99' },
    { id: P + 'hull.retro', name: 'Retro Red hull', skins: ['retro'], price: '$0.99' },
    { id: P + 'hull.stealth', name: 'Stealth hull', skins: ['stealth'], price: '$0.99' },
    { id: P + 'hull.tiger', name: 'Tiger hull', skins: ['tiger'], price: '$0.99' },
    { id: P + 'flame.blue', name: 'Cold Blue flame', skins: ['blue'], price: '$0.99' },
    { id: P + 'flame.sunset', name: 'Sunset flame', skins: ['sunset'], price: '$0.99' },
    { id: P + 'flame.ghost', name: 'Ghost flame', skins: ['ghost'], price: '$0.99' },
    { id: P + 'trail.neon', name: 'Neon trail', skins: ['neon'], price: '$0.99' },
    { id: P + 'rcs.rings', name: 'Halo Rings thrusters', skins: ['rings'], price: '$0.99' },
    { id: P + 'rcs.neondust', name: 'Neon Dust thrusters', skins: ['neondust'], price: '$0.99' },
    { id: P + 'pack.hangar', name: 'Hangar Pack', desc: 'Every skin in the Shop', skins: SHOP_SKINS, price: '$4.99', bundle: true },
    { id: P + 'world.2', name: 'Open World 2 now', world: 2, price: '$1.99' },
    { id: P + 'world.3', name: 'Open World 3 now', world: 3, price: '$1.99' },
    { id: P + 'world.4', name: 'Open World 4 now', world: 4, price: '$1.99' },
    { id: P + 'world.all', name: 'Open every world', desc: 'Worlds 2, 3 and 4, and every world still to come', worlds: 'all', price: '$3.99', bundle: true },
  ];
  const PRODUCT = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  // What a set of owned product ids adds up to.
  function entitlements(owns) {
    const skins = new Set(), worlds = new Set();
    let allWorlds = false;
    for (const id of owns || []) {
      const p = PRODUCT[id];
      if (!p) continue;
      for (const s of p.skins || []) skins.add(s);
      if (p.world != null) worlds.add(p.world);
      if (p.worlds === 'all') allWorlds = true;
    }
    return { skins: [...skins], worlds: [...worlds], allWorlds };
  }

  // ------------------------------------------------------------- unlocks
  const worldOf = (L) => (L.world != null ? L.world : 1);
  // How far a pilot is towards an item: missions cleared (or three-starred)
  // out of the world's missions, or stars out of the milestone. `stars` is
  // { levelId: best stars }.
  function progressOf(item, stars, levels) {
    if (item.shop) return { have: 0, of: 0, done: false };
    if (item.stars != null) {
      const have = levels.reduce((a, l) => a + (l.test ? 0 : stars[l.id] || 0), 0);
      return { have: Math.min(have, item.stars), of: item.stars, done: have >= item.stars };
    }
    if (item.world == null) return { have: 0, of: 0, done: true };
    const ls = levels.filter(l => !l.test && worldOf(l) === item.world);
    const min = item.need === 'three' ? 3 : 1;
    const have = ls.filter(l => (stars[l.id] || 0) >= min).length;
    return { have, of: ls.length, done: ls.length > 0 && have === ls.length };
  }
  // Every item these stars have earned (standard issue included).
  function earned(stars, levels) {
    return ALL.filter(it => progressOf(it, stars || {}, levels).done).map(it => it.id);
  }
  // A look made only of real items; anything unknown falls back to standard.
  function cleanLook(look) {
    const l = look && typeof look === 'object' ? look : {};
    return Object.fromEntries(Object.keys(SLOTS).map(k => [k, TABLE[k][l[k]] ? l[k] : DEFAULT[k]]));
  }
  // The parts of a look its owner has actually earned or bought.
  function shownLook(look, owned) {
    const l = cleanLook(look), has = (id) => standard(byId(id)) || (owned || []).includes(id);
    return Object.fromEntries(Object.keys(SLOTS).map(k => [k, has(l[k]) ? l[k] : DEFAULT[k]]));
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
    } else if (hull.pattern === 'tiger') {
      g.fillStyle = ink;
      for (let x = tail + 1.2, i = 0; x < L * 0.9; x += 2.4, i++) {
        const y = i % 2 ? W * 1.2 : -W * 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2.4, y * 0.05); g.lineTo(x + 1.3, y); g.closePath(); g.fill();
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
    g.fillStyle = hull.window || '#2fb8d8'; g.beginPath(); g.arc(L * 0.3, 0, 1.45, 0, TAU); g.fill();
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

  // The trail through screen points pts ([x, y] or null for a gap), oldest
  // first. Drawn in chunks so it can fade and change colour along its length.
  function drawTrail(g, pts, trail, t) {
    trail = trail || TRAILS[0];
    const n = pts.length, CH = trail.fade || trail.rainbow ? 24 : 1;
    if (n < 2) return;
    const c = trail.color;
    // Rainbow trails shift hue along their length and slowly over time.
    const colorAt = (u, a) => (trail.rainbow ? `hsla(${Math.round(u * 300 + (t || 0) * 40) % 360},90%,72%,${a})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
    for (const pass of trail.glow ? [0, 1] : [1]) {
      for (let ch = 0; ch < CH; ch++) {
        const i0 = Math.floor(ch * (n - 1) / CH), i1 = Math.floor((ch + 1) * (n - 1) / CH);
        if (i1 <= i0) continue;
        const u = (ch + 1) / CH, a = trail.alpha * (trail.fade ? 0.15 + 0.85 * u : 1);
        g.strokeStyle = colorAt(u, pass ? a : a * 0.25);
        g.lineWidth = pass ? trail.width : trail.width * 4;
        g.beginPath();
        let open = false;
        for (let i = i0; i <= i1; i++) {
          const p = pts[i];
          if (!p) { open = false; continue; }
          if (open) g.lineTo(p[0], p[1]); else { g.moveTo(p[0], p[1]); open = true; }
        }
        g.stroke();
      }
    }
    g.lineWidth = 1;
  }

  // One side-thruster particle at screen (x, y), k from 1 (new) to 0.
  function drawRcsParticle(g, x, y, k, rcs) {
    const c = rcs.color;
    g.fillStyle = g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${k * 0.9})`;
    if (rcs.kind === 'ring') { g.lineWidth = 1; g.beginPath(); g.arc(x, y, rcs.size * (1.6 - k), 0, TAU); g.stroke(); }
    else if (rcs.kind === 'spark') { const s = rcs.size * (0.6 + k); g.fillRect(x - s / 2, y - s / 2, s, s); }
    else g.fillRect(x - rcs.size / 2, y - rcs.size / 2, rcs.size, rcs.size);
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
    const L = 9, show = opts.show || 'flame', flameOn = show === 'flame' && opts.flame !== false;
    // The picture spans from the flame's tip to the nose.
    const left = -L - (flameOn ? 22 : 4), right = L + (hull.shape === 'needle' ? 8 : 4), tall = 2 * (3.4 + 4.6);
    const s = Math.min(w / (right - left), h / tall) * 0.95;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.translate(w / 2 - (left + right) / 2 * s, h / 2); g.scale(s, s);
    if (flameOn) drawFlame(g, L, opts.f != null ? opts.f : 0.9, flame, opts.t);
    if (show === 'trail') {
      // A gently curving path up to the tail.
      const pts = [];
      for (let i = 0; i <= 40; i++) { const x = -L - 22 + i * 0.5; pts.push([x, Math.sin((x + L) * 0.25) * 1.6 * (1 - i / 40)]); }
      g.save(); g.scale(1 / s, 1 / s);
      drawTrail(g, pts.map(([x, y]) => [x * s, y * s]), TRAIL[l.trail], opts.t);
      g.restore();
    }
    drawRocket(g, L, false, hull);
    if (show === 'rcs') {
      const r = RCS[l.rcs];
      g.save(); g.scale(1 / s, 1 / s);
      // Nose and tail firing opposite ways, as when turning.
      for (const sgn of [1, -1]) {
        for (const [d, k] of [[4.2, 1], [5.6, 0.75], [7, 0.5]]) drawRcsParticle(g, sgn * (5 + d * 0.4) * s, -sgn * d * s, k, Object.assign({}, r, { size: r.size * s * 0.7 }));
      }
      g.restore();
    }
  }

  const Skins = {
    HULLS, FLAMES, TRAILS, RCSES, SLOTS, HULL, FLAME, TRAIL, RCS, ALL, DEFAULT, PRODUCTS, PRODUCT,
    byId, slotOf, standard, entitlements, progressOf, earned, cleanLook, shownLook,
    drawRocket, drawFlame, drawTrail, drawRcsParticle, sparkColor, drawIcon,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Skins;
  else root.Skins = Skins;
})(typeof window !== 'undefined' ? window : globalThis);
