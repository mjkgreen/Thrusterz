# Thrusterz

An orbital mechanics flight game. Pilot a rocket in real time — a fuel-limited
main engine and side thrusters for rotation — under real Newtonian gravity, and
hit your destination. World 1 builds up from a single launch to
interplanetary transfers, gravity assists and multi-moon tours; World 2 adds
rockets that come apart: staging, payloads and the debris they leave behind.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```sh
npm start            # http://localhost:8080
```

The menu shows one world per tab. World 1 is open from the start; each later
world opens once the world before it has earned enough stars (World 2 needs
50 of World 1's 90). Every mission inside an open world is playable, and the
first one you haven't cleared is marked *Next up*. `?unlock` opens every
world. `?level=N` jumps straight to mission N, counting across all worlds
in menu order.

### Controls

| Key | Action |
| --- | --- |
| `Space` (hold) | Main engine |
| `A` `D` / `←` `→` | Side thrusters (rotate) |
| `W` `S` | Throttle up / down |
| `G` | Gyro assist on/off (auto-stops spin, but caps the run at ★★) |
| `E` | Drop cargo, or drop the spent stage and fly the next one |
| `,` `.` | Time warp down / up (warp drops to 1× while thrusters fire) |
| `V` | Cycle reference frame (auto / inertial / each body) |
| `F` / `O` | Follow ship / overview · mouse wheel zoom, drag pan |
| `[` `]` | Shorter / longer trajectory prediction |
| `R` · `Esc` | Restart · pause |

Touch devices get on-screen controls: rotate on the left thumb, BURN on the right,
warp / frame / gyro in the middle. Pinch to zoom.

On phones the game plays in landscape and fullscreen: a portrait phone gets a
"rotate your phone" screen, and leaving fullscreen, rotating back or switching
apps pauses the mission. iPhone Safari has no fullscreen API for pages, so there
it's landscape-only; Add to Home Screen launches it fullscreen (via the web app
manifest).

New players get big contextual prompts ("Press and hold SPACE to launch",
"Still spinning! Tap D to stop", warp, reference frame). Each disappears once
you do it, and stops appearing after you've mastered it.

## Mechanics

- **Main engine** — constant thrust along the ship's nose. The tank follows the
  rocket equation (`Δv = vₑ · ln(m₀/m)`), so the ship accelerates harder as it
  gets lighter. The Δv gauge shows what's left.
- **Side thrusters (RCS)** — torque, not direct steering: they change your spin
  rate, and you keep spinning until you counter-fire. A quick tap is a fixed
  small nudge (2°/s); holding ramps up. Holding the opposite key brakes the spin
  to exactly zero and stops there. The HUD shows your spin rate. RCS propellant
  is limited. **Gyro assist** (`G`) damps the spin for you, but switching it on
  caps that run at ★★.
- **Trajectory prediction** — the dashed line is your coast path. The magenta
  marker and ghost show the closest approach to your current objective and where
  the target will be at that moment.
- **Objectives** — impact a body (optionally inside a landing zone on its
  spinning surface), reach a zone, escape past a distance, enter an orbit
  band, park at a point such as L4, or rendezvous (distance *and* relative
  speed). Missions can chain objectives.
- **Orbit goals check the whole orbit**, not where you are right now: the
  orbit's lowest and highest points (two-body orbit about the target) must
  both sit inside the band, in the required direction, confirmed for a few
  seconds with the engine off. Sweeping through the band doesn't count.
  Parking goals (L4/L5) also require matching the point's speed.
- **Stars** — 3★ for finishing under the mission's par Δv without gyro assist,
  2★ under 1.4× par.
- **Score** — up to 6,500 per mission for finishing, fuel efficiency against
  par, speed, and flying without gyro assist. Personal bests are saved locally.
- **Stages** (World 2) — rockets are stacks of stages, each with its own
  tank and engine, and each stage's Δv counts everything above it. `E` /
  DEPLOY drops the spent stage and lights the next one.
