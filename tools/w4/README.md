# World 4 workbench: Pulsar

World 4 is 30 missions in five chapters of six, built like World 3: each
chapter in its own file here (`tools/w4/ch1.js` … `ch5.js`), merged into
`js/levels.js` by `node tools/w4/build.js` (`npm run build:w4`). **Only edit
your own chapter file.** Don't edit `js/*.js`, `tools/proofs.js`,
`tools/autopilot.js` or anything else; if you need an engine change, say so
in your report instead.

Read first: `docs/ROADMAP.md` (sections "How a world is built" and "World 4:
Pulsar"), `tools/w3/README.md` (the World 3 rules and house style still
apply), `js/flight.js` (rules: radiation, belts, cargo, zones, goals),
`tools/autopilot.js` (proof scripting), a couple of World 3 chapter files
(`tools/w3/ch4.js`, `tools/w3/ch5.js` are the best examples of combined
missions), and the two radiation prototypes at the bottom of `js/levels.js`
with their proofs in `tools/proofs.js` (`test-shadow` *Sunshade*,
`test-pulsar` *Lighthouse*).

## The difficulty curve (important)

World 4 is late in the game: **it gets hard fast.** Only missions 1 and 7 of
the world (and to a lesser degree each chapter opener) are gentle. Every
other mission combines the chapter's radiation type with **at least two
other tools** (another radiation type, and tools from Worlds 1 to 3: see the
toolbox). A technique the player already knows (a deep pass, a Hohmann, a
release) is only a puzzle when a constraint makes it unfamiliar. Every
mission has **one clear decision** the intro hints at, and at least one
naive plan in `fails` that loses *because of the mechanic*.

About half the missions start unstable (the table says which). Phasing and
timing puzzles (often with retrograde bodies, `orbit: { dir: -1 }`) recur.

## Chapter file format

Same as World 3:

```js
'use strict';
const { ship, C, belt, VE } = require('../../js/levels.js');
module.exports = {
  levels: [ { id, name, intro, objective, teaches, bodies, ship, goals, par, bounds, tMax, predict, view, startCam? }, ... ],
  proofs: { id: { p: [...], scale: [...], script: (p, AP) => steps, opts? }, ... },
  fails:  { id: [{ name: 'naive plan', steps: (AP) => steps, opts? }], ... },
};
```

`node tools/w4/check.js ch1` (all), `node tools/w4/check.js ch1 <id> 600`
(search around p until it wins), `... <id> 800 opt` (cheapest win, for par),
`... <id> 0 trace` (events). Paste the printed `p:` back.

## Radiation rules (World 4's mechanic)

