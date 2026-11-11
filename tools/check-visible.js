// Can the player see the winning route? For each mission's known route, the
// dashed line drawn when the engine stops for the last time before an
// objective is completed must reach that moment. Otherwise the route only
// works for someone who already knows it (or who lengthens the line, which
// touch screens can't). Uses the game's own line (Mission.predictPath),
// including its automatic look-ahead while the path is still closing on the
// objective.
//   node tools/check-visible.js [levelId] [iterations]
// Training and Worlds 2-4 fly their scripted proofs (tools/proofs.js) once.
// World 1 has no stored routes, so it searches for a winning route the line
// can show, starting from tools/check-levels.js's search space.
// Each objective is reported as
//   line   the mission's usual line shows it
//   ahead  only the automatic look-ahead shows it
//   HIDDEN the line stops short: the route can't be found by watching it
// The exit code is 1 if any mission has a HIDDEN objective.
'use strict';
globalThis.Phys = require('../js/physics.js');
const { Mission } = require('../js/flight.js');
const { LEVELS } = require('../js/levels.js');
const AP = require('./autopilot.js');
const PROOFS = require('./proofs.js');
const { run, decode, CHECK } = require('./check-levels.js');

const SLACK = 10; // s: a line ending this close to the moment still counts (orbit goals confirm over a few seconds)

// Record the line after every burn and every completed objective.
const advance = Mission.prototype.advance;
Mission.prototype.advance = function (dt, controls) {
  const v = this._vis || (this._vis = { line: null, thrustT: -Infinity, goalT: 0, goals: [], was: true });
  const before = this.goalIndex + this.done.size;
  const r = advance.call(this, dt, controls);
  if (this.thrusting) v.thrustT = this.t;
  else if (v.was && this.status === 'flying') v.line = this.line();
  v.was = this.thrusting;
  const after = this.goalIndex + this.done.size;
  if (after > before) {
    // An objective that follows from the last one with no burn in between
    // was settled by the line before it.
    const burned = v.thrustT > v.goalT;
    v.goals.push({ t: this.t, burnGap: this.t - v.thrustT, line: burned ? v.line : null });
    v.goalT = this.t;
    if (this.status === 'flying') v.line = this.line();
  }
  return r;
};
Mission.prototype.line = function () {
  const p = this.predictPath(this.level.predict, false);
  return { t: this.t, tEnd: p.tEnd, usual: this.t + this.level.predict };
};

// Worst objective of a finished flight: 0 line, 1 ahead, 2 hidden.
function grade(m) {
  let worst = 0, gap = 0;
  for (const g of (m._vis ? m._vis.goals : [])) {
    if (!g.line || g.burnGap < 1) continue; // completed during a burn, or settled earlier
    const k = g.line.usual >= g.t - SLACK ? 0 : g.line.tEnd >= g.t - SLACK ? 1 : 2;
    if (k > worst || (k === worst && g.t - g.line.t > gap)) { worst = Math.max(worst, k); gap = g.t - g.line.t; }
  }
  return { worst, gap };
}

const NAMES = ['line', 'ahead', 'HIDDEN'];
const only = process.argv[2];
const iters = process.argv[3] != null ? +process.argv[3] : 600;
let hidden = 0;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  if (level.test) continue;
  const world = level.world == null ? 1 : level.world;
  let res = null, how = '';
  if (PROOFS[level.id]) {
    const proof = PROOFS[level.id];
    res = AP.fly(level, proof.script(proof.p, AP), proof.opts);
    how = 'proof';
  } else if (CHECK[level.id]) {
    // Search for a win, preferring ones the line shows.
    const c = CHECK[level.id];
    level.check = c;
    let rnd = 7, sigma = 1;
    const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    const score = (r) => r.won ? r.dv + 100 * grade(r.m).worst : 1000 + r.cost;
    let bestP = c.guess.slice(), best = run(level, decode(bestP, c.burns)), bestS = score(best);
    for (let it = 0; it < iters && !(best.won && grade(best.m).worst === 0); it++) {
      const p = bestP.map((v, i) => v + (rand() * 2 - 1) * c.scale[i] * sigma);
      const r = run(level, decode(p, c.burns)), s = score(r);
      if (s < bestS) { best = r; bestP = p; bestS = s; }
      if (it % 200 === 199) sigma = Math.max(0.05, sigma * 0.7);
    }
    res = best;
    how = 'search';
  } else {
    if (only || world === 1) console.log(`${level.id.padEnd(16)} w${world}  no route to check`);
    continue;
  }
  if (!res.won) { console.log(`${level.id.padEnd(16)} w${world}  ${how}: no win found (${res.status})`); continue; }
  const { worst, gap } = grade(res.m);
  if (worst === 2) hidden++;
  console.log(`${level.id.padEnd(16)} w${world}  ${NAMES[worst].padEnd(6)} ${how.padEnd(6)} longest coast to an objective ${gap.toFixed(0)} s, line ${level.predict} s (look-ahead to ${level.predict * 4} s)`);
}
process.exitCode = hidden ? 1 : 0;
