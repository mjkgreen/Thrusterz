# Thruster Social

Content for @thrustersz (Instagram) and, later, TikTok. A scheduled task runs
Mon / Wed / Fri / Sat at 6:09pm Eastern, makes one post and puts it in the
Google Drive folder **Thrusterz social content** (owned by thrusterz.app),
one subfolder per post (`<date> <pillar> — <Mission>`) holding the media
(`reel.mp4` + `cover.jpg`, or `still.jpg`), `caption.txt`,
`caption-alternatives.txt` and `post.json`.
The `post.json` files together are the record of everything made and posted
(the Drive connector can't edit a file after upload, so there's no single log).

## Content pillars (rotated so no two posts in a row share one)

| Pillar | What | Made with |
| --- | --- | --- |
| gameplay | Real autopilot flight of a mission, 15–30 s reel | `tools/social/record.js <levelId> out.mp4 --hook "…"` |
| challenge | "Can you do this in one burn?": the whole mission, uncut, with a question for a hook and the hint (not the answer) in the caption | record.js, as gameplay |
| tip | One orbital-mechanics idea the game teaches (prograde, Hohmann, gravity assist…) | still.js or a short reel |
| still | A striking single frame with a headline, 1080×1350 | `tools/social/still.js <levelId> out.jpg --at 0.5 --hook "…"` |
| feature | Something new from recent commits | read `git log` since the last feature post |

## Rules
- Real game footage only: never mock up gameplay.
- Hook in the first line and first 3 seconds; keep text out of the bottom fifth (app UI covers it).
- Caption: hook, one line of context, call to action (thrusterz.com), 5–8 hashtags.
- Caption alternatives for A/B testing: besides `caption.txt` (option A), every
  post gets `caption-alternatives.txt` with 3-4 more complete captions (B, C, D,
  E), each a different angle: a question, the physics idea, short and punchy, a
  challenge with a hint. Same rules as the main caption (true to the game, the
  call to action, 5–8 hashtags incl. #thrusterz, no em dashes). List the file in
  `post.json` `files`, and upload it before `post.json`.
- Check the `post.json` records before choosing: don't repeat a mission within 30 days.
- Reels are capped at 2.8 MB (`--max-mb`) so they fit a Drive upload from a session.
- Reels are filmed like the App Store previews: the game runs its own loop on a
  virtual clock, one video frame at a time, with the autopilot's coast steps
  split into 1/60 s pieces so the ship moves smoothly every frame.
  `leavenojunk` can't be filmed that way (its proof then misses): stills only.
- Reels are flown by a human pilot, not the bare proof (`tools/social/pilot.js`):
  turns use the side thrusters, two presses each (start the spin, stop it:
  the stopping press is held until the spin is gone, never alternated with
  speed-up presses), aimed roughly; a turn is made once, as its burn comes up,
  not held through a wait or a coast (no line-up during a wait that still has
  a coast before the burn, and a leftover spin under ~0.02 rad/s is left
  alone); short hesitations before burns and drops; long burns in two
  presses; the engine cut a touch late; a short pause after a release. Every
  take is test-flown with the filmed physics; if it misses, other takes are
  tried, then the proof's numbers are re-tuned for the human version (as
  `check-scripted.js` does), then a milder pilot. `--seed` repeats a take;
  `--exact` films the proof. Seeds differ a lot: one twinprobes take finishes
  in 170 s of game time, another in 1,400 s, so try a few `--seed`s and keep a
  short one.
- And played like a person plays: time warp in the game's steps, one key
  press at a time, back to 1× before every burn, turn and release (the game
  won't warp while thrusters fire), but not for an objective met mid-flight
  (a probe landing plays at speed; only the last objective, which ends the
  flight, slows down); the game's own messages shown; and the keys on screen
  (SPACE, A/D, E, V, . and ,). Human-paced reels run about 30-40 s
  (`--seconds`, default 32).
- Drops are planned on screen, the way a player plans them. V locks the
  reference frame on the body the player is thinking about (`focus()` in
  record.js): with cargo aboard, the body the next drop is meant for (Io for
  probe A; Rhea the moment A is gone, before the burn that re-aims); once the
  cargo is all gone, the carrier's own goal (Terra). The camera keeps the
  ship, that body and the predicted impact ("DROP NOW → IMPACT Io", label
  included) in shot while the path is lined up; the drop comes once it reads
  as a collision, then the frame and the path change straight away. Nobody
  waits to watch the probe land (a probe still in flight stays in shot only
  if that doesn't push the view much wider).
- The camera zooms like a player: out as soon as more needs to be seen, in
  only when a much closer view is called for (about 2×) and then slowly, so
  it never snaps back onto the rocket. Cargo drops get no close-up (it would
  hide the path being planned); staging gets a brief one.
- Reels carry the game's own sound: its synthesised flight music (started four
  bars in, so the melody is already playing) and the engine, thrusters,
  staging, objective and win sounds, in sync with the footage. `--no-audio`
  makes a silent reel, for adding music in the app instead.

## Reviewing a reel (owner's feedback, 2026-11-25)
- Show the whole level, uncut, with the end card and the music through it.
  Don't trim a reel with ffmpeg, even for a challenge: a challenge is the full
  reel with a question for a hook and the hint in the caption.
- Prefer missions where something is planned and dropped (cargo, stages,
  frame changes) for gameplay reels; a mission whose proof is one burn
  (homecoming) films as a dull reel with no frame change.
- Before uploading, pull a frame every 2-3 s and check: the frame (top right)
  changes to each drop's target before the drop and to the carrier's body
  after the last one; the "IMPACT <moon>" label is on screen before each drop
  and not clipped or under a HUD panel; no A/D chatter (a turn is two
  presses); warp drops to 1× only for burns, turns, releases and the finish.

## No repeats
`tools/social/plan.js` decides what's allowed, in code rather than by judgement:
- `plan.js suggest <history.json>` lists what today's post can be: pillars in
  the order they're due, missions not used recently, tip topics not yet done.
- `plan.js check <history.json> <post.json>` must print `OK` before anything
  is uploaded. It refuses a second post on the same date, the same pillar twice
  in a row, the same pillar + subject again (mission, tip `topic` or feature
  `commit`) until that pillar has used every subject, any mission within 45
  days, and a hook that shares most of its meaningful words with an earlier one.

`history.json` is every `post.json` from the Drive folder, as one JSON array.
