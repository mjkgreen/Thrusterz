# Thruster Social

Content for @thrustersz (Instagram) and, later, TikTok. A scheduled task runs
Mon / Wed / Fri / Sat, makes one post, and records it in `content-log.json`.

## Content pillars (rotated so no two posts in a row share one)

| Pillar | What | Made with |
| --- | --- | --- |
| gameplay | Real autopilot flight of a mission, 15–30 s reel | `tools/social/record.js <levelId> out.mp4 --hook "…"` |
| challenge | "Can you do this in one burn?": a mission's setup, cut before the answer | record.js with a shorter `--seconds` |
| tip | One orbital-mechanics idea the game teaches (prograde, Hohmann, gravity assist…) | still or short reel |
| still | A striking single frame with a caption | `tools/store/capture.js` |
| feature | Something new from recent commits | read `git log` since the last feature post |

## Rules
- Real game footage only: never mock up gameplay.
- Hook in the first line and first 3 seconds; keep text out of the bottom fifth (app UI covers it).
- Caption: hook, one line of context, call to action (thrusterz.com), 5–8 hashtags.
- Check `content-log.json` before choosing: don't repeat a mission within 30 days.
