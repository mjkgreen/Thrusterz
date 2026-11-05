// Instagram reels (1080×1920, 30 fps): real gameplay flown by the mission
// proofs (tools/proofs.js), captioned, between brand cards from reel.html.
//   node tools/brand/reel.js [reelName ...] [--out dir]   (default marketing/instagram/reels)
// Each gameplay frame re-flies the mission to that moment (the sim is
// deterministic), so clips are exact but slow to capture: a few minutes a reel.
// Needs Playwright with Chromium, and ffmpeg on the PATH.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const cap = require('../store/capture.js');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const FPS = 30;
// A clip flies mission `id` from sim time `from` to `to` over `secs` seconds of video.
// A card holds a reel.html card for `secs`.
const REELS = {
  trailer: [
    { card: 'open', secs: 1.6 },
    { id: 'apollo', from: 4, to: 26, secs: 3.2, eyebrow: 'Real Newtonian gravity', title: 'Every planet pulls on you.' },
    { id: 'nofly', from: 30, to: 70, secs: 3.2, eyebrow: 'Live trajectory prediction', title: 'See your path before you burn.' },
    { id: 'asteroidrun', from: 22, to: 50, secs: 3.2, eyebrow: 'No-Fly Zones', title: 'Weave through asteroid fields.' },
    { id: 'granddeploy', from: 120, to: 175, secs: 3.2, eyebrow: 'Payloads', title: 'Deploy satellites. Drop stages.' },
    { id: 'widdershins', from: 5, to: 160, secs: 3.4, eyebrow: 'World 4 · Pulsar', title: 'Outrun the radiation beams.' },
    { card: 'end', secs: 2.6 },
  ],
  liftoff: [
    { id: 'satellite', from: 0, to: 60, secs: 7, eyebrow: 'Launch a satellite', title: 'From the launch pad to orbit.' },
    { card: 'score', secs: 2 },
    { card: 'end', secs: 2.4 },
  ],
  deep: [
    { id: 'longhaul', from: 60, to: 160, secs: 4.5, eyebrow: 'The Long Haul', title: 'Thread the no-fly zones.' },
    { id: 'beacon', from: 2, to: 140, secs: 5, eyebrow: 'World 4 · Pulsar', title: 'Hide in the shadow. Dodge the beam.' },
    { card: 'end', secs: 2.4 },
  ],
};

cap.DEVICES.reel = { viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 };

const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const encode = (input, out, secs) => run([...input, '-t', String(secs), '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out]);

(async () => {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const outDir = path.resolve(oi >= 0 ? argv.splice(oi, 2)[1] : path.join(__dirname, '../../marketing/instagram/reels'));
  const names = argv.length ? argv : Object.keys(REELS);
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));

  // Cards and caption overlays from reel.html.
  const browser = await playwright.chromium.launch({ args: ['--allow-file-access-from-files'] });
  const ov = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await ov.goto('file://' + path.join(__dirname, 'reel.html'));
  await ov.evaluate(() => document.fonts.ready);
  await ov.waitForTimeout(800);
  const still = async (id, file) => (await ov.$('#' + id)).screenshot({ path: file, omitBackground: true });

  const { page, close } = await cap.open('reel');
  await cap.setup(page);
  // Gameplay only: the reel's caption replaces the HUD.
  await page.addStyleTag({ content: '#hud, #coach, #toast, #alert, #edge-alert { display: none !important; }' });

  for (const name of names) {
    const parts = [];
    for (const [k, seg] of REELS[name].entries()) {
      const part = path.join(tmp, `${name}-${k}.mp4`);
      if (seg.card) {
        const png = path.join(tmp, `card-${seg.card}.png`);
        if (!fs.existsSync(png)) await still('card-' + seg.card, png);
        encode(['-loop', '1', '-i', png, '-vf', `fade=in:st=0:d=0.25,fade=out:st=${seg.secs - 0.25}:d=0.25`], part, seg.secs);
      } else {
        const dir = path.join(tmp, `${name}-${k}`);
        fs.mkdirSync(dir);
        const n = Math.round(seg.secs * FPS);
        for (let f = 0; f < n; f++) {
          const t = seg.from + (seg.to - seg.from) * f / (n - 1);
          const burning = await page.evaluate(([id, t]) => { window.__stage(id, t, 0); return !!window.Thrusterz.state.mission.__thrust; }, [seg.id, t]);
          if (burning) await page.keyboard.down('Space');
          await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
          await page.screenshot({ path: path.join(dir, `f${String(f).padStart(4, '0')}.png`) });
          if (burning) await page.keyboard.up('Space');
        }
        await ov.evaluate(([a, b]) => window.setCaption(a, b), [seg.eyebrow, seg.title]);
        const capPng = path.join(tmp, `${name}-${k}-cap.png`);
        await still('cap', capPng);
        encode(['-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'), '-i', capPng,
          '-filter_complex', `[0][1]overlay,fade=in:st=0:d=0.2,fade=out:st=${seg.secs - 0.2}:d=0.2`], part, seg.secs);
      }
      parts.push(part);
      console.log(name, k, seg.card || seg.id);
    }
    const list = path.join(tmp, `${name}.txt`);
    fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
    const out = path.join(outDir, `reel-${name}.mp4`);
    run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
    console.log('wrote', out);
  }
  await close();
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
