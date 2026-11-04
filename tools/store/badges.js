// App Store Connect images for the Game Center achievements and the Shop:
//   - one 1024×1024 badge per achievement (Game Center shows them in a
//     circle, so everything sits inside one), drawn with the game's own
//     rocket art (js/skins.js);
//   - a Shop screenshot at iPhone 6.9" landscape size, for the review
//     screenshot every in-app purchase needs.
//   node tools/store/badges.js [outDir]      (default store/)
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

// The achievements, as in docs/APP_STORE.md and js/game.js (gcEarned).
// art: what's in the middle. ring: the world's colour. stars: a row of stars.
const BADGES = [
  { id: 'first_mission', ring: '#7cf7d4', art: { hull: 'classic', flame: 'standard', up: true } },
  { id: 'first_three_stars', ring: '#ffd166', art: { stars: 3 } },
  { id: 'training_complete', ring: '#8cb8ff', art: { hull: 'classic', flame: 'standard' } },
  { id: 'training_perfect', ring: '#8cb8ff', art: { hull: 'classic', flame: 'standard' }, stars: 3 },
  { id: 'world1_complete', ring: '#7cf7d4', art: { hull: 'checker', flame: 'standard' } },
  { id: 'world1_perfect', ring: '#7cf7d4', art: { hull: 'checker', flame: 'crimson' }, stars: 3 },
  { id: 'world2_complete', ring: '#b4f06a', art: { hull: 'nebula', flame: 'standard' } },
  { id: 'world2_perfect', ring: '#b4f06a', art: { hull: 'nebula', flame: 'plasma' }, stars: 3 },
  { id: 'world3_complete', ring: '#ffaa5a', art: { hull: 'hazard', flame: 'standard' } },
  { id: 'world3_perfect', ring: '#ffaa5a', art: { hull: 'hazard', flame: 'boron' }, stars: 3 },
  { id: 'world4_complete', ring: '#c8a8ff', art: { hull: 'chrome', flame: 'standard' } },
  { id: 'world4_perfect', ring: '#c8a8ff', art: { hull: 'chrome', flame: 'pulsar' }, stars: 3 },
  { id: 'stars_50', ring: '#ffd166', art: { count: 50 } },
  { id: 'stars_150', ring: '#ffd166', art: { count: 150 } },
  { id: 'stars_300', ring: '#ffd166', art: { count: 300 } },
];

// Runs in the page: draws one badge on a 1024×1024 canvas.
function drawBadge(b) {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), TAU = Math.PI * 2, R = S / 2;
  // Space backdrop with a few stars.
  const bg = g.createRadialGradient(R, R * 0.8, 40, R, R, R * 1.1);
  bg.addColorStop(0, '#1a2550'); bg.addColorStop(1, '#05060d');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  let seed = b.id.length * 97;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`; const s = 2 + rnd() * 4; g.fillRect(rnd() * S, rnd() * S, s, s); }
  // The world's ring, inside the circle Game Center crops to.
  g.lineWidth = 34; g.strokeStyle = b.ring;
  g.beginPath(); g.arc(R, R, R - 70, 0, TAU); g.stroke();
  g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.arc(R, R, R - 100, 0, TAU); g.stroke();
  const star = (x, y, r, fill) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
    g.closePath(); g.fillStyle = fill; g.fill();
    g.lineWidth = r * 0.08; g.strokeStyle = '#8a6a1a'; g.stroke();
  };
  const a = b.art;
  if (a.hull) {
    g.save();
    g.translate(R, b.stars ? R - 40 : R);
    g.rotate(a.up ? -Math.PI / 2 : -Math.PI / 5);
    // Shifted towards the nose so the flame stays inside the ring.
    g.translate(a.up ? 60 : 110, 0);
    g.scale(13, 13);
    Skins.drawFlame(g, 9, 1, Skins.FLAME[a.flame], 0, Skins.HULL[a.hull]);
    Skins.drawRocket(g, 9, false, Skins.HULL[a.hull]);
    g.restore();
  }
  if (a.stars) for (let i = 0; i < a.stars; i++) star(R + (i - 1) * 230, R + (i === 1 ? -40 : 30), i === 1 ? 150 : 120, '#ffd166');
  if (a.count) {
    star(R, R - 120, 150, '#ffd166');
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 230px "Exo 2", system-ui, sans-serif';
    g.fillText(String(a.count), R, R + 160);
  }
  if (b.stars) for (let i = 0; i < b.stars; i++) star(R + (i - 1) * 150, R + 290, i === 1 ? 70 : 60, '#ffd166');
  return c.toDataURL('image/png');
}

async function main() {
  const out = path.resolve(process.argv[2] || path.join(__dirname, '../../store'));
  const badgeDir = path.join(out, 'achievements'), shopDir = path.join(out, 'iap-review');
  fs.mkdirSync(badgeDir, { recursive: true }); fs.mkdirSync(shopDir, { recursive: true });
  const server = require('../dev-server.js');
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  // Achievement badges, drawn with the game's own code.
  const p = await browser.newPage();
  await p.goto(base + '/index.html?unlock');
  await p.waitForFunction(() => window.Skins && document.fonts.ready);
  for (const b of BADGES) {
    const url = await p.evaluate(drawBadge, b);
    fs.writeFileSync(path.join(badgeDir, `thrusterz.${b.id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(`${BADGES.length} badges → ${badgeDir}`);

  // The Shop on an iPhone 6.9" in landscape (2796×1290).
  const shop = await browser.newPage({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 3 });
  await shop.addInitScript(() => localStorage.setItem('thrusterz.welcomed', 'true'));
  await shop.goto(base + '/index.html?shopdev');
  await shop.waitForTimeout(600);
  await shop.click('#btn-shop-menu');
  await shop.waitForTimeout(800);
  await shop.screenshot({ path: path.join(shopDir, 'shop-2796x1290.png') });
  await shop.evaluate(() => document.getElementById('shop-gold').scrollIntoView({ block: 'center' }));
  await shop.waitForTimeout(400);
  await shop.screenshot({ path: path.join(shopDir, 'shop-gold-2796x1290.png') });
  await shop.evaluate(() => document.getElementById('shop-worlds').scrollIntoView({ block: 'center' }));
  await shop.waitForTimeout(400);
  await shop.screenshot({ path: path.join(shopDir, 'shop-worlds-2796x1290.png') });
  console.log(`Shop screenshots → ${shopDir}`);

  await browser.close();
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
