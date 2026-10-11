# App Store listing

Everything to paste into App Store Connect (App Store tab → the version, and
App Information). Character counts are checked against Apple's limits.

Images and videos are generated from the game itself:

```sh
node tools/store/make.js       # store/screenshots: iphone63-, iphone- and ipad-01…08.png
node tools/store/preview.js    # store/previews: preview-iphone.mp4, preview-ipad.mp4
```

(`store/` is not committed; run these again after the game changes.)

## Product page header (what search results show)

Search results show the **icon, name, subtitle**, the rating, and the first
**app preview** (it autoplays muted) or, without one, the first screenshot.
Landscape media shows one at a time, so preview and screenshot 1 carry the
page.

| Field | Text | Limit |
| --- | --- | --- |
| **Name** | Thrusterz: Orbital Physics | 26 / 30 |
| **Subtitle** | Launch, orbit, slingshot, land | 30 / 30 |

The name's words count for search, so "Orbital Physics" earns its place.
If you'd rather keep the name pure, use **Thrusterz** and move "orbital" and
"physics" into the keywords (dropping "astronomy,science").

## Keywords (100 / 100)

```
rocket,space,spaceflight,gravity,simulator,planet,moon,satellite,lander,trajectory,astronomy,science
```

- Commas, no spaces; Apple already indexes the name and subtitle, so words
  there (orbit, orbital, physics, launch, slingshot, land) aren't repeated.
- No other games' names (Apple rejects competitor names in keywords).

## Promotional text (153 / 170)

Can be changed any time without a new version.

```
Ninety missions of real rocket science: launch, reach orbit, drop stages, dodge no-fly zones and land on the Moon. Plan every burn and chase three stars.
```

## Description

```
Fly a rocket by the real laws of orbital mechanics.

Thrusterz is a puzzle game about spaceflight. Every mission is a small problem in gravity: reach orbit, catch a moon, drop a satellite exactly where it belongs, or slingshot past a planet on the fuel you have left. There's no autopilot. Point, burn, and watch your predicted path bend.

LEARN BY FLYING
• Start with a single burn and work up to transfers, rendezvous, gravity assists, Lagrange points and landings.
• The predicted trajectory updates live as you thrust, so you see what every burn does before you commit.
• Time warp, a gyro assist, and camera frames that follow the planet or the stars keep long flights easy to read.

THREE WORLDS, 90 MISSIONS
• Flight School: the fundamentals, from liftoff to a grand tour of the system.
• Payloads: rocket stages, satellites, probes and landers. Decide when to drop each stage and where every piece ends up, and don't leave junk in the way.
• No-Fly Zones: keep-out areas, asteroid fields, flip burns on a limited side-thruster budget, and missions that put it all together.
• Experimental levels: black holes, wormholes, solar sails, ion engines, tethers, aerobraking and more.

CHASE THE PERFECT FLIGHT
• Earn up to three stars on every mission for flying efficiently.
• Every run gets a score for fuel, time and piloting.
• Compete on leaderboards for each mission and each world. Runs are replayed on the server, so the scores are real.

MADE FOR YOUR PHONE
• Touch controls designed for landscape, plus full keyboard support on iPad.
• Plays offline. Your progress is saved to the cloud and can be restored with a code or Sign in with Apple.
• Music and sound effects with separate volume controls.
• No ads and no in-app purchases.

Real physics, simple controls, and a satisfying "aha" in every mission. Strap in.
```

(1,827 of 4,000 characters.)

## Screenshots (upload in this order)

App Store Connect requires the **6.3" iPhone** set ("iPhone with Dynamic
Island, medium display": `iphone63-NN.png`, 2622×1206) and the **13" iPad**
set (`ipad-NN.png`, 2752×2064). The **6.9"** set (`iphone-NN.png`,
2868×1320) is optional, for the largest iPhones. Up to 10 each; these are 8.
The iPhone preview (1920×886) fits both iPhone sizes.

| # | File | Caption | Shows |
| --- | --- | --- | --- |
| 1 | `iphone63-01.png` / `ipad-01.png` | Fly by real orbital physics | Lander and Orbiter: burning toward the Moon |
| 2 | `-02` | See your path before you burn | No-Fly Zone: predicted path around keep-out zones |
| 3 | `-03` | Deploy satellites, drop stages | Grand Deployment: orbits around Gaia |
| 4 | `-04` | Thread the no-fly zones | The Long Haul |
| 5 | `-05` | Weave through asteroid fields | Asteroid Run |
| 6 | `-06` | Black holes and wormholes | Whirl (experimental) |
| 7 | `-07` | 90 missions in three worlds | The mission menu |
| 8 | `-08` | Earn stars, top the leaderboards | Mission complete, three stars |

## App previews

`preview-iphone.mp4` (1920×886) and `preview-ipad.mp4` (1600×1200): 29.8 s,
30 fps, H.264, with a silent stereo track. Real gameplay at the warp shown
on screen: a satellite launch, the asteroid field, a wormhole jump, and a
Moon landing that ends on "Mission complete".

- Upload each as the **first** item in its media set, so it leads the page and
  search results.
- **Poster frame:** pick around 0:02 (the launch with "Launch on real orbital
  physics"), or 0:29 (the three stars).
- Apple only accepts previews made from the app itself, which these are.

## Other fields

| Field | Value |
| --- | --- |
| Primary category | Games → Simulation |
| Secondary category | Games → Puzzle |
| Age rating | 4+ (no objectionable content; the questionnaire is all "None") |
| Price | Free |
| Support URL | https://thrusterz.com/support.html |
| Marketing URL | https://thrusterz.com |
| Privacy policy URL | https://thrusterz.com/privacy.html |
| Copyright | 2026 (your name or company) |
| What's New (1.0) | First release. Ninety missions across three worlds, leaderboards and experimental levels. |

App Privacy answers and review notes are in `docs/APP_STORE.md` step 5.

## Header and search-result artwork

`node tools/store/art.js` writes `store/art/`: real game scenes, HUD hidden,
no text (the App Store lays the name and Get button over these).

| Slot | Files |
| --- | --- |
| Header (5244×2950 or 3840×1646) | `header-5244x2950.png`, `header-3840x1646.png`: Lander and Orbiter, engine lit between Terra and Luna |
| Search result (5244×2950, 3840×2560 or 1920×1280) | `search-5244x2950.png`, `search-3840x2560.png`, `search-1920x1280.png`: Grand Deployment, orbit rings around Gaia |
