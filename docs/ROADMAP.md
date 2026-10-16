# Thrusterz roadmap

Living notes on where the game goes next. Training (world 0), World 1 (Flight School), World 2
(Payloads), World 3 (No-Fly Zones) and **World 4 (Pulsar**: radiation and
deep gravity, built in `tools/w4`) are complete. Next: **World 5,
Homecoming** (atmospheres and landings); see below. New mechanics are prototyped as **Experimental levels**
in the menu before they get a world of their own.

## Principles for a world mechanic

Each world adds one thing that changes how you think, is taught in a single
mission, and combines with everything before it (the Cut the Rope model).
A good mechanic here:

1. Creates a new kind of decision (timing, aim, sequencing), not just bigger numbers.
2. Is visible on screen, so the trajectory prediction can show its effect.
3. Needs at most one new button, so the phone layout stays clean.
4. Plays with gravity, the core of the game.

Early worlds stay grounded in real spaceflight; stranger ideas come later.

Every prototype has one test level with a scripted proof in `tools/proofs.js`
and naive plans that must lose (`npm test` flies both), so a mechanic can be
judged by playing it before it gets a world.

## How a world is built

A world has a **theme** and one **new mechanic** that comes in a few
**types** (World 4: radiation, as falloff, shadows and beams, plus deep
gravity). Its 30 missions are five chapters of six:

- **Chapter openers teach one type** of the new mechanic, each in its own
  chapter, in a setting simple enough to see the idea. A stable start, but a
  satellite or a zone is fine if it helps teach.
- **Only the world's first one or two missions are easy.** From there every
  mission combines: the current type, another type of this world's mechanic,
  and tools from earlier worlds, more of them as the chapters go on.
- **The toolbox** (the checklist to draw from): unstable starts (falling,
  arriving, escaping, decaying, or an awkward fixed start such as a
  geostationary orbit on the wrong side of a planet), stages and debris
  rules, cargo and satellite drops, constellations, multi-moon and
  multi-planet systems, retrograde bodies, phasing and timing, keep-out
  zones (ship only or closed to everything), patrols, rocks and weaving,
  side-thruster budgets and flip burns, fuel and depots, strong gravity.
