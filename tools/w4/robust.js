// Playability check: can a person flying by hand win? Flies each proof many
// times with its parameters jittered by a human's precision (proof.tol: per
// parameter, the ± a player can't help being off by: a couple of seconds on
// a timing, a few percent on how long a burn runs, a few degrees of aim) and
// reports the win rate, plus the margins the proof leaves.
//   node tools/w4/robust.js ch1            every mission in tools/w4/ch1.js
//   node tools/w4/robust.js ch1 keeper 60  one mission, 60 samples
// Targets: win rate ≥ 50%, ship and cargo dose ≤ 75% of their limits,
// ship Δv ≥ 1.4 × the proof's.
'use strict';
const path = require('path');
const AP = require('../autopilot.js');

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// One mission: { win, n, dose, cargo, fuel, ok } (fractions; ok = meets the targets).
function robust(L, P, n) {
  const run = (p) => AP.fly(L, P.script(p, AP), P.opts);
  const base = run(P.p);
  const lim = base.m.doseLimit;
  const dose = isFinite(lim) ? base.m.dose / lim : 0;
  let cargo = 0;
  for (const c of base.m.crafts) if (c.doseLimit != null) cargo = Math.max(cargo, c.dose / c.doseLimit);
  const fuel = base.m.dv0 / Math.max(1e-6, base.dv);
  const tol = P.tol || P.p.map(() => 0);
  const rand = rng(12345);
  let wins = 0;
  for (let k = 0; k < n; k++) {
    const p = P.p.map((v, i) => v + (rand() * 2 - 1) * (tol[i] || 0));
    if (run(p).won) wins++;
  }
  const win = wins / n;
  return { won: base.won, win, n, dose, cargo, fuel, hasTol: !!P.tol, ok: base.won && !!P.tol && win >= 0.5 && dose <= 0.75 && cargo <= 0.75 && fuel >= 1.4 };
}

module.exports = { robust };

if (require.main === module) {
  const file = process.argv[2], only = process.argv[3], n = +(process.argv[4] || 40);
  if (!file) { console.log('usage: node tools/w4/robust.js <chapter> [levelId] [samples]'); process.exit(2); }
  const ch = require(path.resolve(__dirname, file.endsWith('.js') ? file : file + '.js'));
  let bad = 0;
  for (const L of ch.levels) {
    if (only && L.id !== only) continue;
    const P = ch.proofs[L.id];
    if (!P) { console.log(L.id.padEnd(14), 'NO PROOF'); bad++; continue; }
    const r = robust(L, P, n);
    if (!r.ok) bad++;
    const pct = (v) => (100 * v).toFixed(0) + '%';
    console.log(`${L.id.padEnd(14)} ${r.ok ? 'PLAYABLE' : 'TOO TIGHT'}  wins ${pct(r.win)} of ${r.n}${r.hasTol ? '' : ' (no tol set)'}  dose ${pct(r.dose)}  cargo ${pct(r.cargo)}  fuel ×${r.fuel.toFixed(2)}${r.won ? '' : '  PROOF FAILS'}`);
  }
  process.exitCode = bad ? 1 : 0;
}
