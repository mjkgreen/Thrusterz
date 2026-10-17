// Difficulty check: how often does a person flying by hand win? Flies each
// proof many times with its parameters jittered by a human's precision
// (proof.tol: per parameter, the ± an average player is off by: a couple of
// seconds on a timing, a few percent on how long a burn runs, a few degrees
// of aim), and again with half and a quarter of that error (a good player,
// an expert), and reports the win rates plus the margins the proof leaves.
//   node tools/w4/robust.js ch1            every mission in tools/w4/ch1.js
//   node tools/w4/robust.js ch1 keeper 60  one mission, 60 samples per skill
// Targets (World 4, "5 to 10 attempts unless you're good"): an average
// player wins 10–35% of tries, a good one ≥ 40%, an expert ≥ 80%; ship and
// cargo dose ≤ 90% of their limits on the proof; ship Δv ≥ 1.15 × the proof's.
'use strict';
const path = require('path');
const AP = require('../autopilot.js');

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const BAND = { avg: [0.1, 0.35], good: 0.4, expert: 0.8, dose: 0.9, fuel: 1.15 };

// One mission: { win, good, expert, n, dose, cargo, fuel, ok } (fractions;
// win/good/expert = win rate at 1×, ½× and ¼× proof.tol; ok = in the band).
function robust(L, P, n) {
  const run = (p) => AP.fly(L, P.script(p, AP), P.opts);
  const base = run(P.p);
  const lim = base.m.doseLimit;
  const dose = isFinite(lim) ? base.m.dose / lim : 0;
  let cargo = 0;
  for (const c of base.m.crafts) if (c.doseLimit != null) cargo = Math.max(cargo, c.dose / c.doseLimit);
  const fuel = base.m.dv0 / Math.max(1e-6, base.dv);
  const tol = P.tol || P.p.map(() => 0);
  const rate = (scale) => {
    const rand = rng(12345);
    let wins = 0;
    for (let k = 0; k < n; k++) {
      const p = P.p.map((v, i) => v + (rand() * 2 - 1) * (tol[i] || 0) * scale);
      if (run(p).won) wins++;
    }
    return wins / n;
  };
  const win = rate(1), good = rate(0.5), expert = rate(0.25);
  const ok = base.won && !!P.tol && win >= BAND.avg[0] && win <= BAND.avg[1] && good >= BAND.good && expert >= BAND.expert
    && dose <= BAND.dose && cargo <= BAND.dose && fuel >= BAND.fuel;
  return { won: base.won, win, good, expert, n, dose, cargo, fuel, hasTol: !!P.tol, ok };
}

module.exports = { robust, BAND };

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
    const verdict = r.ok ? 'IN BAND  ' : r.win > BAND.avg[1] ? 'TOO EASY ' : 'TOO HARD ';
    console.log(`${L.id.padEnd(14)} ${verdict} avg ${pct(r.win)} · good ${pct(r.good)} · expert ${pct(r.expert)} of ${r.n}${r.hasTol ? '' : ' (no tol set)'}  dose ${pct(r.dose)}  cargo ${pct(r.cargo)}  fuel ×${r.fuel.toFixed(2)}${r.won ? '' : '  PROOF FAILS'}`);
  }
  process.exitCode = bad ? 1 : 0;
}
