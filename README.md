# Thrusterz

An orbital mechanics flight game. Pilot a rocket in real time — a fuel-limited
main engine and side thrusters for rotation — under real Newtonian gravity, and
hit your destination. Fourteen missions build up from a single launch to
interplanetary transfers, gravity assists and multi-moon tours.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```sh
npm start            # http://localhost:8080
```

Handy URL flags: `?level=N` jumps to mission N, `?unlock` unlocks every mission.

### Controls

| Key | Action |
| --- | --- |
| `Space` (hold) | Main engine |
| `A` `D` / `←` `→` | Side thrusters (rotate) |
| `W` `S` | Throttle up / down |
| `G` | Gyro assist on/off (auto-stops spin, but caps the run at ★★) |
| `,` `.` | Time warp down / up (warp drops to 1× while thrusters fire) |
| `V` | Cycle reference frame (auto / inertial / each body) |
| `F` / `O` | Follow ship / overview · mouse wheel zoom, drag pan |
| `[` `]` | Shorter / longer trajectory prediction |
| `R` · `Esc` | Restart · pause |

Touch devices get on-screen controls: rotate on the left thumb, BURN on the right,
warp / frame / gyro in the middle. Pinch to zoom.

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
- **Objectives** — impact a body, reach a zone, hold an orbit band for N
  seconds, or rendezvous (distance *and* relative speed). Missions can chain
  several objectives.
- **Stars** — 3★ for finishing under the mission's par Δv without gyro assist,
  2★ under 1.4× par.

## Missions

| # | Mission | Teaches |
| --- | --- | --- |
| 1 | Liftoff | Main engine, launch timing from a spinning asteroid (no rotation yet) |
| 2 | Point and Burn | Side thrusters, rotation and stopping a spin |
| 3 | Full Stop | Flip and burn to park next to a buoy; time warp |
| 4 | Circularize | Prograde burns; overview / follow camera |
| 5 | Deorbit | Retrograde burns |
| 6 | Turn and Burn | Hohmann transfer |
| 7 | Moonshot | Intercepting a moving moon, phasing |
| 8 | Docking | Phasing and rendezvous with a station |
| 9 | Lunar Capture | Capture burns, reference frames |
| 10 | Slingshot | Gravity assist (the gate is unreachable without one) |
| 11 | Twin Suns | Binary star system, three-body chaos |
| 12 | Interplanetary | Escape burns, transfer windows |
| 13 | Comet Chaser | Eccentric orbits |
| 14 | Grand Tour | Chained flybys of several moons |

The reference frame starts on **Auto**: it follows the body whose sphere of
influence you're in, or the star you're orbiting when you're in none.

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
