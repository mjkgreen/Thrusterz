// World 3 workbench: fly the scripted proofs of one chapter file.
//   node tools/w3/check.js ch1                 every mission in tools/w3/ch1.js
//   node tools/w3/check.js ch1 nofly 400       search 400 tries around p if it doesn't win
//   node tools/w3/check.js ch1 nofly 400 opt   keep searching for the cheapest win
//   node tools/w3/check.js ch1 nofly 0 trace   print the flight every 10 s
// A chapter file exports { levels: [...], proofs: { id: { p, scale, script, opts? } },
// fails?: { id: [{ name, steps, opts? }] } } where each "fail" is a naive
// flight plan that must NOT win (proves the zone, budget or rock really bites).
'use strict';
const path = require('path');
const AP = require('../autopilot.js');

const file = process.argv[2];
if (!file) { console.log('usage: node tools/w3/check.js <chapter> [levelId] [iterations] [opt|trace]'); process.exit(2); }
const ch = require(path.resolve(__dirname, file.endsWith('.js') ? file : file + '.js'));
const only = process.argv[3];
const iters = process.argv[4] != null ? +process.argv[4] : 0;
const mode = process.argv[5];

function search(level, proof, n, optimize) {
  let rnd = 7;
  const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const run = (p) => AP.fly(level, proof.script(p, AP), proof.opts);
  let bestP = proof.p.slice(), best = run(bestP), sigma = 1;
  for (let it = 0; it < n && !(best.won && !optimize); it++) {
    const p = bestP.map((v, i) => v + (rand() * 2 - 1) * (proof.scale[i] || 0) * sigma);
    const r = run(p);
    if (r.cost < best.cost) { best = r; bestP = p; }
    if (it % 100 === 99) sigma = Math.max(0.05, sigma * 0.7);
  }
  return { best, p: bestP };
}

let failed = 0;
for (const L of ch.levels) {
  if (only && only !== 'all' && L.id !== only) continue;
  const proof = ch.proofs[L.id];
  if (!proof) { console.log(`${L.id.padEnd(14)} NO PROOF`); failed++; continue; }
  const t0 = Date.now();
  const { best, p } = search(L, proof, iters, mode === 'opt');
  const budget = L.ship.rcs ? L.ship.rcs.fuel : null;
  const rcsOk = !budget || best.rcs <= budget * 0.8;
  if (!best.won || !rcsOk) failed++;
  console.log(`${L.id.padEnd(14)} ${best.won ? (rcsOk ? 'SOLVED ' : 'RCS>80%') : 'FAILED '} dv=${best.dv.toFixed(2)} / ${best.m.dv0.toFixed(2)} par=${L.par}`
    + (budget != null ? ` rcs=${best.rcs.toFixed(2)} / ${budget}s` : '')
    + ` t=${best.m.t.toFixed(0)} / ${L.tMax} (${Date.now() - t0}ms)${best.won ? '' : ' ' + best.status + ': ' + best.message}`);
  if (iters) console.log('   p:', JSON.stringify(p.map(v => +v.toFixed(3))));
  if (best.won && best.dv > L.par) console.log('   note: proof uses more Δv than par');
  for (const f of (ch.fails && ch.fails[L.id]) || []) {
    const r = AP.fly(L, f.steps(AP), f.opts);
    if (r.won) failed++;
    console.log(`   ${r.won ? 'BAD: naive plan wins' : 'ok: naive plan fails'} · ${f.name} · ${r.status}: ${r.message}`);
  }
  if (mode === 'trace') {
    const m = AP.fly(L, proof.script(p, AP), Object.assign({}, proof.opts, { trace: true })).m;
    for (const e of m.events) console.log('   event', e.t.toFixed(1), e.type, e.craft || e.stage || e.index || '');
  }
}
process.exitCode = failed ? 1 : 0;
