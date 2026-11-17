# Thruster Social

Content for @thrustersz (Instagram) and, later, TikTok. A scheduled task runs
Mon / Wed / Fri / Sat at 6:09pm Eastern, makes one post and puts it in the
Google Drive folder **Thrusterz social content** (owned by thrusterz.app):
the media, a caption file, and an entry in `content-log.json` there, which is
the record of everything made and posted.

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
- Check `content-log.json` before choosing: don't repeat a mission within 30 days.
- Reels are capped at 2.8 MB (`--max-mb`) so they fit a Drive upload from a session.
- Captions go in `<date> <pillar> — <name> (caption).txt` next to the media.
