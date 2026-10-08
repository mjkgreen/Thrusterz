# Thrusterz

An orbital mechanics flight game. Pilot a rocket in real time — a fuel-limited
main engine and side thrusters for rotation — under real Newtonian gravity, and
hit your destination. Thirty-one missions build up from a single launch to
interplanetary transfers, gravity assists and multi-moon tours.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```sh
npm start            # http://localhost:8080
```

Every mission is open from the start; the first one you haven't cleared is marked
*Next up*. `?level=N` jumps straight to mission N.

### Controls

| Key | Action |
| --- | --- |
| `Space` (hold) | Main engine |
| `A` `D` / `←` `→` | Side thrusters (rotate) |
| `W` `S` | Throttle up / down |
| `G` | Gyro assist on/off (auto-stops spin, but caps the run at ★★) |
| `E` | Deploy payload (when carrying one) |
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
  spinning surface), reach a zone, escape past a distance, hold an orbit band
  (optionally in a set direction) or a point such as L4 for N seconds, or
  rendezvous (distance *and* relative speed). Missions can chain objectives.
- **Stars** — 3★ for finishing under the mission's par Δv without gyro assist,
  2★ under 1.4× par.
- **Score** — up to 6,500 per mission for finishing, fuel efficiency against
  par, speed, and flying without gyro assist. Personal bests are saved locally.
- **Payload deploy** (test level) — a booster carries a light payload with its
  own tiny tank. `E` / DEPLOY drops the spent booster (it keeps falling as
  debris) and hands control to the payload.
- **Fuel pickups** (test level) — fly through a canister to add its Δv.

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
| 28 | Ringside | Orbit insertion through obstacles |
| 29 | Comet Chaser | Eccentric orbits · Kepler's 2nd law |
| 30 | Moon Juggler | Chained escapes and captures |
| 31 | Grand Tour | Multi-body trajectory planning |

The reference frame starts on **Auto**: it follows the body whose sphere of
influence you're in, or the star you're orbiting when you're in none.

**Test levels:** *Launch a Satellite* (payload deploy, with separate Booster and Satellite fuel gauges) and *Fuel Run* (fuel
pickups) prototype the next mechanics. See [docs/ROADMAP.md](docs/ROADMAP.md) for
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
js/flight.js        Mission: ship, engines, staging-ready mass model, objectives
js/levels.js        mission definitions
js/game.js          rendering, input, HUD, menus, progress (localStorage)
tools/test-physics.js   physics sanity tests            (npm test)
tools/check-levels.js   autopilot search proving each mission is solvable
                        within its fuel budget           (npm run check-levels)
```

`physics.js`, `flight.js` and `levels.js` have no DOM dependencies and run
under Node, which is how the tools use them.

## Roadmap

The ship is modelled as a list of stages, so these slot in next:

- Staging / jettisoning an empty tank
- Orbital refuelling at a depot
- Secondary (translation) thrusters for fine docking
- Soft landings (impact-speed limits)
- Autopilot holds (prograde / retrograde) as an unlockable upgrade
