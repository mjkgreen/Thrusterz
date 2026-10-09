# World 3 workbench: No-Fly Zones

World 3 is 30 missions in five chapters of six. Each chapter is built in its
own file here (`tools/w3/ch1.js` … `ch5.js`) so chapters can be designed in
parallel; they get merged into `js/levels.js` (array `WORLD3`) and
`tools/proofs.js` at the end. **Only edit your own chapter file.** Don't edit
`js/*.js`, `tools/proofs.js`, `tools/autopilot.js` or anything else; if you
need an engine change, say so in your report instead.

Read first: `docs/ROADMAP.md` (World 3 section), `js/flight.js` (rules),
`tools/autopilot.js` (proof scripting), and the existing test levels at the
bottom of `js/levels.js` with their proofs in `tools/proofs.js`
(`test-keepout`, `test-patrol`, `test-berth`, `test-spin`, `test-sentry`).
World 2 levels and proofs are the best examples of the house style.

## Chapter file format

```js
'use strict';
const { ship, C, belt, VE } = require('../../js/levels.js');
module.exports = {
  levels: [ { id, name, intro, objective, teaches, bodies, ship, goals, par, bounds, tMax, predict, view, startCam? }, ... ],
  proofs: { id: { p: [...], scale: [...], script: (p, AP) => steps, opts? }, ... },
  fails:  { id: [{ name: 'climb at once', steps: (AP) => steps, opts? }], ... },  // naive plans that must lose
};
```

Run `node tools/w3/check.js ch1` (all), `node tools/w3/check.js ch1 <id> 600`
(search around p until it wins), `... <id> 800 opt` (keep searching for the
cheapest win; use this to set par). Paste the printed `p:` back into the file.

## The world's arc

The core difficulty of World 3, where it ends up, is **probes and stages
combined with keep-out zones and flip burns** (turning round with a limited
side-thruster budget). Everything builds up to that:

1. **Keep Out** — zones on their own (ship only). Gentle start.
2. **Weaving** — threading through objects: rocks and fields of zones, in
   gravity (not zero-G, except *Sentry Field*).
3. **Flip Burns** — side-thruster (RCS) budgets: every turn costs, flips are
   precious. Retrograde burns need a flip.
4. **Zone Drops** — probes and spent stages with zones. Introduces zones closed
   to everything (`zone: 'all'`), so where a probe or booster drifts matters.
5. **Grand Missions** — all of it: stages + probes + zones + flips on a budget.

Within a chapter, missions get harder; mission 1 of a chapter teaches its idea
in the simplest possible setting. Every mission should have one clear "aha"
(a decision), not just be bigger numbers.

## Rules you can use

- **Keep-out zone:** `keepOut: R` on a body (often a massless station,
  `gm: 0, kind: 'station'`, or a marker). The ship may not come within R of
  the body's centre. Zones move with their body (orbits). The predicted path
  turns red where it would enter.
- **Closed to everything:** add `zone: 'all'`. Then dropped cargo and spent
  stages may not enter either (cargo may enter a zone around the body it is
  being delivered to: a goal `{ craft: 'pod', body: 'haven', ... }`). Spent
  stages are checked like World 2 debris: a stage whose orbit would cross the
  zone's orbit band fails at once (`cross`), one that will drift in fails
  (`hit`); a stage that falls to the ground is fine. Drawn amber.
- **Protected bodies** (`protect: true`, World 2): debris may not hit them.
- **Rocks:** `kind: 'rock', gm: 0, radius` bodies, fixed (`x, y`) or on
  orbits; touching one crashes ship or cargo. `belt(parent, n, rMin, rMax, seed, prefix)`
  makes a ring of them. Prefer orbiting rocks in gravity.
- **Fuel pickups:** see `test-fuel`.
- **RCS budget:** `rcs: { fuel: seconds }` in `ship({...})`. Default is 60 s
  (no constraint). Proofs for budget levels must use `opts: { turn: true }`
  (honest turning) and use **≤ 80%** of the budget. A budget should be about
  1.5× what the proof uses: a careful human makes it, holding the keys doesn't.
  `rcs: false` would remove side thrusters entirely; don't use it (the
  Fixed Heading idea was cut).
- **Stages / cargo:** `ship({ stack: [...] })`, `payload`, `cargo` as in World 2.
- Goal types: `hit` (optionally `craft`, `site`), `reach` (point or body,
  optionally `craft`), `orbit` (band, optional `dir`, `craft`), `rendezvous`,
  `hold` (incl. `lagrange`), `escape`, `spread`.

## Conventions

- `id`: short lowercase, unique across the whole game (check `js/levels.js`).
- `name`: 1–3 words. `teaches`: short phrase like "Moving keep-out zones".
- `intro`: 2–4 plain sentences in the voice of the existing levels: what's
  going on, what to do, the one hint that matters. Name controls the way
  others do (E drops cargo, the stage button…). No em dashes; use commas,
  colons or full stops.
- `objective`: one sentence, the exact win condition with numbers.
- `par`: about 1.1–1.25× the cheapest proof Δv you found (`opt`), rounded
  to 0.1. Ship Δv about 1.4–1.7× par.
- `tMax` comfortably above the proof's time (proof under ~70% of tMax).
- `view`/`bounds`/`predict` sensible for the layout (see similar levels).
- Every mission: a proof that wins, and where a zone/rock/budget is the
  point, at least one `fails` entry showing the obvious naive plan loses
  because of it.
- Physics is deterministic; don't rely on Math.random.