- **Something new every time:** a technique from an earlier world (a deep
  pass, a Hohmann, a release) is no longer the puzzle on its own; it's the
  puzzle when combined with a constraint that makes it unfamiliar (dip in
  quickly, between two sweeps, from a start you can't choose).
- About **half the missions start unstable**, more toward the end; every
  mission has one clear decision and a naive plan that loses.

## Future worlds

| Status | Mechanic | The decision it adds | Notes |
| --- | --- | --- | --- |
| **Built (World 2)** | **Payloads** | When to drop a stage or release cargo, and where the pieces end up | Stages, engineless cargo, debris fates, constellations. |
| **Built (World 3)** | **Area denial** | Where you may not go, and where things may end up | Keep-out zones (ship only, or closed to everything), weaving, side-thruster budgets and flip burns, combined with stages and probes. See World 3 below. |
| **Prototype** | **Fuel pickups** | Route planning: is the detour worth the fuel? | Canisters on their own orbits. Test level: *Fuel Run*. Used as a mixer in World 2 (*Fuel Depot*). |
| **Prototype** | **Refuelling depot** | Rendezvous to refill, then fly a mission your tank alone can't | Station with `depot: { dv, dist, relVel }`. Test level: *Top Up* (Hohmann to the depot, match its speed, +4 Δv, then a high orbit). |
| **Prototype → World 5** | **Atmospheres / aerobraking** | How deep to skim: free braking vs. burning up | Drag layer (density falls off with height) and a heating limit (ρ·v³); the predicted path includes drag and marks where you'd burn up. Test level: *Aerobrake* (capture from a fast arrival on 0.7 Δv, then lift the low point out of the air). |
| Idea | Asteroid tug / planetary defense | Push a heavy mass with your small engine | Dock with a rock and redirect it off a collision course. Strong finale for a world. |
| **Prototype → World 5** | **Soft landings** | Throttle control for a gentle touchdown | `maxSpeed` on a hit goal; the impact label shows touchdown speed. Test level: *Touchdown*. Landing legs and terrain later. |
| **Prototype** | **Solar sail** | Steer with sunlight, no fuel at all | Push along the nose ×cos²×1/r²; a spin matched to your orbit holds the sail angle. Test level: *Sunward Sail* (spiral out from 300 to 450–520). |
| **Prototype** | **Ion engine** | Very low thrust for very long burns | Spirals instead of impulsive burns; time warp up to 10× while it fires. Test level: *Long Burn*. |
| Idea | Precision docking | Fine translation thrusters for the last few meters | More buttons; needs a careful mobile design. |
| **Prototype → World 4** | **Radiation** | Where and when you're exposed: hide, time it, or keep your distance | Belts: a dose meter, shown on the predicted path too (*Radiation Belt*). Sources: inverse-square falloff, shadows behind planets, moons and rocks, and a pulsar's two sweeping beams (*Sunshade*, *Lighthouse*). The path glows where it would take dose. Solar flares and debris still ideas. |
| **Prototype** | **Tether / grapple** | Swing around an anchor and release at the right moment | Latch / release on the contextual E button (LATCH / RELEASE); inelastic rope, slack allowed. Test level: *Swing* (zero-G: turn round with no fuel). |
| **Prototype** | **Wormholes** | Enter one, exit another with the same velocity | The predicted path follows through. Test level: *Shortcut* (the entry angle aims the exit at an out-of-reach planet). Sci-fi, so late or never as a world. |
| Idea | Collectible stars | Fly a route that grabs three stars along the way | Cut the Rope-style replay layer that works in every world, including World 1. |
| **Prototype → World 4** | **Event horizons / strong gravity** | How close to pass a black hole: whirl round or fall in | A horizon much larger than the hole and a strong-gravity pull (gm/(r − pw)²): no stable orbits inside 3·pw, so a close pass whirls you round more than half a turn. Test level: *Whirl* (World 1's *Event Horizon* is the Oberth version). |

## Training (world 0, built)

Playtesters found the step from the first missions into World 1 too steep,
so the basics have their own short world, ahead of World 1, one control per
mission, each simple enough to win by using that control well:

1. **Liftoff**: the main engine.
2. **Point and Burn** (zero-G): side thrusters, stopping a spin.
3. **Full Stop** (zero-G): flip and burn, the retrograde marker.
4. **Long Coast** (zero-G): time warp, out and back to 1× before the stop.
5. **The Big Picture**: overview camera, a prograde burn out to a gate.
6. **Moving Frame**: starts in the inertial frame round a planet that is
   racing round its star; V to Terra's frame, then raise the low point.
7. **Lean Burn** (zero-G): stars come from fuel; burn gently, coast, restart.

Each has a proof in `tools/proofs.js` with a beginner-sized `tol`, and the
suite checks every one wins at least 3 times in 4 when flown sloppily.
World 1 now opens with Circularize, and its rendezvous missions (Docking,
Constellation, Rescue) come before the Luna transfers. `level.startFrame`
sets the reference frame a mission starts in.

## World 2: Payloads (built)

Four sub-mechanics, combined in five chapters of six missions:

| Sub-mechanic | What it adds |
| --- | --- |
| A. Hand-off | Drop the spent stage; control passes to the next one |
| B. Passive drop | Release engineless cargo; it coasts along your current path (the dashed line is the release preview) while you keep flying |
| C. Stacks | Three or more stages, each lighter than the last |
| D. Debris | Spent stages keep flying. A stage left on an orbit that crosses a protected object's orbit fails the mission (it would hit eventually); one that reenters is fine |

Chapters: *Hand-off* (Launch a Satellite, Burn It Dry, Against the Spin,
Stationary, Moon Probe, Homecoming) · *Passive drop* (Release Point, Impactor,
Relay Drop, Moon Mail, Twin Probes, Constellation) · *Stacks* (Three Stages,
Kick Stage, Escape Velocity, Solar Probe, Outer Planet, Splashdown) · *Debris*
(Clear the Station, Busy Orbit, Leave No Junk, Fuel Depot, Relay Pair,
Junkyard) · *Grand missions* (Lander and Orbiter, Deep Impact, Voyager, Moon
Network, Belt Survey, Grand Deployment).

Every World 2 mission has a scripted winning flight plan in `tools/proofs.js`,
flown by `npm test`; pars were set from the cheapest routes the search found.

Fuel pickups appear in World 2 only as an occasional mixer. Refuelling depots
(rendezvous, then top up) and control switching between craft (booster landing,
Apollo-style lander and orbiter) are saved for later worlds.

## World 3: No-Fly Zones (built)

Five chapters of six, building to the world's core: **probes and stages
combined with keep-out zones and flip burns on a side-thruster budget**.

| Chapter | Missions | What it adds |
| --- | --- | --- |
| *Keep Out* | No-Fly Zone, Patrol, Supply Run, Wide Berth, Hot Moon, Crowded Trojans | Ship-only zones: wait for a gap, drop into a bubble, slingshot or capture outside a zone, drift the other way round |
| *Weaving* | Asteroid Run, Debris Cloud, Detour, Sentry Field, Moon Maze, Close Quarters | Threading orbiting rocks and fields of moving zones (Sentry Field is the one zero-G mission) |
| *Flip Burns* | Spin Burn, One Flip, Brake at Luna, Station Stop, Down Through the Gap, Round Trip | Side-thruster budgets: slow, planned turns; holding the keys runs dry |
| *Zone Drops* | Clean Zone, Shielded Moon, Range Safety, Air Drop, Twin Zones, Crossing Traffic | Zones closed to everything (amber): where a probe or spent stage ends up |
| *Grand missions* | Resupply Run, Blockade Run, Moon Courier, Slingshot Relay, Survey Drop, The Long Haul | Everything at once, every mission on a budget |

The *Fixed Heading* prototype was cut; *Asteroid Run* moved from zero-G into
gravity (weaving through orbiting rocks). Each mission lives in
`tools/w3/ch*.js` with its scripted proof and the naive plans that must lose
(`npm test` flies them all); `npm run build:w3` writes the levels into
`js/levels.js`, and `node tools/w3/check.js chN [id] [iterations] [opt]`
re-tunes a proof.

Notes from building it, for later: the `rendezvous` goal checks one instant
(touch-and-go counts; a short hold would be stricter); massless markers that
share a moon's orbit need `mu` set by hand to stay with it; stations around a
planet with a heavy moon circle the barycentre, so debris bands are a little
wider than `debrisFate` assumes; the autopilot's honest turning chases moving
targets and over-spends RCS (chapter files carry better helpers).

### Original plan

Area denial was tried in World 2 (*Supply Run*, a keep-out bubble around a
station) but nothing else in that world used it, so it moved to the test
levels as *Keep Out* and World 2's slot 10 became *Moon Mail* (drop on a
flyby, carrier comes home on a free return). It becomes World 3's mechanic.

The idea has two sides: **zones you may not enter** and **zones something must
end up in**. It's grounded (real stations have a keep-out sphere and an
approach corridor; real launches have range-safety and no-fly areas), needs no
new button, and shows on the predicted path: the dashed line turns red where it
would cross a zone.