- **Source:** on a body, `radiation: { rate, at, dose, beam? }`: `rate`
  Sv/s at distance `at` from its centre, falling with the square of the
  distance (inside the body's radius it stays at the surface value). The ship
  may take at most `dose` Sv in all (belts and sources share the total; the
  smallest limit in the level applies).
- **Shadows:** any body with a radius (planets, moons, rocks, comets; not
  stations, pickups, wormholes or anchors) on the straight line between the
  source and you blocks it completely. The cone behind a body widens with
  distance from the source.
- **Beam (pulsar):** `beam: { width, period, phase }`: radiation only in two
  opposite beams `width` radians wide, sweeping counter-clockwise once every
  `period` s, at angle `phase + 2π t / period`. Shadows block beams too.
  Exposure per sweep at radius r is `rate·(at/r)²·period·width/(2π)`: close
  in a hit is huge, far out it's small. Crossing the beam's path against its
  spin shortens the exposure.
- **Belts:** `belt: { rMin, rMax, dose }` on a body: 1 Sv per second inside.
- **Cargo dose:** a cargo item may carry `dose: Sv`. It's shielded aboard;
  once dropped (E) it takes radiation at its own position and is lost (the
  mission fails) over its limit. While it's aboard, the path preview marks
  where it would run out.
- **Deep gravity:** `pw` (strong gravity, no stable orbit inside 3·pw) and
  `horizon: r` (crossing it is final) on a massive body, see *Whirl*
  (`test-horizon`). They combine with `radiation`. Close to a pulsar the
  falloff makes a beam hit huge: tune `rate` so passes between sweeps are
  the answer and the timing reads as fair.
- **L1/L2:** `hold` goals take `lagrange: { body, lead: 0, scale }` (scale
  slightly over 1 is L2 behind the body, in its shadow; solve the scale with
  the star's barycentre wobble, see the roadmap). L2 is unstable: a coasting
  ship drifts out of a 20 k zone in about 20 s, so use a short hold (~10 s)
  or a rendezvous with a station parked there. A station can co-rotate with
  a planet: `orbit: { parent, a, n: <planet's n>, phase: <planet's phase>, reflex: false }`
  with `gm: 0`. Stations are solid: don't make the player sit on one.
- **Kinds:** `kind: 'star'` for a hot star (draws as a star), `kind: 'pulsar'`
  for a pulsar (small, bright, colour like `#e4dcff`).
- Coast steps are capped so a beam can't be skipped; the predicted path glows
  where it would take dose and marks DOSE LIMIT.

## The toolbox (from earlier worlds)

Unstable starts (`start: { conic }`, `{ orbit: { speed } }`, `{ free }`),
awkward fixed starts (e.g. a geostationary orbit on the far side of a
planet), stages (`stack`) and debris rules (`protect`, `zone: 'all'`), cargo
drops (`cargo`), constellations (`spread` goals), multi-moon and
multi-planet systems, retrograde bodies (`dir: -1`), phasing, keep-out zones,
patrols (stations with `keepOut` on orbits), rocks (`belt()` and `kind:
'rock'`), side-thruster budgets (`rcs: { fuel }`, proofs with `opts: { turn:
true }` using ≤ 80% of it), fuel pickups and depots, strong gravity.

## Conventions

As World 3: unique lowercase `id` (check `js/levels.js` and the other
chapter files), `name` 1 to 3 words, `teaches` a short phrase, `intro` 2 to 4
plain sentences naming the controls and the one hint that matters (no em
dashes), `objective` one sentence with the exact win condition and numbers,
`par` about 1.1 to 1.25 × the cheapest proof Δv, ship Δv about 1.4 to 1.7 ×
par, proof time under ~70% of `tMax`, sensible `view`/`bounds`/`predict`.
Distances on screen are "k". Deterministic only (no Math.random).
Missions should look different from each other: vary layouts, colours,
names (stars, pulsars, planets, moons, stations), and goal types (orbit,
rendezvous, hold, reach, escape, hit/landing, spread, drops).

## The plan

The mission table below is the plan; the names, ids and details are yours to
refine if a mission plays better another way, as long as it keeps its
chapter's type, its start (stable or unstable), and what it combines.

### Chapters (5 × 6)

Each chapter opens by teaching one type, then combines it with the other
types and the toolbox. **Phase** marks phasing and timing puzzles (often with
retrograde bodies); **Unstable** marks a start already in motion.

**1 · Sunburn: falloff**

| # | Mission | Start | Combines | The decision |
| --- | --- | --- | --- | --- |
| 1 | Sunburn | stable | ship only | Climb away from a hot star before the dose runs out: distance is safety. |
| 2 | Send and Release | Unstable: falling in on a long ellipse | satellite with its own dose limit | You can't afford the trip in and back: release it fast enough to cross the hot zone alive, then climb out. |
| 3 | Hot Booster | stable | stages | Stage so the last stage does the short fast dive and the escape. |
| 4 | Retrograde Relay | Unstable: arriving on a flyby | retrograde station · Phase | Brake into the system, phase from far out (cheap), then dive to meet it. |
| 5 | Patrol Shift | stable | patrol zones on the cool lanes · Phase | Go between patrols in the cool lane, or take the hot inner lane fast. |
| 6 | Solar Survey | Unstable: low point grazes the hot zone | three probes, constellation | Spread the probes on close orbits within each one's budget, and raise your low point before the laps add up. |

**2 · Shadows**

| # | Mission | Start | Combines | The decision |
| --- | --- | --- | --- | --- |
| 7 | Eclipse | stable | ship only | Leave a planet from its night side, inside its shadow (*Sunshade*). |
| 8 | Shade Drop | stable | satellite to a station at a moon's L2 · Phase | Release it to coast in down the shadow; keep yourself out of the sun. |
| 9 | Fenced Shade | Unstable: in the shadow, sinking | zones inside the shadow | Climb above the zones without leaving the narrowing cone. |
| 10 | Umbrella Field | stable | orbiting rocks, the only shade | Weave close behind rocks that kill on contact. |
| 11 | Backward Moon | Unstable: drifting into sunlight | retrograde moon · Phase | Its shadow sweeps the other way and passes fast: arrive as it lines up. |
| 12 | Junk in the Sun | stable | stages, debris rules, a shaded station's zone | Stage in the shade, but aim the spent booster's fall into the star. |

**3 · Beams**

| # | Mission | Start | Combines | The decision |
| --- | --- | --- | --- | --- |
| 13 | Lighthouse | Unstable: escaping slowly, a sweep coming | ship only | Beat the beam outward (the prototype). |
| 14 | Against the Spin | stable | flip to a retrograde orbit · Phase | Against the beam's spin it crosses you fast; with it, it lingers. |
| 15 | Duck and Release | Unstable: crossing the next sweep's line | probe drop, hide at a moon's L2 · Phase | Release just after a sweep, then dive into the shade. |
| 16 | Turn in the Dark | stable | side-thruster budget, shadows | Do the turning in the shade: no time to flip in the beam. |
| 17 | Beam Patrol | Unstable: in a patrol lane, being caught | patrols · Phase | Find the window where the patrol gaps and beam gaps line up. |
| 18 | Keeper's Station | stable | stages, rendezvous on the far side · Phase | Stage, go round through gaps and shadows, match speed. |

**4 · Deep Gravity**

| # | Mission | Start | Combines | The decision |
| --- | --- | --- | --- | --- |
| 19 | Heavy Star | stable | a neutron star, a moon in the way | Whip round where no orbit is stable, without clipping the moon. |
| 20 | Needle Dive | geostationary on the far side of a planet | deep pass, the beam, a moon's zone · Phase | You can't choose your start: leave on the right lap so the dive's bottom falls between sweeps and clears the zone. |
| 21 | Slingshot Drop | Unstable: fast flyby of the pulsar | probe release, the beam | One deep pass: release at the bottom, out of the beam. |
| 22 | Retro Whirl | stable | whirl to reverse, retrograde station · Phase | The whirl turns you round for free; time it so the beams point away. |
| 23 | Horizon Fence | Unstable: arriving on the fenced line | black hole, zones, side-thruster budget | Thread past the horizon on a tighter or wider line than the one fenced off. |
| 24 | Binary | Unstable: caught between the pair | pulsar and black hole · Phase | Slingshot through the pair at the right phase of their orbit. |

**5 · Grand Missions**

| # | Mission | Start | Combines | The decision |
| --- | --- | --- | --- | --- |
| 25 | Dark Constellation | stable | three satellites in a shadow band, dose limits · Phase | Spread them evenly with every one coasting in the shade. |
| 26 | Staged Dive | Unstable: orbit decaying into the dive | three stages, debris rules | Drop each stage where it falls safely, the last at the bottom. |
| 27 | Sentry Pulsar | stable | moon zones, patrols, the beam · Phase | Weave through all three at once. |
| 28 | Pulsar Supply Run | stable | cargo to a retrograde moon, side-thruster budget, beam | World 3's *Supply Run*, rebuilt around a pulsar. |
| 29 | Rescue in the Beam | Unstable: you and the drifting ship | rendezvous between sweeps · Phase | Meet it in a gap, match speed, leave through a shadow. |
| 30 | Pulsar Tour | Unstable: arriving into the system | everything | The finale. |

15 unstable or awkward starts, 14 phasing puzzles.

## Redesign v3 (after the second playtest): multi-part, sprinkled pulsars, shadow lanes

The player's direction, in their words: "the key thing should be with
multiple stages or parts to the level ... you can fly the first part
correctly, but if you mistime the second part or the third part, then you
can't win ... you use too much fuel on one thing, or too much RCS, or have
too much radiation accumulation. That's when the windows start to get
tight ... not the 10% or 20% off of a button press error, but the
accumulation of being off on each one ... for World 4 especially, having
them be multi-part as a rule is good."

Rules for every World 4 mission now:

- **Multi-part.** At least two goals, most three or four (dive then orbit,
  deploy then something else, hold then transfer then rendezvous). Fuel,
  RCS and the dose limit are shared across the parts, so a sloppy first
  part costs you later. That accumulation is where the difficulty comes
  from, not razor-thin single windows. The goal checklist shows every part.
- **Proofs model each part with its own parameters**, each with an honest
  human `tol`; robust.js jitters them all at once, so errors accumulate the
  way a player's do.
- **Pulsars are sprinkled, not a chapter.** The beam is introduced early in
  chapter 2 and then mixed into missions across chapters 2 to 5 alongside
  falloff, shadows and deep gravity.
- **Shadows are now physical** (js/flight.js `discVisible`): a star is a
  disc (its radius, or `radiation.size`), so behind a body smaller than the
  star the umbra (no dose) narrows and ends, at about d·Rc/(Rs − Rc) behind
  it, inside a penumbra where the dose is the share of the disc still
  showing. Pulsars are points (`size` 0): sharp shadows that widen. Check
  your hiding places really are in the umbra.

Chapters:

1. **Sunburn** (falloff): diving and parking on dose budgets, cargo with
   its own limit. Multi-part.
2. **Shadows and Beams**: shadows (umbra, penumbra, eclipses by moons and
   rocks); the pulsar beam is introduced here (about mission 3 or 4) and
   combined with shadows.
3. **Shadow Lanes** (new, replaces the Beams chapter): hanging in a
   planet's L2 shadow while it orbits (the `lagrange` goal with `hold`),
   planets on **elliptical orbits** (`orbit: { e, argp }`; nothing has used
   them yet), timing the transfer from one planet to the next for when
   they line up, passing through a beam on the way. Hold, then transfer,
   then arrive.
4. **Deep Gravity**: strong gravity and horizons, with beams and shadows.
5. **Grand Missions**: three or four parts each, everything combined.

The difficulty band below still applies (average 10–35%, good ≥ 40%,
expert ≥ 80%), and naive plans must still lose.

## Difficulty band (after the second playtest)

The playability pass overshot: nearly every mission won 95–100% of jittered
runs, and the rendezvous windows got too big. The target now is that an
average player needs about **5 to 10 attempts**, fewer if they're good.
`node tools/w4/robust.js chN` flies each proof 40 times at three skill
levels, jittering every parameter by its `tol` × 1, ½ and ¼:

| Skill | Error | Win rate |
| --- | --- | --- |
| Average | 1 × tol | 10–35% |
| Good | ½ × tol | ≥ 40% |
| Expert | ¼ × tol | ≥ 80% |

plus ship and cargo dose ≤ 90% of their limits on the proof, and ship Δv
≥ 1.15 × the proof's. A mission in all of these reads IN BAND; the test
suite requires it.

- **`tol` stays honest.** Use the human values below (they describe the
  player, not the mission). Don't shrink a tol to make a mission look
  harder or grow one to look easier: tighten the mission itself.
- **Make the execution matter**, where the previous pass loosened it:
  rendezvous distance and relative speed (around 8 to 15 k and 0.3 to
  0.6 k/s; precision docking with limited fuel is the fun, as Keeper's
  Station was meant to be), gate and band sizes, the tank (corrections
  should cost you), dose limits, beam timing.
- **Still no hidden trial and error.** The hard part must be visible:
  flying the plan well, not guessing which lap works. Everything from the
  playability pass below still applies, except its numeric targets.

## Playability pass (after the first playtest)

Playtesting found World 4 too tight: the player beat 1 to 19 but not
Needle Dive, margins were razor thin, and some missions were execution
tests rather than puzzles. The rules now, for every mission:

- **A person tapping BURN can't control the exact amount of fuel.** Every
  proof gets `tol`: per parameter, the ± a player can't help being off by.
  Use honest human values: a wait or departure time ±2 s (more if the moment
  can only be judged by eye), a burn target ±4% of the quantity it watches
  (high point, low point, speed) or ±0.1 k/s, an aim ±0.06 rad, a release
  ±1.5 s. `node tools/w4/robust.js chN` flies 40 jittered copies: **win rate
  ≥ 50%**, ship and cargo **dose ≤ 75%** of their limits, **ship Δv ≥ 1.4×**
  the proof's. All three must pass (PLAYABLE).
- **Puzzle first, execution second.** The difficulty is in working out the
  plan (which way, when, what to drop, where to hide), not in pixel-precise
  flying. The decision must be readable from the screen (predicted path,
  its radiation glow, shadows, beams, zones) and the intro: no hidden
  trial and error like "only the third lap works" with nothing on screen to
  tell you so. Tight windows are fine if you can see them coming.
- **Rendezvous and holds a thumb can hit** (superseded by the band above). Fuel for corrections: proofs should not need
  perfect matching burns.
- Keep the mission's idea, start type and combinations, and keep it hard as
  a puzzle. Loosen margins, add fuel, widen windows, or redesign the parts
  that were pure execution. Naive plans must still lose (the shortcut must
  not become valid when you add fuel; raise dose or zone pressure instead).
- Intros: say what to look for on screen (the glow on the path, the beam's
  position, where the shadow falls) so the plan can be found by thinking.
