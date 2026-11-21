# Thruster Social

Content for @thrustersz (Instagram) and, later, TikTok. A scheduled task runs
Mon / Wed / Fri / Sat at 6:09pm Eastern, makes one post and puts it in the
Google Drive folder **Thrusterz social content** (owned by thrusterz.app),
one subfolder per post (`<date> <pillar> — <Mission>`) holding the media
(`reel.mp4` + `cover.jpg`, or `still.jpg`), `caption.txt` and `post.json`.
The `post.json` files together are the record of everything made and posted
(the Drive connector can't edit a file after upload, so there's no single log).

## Content pillars (rotated so no two posts in a row share one)

| Pillar | What | Made with |
| --- | --- | --- |
| gameplay | Real autopilot flight of a mission, 15–30 s reel | `tools/social/record.js <levelId> out.mp4 --hook "…"` |
| challenge | "Can you do this in one burn?": a mission's setup, cut before the answer | record.js with a shorter `--seconds` |
| tip | One orbital-mechanics idea the game teaches (prograde, Hohmann, gravity assist…) | still.js or a short reel |
| still | A striking single frame with a headline, 1080×1350 | `tools/social/still.js <levelId> out.jpg --at 0.5 --hook "…"` |
| feature | Something new from recent commits | read `git log` since the last feature post |

## Rules
- Real game footage only: never mock up gameplay.
- Hook in the first line and first 3 seconds; keep text out of the bottom fifth (app UI covers it).
- Caption: hook, one line of context, call to action (thrusterz.com), 5–8 hashtags.
- Check the `post.json` records before choosing: don't repeat a mission within 30 days.
- Reels are capped at 2.8 MB (`--max-mb`) so they fit a Drive upload from a session.
- Reels are filmed like the App Store previews: the game runs its own loop on a
  virtual clock, one video frame at a time, with the autopilot's coast steps
  split into 1/60 s pieces so the ship moves smoothly every frame.
  `leavenojunk` can't be filmed that way (its proof then misses): stills only.
- Reels are flown by a human pilot, not the bare proof (`tools/social/pilot.js`):
  turns use the side thrusters, two presses each (start the spin, stop it),
  aimed roughly and lined up just before a burn; short hesitations before
  burns and drops; long burns in two presses; the engine cut a touch late;
  a pause after a release to watch it go. Every take is test-flown with the
  filmed physics; if it misses, other takes are tried, then the proof's
  numbers are re-tuned for the human version (as `check-scripted.js` does),
  then a milder pilot. `--seed` repeats a take; `--exact` films the proof.
- And played like a person plays: time warp in the game's steps, one key
  press at a time, back to 1× before every burn, turn and release (the game
  won't warp while thrusters fire); V pressed to lock the reference frame on
  the body a release is aimed at; a close-up around releases; the game's
  own messages shown; and the keys on screen (SPACE, A/D, E, V, . and ,).
  Human-paced reels run about 30-40 s (`--seconds`, default 32).
- Reels carry the game's own sound: its synthesised flight music (started four
  bars in, so the melody is already playing) and the engine, thrusters,
  staging, objective and win sounds, in sync with the footage. `--no-audio`
  makes a silent reel, for adding music in the app instead.

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
