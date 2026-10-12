// World 4 · Chapter 4 · Deep Gravity: neutron stars and black holes (strong
// gravity, `pw`, and event horizons) combined with radiation and the toolbox.
'use strict';
const { ship, C } = require('../../js/levels.js');
const Phys = require('../../js/physics.js');

const NEUTRON = '#e4dcff';

// Distance from the ship (or an object) to a body.
const dist = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.x - m.sys.px[i], s.y - m.sys.py[i]); };
// Speed relative to a body.
const speed = (m, id, o) => { const s = o || m.ship; m.sys.update(m.t); const i = m.sys.byId[id].index; return Math.hypot(s.vx - m.sys.vx[i], s.vy - m.sys.vy[i]); };

// Energy about a strong-gravity body (its pull is gm / (r - pw)²): above
// zero you are on your way out for good.
const pwEnergy = (m, id) => { const b = m.sys.byId[id]; const r = dist(m, id), v = speed(m, id); return v * v / 2 - b.gm / (r - (b.pw || 0)); };

// Tor: a planet whose day matches a 70 k orbit, so a ship there hangs over
// one spot (geostationary).
const TOR_GM = 2000, GEO = 70, TOR_SPIN = Math.sqrt(TOR_GM / (GEO * GEO * GEO));

const levels = [
  {
    id: 'heavystar',
    name: 'Heavy Star',
    intro: 'Kern is a neutron star: no bigger than a moon, but so dense that close in it pulls far harder than any planet. Inside about 90 k no orbit is stable, and a pass that dips in there whips you round much further than half a turn. Brake a little at the top of your orbit and watch the dashed path swing round toward the gate as your low point drops. Ash crosses your orbit soon, so don\'t wait around.',
    objective: 'Whip round Kern and fly through the gate.',
    teaches: 'Neutron stars · whirling round',
    bodies: [
      { id: 'kern', name: 'Kern', gm: 40000, radius: 12, pw: 30, color: NEUTRON, kind: 'pulsar' },
      { id: 'ash', name: 'Ash', gm: 60, radius: 18, color: C.rock, orbit: { parent: 'kern', a: 480, phase: -2.35 } },
    ],
    ship: ship({ start: { orbit: { body: 'kern', r: 900, angle: Math.PI, speed: 0.69 } }, heading: 'retrograde', dv: 1.6, accel: 1 }),
    goals: [{ type: 'reach', x: 366, y: -822, r: 120, label: 'the gate' }],
    par: 1, bounds: 4000, tMax: 900, predict: 400, view: { x: 0, y: -100, span: 2200 },
  },
  {
    id: 'needledive',
    name: 'Needle Dive',
    intro: 'You are parked in a geostationary orbit over Tor\'s far side, and Spindle is a pulsar. Dive through its eye, inside 100 k, and burn at the bottom to climb out of the system, but this close in a beam hit is enormous: a sweep that catches you on the way in or out is fatal, and Wisp\'s red zone circles close in. Each lap round Tor shifts when you arrive, so leave backward from Tor\'s inner side on the lap where the dashed path stays dark and clear of the zone.',
    objective: 'Pass within 100 k of Spindle, then get 1800 k away from it, taking under 6 Sv of radiation.',
    teaches: 'Pick the lap · dive between sweeps',
    bodies: [
      { id: 'spindle', name: 'Spindle', gm: 40000, radius: 10, pw: 25, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.3, at: 300, dose: 6, beam: { width: 0.3, period: 78.7, phase: 2.31 } } },
      { id: 'wisp', name: 'Wisp', gm: 20, radius: 8, color: C.ice, keepOut: 35, orbit: { parent: 'spindle', a: 150, phase: 3.722, dir: -1 } },
      { id: 'tor', name: 'Tor', gm: TOR_GM, radius: 28, spin: TOR_SPIN, color: C.tan, orbit: { parent: 'spindle', a: 1000, phase: 0 } },
    ],
    ship: ship({ start: { orbit: { body: 'tor', r: GEO, angle: 0 } }, heading: 'prograde', dv: 7, accel: 2 }),
    goals: [
      { type: 'reach', body: 'spindle', r: 100, label: 'Needle\'s eye' },
      { type: 'escape', body: 'spindle', r: 1800 },
    ],
    par: 4.4, bounds: 6000, tMax: 1100, predict: 300, view: { x: 400, y: 0, span: 2600 }, startCam: 'overview',
  },
  {
    id: 'slingdrop',
    name: 'Slingshot Drop',
    intro: 'You are diving past the pulsar Vigil far too fast to stay, carrying a relay probe for deep space. The probe is shielded while it is aboard but takes only 1 Sv once you let it go, and at the bottom of the pass a beam crossing is far more than that. Ride through the beam with the probe aboard, release it (E) just after, while you are still at the bottom, then brake hard at once so Vigil captures you while the probe flies on.',
    objective: 'Send the probe 1500 k from Vigil, then orbit Vigil with your high point under 900 k, taking under 6 Sv yourself.',
    teaches: 'Release at the bottom, out of the beam',
    bodies: [
      { id: 'vigil', name: 'Vigil', gm: 40000, radius: 10, pw: 25, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.3, at: 300, dose: 6, beam: { width: 0.3, period: 80, phase: 5.502 } } },
    ],
    ship: ship({ start: { free: { x: -487.4, y: -461.6, vx: 9.076, vy: 2.194 } }, heading: Math.PI, dv: 1.6, accel: 3, cargo: [{ id: 'relay', name: 'Relay probe', mass: 0.2, dose: 1 }] }),
    goals: [
      { type: 'escape', body: 'vigil', craft: 'relay', r: 1100, label: 'Deep space' },
      { type: 'orbit', body: 'vigil', rMin: 30, rMax: 910 },
    ],
    par: 1, bounds: 5000, tMax: 600, predict: 300, view: { x: -200, y: -200, span: 2000 }, startCam: 'overview',
  },
  {
    id: 'retrowhirl',
    name: 'Retro Whirl',
    intro: 'Vesper Station circles Halo clockwise, the other way round from you, and flipping your orbit round would take more than your whole tank. Instead, leave Halo backward from its inner side and dive at the pulsar Lumen: a pass just inside its unstable ring whips you round so you climb back out to meet Halo, and if you pass Halo\'s far side you can brake straight into Vesper\'s direction. Lumen\'s beams sweep the dive, so leave on a lap when they point away as you fall and climb, and trim your path on the way back out.',
    objective: 'Orbit Halo clockwise, the way Vesper goes, between 40 and 135 k up, taking under 8 Sv of radiation.',
    teaches: 'Whirl round to turn round',
    bodies: [
      { id: 'lumen', name: 'Lumen', gm: 40000, radius: 10, pw: 25, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.3, at: 300, dose: 8, beam: { width: 0.3, period: 90, phase: 2.8 } } },
      { id: 'halo', name: 'Halo', gm: 1000, radius: 22, color: C.purple, orbit: { parent: 'lumen', a: 1000, phase: 0 } },
      { id: 'vesper', name: 'Vesper Station', gm: 0, radius: 3, color: C.station, kind: 'station', orbit: { parent: 'halo', a: 75, phase: 0, dir: -1 } },
    ],
    ship: ship({ start: { orbit: { body: 'halo', r: 48, angle: 0 } }, heading: 'prograde', dv: 8.5, accel: 1 }),
    goals: [{ type: 'orbit', body: 'halo', rMin: 60, rMax: 160, dir: -1 }],
    par: 6, bounds: 6000, tMax: 900, predict: 400, view: { x: 300, y: 0, span: 2600 }, startCam: 'overview',
  },
  {
    id: 'horizonfence',
    name: 'Horizon Fence',
    intro: 'You are falling past the black hole Gorge on a line its fence posts were put there to stop: hold course and you fly into a red zone. The gate lies back the way you came, so you need a tighter line that whirls you round, inside the fence, not a wider one outside it. Turn your nose toward Gorge with the side thrusters (you only have enough for one careful turn) and nudge your pass in, but the hot disc round the hole is pouring out radiation, so the deeper you go the more you take.',
    objective: 'Whirl round Gorge and fly through the gate on 1.8 s of side thrusters, taking under 4 Sv of radiation.',
    teaches: 'Thread inside the fence',
    bodies: [
      { id: 'gorge', name: 'Gorge', gm: 100000, radius: 10, horizon: 40, pw: 40, color: '#1a1020', kind: 'blackhole', radiation: { rate: 0.03, at: 300, dose: 4 } },
      { id: 'posta', name: 'Fence Post A', gm: 0, radius: 3, color: C.station, kind: 'station', keepOut: 35, x: 250 * Math.cos(2.618), y: 250 * Math.sin(2.618) },
      { id: 'postb', name: 'Fence Post B', gm: 0, radius: 3, color: C.station, kind: 'station', keepOut: 35, x: -250, y: 0 },
      { id: 'postc', name: 'Fence Post C', gm: 0, radius: 3, color: C.station, kind: 'station', keepOut: 35, x: 250 * Math.cos(-2.618), y: 250 * Math.sin(-2.618) },
    ],
    ship: ship({ start: { free: { x: 1017.4, y: -587.5, vx: -14.75, vy: 0.85 } }, heading: Math.PI, dv: 1.8, accel: 1, rcs: { fuel: 1.8 } }),
    goals: [{ type: 'reach', x: 1126, y: 419, r: 160, label: 'the gate' }],
    par: 1.2, bounds: 5000, tMax: 250, predict: 250, view: { x: 400, y: 0, span: 2200 }, startCam: 'overview',
  },
  {
    id: 'pulsarbinary',
    name: 'Binary',
    intro: 'The black hole Abyss and the pulsar Tock circle each other, and you are caught between them: Tock\'s pull is already twisting your orbit round Abyss, and every lap here adds to your dose as its beams sweep past. Your tank cannot climb out of this well alone. Burn prograde at your low point to throw your high point out to Tock\'s orbit just as Tock swings by ahead of you, and it drags you along and flings you out of the system; on the wrong lap you meet Tock head on, or not at all.',
    objective: 'Get 1500 k from Abyss, taking under 6 Sv of radiation.',
    teaches: 'Slingshot off a moving pulsar',
    bodies: [
      { id: 'abyss', name: 'Abyss', gm: 40000, radius: 8, horizon: 25, pw: 25, color: '#1a1020', kind: 'blackhole' },
      { id: 'tock', name: 'Tock', gm: 10000, radius: 8, pw: 8, color: NEUTRON, kind: 'pulsar', radiation: { rate: 0.5, at: 300, dose: 6, beam: { width: 0.3, period: 60, phase: 0 } }, orbit: { parent: 'abyss', a: 500, phase: 0 } },
    ],
    ship: ship({ start: { conic: { body: 'abyss', pe: 190, e: 0.3, nu: Math.PI, angle: 0 } }, heading: 'prograde', dv: 1.1, accel: 1 }),
    goals: [{ type: 'escape', body: 'abyss', r: 1500 }],
    par: 0.7, bounds: 6000, tMax: 800, predict: 300, view: { x: 0, y: 0, span: 1800 }, startCam: 'overview',
  },
];