### Building blocks

| Block | What it adds | Rule |
| --- | --- | --- |
| A. Keep-out bubble | A circle around a body or a point that rides its orbit | Ship may not enter; cargo may (prototype rule) |
| B. Zone rules per object | Who a zone applies to: ship, cargo, spent stages, or all | One flag per zone, shown by colour/pattern |
| C. Shapes | Circle, ring (an altitude band, e.g. a radiation belt), surface arc (restricted ground), cone/corridor (the only way in) | Same check, different geometry |
| D. Timing | Zones that switch on and off, sweep around, or move on their own orbit | Shown as a countdown and a ghost of where the zone will be |
| E. Drop zone | The inverse: an area cargo (or the ship) must finish inside | Generalises today's surface landing zone to space |

### Combinations with earlier mechanics

| Combine with | Level idea | The decision |
| --- | --- | --- |
| Passive drop (W2) | **Keep Out** (built): throw the pod into the station's bubble | Release point vs. bubble edge |
| Phasing (W1 Docking) | **Approach Corridor**: dock with a station only through a cone on its trailing side | Match the orbit from behind, not from below |
| Gravity assist (W1 Slingshot) | **Wide Berth** (test level): Slingshot with a keep-out zone around Goliath. Later, **Dark Side**: only the near side is denied | Higher periapsis, weaker assist, tighter aim |
| Landing zone (W1) | **Restricted Ground**: a spinning planet with no-landing arcs between two allowed pads | Deorbit timing against the planet's spin |
| Debris (W2) | **Range Safety**: spent stages may not fall into a populated surface arc | Where the booster drops, not just whether it reenters |
| Hohmann / bi-elliptic (W1) | **Radiation Belt**: a ring-shaped zone with a time limit inside it (ship only) | Cross fast or go around the long way |
| Moving zone + phasing | **Patrol** (test level): guard satellites with keep-out zones circle between you and your target orbit | Wait for a gap, or change your lap time to dodge it |
| Timed zone | **Solar Storm**: the whole sky is denied except the planet's shadow for 60 s | Get into the shadow, and stay in it as you orbit |
| Constellation (W2) | **Blackout Arc**: spread satellites, but none may park over a denied longitude | Spacing with a hole in it |
| Fuel pickups | **Detour**: the canister sits just past a zone, so the cheap straight route is forbidden | Is the long way round still worth the fuel? |
| Lagrange (W1) | **Crowded Trojans**: L4 is denied, park at L5 | Same physics, opposite direction of drift |
| Drop zone (E) | **Air Drop**: put cargo inside a space zone, not on a surface | Release point and speed both matter |
| Two zones | **Customs**: pass through a checkpoint zone first, then deliver | Chained zones, order matters |
| Rendezvous + bubble | **Tow Away**: dock with a dead satellite drifting toward a protected bubble and haul it clear | Finale; needs the asteroid-tug mechanic |

