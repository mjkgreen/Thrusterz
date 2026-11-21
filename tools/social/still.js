// A single real game frame for a feed post (1080×1350, 4:5), with a headline.
//   node tools/social/still.js <levelId> <out.jpg> [--at 0.55] [--hook "text"] [--story]
// --at: where in the flight, as a fraction of the proof's length (0–1).
// --story: 1080×1920 instead (stories, TikTok photo posts).
'use strict';
const cap = require('../store/capture.js');
const { timeline, dress, direct, nextFrames } = require('./record.js');

cap.DEVICES.feed = { viewport: { width: 432, height: 540 }, deviceScaleFactor: 2.5 };
cap.DEVICES.reel = cap.DEVICES.reel || { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5 };

async function still(o) {
  const { page, close } = await cap.open(o.story ? 'reel' : 'feed');
  try {
    await cap.setup(page);
    const tl = await page.evaluate(timeline, [o.id, 1, false]);
    await page.evaluate(dress, o.hook || '');
    await page.evaluate(`window.__direct = ${direct.toString()}`);
    // Let the camera settle on the moment, as it would in a reel.
    const t = Math.max(1e-3, tl.tEnd * (o.at == null ? 0.55 : o.at));
    for (let k = 12; k >= 0; k--) {
      await page.evaluate(([id, t, first]) => { window.__stage(id, t, 0); window.Thrusterz.state.paused = true; window.__direct(first); window.Thrusterz.refreshHud(); },
        [o.id, Math.max(1e-3, t - k * 0.4), k === 12]);
    }
    await page.addStyleTag({ content: '#reel-hook { top: 21.5% !important; }' });
    await nextFrames(page);
    await page.screenshot({ path: o.out, type: 'jpeg', quality: 92 });
    return { level: o.id, name: tl.name, file: o.out, t: +t.toFixed(1) };
  } finally { await close(); }
}

module.exports = { still };

if (require.main === module) {
  const a = process.argv.slice(2), o = { id: a.shift(), out: a.shift() };
  while (a.length) { const k = a.shift(); if (k === '--at') o.at = +a.shift(); else if (k === '--hook') o.hook = a.shift(); else if (k === '--story') o.story = true; }
  still(o).then(i => console.log(JSON.stringify(i))).catch(e => { console.error(e); process.exit(1); });
}