const proofs = {
  heavystar: {
    // Brake at the top until the speed is p[0]: the low point drops inside
    // the unstable ring and the whirl swings the climb round to the gate.
    p: [3.7], scale: [0.03],
    script: (p, AP) => [
      { burn: 'retro', rel: 'kern', until: (m) => speed(m, 'kern') <= p[0] },
    ],
  },
};

// Closest the coasting path comes to a body within T seconds (what the
// dashed path shows a player), stopping at any impact. Cached briefly.
function closest(m, id, T) {
  const c = m._closest || (m._closest = {}), key = id + ':' + T;
  if (c[key] && m.t - c[key].t < 0.02 && m.t >= c[key].t) return c[key].d;
  const sys = m.sys, i = sys.byId[id].index, s = { x: m.ship.x, y: m.ship.y, vx: m.ship.vx, vy: m.ship.vy }, bp = [0, 0];
  let t = m.t, best = Infinity;
  while (t < m.t + T) {
    const dt = Phys.coastDt(sys, s, t, 0.01, 1);
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
    sys.posAt(i, t, bp);
    best = Math.min(best, Math.hypot(s.x - bp[0], s.y - bp[1]));
    if (Phys.collision(sys, s.x, s.y, t) >= 0) break;
  }
  sys.update(m.t);
  c[key] = { t: m.t, d: best };
  return best;
}

