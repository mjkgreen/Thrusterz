# Thrusterz roadmap

Living notes on where the game goes next. World 1 (Flight School) and World 2
(Payloads) are complete. New mechanics are prototyped as **Test levels** in the
menu before they get a world of their own.

## Principles for a world mechanic

Each world adds one thing that changes how you think, is taught in a single
mission, and combines with everything before it (the Cut the Rope model).
A good mechanic here:

1. Creates a new kind of decision (timing, aim, sequencing), not just bigger numbers.
2. Is visible on screen, so the trajectory prediction can show its effect.
3. Needs at most one new button, so the phone layout stays clean.
4. Plays with gravity, the core of the game.

Early worlds stay grounded in real spaceflight; stranger ideas come later.

## Future worlds

| Status | Mechanic | The decision it adds | Notes |
| --- | --- | --- | --- |
| **Built (World 2)** | **Payloads** | When to drop a stage or release cargo, and where the pieces end up | Stages, engineless cargo, debris fates, constellations. |
| **Prototype → World 3** | **Area denial** | Where you may not go, and where something must end up | Keep-out zones and drop zones, mixed with side-thruster budgets and zero-G flying. Test levels: *Keep Out*, *Patrol*, *Wide Berth*, *Fixed Heading*, *Spin Burn*, *Asteroid Run*, *Sentry Field*. See the World 3 plan below. |
| **Prototype** | **Fuel pickups** | Route planning: is the detour worth the fuel? | Canisters on their own orbits. Test level: *Fuel Run*. Used as a mixer in World 2 (*Fuel Depot*). |
| Idea | Refuelling depot | Rendezvous to refill, then fly a mission your tank alone can't | Builds on Docking. Natural pair with pickups. |
| Idea | Atmospheres / aerobraking | How deep to skim: free braking vs. burning up | Drag layer + heating limit. No new button; a new surface to read on the predicted path. |
| Idea | Asteroid tug / planetary defense | Push a heavy mass with your small engine | Dock with a rock and redirect it off a collision course. Strong finale for a world. |
| Idea | Soft landings | Throttle control for a gentle touchdown | Impact-speed limit, landing legs, terrain. |
| Idea | Solar sail | Steer with sunlight, no fuel at all | Slow spiral trajectories; uses only the rotate controls. |
| Idea | Ion engine | Very low thrust for very long burns | Spirals instead of impulsive burns. |
| Idea | Precision docking | Fine translation thrusters for the last few meters | More buttons; needs a careful mobile design. |
| Idea | Hazards | Radiation belts (time limits), solar flares, debris | Mixers rather than a whole world. |
| Idea | Tether / grapple | Swing around an anchor and release at the right moment | Parked for now: less grounded than the early worlds. |
| Idea | Wormholes | Enter one, exit another with the same velocity | Sci-fi; breaks the real-physics identity, so late or never. |
| Idea | Collectible stars | Fly a route that grabs three stars along the way | Cut the Rope-style replay layer that works in every world, including World 1. |

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

## World 3: No-Fly Zones (planned)

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