A world of 30 could run as five chapters of six: *Keep out* (A, B) ·
*Shapes* (C) · *Moving zones* (D) · *Drop zones* (E) · *Grand missions*.

### What it needs in code

- Zones as their own list on a level (shape, owner body or orbit, who they
  apply to, schedule), instead of `keepOut` on a body.
- The coast predictor checks zones for the ship (done: the path turns red at
  the first crossing) and for each cargo's release preview (to do).
- A `zone` goal type for drop zones (craft or ship inside a zone, optionally
  held for a few seconds).
- A scripted proof in `tools/proofs.js` for every mission, as World 2 has.

### Side-thruster budgets (World 3 mixer)

So far RCS has been a limitless resource: every ship gets 60 s of firing and
no mission comes close. World 3 can make it a real constraint now and then,
not on every mission. Turning is a cost, so you plan fewer, slower turns:
tap (2°/s for 0.08 s of propellant) instead of holding.

**Measuring it.** The autopilot used to set the heading directly, so proofs
said nothing about turning. With `opts.turn` it now turns with the real
thrusters (spin up to a capped rate, coast, counter-fire to stop, match a
target that keeps turning such as prograde, and stop any leftover spin).
`npm run rcs-report` flies every proof that way. Results with the current
proofs (turn rate capped at 0.2 rad/s; "lost" means the slower turns broke
the proof's timing, not that RCS ran out):

| RCS needed | Missions |
| --- | --- |
| 0 s (launch only) | Launch a Satellite, Against the Spin, Stationary, Three Stages, Escape Velocity, Splashdown, Busy Orbit, Junkyard |
| under 3 s | Burn It Dry, Homecoming, Solar Probe, Clear the Station, Voyager, Belt Survey, Keep Out, Wide Berth |
| 3–10 s | Kick Stage, Leave No Junk, Deep Impact, Patrol, Relay Pair, Relay Drop, Twin Probes, Moon Network, Moon Probe, Impactor, Lander and Orbiter |
| not measured yet | Release Point, Moon Mail, Constellation, Fuel Depot, Outer Planet, Grand Deployment (need re-tuning for slow turns; launch steps still turn directly) |

So 60 s is 6–60× more than needed. A budget becomes a constraint around
1.5× what the proof uses: enough for a careful human, not for holding keys.
Proofs with a budget must use ≤80% of it (checked by `npm test`).

**Test levels.**

| Level | Budget | Proof uses | The idea |
| --- | --- | --- | --- |
| *Fixed Heading* | none (no side thrusters) | – | Your nose stays fixed against the stars while prograde swings round as you orbit: wait for them to line up, then burn. Burning early misses Luna |
| *Spin Burn* | 1.0 s | 0.27 s | Tap up a slow spin and pulse the engine as the nose sweeps past prograde (spin-stabilised stages). Holding a key for one second empties the tank |
| *Asteroid Run* | 7 s, 10 Δv | 4.9 s, 7.4 Δv | Zero-G: three gates through rocks, then stop at a depot. Every change of direction costs a turn and fuel |
| *Sentry Field* | 5 s, 7 Δv | 3.2 s, 4.4 Δv | Zero-G + area denial + a drop: throw a beacon into a zone you can't enter, dodge a circling sentry, stop at the depot |

Zero-G levels use a depot with a negligible mass as the HUD's reference, and
`zeroG: true` hides the orbit readouts. **Open questions:** is it fun or just
fiddly? Does running dry need a softer outcome (right now you just can't turn,
and a spin keeps going)? A low-RCS warning on the HUD? Should turn rate depend
on mass, so dropping cargo makes the ship nimbler?

## World 4: Pulsar (built)

Radiation and deep gravity, one question: **how close dare you go?** The
pulsar ties them together: a neutron star is a tiny, extremely dense body with
a deep gravity well that also sweeps two radiation beams round like a
lighthouse, so every close pass trades a gravity boost against dose.

### Radiation rules (built, `radiation` on a body; see `js/flight.js`)

- **Falloff:** `rate` Sv/s at distance `at`, falling with the square of the
  distance (a quarter as strong at twice the distance). Dive in fast or park
  far out; an ellipse spends little time at its hot low point.
- **Shadows:** any planet, moon or rock on the line to the source blocks it
  completely. The far side of a moon is a safe harbour; L2 sits in a planet's
  shadow. Drawn as dark cones with teal edges.
- **Beams:** `beam: { width, period, phase }` makes a pulsar: radiation only
  in two opposite beams sweeping round. A timing puzzle on top of an orbit
  puzzle: go between sweeps, hide during them.
- **Dose budget:** at most `dose` Sv in all (belts and sources share it),
  like World 3's side-thruster budget. The predicted path glows where it would
  take dose and marks DOSE LIMIT where the total would run out.
- Coast steps are capped so a beam can never sweep past between steps, and
  the prediction samples finely enough to catch it, so replays stay exact.

Prototypes: *Sunshade* (leave a planet close to a hot star from its night
side, inside its shadow, before parking in the sunlight adds up) and
*Lighthouse* (beat the pulsar's beam outward: close in one sweep is fatal,
far out it's weak).

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

### Engine work

- **Cargo dose** (built): a cargo item with `dose: Sv` is shielded aboard and,
  once released, takes radiation at its own position (belts and sources);
  over its limit it's lost and the mission fails. While it's still aboard,
  the release preview marks where it would run out (`PROBE DOSE LIMIT`),
  and the HUD shows each released item's dose.
- **L2** (checked): `hold` goals take `lagrange: { body, lead: 0, scale }`
  (scale just over 1 is L2 behind a moon, just under 1 is L1). The shade
  there is total, but L2 is unstable: a coasting ship drifts out of a 20 k
  zone in about 20 s. So missions 8 and 15 use a rendezvous with a station
  there, or a short hold (about 10 s); longer waits need small correction
  burns, which could be a skill of its own later. Solve L2 including the
  star's wobble about the barycentre, or it's about 8 k off.
- **Pulsar with deep gravity** (checked): `radiation.beam`, `pw` and
  `horizon` work together on one body. Close in, the falloff makes a beam
  hit enormous (a deep pass in the beam is instantly fatal, between sweeps
  it's free), so tune `rate` per level so the timing reads as fair.
- Maybe a **shielded tail** (less dose with the engine toward the source),
  only if playtesting wants more depth. Flares are dropped: the beam already
  covers timing.

## World 5: Homecoming (plan)

Atmospheres and landings, back to grounded spaceflight for the finale:
aerobraking and aerocapture (*Aerobrake*), skimming versus burning up, soft
landings with throttle (*Touchdown*), drag-assisted descents, and **junk
that burns up in the air counts as cleanly disposed of** (a new rule for
spent stages and cargo, today only the ship has a heat limit), which pays
off World 2's leave-no-junk missions.

## Score and leaderboards

### Score (implemented, local only)

Every completed mission earns a score (`Mission.score()` in `js/flight.js`),
shown on the result screen with your personal best:

```
score = 1000                                   completion
      + 4000 × min(1.25, par / Δv used) / 1.25 fuel efficiency (full marks at 80% of par)
      + 1000 × (1 − time / mission time limit)  speed
      +  500 if gyro assist was never used      piloting
```

Maximum 6,500, rounded to the nearest 10. Fuel dominates on purpose: it's the
skill the game teaches. Stars stay as the simple pass/fail-ish layer; score is
the optimization layer.

Ideas to fold in later: collectible-star bonuses, a precision bonus (how
centred you are in an orbit band, how soft a docking was), per-world totals.

### Leaderboards (design)

- **Boards:** per mission (best score, plus a "least Δv" board for purists),
  per world (sum of best mission scores), and a global total.
- **Identity:** a player name with no login to start; a random device ID stored
  locally. Optional sign-in later to carry progress across devices.
- **Backend:** the game is a static site on Vercel, so a small serverless API
  (Vercel Functions) with Upstash Redis (sorted sets per mission) or Postgres.
  Endpoints: `POST /api/runs` (submit), `GET /api/boards/:mission`.
- **Anti-cheat via replays:** submissions carry the *input log* (thrust,
  rotate, deploy, gyro and warp changes, timestamped in simulation time), not
  just a score. The server re-simulates the run headlessly with the same
  physics code (it already runs in Node; see `tools/`) and only accepts the
  score the replay produces. Requirements before launch:
  - Make the simulation step deterministic (fixed timestep accumulator in
    the client, inputs applied on step boundaries) so replays reproduce exactly.
  - Version the physics/levels; reject runs from an older version.
  - Rate-limit submissions per device.
- **Bonus:** stored replays enable "watch the #1 run" ghosts.

## Level maker (future)

A Mario Maker-style editor: build a system, prove it's beatable, share it.

- **Editor:** place bodies (mass, radius, spin), give them orbits (parent,
  distance, eccentricity, phase), set the ship's start, fuel and abilities,
  add objectives (impact, landing zone, orbit band, rendezvous, Lagrange hold,
  pickups, payload). Live trajectory preview while editing.
- **Prove it's solvable:** the author must complete their own level before
  publishing. The clear's replay is stored and re-simulated by the server,
  exactly like leaderboard submissions. The autopilot search in
  `tools/check-levels.js` can also flag levels that are trivially easy
  (solvable with almost no fuel) or broken.
- **Sharing:** levels are plain JSON (the same format as `js/levels.js`), so a
  share code or link can carry them before there's a server at all.
- **Publishing (later):** browse, play, rate, report; per-level leaderboards;
  featured levels. Needs moderation for names and descriptions.