// High point of the current path about a strong-gravity body (from its
// energy; Infinity when unbound).
const pwAp = (m, id) => { const E = pwEnergy(m, id), b = m.sys.byId[id]; return E >= 0 ? Infinity : (b.pw || 0) - b.gm / E; };

// Radial speed away from a body (positive: climbing).
const radv = (m, id) => { m.sys.update(m.t); const i = m.sys.byId[id].index, s = m.ship; return ((s.x - m.sys.px[i]) * (s.vx - m.sys.vx[i]) + (s.y - m.sys.py[i]) * (s.vy - m.sys.vy[i])) / dist(m, id); };
// A burn of a set Δv in a direction.
const dvBurn = (dir, rel, amount) => {
  const st = { d0: 0 };
  return [
    { fn: (m) => { st.d0 = m.dvUsed(); } },
    { burn: dir, rel, until: (m) => m.dvUsed() - st.d0 >= amount },
  ];
};

proofs.needledive = {
  // Wait p[0] s (laps round Tor), leave Tor backward from its inner side
  // with p[1] of Δv, and at the bottom of the dive burn prograde until free.
  p: [219.277, 70.103, 0.559], scale: [2, 3, 0.3],
  script: (p, AP) => [
    { wait: Math.max(0, p[0]) },
    { burn: 'pro', rel: 'tor', until: (m) => m.dvUsed() > 2 && closest(m, 'spindle', 400) <= p[1] },
    { coast: (m) => dist(m, 'spindle') < 140 && radv(m, 'spindle') > 0 },
    { burn: 'pro', rel: 'spindle', until: (m) => pwEnergy(m, 'spindle') > p[2] },
  ],
};

