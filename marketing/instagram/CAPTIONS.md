# Instagram launch posts

Nine 1080×1350 (4:5) posts, in posting order. Posted in this order, they fill
a 3×3 grid: the logo post ends up bottom-left and the "Play" post top-right.
Gameplay images are real frames from the game (`tools/store/capture.js`).
To rebuild: `node tools/brand/instagram.js <framesDir>` (see the script header).

Shared hashtags (add to the first comment or the end of the caption):
#Thrusterz #orbitalmechanics #spacegame #physicsgame #indiegame #browsergame #rocketscience #gamedev

---

**post-01.png · Hello**
Meet Thrusterz: a flight game where you pilot a rocket under real orbital physics. Launch, reach orbit, slingshot past moons and land, one burn at a time. Free to play at thrusterz.com 🚀

**post-02.png · Real gravity**
Every planet and moon pulls on you. You get a main engine, side thrusters that set your spin, and a limited fuel tank. Gravity does the rest. Orbits, transfers and gravity assists work the way they do for real spacecraft.

**post-03.png · Trajectory prediction**
See your path before you burn. The dashed line shows where your orbit is heading, so you can line up the perfect nudge. Burn the wrong way and you'll watch it drift off course.

**post-04.png · Scoring**
Fuel is your score. Fly under par Δv for three stars, then race other pilots on the leaderboards. Every run is checked and replayed, so the scores are real. How efficient can you fly?

**post-05.png · No-Fly Zones**
Weave through asteroid fields. The No-Fly Zones world adds keep-out areas, flip burns and a tight side-thruster budget. Every turn costs fuel.

**post-06.png · Payloads**
Deploy satellites. Drop stages. In Payloads your rocket comes apart: staging, putting satellites into the right orbits, and dodging the debris you leave behind.

**post-07.png · Five worlds**
Five worlds of missions, from your first launch to grand tours:
00 Training: one control at a time
01 Flight School: orbit, land, dock, go interplanetary
02 Payloads: staging and satellites
03 No-Fly Zones: keep-out areas and asteroids
04 Pulsar: hide from sweeping radiation beams, storms and belts
No physics knowledge needed: Training teaches you as you fly.

**post-08.png · World 4: Pulsar**
Hide in the shadow. Dodge the beam. In World 4, pulsars sweep radiation round like a lighthouse: duck into a moon's shadow, time your pass between sweeps, and keep your dose under the limit. Storms, radiation belts and magnetotails join in later.

**post-09.png · Play**
Your first flight takes 20 seconds. Free, no tracking, no sign-up. Play in your browser at thrusterz.com, sideways on any phone, or get the iPhone app. Link in bio.

---

# Reels

1080×1920, 30 fps, no audio: add a track in Instagram when posting. Real
gameplay, flown by the game's own mission autopilot. The top of each frame
holds the caption; the bottom ~25% is kept clear for Instagram's buttons.
To rebuild: `node tools/brand/reel.js [trailer|liftoff|deep]` (needs ffmpeg).

**reel-trailer.mp4 · 20s · the launch trailer**
Real orbital physics, one burn at a time. Launch, orbit, thread asteroid fields, drop satellites into place and outrun a pulsar's radiation beams. Free in your browser at thrusterz.com, and on iPhone 🚀

**reel-liftoff.mp4 · 11s · launch to orbit**
From the launch pad to orbit. Burn up, tip over, and let gravity curve your path into an orbit. Use less fuel, earn more stars. Can you do it in under par?

**reel-deep.mp4 · 12s · no-fly zones and World 4**
Thread the no-fly zones, then take on World 4: a pulsar sweeps its beams round like a lighthouse, and the only safe place is the sharp shadow behind a moon. Arrive as the beam does and the shadow hides you.
