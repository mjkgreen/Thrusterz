# Thrusterz roadmap

Living notes on where the game goes next. World 1 (Flight School)
is complete. New mechanics are prototyped as **Test levels** in the menu before
they get a world of their own.

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
| **Prototype** | **Payload deploy** | When to release a payload so it coasts to its own target | Booster + payload with its own tiny tank. Test level: *Launch a Satellite*. Staging (dropping empty tanks) folds in here. |
| **Prototype** | **Fuel pickups** | Route planning: is the detour worth the fuel? | Canisters on their own orbits. Test level: *Fuel Run*. Also good as a mixer in any world. |
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

## World 2 plan: Payloads (draft)

Built on four sub-mechanics, each with a preview in **Test levels**:

| Sub-mechanic | What it adds | Preview level |
| --- | --- | --- |
| A. Hand-off | Drop the spent stage; control passes to the payload | Launch a Satellite |
| B. Passive drop | Release engineless cargo; it coasts along your current path (the dashed line is the release preview) while you keep flying | Release Point |
| C. Stacks | Three or more stages, each lighter than the last | Three Stages |
| D. Debris | Spent stages keep flying and can hit protected objects | Clear the Station |

Draft missions (6 per chapter): *Hand-off* (Launch a Satellite, Burn It Dry, High
Orbit, Against the Spin, Moon Probe, Lander) · *Passive drop* (Release Point,
Impactor, Relay Drop, Supply Run, Twin Probes, Constellation) · *Stacks* (Three
Stages, Kick Stage, Escape Probe, Sundiver Probe, Assist and Release, Outer
Planet) · *Debris and hazards* (Clear the Station, Busy Orbit, Ring Drop, Fuel
Depot Drop, Trojan Relay, Binary Survey) · *Grand missions* (Moon Network, Belt
Survey, Voyager, Lander + Orbiter, Deep Space Network, Grand Deployment).

Fuel pickups appear in World 2 only as an occasional mixer. Refuelling depots
(rendezvous, then top up) and control switching between craft (booster landing,
Apollo-style lander and orbiter) are saved for later worlds.

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