- **Cargo** (World 2) — engineless payloads (pods, relays, probes,
  satellites). `E` / DROP releases the next one with your exact position and
  velocity, so your dashed path at that moment is exactly where it goes; the
  readout says *DROP NOW → IMPACT* when it would land on target. Cargo can
  have its own objectives: land in a zone, hold an orbit, park at a Lagrange
  point, reach a station, or spread out into a constellation.
- **Debris** (World 2) — dropped stages keep flying. Their fate is computed
  when they're dropped: burn up on reentry (fine), drift clear, or threaten a
  protected object. A stage left on a bound orbit that crosses a protected
  object's orbit fails the mission at once, since it would hit eventually; the
  danger band and crossing points are shown. Some stations also have a
  keep-out zone your ship may not enter.
- **Δv used** is the Δv you actually burned, so dropping cargo (which leaves
  the rest of the ship lighter) doesn't count as saving fuel.
- **Fuel pickups** — fly through a canister to add its Δv to the current
  stage.

## Missions

**World 1 · Flight School**

| # | Mission | Teaches |
| --- | --- | --- |
| 1 | Liftoff | Main engine |
| 2 | Point and Burn | Side thrusters · rotation |
| 3 | Full Stop | Flip and burn · time warp |
| 4 | Circularize | Prograde burns · camera |
| 5 | Reach Orbit | Launching into orbit · gravity turn |
| 6 | Deorbit | Retrograde burns |
| 7 | Landing Zone | Timing a deorbit burn |
| 8 | Turn and Burn | Two-burn Hohmann transfer |
| 9 | Skimmer | Lowering an orbit |
| 10 | Wrong Way | Orbit direction · bi-elliptic transfer |
| 11 | Moonshot | Intercepting a moving target · phasing |
| 12 | Free Return | Free-return trajectory |
| 13 | Cycler | Repeating trajectories |
| 14 | Docking | Phasing · rendezvous |
| 15 | Constellation | Phasing within an orbit |
| 16 | Rescue | Rendezvous on an eccentric orbit |
| 17 | Lunar Capture | Capture burns · reference frames |
| 18 | Moon Landing | Landing on a moving, spinning moon |
| 19 | Moon to Moon | Leaving a moon · nested orbits |
| 20 | Lagrange Point | Lagrange points · co-orbital rendezvous |
| 21 | Trojan Swap | Drifting with orbital period |
| 22 | Event Horizon | Extreme Oberth effect |
| 23 | Slingshot | Gravity assists |
| 24 | Twin Suns | Three-body chaos |
| 25 | Interplanetary | Escape burns · transfer windows |
| 26 | Sundiver | Why the Sun is hard to reach |
| 27 | Asteroid Belt | Threading moving obstacles |
| 28 | Comet Chaser | Eccentric orbits · Kepler's 2nd law |
| 29 | Moon Juggler | Chained escapes and captures |
| 30 | Grand Tour | Multi-body trajectory planning |

**World 2 · Payloads**

| # | Mission | Teaches |
| --- | --- | --- |
| 1 | Launch a Satellite | Payload deploy |
| 2 | Burn It Dry | Use every stage fully |
| 3 | Against the Spin | Launch direction · retrograde orbit |
| 4 | Stationary | Synchronous orbit |
| 5 | Moon Probe | Transfer stage + capture |
| 6 | Homecoming | Return stage · targeted landing |
| 7 | Release Point | Passive drop · release timing |
| 8 | Impactor | Drop, then dodge |
| 9 | Relay Drop | Place cargo on an orbit |
| 10 | Supply Run | Throw, don't carry |
| 11 | Twin Probes | Two drops, two targets |
| 12 | Constellation | Phasing orbits |
| 13 | Three Stages | Multi-stage rockets |
| 14 | Kick Stage | Apogee kick · long, weak burns |
| 15 | Escape Velocity | Escape velocity |
| 16 | Solar Probe | Stacks for big Δv |
| 17 | Outer Planet | Interplanetary orbiter |
| 18 | Splashdown | Range safety |
| 19 | Clear the Station | Debris hazards |
| 20 | Busy Orbit | Where your booster ends up |
| 21 | Leave No Junk | Deorbiting the upper stage |
| 22 | Fuel Depot | Pickups on the way up |
| 23 | Relay Pair | Lagrange drops |
| 24 | Junkyard | Planning every drop |
| 25 | Lander and Orbiter | Targeted drop + capture |
| 26 | Deep Impact | Impactor + flyby |
| 27 | Voyager | Gravity assist with a stack |
| 28 | Moon Network | Multi-stop delivery |
| 29 | Belt Survey | Precision drops on small targets |
| 30 | Grand Deployment | Everything at once |

