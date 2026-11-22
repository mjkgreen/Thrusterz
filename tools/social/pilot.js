// A human at the controls, for social reels. Takes a mission's proof (the
// autopilot's exact, machine-perfect script) and flies it the way a person
// would: turning with the side thrusters instead of snapping to an angle,
// hesitating before burns and drops, breaking long burns into a couple of
// presses, letting go of the engine a little late, and pausing after a
// release before burning away from it.
//
// Imperfection changes the flight, so every variant is checked: plan()
// tries seeded variants, from the most human down to the proof as written,
// and keeps the first one that still wins. Pure logic: no requires, so it
// loads in the page (record.js) as well as in Node.
//
//   const v = Pilot.variant(proof, AP, { seed, level })  → { script, opts, level, seed }
//     (a script holds state while flown: build a fresh one for every flight)
//   Pilot.plan(proof, AP, fly, { seed })                  → the first variant that wins
(function (root) {
  'use strict';

  // Most human first. Each level is tried with a few seeds before stepping down.
  const LEVELS = [
    { name: 'human', turn: true, hesitate: [0.35, 1.0], dropPause: [0.5, 1.3], afterDrop: [0.7, 1.6], pulses: true, lateCut: [0, 0.12] },
    { name: 'steady', turn: true, hesitate: [0.2, 0.6], dropPause: [0.3, 0.8], afterDrop: [0.5, 1.0], pulses: false, lateCut: [0, 0.05] },
    { name: 'careful', turn: false, hesitate: [0.15, 0.4], dropPause: [0.3, 0.6], afterDrop: [0.4, 0.8], pulses: false, lateCut: [0, 0] },
    { name: 'exact', turn: false, hesitate: [0, 0], dropPause: [0, 0], afterDrop: [0, 0], pulses: false, lateCut: [0, 0] },
  ];
  const SEEDS_PER_LEVEL = 3;

  // Small, seedable random numbers (mulberry32).
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const between = (r, [lo, hi]) => lo + (hi - lo) * r();

  // The proof's script, flown by a person at this level.
  function humanize(steps, L, r) {
    const out = [];
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      if (st.burn != null) {
        const pause = between(r, L.hesitate);
        if (pause > 0.01) out.push({ wait: pause, human: 'aim' });
        const until = st.until;
        // Letting go a little late: the engine runs on briefly once done.
        const late = between(r, L.lateCut);
        let doneAt = null;
        const lateUntil = until && late > 0.005 ? (m, ctx) => {
          if (doneAt == null && until(m, ctx)) doneAt = m.t;
          return doneAt != null && m.t - doneAt >= late;
        } : until;
        // A long burn in two presses: a first push, a breath, then the rest.
        // (Not for burns with a time cap or staging, whose step timing matters.)
        if (L.pulses && until && st.max == null && !st.stage && r() < 0.6) {
          const first = 0.6 + r() * 1.2, gap = 0.25 + r() * 0.45;
          out.push(Object.assign({}, st, { until: (m, ctx) => until(m, ctx) || m.t - ctx.t0 >= first, human: 'press' }));
          out.push({ wait: gap, human: 'breath' });
          out.push(Object.assign({}, st, { until: lateUntil, human: 'press' }));
        } else out.push(Object.assign({}, st, { until: lateUntil }));
      } else if (st.drop || st.deploy) {
        const pause = between(r, L.dropPause);
        if (pause > 0.01) out.push({ wait: pause, human: 'ready' });
        out.push(st);
        // Watch it go before burning away from it.
        const after = between(r, L.afterDrop);
        if (after > 0.01 && i < steps.length - 1) out.push({ wait: after, human: 'watch' });
      } else out.push(st);
    }
    // (If the first press already finished the burn, the second ends at once.)
    return out;
  }

  // o: { seed, level, p } (p: the proof's numbers, re-tuned; default its own).
  function variant(proof, AP, o) {
    const L = LEVELS.find(l => l.name === o.level) || LEVELS[0];
    const r = rng(o.seed);
    const p = o.p || proof.p;
    const script = humanize(proof.script(p, AP), L, r);
    const opts = Object.assign({}, proof.opts || {});
    // Honest turning: torque, ramp-up and limited side-thruster fuel, at a
    // person's pace (a little different each time).
    if (L.turn && !opts.turn) { opts.turn = true; opts.turnRate = 0.45 + r() * 0.35; }
    // Aim roughly while waiting (5-8°), line up properly just before a burn.
    if (L.turn) opts.aimSlack = 0.09 + r() * 0.05;
    return { script, opts, level: L.name, seed: o.seed, p };
  }

  // The first variant that wins. `fly(make)` flies make()'s { script, opts }
  // and returns { status, cost } (cost: the autopilot's measure of how close
  // a losing run came). record.js passes the same chunked physics it films with.
  //
  // A proof's numbers are tuned for a pilot who reacts instantly: on some
  // missions (impactor) any pause before the dodge burn ends on the Moon. A
  // person would burn until their path clears; here, the numbers are re-tuned
  // for the human version (the search check-scripted.js uses), before giving
  // up some of the humanity.
  function plan(proof, AP, fly, o) {
    o = o || {};
    const base = (o.seed >>> 0) || 1, iters = o.searchIters == null ? 150 : o.searchIters;
    const tried = [];
    const attempt = (level, seed, p) => {
      const res = fly(() => variant(proof, AP, { seed, level, p }));
      return Object.assign({ level, seed, p: p || proof.p }, res);
    };
    const done = (a) => Object.assign(variant(proof, AP, { seed: a.seed, level: a.level, p: a.p }), { tried, tuned: a.p !== proof.p });
    for (const L of LEVELS) {
      if (L.name === 'exact') break;
      let best = null;
      for (let k = 0; k < SEEDS_PER_LEVEL; k++) {
        const a = attempt(L.name, (base + k * 7919) >>> 0);
        tried.push(L.name + ':' + a.status);
        if (a.status === 'won') return done(a);
        if (!best || a.cost < best.cost) best = a;
      }
      if (!iters || !proof.scale) continue;
      // Re-tune the closest miss: random steps around its numbers, shrinking.
      const r = rng(best.seed ^ 0x9e3779b9);
      let sigma = 1;
      for (let it = 0; it < iters; it++) {
        const p = best.p.map((v, i) => v + (r() * 2 - 1) * (proof.scale[i] || 0) * sigma);
        const a = attempt(L.name, best.seed, p);
        if (a.status === 'won') { tried.push(L.name + ':tuned after ' + (it + 1)); return done(a); }
        if (a.cost < best.cost) best = a;
        if (it % 40 === 39) sigma = Math.max(0.1, sigma * 0.6);
      }
      tried.push(L.name + ':tuning failed');
    }
    const exact = attempt('exact', base);
    tried.push('exact:' + exact.status);
    return Object.assign(done(exact), { level: exact.status === 'won' ? 'exact' : 'none' });
  }

  const Pilot = { LEVELS, variant, plan, humanize, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pilot;
  else root.Pilot = Pilot;
})(typeof window !== 'undefined' ? window : globalThis);