proofs.slingdrop = {
  // Coast through the beam at the bottom with the probe aboard, release it at
  // p[0] s, then brake at once until the high point is down to p[1].
  p: [56.5, 860], scale: [0.3, 30],
  script: (p, AP) => [
    { coast: (m) => m.t >= p[0] },
    { drop: true },
    { burn: 'retro', rel: 'vigil', until: (m) => pwAp(m, 'vigil') <= p[1] },
  ],
};

// Where the coasting path next meets a body after `skip` seconds, within T:
// its closest distance and which way round it passes (1 counter-clockwise,
// -1 clockwise). Cached briefly (burns call it every tick).
function encounter(m, id, skip, T) {
  const c = m._enc || (m._enc = {}), key = id + ':' + skip + ':' + T;
  if (c[key] && m.t - c[key].t < 0.02 && m.t >= c[key].t) return c[key].e;
  const sys = m.sys, i = sys.byId[id].index, s = { x: m.ship.x, y: m.ship.y, vx: m.ship.vx, vy: m.ship.vy }, bp = [0, 0], bq = [0, 0];
  let t = m.t, best = Infinity, sense = 0;
  while (t < m.t + T) {
    const dt = Phys.coastDt(sys, s, t, 0.01, 1);
    Phys.rk4(sys, s, t, dt, 0, 0);
    t += dt;
    if (Phys.collision(sys, s.x, s.y, t) >= 0) { if (t > m.t + skip) { sys.posAt(i, t, bp); const d = Math.hypot(s.x - bp[0], s.y - bp[1]); if (d < best) { best = d; sense = 0; } } break; }
    if (t < m.t + skip) continue;
    sys.posAt(i, t, bp);
    const dx = s.x - bp[0], dy = s.y - bp[1], d = Math.hypot(dx, dy);
    if (d < best) {
      best = d;
      sys.posAt(i, t + 0.01, bq);
      const vx = s.vx - (bq[0] - bp[0]) / 0.01, vy = s.vy - (bq[1] - bp[1]) / 0.01;
      sense = dx * vy - dy * vx > 0 ? 1 : -1;
    }
  }
  sys.update(m.t);
  const e = { d: best, sense };
  c[key] = { t: m.t, e };
  return e;
}

