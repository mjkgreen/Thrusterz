// Solvability check for levels with a scripted proof (tools/proofs.js).
// Each proof is a parameterised flight plan; this flies it with the stored
// parameters and, if that doesn't win, searches nearby values.
//   node tools/check-scripted.js [levelId] [iterations]
'use strict';
const AP = require('./autopilot.js');
const { LEVELS } = require('../js/levels.js');
const PROOFS = require('./proofs.js');

function search(level, proof, iters, seed, optimize) {
  let rnd = seed || 7;
  const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const run = (p) => AP.fly(level, proof.script(p, AP), proof.opts);
  let bestP = proof.p.slice(), best = run(bestP);
  let sigma = 1;
  for (let it = 0; it < iters && !(best.won && !optimize); it++) {
    const p = bestP.map((v, i) => v + (rand() * 2 - 1) * (proof.scale[i] || 0) * sigma);
    const r = run(p);
    if (r.cost < best.cost) { best = r; bestP = p; }
    if (it % 100 === 99) sigma = Math.max(0.05, sigma * 0.7);
  }
  return { best, p: bestP };
}

const only = process.argv[2];
const iters = process.argv[3] != null ? +process.argv[3] : 400;
const optimize = process.argv[4] === 'opt'; // keep searching after a win to find the cheapest route
let failed = 0;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  const proof = PROOFS[level.id];
  if (!proof) { if (only || level.world === 2) console.log(`${level.id.padEnd(15)} no proof`); continue; }
  const t0 = Date.now();
  const { best, p } = search(level, proof, iters, 7, optimize);
  if (!best.won) failed++;
  const budget = best.m.dv0;
  console.log(`${level.id.padEnd(15)} ${best.won ? 'SOLVED ' : 'FAILED '} dv=${best.dv.toFixed(2)} / ${budget.toFixed(2)} par=${level.par} ` +
    (proof.opts && proof.opts.turn ? `rcs=${best.rcs.toFixed(2)} / ${best.m.rcsFuel0.toFixed(2)}s ` : '') +
    `status=${best.status} t=${best.m.t.toFixed(0)} cost=${best.cost.toFixed(2)} (${Date.now() - t0}ms)${best.won ? '' : ' ' + best.message}`);
  console.log('   p:', JSON.stringify(p.map(v => +v.toFixed(3))));
}
process.exitCode = failed ? 1 : 0;
