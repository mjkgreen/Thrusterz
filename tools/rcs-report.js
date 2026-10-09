// How much side-thruster (RCS) time does each proven mission need?
// Flies every scripted proof with honest turning (tools/autopilot.js,
// opts.turn) at a few spin-rate caps and prints the RCS seconds used.
// Slow turns cost less RCS but take longer, so a proof tuned with instant
// turns can miss its timing; those show as "lost" (re-tune with
// check-scripted.js before giving that mission an RCS budget).
//   node tools/rcs-report.js [levelId]
'use strict';
const AP = require('./autopilot.js');
const { LEVELS } = require('../js/levels.js');
const PROOFS = require('./proofs.js');

const RATES = [0.5, 0.2, 0.08];
const only = process.argv[2];
console.log('mission'.padEnd(16) + 'budget  ' + RATES.map(r => `turn ≤${r} rad/s`.padEnd(20)).join(''));
for (const L of LEVELS) {
  if (only && L.id !== only) continue;
  const proof = PROOFS[L.id];
  if (!proof || !L.ship.rcs) continue;
  const cells = RATES.map((turnRate) => {
    const r = AP.fly(L, proof.script(proof.p, AP), Object.assign({}, proof.opts, { turn: true, turnRate }));
    return (r.won ? `${r.rcs.toFixed(2)}s` : `lost ${r.rcs.toFixed(2)}s`).padEnd(20);
  });
  console.log(L.id.padEnd(16) + (L.ship.rcs.fuel.toFixed(1) + 's').padEnd(8) + cells.join(''));
}