proofs.retrowhirl = {
  // Leave Halo backward after p[0] s until the dive's low point is p[1].
  // On the climb back out, p[2] k from Lumen, steer (p[3] from prograde)
  // until the dashed path passes Halo's far side (clockwise) within p[4];
  // at that low point brake until the high point is down to p[5].
  p: [104.332, 67.437, 386.182, -0.014, 100, 133.452], scale: [1, 2, 30, 0.3, 10, 5],
  script: (p, AP) => [
    { wait: Math.max(0, p[0]) },
    { burn: 'pro', rel: 'halo', until: (m) => m.dvUsed() > 1 && (c => c <= p[1] && c > 45)(closest(m, 'lumen', 400)) },
    { coast: (m) => dist(m, 'lumen') < 150 },
    { coast: (m) => dist(m, 'lumen') > p[2] },
    { burn: p[3], rel: 'lumen', max: 3, until: (m) => { const e = encounter(m, 'halo', 0, 700); return e.sense === -1 && e.d <= p[4] && e.d >= 72; } },
    { coast: (m) => dist(m, 'halo') < 300 && radv(m, 'halo') > 0 },
    { burn: 'retro', rel: 'halo', until: (m) => { const o = AP.orb(m, 'halo'); return o.bound && o.ap <= p[5]; } },
  ],
};

proofs.horizonfence = {
  // Turn to face Gorge's side of your line (straight up the screen) and burn
  // with p[0] of Δv: the pass drops inside the fence and whirls to the gate.
  p: [1.15], scale: [0.05], opts: { turn: true, turnRate: 0.4 },
  script: (p) => [
    { burn: () => Math.PI / 2, until: (m) => m.dvUsed() >= p[0] },
  ],
};

// Radial speed sign changes: count the low points passed.
const lowPoints = (id, k) => { let n = 0, prevIn = false; return { fn: () => { n = 0; prevIn = false; }, coast: (m) => { const inn = radv(m, id) < 0; if (prevIn && !inn) n++; prevIn = inn; return n >= k; } }; };

proofs.pulsarbinary = {
  // At the first low point, burn prograde p[0] of Δv: the high point reaches
  // Tock's orbit just as Tock comes by, and the slingshot flings you out.
  p: [0.64], scale: [0.02],
  script: (p) => {
    const lp = lowPoints('abyss', 1);
    return [{ fn: lp.fn }, { coast: lp.coast }, ...dvBurn('pro', 'abyss', p[0])];
  },
};