The reference frame starts on **Auto**: it follows the body whose sphere of
influence you're in, or the star you're orbiting when you're in none.

World 2 flies through a green nebula with distant planets in the background,
so you can always tell the worlds apart. **Test levels** prototype upcoming
mechanics (currently *Fuel Run*). See [docs/ROADMAP.md](docs/ROADMAP.md) for
future worlds, the leaderboard design and the level-maker plan.

## Physics

`js/physics.js` — G = 1, time in seconds at 1× warp.

- Celestial bodies ride analytic **Kepler rails** (circular or eccentric, solved
  with Kepler's equation), so the predictor and the actual flight agree exactly.
- **Barycentric reflex**: a massive moon and its planet both orbit their shared
  barycenter, so binary stars fall out of the same rule.
- Rails can't respond to each other the way true n-body bodies do, so the ship's
  gravity is computed **relative to its host body** (innermost sphere of
  influence): host acceleration + host pull + *tidal* pull from everything
  else. This is what the full n-body problem gives, and it keeps parking orbits
  stable instead of drifting from rails artifacts.
- Ship integration is RK4 — fixed 1/120 s steps while engines fire, adaptive
  steps while coasting (shorter near bodies, never tunnelling through them).

## Layout

```
index.html          page shell, HUD and menus
css/style.css
js/physics.js       rails, gravity, integrator, coast prediction
js/flight.js        Mission: ship, stages, cargo, debris, objectives
js/levels.js        mission definitions
js/game.js          rendering, input, HUD, menus, progress (localStorage)
fonts/              bundled fonts (offline; OFL)
tools/test-physics.js   physics sanity tests            (npm test)
tools/browser-check.js  headless Chromium: every mission under random input,
                        two-finger taps, corrupted saves (npm run test:browser)
tools/brand/            icon + share card sources; render.js regenerates img/
tools/check-levels.js   random burn search proving World 1 missions solvable
                        within their fuel budget         (npm run check-levels)
tools/autopilot.js      scripted autopilot (launch, burns, drops, deploys)
tools/proofs.js         a winning flight plan for every World 2 mission;
                        npm test flies them all
tools/check-scripted.js re-tunes a proof's parameters    (npm run check-scripted [id] [iters] [opt])
```

`physics.js`, `flight.js` and `levels.js` have no DOM dependencies and run
under Node, which is how the tools use them.

## Stability

The game loop survives a failing frame, physics and path prediction run on
per-frame time budgets (time warp steps down if a device can't keep up),
numerical blow-ups end the mission cleanly, and saved progress is validated
on load. Add `?debug` to the URL for an fps / script-time readout. Both test
suites run on every push (`.github/workflows/test.yml`). For packaging as an
iOS / Android app see [docs/APP_STORE.md](docs/APP_STORE.md).

## Roadmap

Next up (details in [docs/ROADMAP.md](docs/ROADMAP.md)):

- Orbital refuelling at a depot
- Control switching between craft (booster landing, lander and orbiter)
- Secondary (translation) thrusters for fine docking
- Soft landings (impact-speed limits)
- Autopilot holds (prograde / retrograde) as an unlockable upgrade
