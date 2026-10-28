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
    { id: 'classic', name: 'Classic', desc: 'The white rocket every pilot starts with.', cap: '#e8c45a', capLine: '#8a6a1a', fill: ['#ffffff', '#eef2fa', '#b9c4dc'], line: '#7f8aa8', fin: '#d9e0ee', nozzle: '#3a4a72' },
    { id: 'cadet', name: 'Cadet', desc: 'Flight-school white with safety-orange bands and fins.', shop: true, fill: ['#ffffff', '#eef2fa', '#b9c4dc'], line: '#7f8aa8', fin: '#ff8a3d', finLine: '#a8501a', nozzle: '#3a4a72', pattern: 'bands', ink: '#ff8a3d' },
    { id: 'checker', name: 'Checkerboard', desc: 'Black and white checks, like 1940s test rockets painted so the cameras could see them roll.', world: 1, need: 'clear', fill: ['#ffffff', '#f2f4f8', '#c9cfdc'], line: '#3a3f4c', fin: '#262a33', finLine: '#0e1015', nozzle: '#262a33', pattern: 'checker', ink: '#262a33' },
    { id: 'nebula', name: 'Nebula', desc: 'Deep violet, dusted with stars.', world: 2, need: 'clear', fill: ['#f0c8ff', '#a45cf0', '#4b1f8f'], line: '#2e1260', fin: '#f78cff', finLine: '#7a2a90', nozzle: '#241046', pattern: 'stars', ink: '#ffffff' },
    { id: 'hazard', name: 'Hazard', desc: 'Caution yellow with black stripes, built for the no-fly zones.', world: 3, need: 'clear', fill: ['#ffe97a', '#ffcc33', '#c89400'], line: '#5a4300', fin: '#1e1e22', finLine: '#000000', nozzle: '#1e1e22', pattern: 'hazard', ink: '#1e1e22' },
    { id: 'saturnv', name: 'Saturn V', desc: 'The Moon rocket: three white stages with black roll markings, the Apollo spacecraft and its red escape tower. In multi-stage missions it drops its stages one by one.', stars: 250, custom: 'saturn', line: '#4a4f5c', fin: '#1c1e24', cap: '#e8c45a', capLine: '#8a6a1a' },
    { id: 'chrome', name: 'Chrome Needle', desc: 'A longer nose, bigger swept fins and a mirror finish.', world: 4, need: 'clear', shape: 'needle', fill: ['#ffffff', '#9aa6bd', '#eef2fa', '#5d6a85'], line: '#4a5570', fin: '#c8a8ff', finLine: '#5b3f99', nozzle: '#2a3150', pattern: 'pinstripe', ink: '#8cf0ff' },
    // Shop
    { id: 'retro', name: 'Retro Red', desc: 'Red and cream, straight off a 1950s pulp magazine cover.', shop: true, fill: ['#ffffff', '#f4f1ea', '#cfc8b8'], line: '#7a2020', fin: '#d62828', finLine: '#7a1010', nozzle: '#3a3a3a', pattern: 'bands', ink: '#d62828' },
    { id: 'stealth', name: 'Stealth', desc: 'Matte black with a red visor and a red pinstripe.', shop: true, fill: ['#4a4f5c', '#2a2e38', '#14161c'], line: '#0a0b0f', fin: '#22252e', finLine: '#000000', nozzle: '#0a0b0f', window: '#ff4040', pattern: 'pinstripe', ink: '#ff4040' },
    { id: 'gold', name: 'Solid Gold', gold: true, shop: true, desc: 'Polished gold from nose to nozzle. It flies exactly the same; everyone will know you paid for it.', fill: ['#fff6c8', '#ffd34d', '#fff0a0', '#b8860b'], line: '#6e4e00', fin: '#e6b422', finLine: '#6e4e00', nozzle: '#5a4000', window: '#fff3b0', pattern: 'pinstripe', ink: '#fffbe6' },
    { id: 'shuttle', name: 'Space Shuttle', desc: 'The orbiter riding its orange fuel tank between two white boosters. Stage it and the tank and boosters fall away; the payload rides in the bay.', shop: true, custom: 'shuttle', line: '#5a5f6a', fin: '#2a2d36', cap: '#e8c45a', capLine: '#8a6a1a' },
    { id: 'tiger', name: 'Tiger', desc: 'Burnt orange with black tiger stripes.', shop: true, fill: ['#ffc070', '#ff8c1a', '#b85a00'], line: '#4a2400', fin: '#1a1410', finLine: '#000000', nozzle: '#1a1410', pattern: 'tiger', ink: '#1a1410' },
  ];

  // Flames: outer plume, pale core, and the exhaust particles' colour from
  // `hot` (just out of the nozzle) to `cool` (fading). `pulse` throbs.
  const FLAMES = [
    { id: 'standard', name: 'Standard', desc: 'Orange and gold: the classic burn.', outer: [[255, 200, 70, 0.95], [255, 122, 26, 0.85], [255, 90, 20, 0]], core: [[255, 248, 200, 0.95], [255, 230, 140, 0]], hot: [255, 250, 60], cool: [255, 150, 0] },
    { id: 'blue', name: 'Cold Blue', desc: 'A clean blue burn, like a methane engine.', shop: true, outer: [[140, 210, 255, 0.95], [50, 120, 255, 0.85], [30, 60, 255, 0]], core: [[235, 250, 255, 0.95], [170, 220, 255, 0]], hot: [210, 240, 255], cool: [60, 120, 255] },
    { id: 'crimson', name: 'Strontium Red', desc: 'Deep red, the colour strontium burns in a flame test.', world: 1, need: 'three', outer: [[255, 110, 110, 0.95], [220, 20, 50, 0.85], [160, 0, 40, 0]], core: [[255, 225, 225, 0.95], [255, 140, 150, 0]], hot: [255, 200, 200], cool: [210, 20, 50] },
    { id: 'plasma', name: 'Plasma', desc: 'A hot magenta plume.', world: 2, need: 'three', outer: [[255, 150, 255, 0.95], [190, 60, 255, 0.85], [110, 30, 255, 0]], core: [[255, 240, 255, 0.95], [255, 170, 255, 0]], hot: [255, 220, 255], cool: [170, 60, 255] },
    { id: 'boron', name: 'Boron Green', desc: 'Bright green, the colour boron burns in a flame test.', world: 3, need: 'three', outer: [[190, 255, 120, 0.95], [60, 220, 80, 0.85], [20, 160, 60, 0]], core: [[240, 255, 225, 0.95], [190, 255, 160, 0]], hot: [230, 255, 190], cool: [40, 200, 70] },
    { id: 'pulsar', name: 'Pulsar', desc: 'White-hot and pulsing, like the star it\'s named for.', world: 4, need: 'three', pulse: true, outer: [[140, 245, 255, 0.95], [120, 120, 255, 0.85], [200, 120, 255, 0]], core: [[255, 255, 255, 1], [190, 250, 255, 0]], hot: [235, 255, 255], cool: [170, 110, 255] },
    // Shop
    { id: 'sunset', name: 'Sunset', desc: 'Peach at the nozzle, fading through pink to violet.', shop: true, outer: [[255, 170, 120, 0.95], [255, 80, 140, 0.85], [160, 60, 220, 0]], core: [[255, 240, 210, 0.95], [255, 190, 150, 0]], hot: [255, 220, 160], cool: [230, 60, 150] },
    { id: 'goldflame', name: 'Gold Rush', gold: true, shop: true, desc: 'A molten-gold plume with a white-hot core.', outer: [[255, 236, 140, 0.98], [240, 180, 30, 0.9], [200, 130, 0, 0]], core: [[255, 255, 235, 1], [255, 230, 150, 0]], hot: [255, 250, 200], cool: [235, 170, 20] },
    { id: 'ghost', name: 'Ghost', desc: 'Pale and see-through, as if it\'s barely there.', shop: true, outer: [[235, 240, 255, 0.7], [190, 200, 255, 0.45], [160, 170, 255, 0]], core: [[255, 255, 255, 0.95], [230, 235, 255, 0]], hot: [250, 250, 255], cool: [170, 180, 240] },
  ];

  // Trails: the line behind the ship showing where it has been. `fade`
  // dims the older end; `rainbow` cycles colour along it; `glow` adds a
  // soft wide stroke under it.
  const TRAILS = [
    { id: 'faint', name: 'Standard', desc: 'A faint amber line.', color: [255, 190, 110], alpha: 0.35, width: 1.5 },
    { id: 'comet', name: 'Comet', desc: 'A bright cyan tail that glows, then fades behind you.', stars: 100, color: [120, 230, 255], alpha: 0.85, width: 2, fade: true, glow: true },
    { id: 'aurora', name: 'Aurora', desc: 'Shifts through every colour along your path.', stars: 300, color: [140, 255, 200], alpha: 0.8, width: 2.2, fade: true, glow: true, rainbow: true },
    { id: 'goldtrail', name: 'Gold Leaf', gold: true, shop: true, desc: 'A glowing gold line, so everyone can see where you have been.', color: [255, 205, 70], alpha: 0.95, width: 2.2, fade: true, glow: true },
    { id: 'neon', name: 'Neon', desc: 'A hot pink line with a neon glow.', shop: true, color: [255, 80, 200], alpha: 0.9, width: 1.8, glow: true },
  ];

  // Side-thruster puffs: `kind` 'puff' (small squares), 'spark' (longer,
  // streaky) or 'ring' (little circles).
  const RCSES = [
    { id: 'puff', name: 'Standard', desc: 'Small white puffs.', color: [220, 235, 255], kind: 'puff', life: 0.18, size: 1.6 },
    { id: 'sparks', name: 'Ember Sparks', desc: 'Orange sparks that hang in the air a little longer.', stars: 200, color: [255, 150, 60], kind: 'spark', life: 0.35, size: 1.8 },
    // Shop
    { id: 'rings', name: 'Halo Rings', desc: 'Little cyan rings that spread out as they fade.', shop: true, color: [140, 240, 255], kind: 'ring', life: 0.3, size: 2.2 },
    { id: 'golddust', name: 'Gold Dust', gold: true, shop: true, desc: 'Every turn scatters gold dust.', color: [255, 215, 80], kind: 'spark', life: 0.45, size: 2 },
    { id: 'neondust', name: 'Neon Dust', desc: 'Pink sparks to match the Neon trail.', shop: true, color: [255, 90, 210], kind: 'spark', life: 0.4, size: 1.6 },
  ];

  // Satellites (the craft you fly once a rocket has delivered one). `shape`:
  // 'box' (body with two solar panels), 'sphere' (a ball trailing four long
  // antennas) or 'tube' (a telescope tube with panels).
  const SATS = [
    { id: 'foil', name: 'Gold Foil', desc: 'A foil-wrapped box with two blue solar panels.', shape: 'box', body: '#e8c45a', bodyLine: '#8a6a1a', panel: '#4f7fd8', panelLine: '#9fc0ff' },
    { id: 'sputnik', name: 'Sputnik', desc: 'A polished ball trailing four long antennas, like the very first satellite in 1957.', stars: 150, shape: 'sphere', body: '#e6e9ef', bodyLine: '#7b8496', panel: '#c9ced8', panelLine: '#c9ced8' },
    // Shop
    { id: 'silver', name: 'Silver Foil', desc: 'Silver insulation and dark, high-efficiency panels.', shop: true, shape: 'box', body: '#d5dbe6', bodyLine: '#6f7a90', panel: '#243052', panelLine: '#7d8fb8' },
    // Shop
    { id: 'hubble', name: 'Hubble', desc: 'The space telescope: a silver tube with its aperture door open and two solar wings.', shop: true, shape: 'tube', body: '#d9dee8', bodyLine: '#6a7488', panel: '#3a5fb0', panelLine: '#9fc0ff' },
    { id: 'iss', name: 'ISS', desc: 'The International Space Station: a long truss, white modules and eight golden solar wings.', shop: true, shape: 'iss', body: '#eef1f6', bodyLine: '#7b8496', panel: '#c8862a', panelLine: '#f0c070' },
    { id: 'jwst', name: 'James Webb', desc: 'A gold honeycomb mirror riding on a tennis-court-sized sunshield.', shop: true, shape: 'jwst', body: '#e8b830', bodyLine: '#8a6a10', panel: '#c9b8e8', panelLine: '#8a78b8' },
    { id: 'voyager', name: 'Voyager', desc: 'A big white dish and long booms, built for the outer planets and still going.', shop: true, shape: 'voyager', body: '#f2f2ee', bodyLine: '#6a6e78', panel: '#8a8f9a', panelLine: '#c9ced8' },
    { id: 'goldsat', name: 'Gold Standard', desc: 'Gold body, gold panels, gold everything.', gold: true, shop: true, shape: 'box', body: '#ffd34d', bodyLine: '#7a5600', panel: '#e6b422', panelLine: '#fff0a0' },
  ];

  // Slots in a look, and the items each takes: standard issue first, then
  // the ones earned by flying (worlds, then stars), then the Shop's, then gold.
  const rank = (it) => (it.gold ? 3 : it.shop ? 2 : it.stars != null ? 1.5 : it.world != null ? 1 : 0);
  for (const list of [HULLS, FLAMES, TRAILS, RCSES, SATS]) list.sort((a, b) => rank(a) - rank(b)); // stable: keeps the order within each group
  const SLOTS = { hull: HULLS, flame: FLAMES, trail: TRAILS, rcs: RCSES, sat: SATS };
  const TABLE = Object.fromEntries(Object.entries(SLOTS).map(([k, list]) => [k, Object.fromEntries(list.map(it => [it.id, it]))]));
  const HULL = TABLE.hull, FLAME = TABLE.flame, TRAIL = TABLE.trail, RCS = TABLE.rcs, SAT = TABLE.sat;
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
  // The Hangar Pack is every Shop skin except gold; gold is only sold on its own.
  const SHOP_SKINS = ALL.filter(it => it.shop && !it.gold).map(it => it.id);
  const GOLD_SKINS = ALL.filter(it => it.gold).map(it => it.id);
  const PRODUCTS = [
    { id: P + 'hull.cadet', name: 'Cadet hull', skins: ['cadet'], price: '$0.99' },
    { id: P + 'hull.retro', name: 'Retro Red hull', skins: ['retro'], price: '$0.99' },
    { id: P + 'hull.stealth', name: 'Stealth hull', skins: ['stealth'], price: '$0.99' },
    { id: P + 'hull.tiger', name: 'Tiger hull', skins: ['tiger'], price: '$0.99' },
    { id: P + 'hull.shuttle', name: 'Space Shuttle hull', skins: ['shuttle'], price: '$1.99' },
    { id: P + 'flame.blue', name: 'Cold Blue flame', skins: ['blue'], price: '$0.99' },
    { id: P + 'flame.sunset', name: 'Sunset flame', skins: ['sunset'], price: '$0.99' },
    { id: P + 'flame.ghost', name: 'Ghost flame', skins: ['ghost'], price: '$0.99' },
    { id: P + 'trail.neon', name: 'Neon trail', skins: ['neon'], price: '$0.99' },
    { id: P + 'rcs.rings', name: 'Halo Rings thrusters', skins: ['rings'], price: '$0.99' },
    { id: P + 'rcs.neondust', name: 'Neon Dust thrusters', skins: ['neondust'], price: '$0.99' },
    { id: P + 'sat.silver', name: 'Silver Foil satellite', skins: ['silver'], price: '$0.99' },
    { id: P + 'sat.hubble', name: 'Hubble satellite', skins: ['hubble'], price: '$0.99' },
    { id: P + 'sat.iss', name: 'ISS satellite', skins: ['iss'], price: '$1.99' },
    { id: P + 'sat.jwst', name: 'James Webb satellite', skins: ['jwst'], price: '$1.99' },
    { id: P + 'sat.voyager', name: 'Voyager satellite', skins: ['voyager'], price: '$0.99' },
    { id: P + 'pack.hangar', name: 'Hangar Pack', desc: 'Every skin in the Shop except gold', skins: SHOP_SKINS, price: '$14.99', bundle: true },
    { id: P + 'gold.hull', name: 'Solid Gold hull', skins: ['gold'], price: '$4.99', gold: true },
    { id: P + 'gold.flame', name: 'Gold Rush flame', skins: ['goldflame'], price: '$2.99', gold: true },
    { id: P + 'gold.trail', name: 'Gold Leaf trail', skins: ['goldtrail'], price: '$2.99', gold: true },
    { id: P + 'gold.rcs', name: 'Gold Dust thrusters', skins: ['golddust'], price: '$2.99', gold: true },
    { id: P + 'gold.sat', name: 'Gold Standard satellite', skins: ['goldsat'], price: '$2.99', gold: true },
    { id: P + 'pack.gold', name: 'Gold Set', desc: 'The gold hull, flame, trail, thrusters and satellite together. Not part of the Hangar Pack.', skins: GOLD_SKINS, price: '$11.99', gold: true, bundle: true },
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

  // ------------------------------------------------- real-rocket shapes
  // A cylinder along x from x0 to x1 at height y, radius r, shaded top to
  // bottom, with a pointed nose `nose` long (0: flat).
  function cylinder(g, x0, x1, y, r, colors, line, nose) {
    const gr = g.createLinearGradient(0, y - r, 0, y + r);
    gr.addColorStop(0, colors[0]); gr.addColorStop(0.5, colors[1]); gr.addColorStop(1, colors[2]);
    g.fillStyle = gr; g.strokeStyle = line; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x0, y - r); g.lineTo(x1, y - r);
    if (nose) g.quadraticCurveTo(x1 + nose * 0.7, y - r * 0.8, x1 + nose, y); else g.lineTo(x1, y + r);
    if (nose) g.quadraticCurveTo(x1 + nose * 0.7, y + r * 0.8, x1, y + r);
    g.lineTo(x0, y + r); g.closePath(); g.fill(); g.stroke();
  }
  // A taper from radius r0 at x0 to r1 at x1.
  function frustum(g, x0, r0, x1, r1, fill, line) {
    g.fillStyle = fill; g.strokeStyle = line; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x0, -r0); g.lineTo(x1, -r1); g.lineTo(x1, r1); g.lineTo(x0, r0); g.closePath(); g.fill(); g.stroke();
  }
  const WHITE = ['#ffffff', '#eef1f6', '#b9c0ce'];
  // Rockets drawn as a stack of pieces, bottom first. When a mission drops
  // stages, the rocket sheds pieces to match (see view()), and each dropped
  // stage is drawn as the pieces it took away. Each piece: its extent along
  // x (x0, x1), where its engines fire from (tail, engines: y offsets), and
  // draw(g, t, payload, hull, bottom): t is the stack's tail x; `bottom`
  // is true when nothing is below it (so its nozzles show).
  const CUSTOM = {
    // Saturn V: S-IC, S-II, then S-IVB with the Apollo spacecraft and escape
    // tower. With a payload aboard, the adapter under the spacecraft is gold.
    saturn: {
      scale: 1.2,
      pieces: [
        { x0: -1.6, x1: 7, tail: 0, engines: [-1.6, 0, 1.6], draw(g, t, payload, hull) {
          const ink = '#16181d';
          g.fillStyle = ink;
          for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(t + 2.5, sgn * 2.6); g.lineTo(t - 0.4, sgn * 4.4); g.lineTo(t, sgn * 2.6); g.closePath(); g.fill(); }
          g.fillStyle = '#2a2d36'; for (const y of [-1.6, 0, 1.6]) g.fillRect(t - 1.4, y - 0.5, 1.4, 1);
          cylinder(g, t, t + 7, 0, 2.6, WHITE, hull.line, 0);
          g.fillStyle = ink; g.fillRect(t + 0.3, -2.6, 2.2, 2.6); g.fillRect(t + 2.5, 0, 2.2, 2.6); g.fillRect(t + 6.3, -2.6, 0.7, 5.2);
        } },
        { x0: 5.6, x1: 15, tail: 7, engines: [-1.2, 0, 1.2], draw(g, t, payload, hull, bottom) {
          if (bottom) { g.fillStyle = '#2a2d36'; for (const y of [-1.2, 0, 1.2]) g.fillRect(t + 5.8, y - 0.4, 1.2, 0.8); }
          cylinder(g, t + 7, t + 13.6, 0, 2.6, WHITE, hull.line, 0);
          frustum(g, t + 13.6, 2.6, t + 15, 2, '#f1f3f7', hull.line);
        } },
        { x0: 14, x1: 26.8, tail: 15, engines: [0], draw(g, t, payload, hull, bottom) {
          const ink = '#16181d';
          if (bottom) { g.fillStyle = '#2a2d36'; g.fillRect(t + 14, -0.6, 1, 1.2); }
          cylinder(g, t + 15, t + 18.4, 0, 2, WHITE, hull.line, 0);
          g.fillStyle = ink; g.fillRect(t + 16.6, -2, 1.8, 2);
          frustum(g, t + 18.4, 2, t + 20.4, 1.6, payload ? hull.cap : '#d5dae4', payload ? hull.capLine : hull.line);
          frustum(g, t + 20.4, 1.6, t + 22.8, 0.35, '#c9ced8', hull.line);
          g.strokeStyle = ink; g.lineWidth = 0.7; g.beginPath(); g.moveTo(t + 22.6, 0); g.lineTo(t + 25.4, 0); g.stroke();
          g.fillStyle = '#c0392b'; g.fillRect(t + 24.6, -0.75, 2.2, 1.5);
        } },
      ],
    },
    // Space Shuttle, seen from above: the two boosters, the orange tank,
    // then the orbiter riding on top. The payload rides in the bay (gold
    // when loaded).
    shuttle: {
      scale: 1.3,
      pieces: [
        { x0: -1.4, x1: 16, tail: -0.2, engines: [-3.8, 3.8], draw(g, t, payload, hull) {
          g.fillStyle = '#2a2d36';
          for (const y of [-3.8, 3.8]) g.fillRect(t - 1.4, y - 0.6, 1.4, 1.2);
          for (const y of [-3.8, 3.8]) cylinder(g, t - 0.2, t + 14, y, 1.1, WHITE, hull.line, 2);
        } },
        { x0: 0.6, x1: 19.2, tail: 0.6, engines: [], draw(g, t) {
          cylinder(g, t + 0.6, t + 16, 0, 2.3, ['#f0a050', '#d9772b', '#8a4510'], '#6a3208', 3.2);
        } },
        { x0: -1.4, x1: 14.6, tail: -0.4, engines: [0], draw(g, t, payload, hull) {
          const ink = '#1b1d22';
          g.fillStyle = '#2a2d36'; for (const y of [-0.8, 0, 0.8]) g.fillRect(t - 1.4, y - 0.3, 1, 0.6);
          g.fillStyle = '#f4f5f8'; g.strokeStyle = hull.line; g.lineWidth = 0.6;
          g.beginPath();
          g.moveTo(t + 14.6, 0);
          g.quadraticCurveTo(t + 14.2, -1.5, t + 12.4, -1.6);
          g.lineTo(t + 9.4, -1.7); g.lineTo(t + 2.4, -6.2); g.lineTo(t + 0.4, -6.2); g.lineTo(t + 0.4, -1.8); g.lineTo(t - 0.4, -1.6);
          g.lineTo(t - 0.4, 1.6); g.lineTo(t + 0.4, 1.8); g.lineTo(t + 0.4, 6.2); g.lineTo(t + 2.4, 6.2); g.lineTo(t + 9.4, 1.7);
          g.lineTo(t + 12.4, 1.6); g.quadraticCurveTo(t + 14.2, 1.5, t + 14.6, 0);
          g.closePath(); g.fill(); g.stroke();
          g.strokeStyle = ink; g.lineWidth = 0.9;
          g.beginPath(); g.moveTo(t + 9.4, -1.7); g.lineTo(t + 2.4, -6.2); g.moveTo(t + 9.4, 1.7); g.lineTo(t + 2.4, 6.2); g.stroke();
          g.fillStyle = ink; g.beginPath(); g.ellipse(t + 14, 0, 0.7, 1.1, 0, 0, TAU); g.fill();
          g.fillRect(t + 12.2, -0.9, 0.6, 0.6); g.fillRect(t + 12.2, 0.3, 0.6, 0.6);
          // Payload bay doors, and the tail fin seen edge-on.
          g.fillStyle = payload ? hull.cap : '#e3e6ec'; g.strokeStyle = payload ? hull.capLine : '#9aa0ad'; g.lineWidth = 0.4;
          g.beginPath(); g.rect(t + 3.4, -1.15, 7.6, 2.3); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(t + 7.2, -1.15); g.lineTo(t + 7.2, 1.15); g.stroke();
          g.fillStyle = '#9aa0ad'; g.fillRect(t - 0.2, -0.35, 3.4, 0.7);
        } },
      ],
    },
  };
  // Which pieces show while flying stage `stage` of `rockets` rocket stages
  // (satellite stages don't count): a one-stage mission shows the whole
  // stack; otherwise the pieces are shared out so the last rocket stage is
  // the top piece alone. Returns [from, to) piece indices.
  function piecesFor(hull, stage, rockets) {
    const n = CUSTOM[hull.custom].pieces.length;
    const start = (k) => (rockets <= 1 ? 0 : Math.round(Math.min(k, rockets - 1) * (n - 1) / (rockets - 1)));
    // The last rocket stage, dropped (releasing a satellite), takes all
    // that is left of the stack with it.
    const last = stage >= rockets - 1;
    return { ship: [start(stage), n], dropped: [start(stage), last ? n : Math.max(start(stage) + 1, start(stage + 1))] };
  }
  // How to place pieces [from, to) of a stack: scaled, and shifted so the
  // pieces flying now are centred on the ship. `shownFrom` is the bottom
  // piece of the stack the ship had when these pieces were on it.
  // What is left after dropping stages is enlarged to the whole stack's
  // length, so an upper stage flies full size; `grow` (0..1) eases it there
  // just after a drop.
  const span = (ps) => [Math.min(...ps.map(p => p.x0)), Math.max(...ps.map(p => p.x1))];
  function stackXform(hull, L, shownFrom, grow) {
    const c = CUSTOM[hull.custom], t = -L + 1, [x0, x1] = span(c.pieces.slice(shownFrom)), [a0, a1] = span(c.pieces);
    const fit = (a1 - a0) / (x1 - x0), g = grow == null ? 1 : grow;
    return { k: c.scale * (1 + (fit - 1) * g), dx: -(t + (x0 + x1) / 2), t };
  }
  function drawStack(g, L, payload, hull, from, to, shownFrom, grow) {
    const c = CUSTOM[hull.custom], f = from == null ? 0 : from, e = to == null ? c.pieces.length : to;
    const x = stackXform(hull, L, shownFrom == null ? f : shownFrom, grow);
    g.save(); g.scale(x.k, x.k); g.translate(x.dx, 0);
    for (let i = f; i < e; i++) c.pieces[i].draw(g, x.t, payload && i === c.pieces.length - 1, hull, i === f);
    g.restore();
    g.lineWidth = 1;
  }
  // Where a whole stack's nose and tail end up (for fitting icons).
  function stackRight(hull, L) { const c = CUSTOM[hull.custom], x = stackXform(hull, L, 0); return (x.t + Math.max(...c.pieces.map(p => p.x1)) + x.dx) * x.k + 0.5; }
  // Engines of a stack showing from piece `from` up: { x, y } of each.
  function stackEngines(hull, L, from, grow) {
    const c = CUSTOM[hull.custom], x = stackXform(hull, L, from, grow);
    const out = [];
    for (const p of c.pieces.slice(from)) for (const y of p.engines) out.push({ x: (x.t + p.tail + x.dx) * x.k, y: y * x.k });
    return { list: out, k: x.k };
  }

  // Is a #rrggbb colour dark (so a seam on it should be light)?
  function dark(hex) {
    const n = parseInt(String(hex).slice(1, 7), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 110;
  }

  // The rocket body. `payload`: the nose is the gold fairing holding cargo
  // (the same for every skin: it tells you there's something to drop).
  // from, to, shownFrom, grow: for stacked rockets, which pieces to draw
  // (see piecesFor) and how far they've grown since the last drop; other
  // hulls ignore them.
  function drawRocket(g, L, payload, hull, from, to, shownFrom, grow) {
    hull = hull || HULLS[0];
    if (hull.custom) { drawStack(g, L, payload, hull, from, to, shownFrom, grow); return; }
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
      // The fairing over the payload, in the hull's accent colour (gold on
      // the classic rocket), with a seam so it reads as a separate cap.
      const cap = hull.cap || hull.fin, nose = d.nose;
      g.fillStyle = cap; g.strokeStyle = hull.capLine || hull.finLine || hull.line;
      g.beginPath();
      g.moveTo(nose, 0); g.bezierCurveTo(nose - 3, -W * 0.85, L * 0.45, -W * 1.06, L * 0.15, -W * 1.04);
      g.lineTo(L * 0.15, W * 1.04); g.bezierCurveTo(L * 0.45, W * 1.06, nose - 3, W * 0.85, nose, 0);
      g.fill(); g.stroke();
      g.strokeStyle = dark(cap) ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
      g.beginPath(); g.moveTo(L * 0.15, -W); g.lineTo(L * 0.15, W); g.stroke();
      g.lineWidth = 1;
      return;
    }
    // Porthole
    g.fillStyle = '#0b1338'; g.beginPath(); g.arc(L * 0.3, 0, 2.1, 0, TAU); g.fill();
    g.fillStyle = hull.window || '#2fb8d8'; g.beginPath(); g.arc(L * 0.3, 0, 1.45, 0, TAU); g.fill();
    g.fillStyle = 'rgba(220,250,255,0.9)'; g.beginPath(); g.arc(L * 0.3 + 0.5, -0.5, 0.5, 0, TAU); g.fill();
    g.lineWidth = 1;
  }

  // A satellite, facing +x (its antenna or aperture forward).
  function drawSatellite(g, sat) {
    sat = sat || SATS[0];
    const panels = (y0) => {
      g.fillStyle = sat.panel; g.strokeStyle = sat.panelLine; g.lineWidth = 0.8;
      for (const y of [y0, -y0 - 8]) {
        g.fillRect(-2.5, y, 5, 8); g.strokeRect(-2.5, y, 5, 8);
        g.lineWidth = 0.4; g.beginPath(); g.moveTo(-2.5, y + 4); g.lineTo(2.5, y + 4); g.moveTo(0, y); g.lineTo(0, y + 8); g.stroke(); g.lineWidth = 0.8;
      }
    };
    if (sat.shape === 'sphere') {
      g.strokeStyle = sat.panelLine; g.lineWidth = 0.7;
      g.beginPath();
      for (const y of [-1.6, -0.6, 0.6, 1.6]) { g.moveTo(-1, y); g.lineTo(-13, y * 4.5); }
      g.stroke();
      const gr = g.createRadialGradient(1.2, -1.4, 0.5, 0, 0, 4.4);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, sat.body); gr.addColorStop(1, sat.bodyLine);
      g.fillStyle = gr; g.strokeStyle = sat.bodyLine; g.lineWidth = 0.8;
      g.beginPath(); g.arc(0, 0, 4.2, 0, TAU); g.fill(); g.stroke();
    } else if (sat.shape === 'iss') {
      // Truss across, four pairs of golden wings, modules along the middle.
      g.strokeStyle = sat.bodyLine; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(0, -14); g.lineTo(0, 14); g.stroke();
      g.fillStyle = sat.panel; g.strokeStyle = sat.panelLine; g.lineWidth = 0.4;
      for (const y of [-14, -9.5, 5.5, 10]) for (const x of [-6.5, 1.5]) { g.fillRect(x, y, 5, 4); g.strokeRect(x, y, 5, 4); }
      g.fillStyle = sat.body; g.strokeStyle = sat.bodyLine; g.lineWidth = 0.7;
      g.beginPath(); g.rect(-7, -1.4, 14, 2.8); g.fill(); g.stroke();
      g.beginPath(); g.rect(-2, -3.6, 3, 7.2); g.fill(); g.stroke();
    } else if (sat.shape === 'jwst') {
      // Layered sunshield (a long diamond) under a gold hexagonal mirror.
      g.fillStyle = sat.panel; g.strokeStyle = sat.panelLine; g.lineWidth = 0.6;
      for (const k of [1, 0.8, 0.6]) {
        g.beginPath(); g.moveTo(-8 * k, 0); g.lineTo(0, -12 * k); g.lineTo(8 * k, 0); g.lineTo(0, 12 * k); g.closePath(); g.fill(); g.stroke();
      }
      g.fillStyle = sat.body; g.strokeStyle = sat.bodyLine; g.lineWidth = 0.5;
      const hex = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); g.fill(); g.stroke(); };
      hex(1, 0, 1.5);
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; hex(1 + 2.6 * Math.cos(a), 2.6 * Math.sin(a), 1.5); }
      g.strokeStyle = sat.bodyLine; g.lineWidth = 0.4; g.beginPath(); g.moveTo(1, 0); g.lineTo(5.5, 0); g.stroke();
    } else if (sat.shape === 'voyager') {
      // Booms first, then the bus and the big dish facing forward.
      g.strokeStyle = sat.panelLine; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-6, 11); g.moveTo(0, 0); g.lineTo(-4, -13); g.stroke();
      g.fillStyle = sat.panel; g.beginPath(); g.arc(-6, 11, 1.4, 0, TAU); g.fill();
      g.fillRect(-3, -2.4, 4, 4.8);
      const gr = g.createRadialGradient(3.5, 0, 0.5, 3.5, 0, 6);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, sat.body);
      g.fillStyle = gr; g.strokeStyle = sat.bodyLine; g.lineWidth = 0.7;
      g.beginPath(); g.ellipse(2.5, 0, 2, 6, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(2.5, 0); g.lineTo(6, 0); g.stroke();
    } else if (sat.shape === 'tube') {
      panels(4.2);
      const gr = g.createLinearGradient(0, -3.6, 0, 3.6);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, sat.body); gr.addColorStop(1, sat.bodyLine);
      g.fillStyle = gr; g.strokeStyle = sat.bodyLine; g.lineWidth = 0.9;
      g.beginPath(); g.rect(-6, -3.4, 11, 6.8); g.fill(); g.stroke();
      g.fillStyle = '#10131c'; g.fillRect(4.6, -2.8, 1.4, 5.6);
      g.strokeStyle = sat.bodyLine; g.beginPath(); g.moveTo(5, -3.4); g.lineTo(8, -5.6); g.stroke();
    } else {
      panels(5);
      g.fillStyle = sat.body; g.strokeStyle = sat.bodyLine; g.lineWidth = 1;
      g.beginPath(); g.rect(-4, -4.5, 8, 9); g.fill(); g.stroke();
      g.fillStyle = '#c9ced8'; g.beginPath(); g.moveTo(-4, -2); g.lineTo(-6.5, -3); g.lineTo(-6.5, 3); g.lineTo(-4, 2); g.fill();
      g.strokeStyle = '#e9edf7'; g.beginPath(); g.moveTo(4, 0); g.lineTo(7, 0); g.stroke();
    }
    g.lineWidth = 1;
  }

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a == null ? c[3] : a})`;
  // How hard a pulsing flame is throbbing at time t (seconds): 0..1.
  const throb = (t) => 0.5 + 0.5 * Math.sin(t * 14);

  // The main engine's flame behind the nozzle; f is its size (throttle with
  // flicker), t the time in seconds (for pulsing flames).
  function drawFlame(g, L, f, flame, t, hull, from, grow) {
    flame = flame || FLAMES[0];
    // Stacked rockets fire from each engine of the pieces still attached,
    // with a slimmer flame from each.
    if (hull && hull.custom) {
      const e = stackEngines(hull, L, from || 0, grow), x0 = -L - 0.5;
      for (const { x, y } of e.list) { g.save(); g.translate(x - x0 + 0.5 * e.k, y); g.scale(1, 0.55 * e.k); drawFlame(g, L, f * 0.85, flame, t); g.restore(); }
      return;
    }
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
    if (show === 'sat') {
      // Just the satellite, upright so its panels spread sideways.
      const s = Math.min(w / 32, h / 18) * 0.95;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.translate(w / 2, h / 2); g.scale(s, s); g.rotate(-Math.PI / 2 + Math.sin((opts.t || 0) * 0.8) * 0.15);
      drawSatellite(g, SAT[l.sat]);
      return;
    }
    // The picture spans from the flame's tip to the nose.
    const left = -L - (flameOn ? 22 : 4), right = hull.custom ? stackRight(hull, L) : L + (hull.shape === 'needle' ? 8 : 4), tall = 2 * (3.4 + 4.6);
    const s = Math.min(w / (right - left), h / tall) * 0.95;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.translate(w / 2 - (left + right) / 2 * s, h / 2); g.scale(s, s);
    if (flameOn) drawFlame(g, L, opts.f != null ? opts.f : 0.9, flame, opts.t, hull);
    if (show === 'trail') {
      // A gently curving path up to the tail.
      const pts = [];
      const ph = (opts.t || 0) * 3;
      for (let i = 0; i <= 40; i++) { const x = -L - 22 + i * 0.5; pts.push([x, Math.sin((x + L) * 0.25 + ph) * 1.6 * (1 - i / 40)]); }
      g.save(); g.scale(1 / s, 1 / s);
      drawTrail(g, pts.map(([x, y]) => [x * s, y * s]), TRAIL[l.trail], opts.t);
      g.restore();
    }
    drawRocket(g, L, false, hull);
    if (show === 'rcs') {
      const r = RCS[l.rcs];
      g.save(); g.scale(1 / s, 1 / s);
      // Nose and tail firing opposite ways, as when turning: puffs stream
      // out and fade (moving when the picture is animated).
      const ph = ((opts.t || 0) * 2) % 1;
      for (const sgn of [1, -1]) {
        for (let i = 0; i < 3; i++) {
          const u = (i + ph) / 3, d = 3.6 + u * 4.2;
          drawRcsParticle(g, sgn * (5 + d * 0.4) * s, -sgn * d * s, 1 - u * 0.8, Object.assign({}, r, { size: r.size * s * 0.7 }));
        }
      }
      g.restore();
    }
  }

  const Skins = {
    HULLS, FLAMES, TRAILS, RCSES, SATS, SLOTS, HULL, FLAME, TRAIL, RCS, SAT, ALL, DEFAULT, PRODUCTS, PRODUCT,
    byId, slotOf, standard, entitlements, progressOf, earned, cleanLook, shownLook,
    drawRocket, drawFlame, drawTrail, drawSatellite, piecesFor, drawRcsParticle, sparkColor, drawIcon,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Skins;
  else root.Skins = Skins;
})(typeof window !== 'undefined' ? window : globalThis);