const fails = {
  pulsarbinary: [
    { name: 'wait and see', steps: () => [] },
    { name: 'escape straight out at the low point', steps: (AP) => { const lp = lowPoints('abyss', 1); return [{ fn: lp.fn }, { coast: lp.coast }, { burn: 'pro', rel: 'abyss', until: () => false }]; } },
    { name: 'leave on the next lap', steps: (AP) => { const lp = lowPoints('abyss', 2); return [{ fn: lp.fn }, { coast: lp.coast }, ...dvBurn('pro', 'abyss', 0.64)]; } },
    { name: 'wait two laps and then go', steps: (AP) => { const lp = lowPoints('abyss', 3); return [{ fn: lp.fn }, { coast: lp.coast }, ...dvBurn('pro', 'abyss', 1.1)]; } },
  ],
  horizonfence: [
    { name: 'hold course', steps: () => [] },
    { name: 'take the wide line outside the fence', opts: { turn: true, turnRate: 0.4 }, steps: () => [{ burn: () => -Math.PI / 2, until: (m) => m.dvUsed() >= 1.1 }] },
    { name: 'dive deeper for a bigger whirl', opts: { turn: true, turnRate: 0.4 }, steps: () => [{ burn: () => Math.PI / 2, until: (m) => m.dvUsed() >= 1.6 }] },
    { name: 'flip fast (holding the keys)', opts: { turn: true, turnRate: 1.6 }, steps: (AP) => proofs.horizonfence.script(proofs.horizonfence.p, AP) },
  ],
  retrowhirl: [
    { name: 'flip the orbit round in place', steps: (AP) => [{ burn: 'retro', rel: 'halo', until: (m) => AP.orb(m, 'halo').dir === -1 && AP.orb(m, 'halo').ap >= 60 }] },
    { name: 'leave on the first lap', steps: (AP) => proofs.retrowhirl.script([34].concat(proofs.retrowhirl.p.slice(1)), AP) },
    { name: 'leave a lap later', steps: (AP) => proofs.retrowhirl.script([176].concat(proofs.retrowhirl.p.slice(1)), AP) },
  ],
  slingdrop: [
    { name: 'release the probe at once', steps: (AP) => proofs.slingdrop.script([0, 860], AP) },
    { name: 'release at the bottom, before the beam', steps: (AP) => proofs.slingdrop.script([55.2, 860], AP) },
    { name: 'brake first, then release', steps: (AP) => [{ coast: (m) => m.t >= 56.3 }, { burn: 'retro', rel: 'vigil', until: (m) => pwAp(m, 'vigil') <= 860 }, { drop: true }] },
    { name: 'release, then brake once clear of Vigil', steps: (AP) => [{ coast: (m) => m.t >= 56.3 }, { drop: true }, { coast: (m) => dist(m, 'vigil') > 400 }, { burn: 'retro', rel: 'vigil', until: (m) => pwAp(m, 'vigil') <= 860 }] },
  ],
  needledive: [
    { name: 'leave on the first lap', steps: (AP) => proofs.needledive.script([41].concat(proofs.needledive.p.slice(1)), AP) },
    { name: 'leave on the second lap', steps: (AP) => proofs.needledive.script([131].concat(proofs.needledive.p.slice(1)), AP) },
    { name: 'a shallow dive on the first lap', steps: (AP) => proofs.needledive.script([41, 94, 0.56], AP) },
    { name: 'wait one lap too many', steps: (AP) => proofs.needledive.script([311].concat(proofs.needledive.p.slice(1)), AP) },
    { name: 'dive in from the far side', steps: (AP) => [{ burn: 'retro', rel: 'tor', until: (m) => m.dvUsed() > 2 && closest(m, 'spindle', 400) <= 70 }, ...proofs.needledive.script(proofs.needledive.p, AP).slice(2)] },
  ],
  heavystar: [
    { name: 'wait for the orbit to swing round', steps: () => [] },
    { name: 'brake hard and dive straight in', steps: (AP) => proofs.heavystar.script([3.2], AP) },
    { name: 'brake on the next lap', steps: (AP) => [{ wait: 420 }, ...proofs.heavystar.script(proofs.heavystar.p, AP)] },
  ],
};

module.exports = { levels, proofs, fails };
