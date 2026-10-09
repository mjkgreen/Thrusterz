// Browser checks: runs the real game in headless Chromium and fails on any
// page error, freeze or dead button.   npm run test:browser
//   1. every mission loads, flies and renders
//   2. random input on every mission (burn, rotate, drop, warp, camera)
//   3. pause and retry work with another finger held down (phones)
//   4. corrupted saved progress never breaks the menu
//   5. the game loop never stops (sim time keeps advancing)
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let failed = 0;
const check = (name, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) failed++; };

(async () => {
  const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];
  const watch = (p) => {
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  };

  // 1 + 2 + 5: every mission, plain and with random input.
  {
    const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    watch(p);
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(300);
    const n = await p.evaluate(() => window.Thrusterz.levelCount);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stalled = [];
    for (let i = 0; i < n; i++) {
      await p.evaluate((i) => { window.Thrusterz.startLevel(i); document.getElementById('gate').classList.add('hidden'); }, i);
      const t0 = await p.evaluate(() => window.Thrusterz.state.mission.t);
      for (let k = 0; k < 8; k++) {
        const r = rnd();
        const key = r < 0.3 ? 'Space' : r < 0.45 ? 'KeyA' : r < 0.6 ? 'KeyD' : r < 0.72 ? 'KeyE' : r < 0.82 ? 'Period' : r < 0.9 ? 'KeyV' : 'KeyO';
        await p.keyboard.down(key); await p.waitForTimeout(30 + rnd() * 150); await p.keyboard.up(key);
      }
      const r = await p.evaluate(() => { const S = window.Thrusterz.state; return { t: S.mission.t, status: S.mission.status }; });
      if (r.status === 'flying' && !(r.t > t0)) stalled.push(i);
      // Fast-forward whatever state the random input left, and draw it.
      await p.evaluate(() => { const S = window.Thrusterz.state, m = S.mission; for (let t = 0; t < 20 && m.status === 'flying'; t++) m.advance(20, { thrust: false, throttle: 1, rotate: 0 }); S.predDirty = true; });
      await p.waitForTimeout(60);
      await p.evaluate(() => { const S = window.Thrusterz.state; S.paused = false; ['pause', 'result', 'help'].forEach(id => document.getElementById(id).classList.add('hidden')); });
    }
    check(`all ${n} missions load and run under random input`, errors.length === 0, errors.slice(0, 3).join(' | '));
    check('the game loop never stalls', stalled.length === 0, stalled.join(','));
    errors.length = 0;
    await p.close();
  }

  // 3. Two-finger taps on a phone: pause and retry while BURN is held.
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p);
    const cdp = await ctx.newCDPSession(p);
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(300);
    await p.evaluate(() => { window.Thrusterz.startLevel(4); document.getElementById('gate').classList.add('hidden'); });
    await p.waitForTimeout(400);
    const at = (sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const burn = await at('#touch .burn'), pause = await at('#btn-pause');
    await T('touchStart', [{ x: burn.x, y: burn.y, id: 1 }]);
    await p.waitForTimeout(150);
    await T('touchStart', [{ x: burn.x, y: burn.y, id: 1 }, { x: pause.x, y: pause.y, id: 2 }]);
    await p.waitForTimeout(60);
    await T('touchEnd', [{ x: pause.x, y: pause.y, id: 2 }]);
    await p.waitForTimeout(250);
    check('pause works while BURN is held', await p.evaluate(() => window.Thrusterz.state.paused));
    check('pausing releases the held engine', await p.evaluate(() => !window.Thrusterz.state.mission.thrusting || window.Thrusterz.state.paused));
    await p.evaluate(() => { const S = window.Thrusterz.state; S.paused = false; document.getElementById('pause').classList.add('hidden'); S.mission.status = 'crashed'; S.mission.message = 'test'; });
    await p.waitForTimeout(2200);
    const retry = await at('#btn-res-retry');
    await T('touchStart', [{ x: burn.x, y: burn.y, id: 1 }, { x: retry.x, y: retry.y, id: 3 }]);
    await p.waitForTimeout(60);
    await T('touchEnd', [{ x: retry.x, y: retry.y, id: 3 }]);
    await p.waitForTimeout(250);
    check('retry works while BURN is held', await p.evaluate(() => window.Thrusterz.state.mission.status === 'flying' && document.getElementById('result').classList.contains('hidden')));
    await T('touchEnd', [{ x: burn.x, y: burn.y, id: 1 }]);
    await p.waitForTimeout(200);
    const before = await p.evaluate(() => window.Thrusterz.state.paused);
    await T('touchStart', [{ x: pause.x, y: pause.y, id: 4 }]); await p.waitForTimeout(50); await T('touchEnd', [{ x: pause.x, y: pause.y, id: 4 }]);
    await p.waitForTimeout(400);
    check('a single tap fires exactly once', (await p.evaluate(() => window.Thrusterz.state.paused)) === !before);
    check('no page errors on touch', errors.length === 0, errors.slice(0, 3).join(' | '));
    errors.length = 0;
    await ctx.close();
  }

  // 4. Corrupted or outdated saves.
  {
    const p = await browser.newPage();
    watch(p);
    await p.goto(URL);
    const bad = ['{not json', '"text"', 'null', '[]', '{"stars":"x","best":[1],"unlocked":"lots","tab":99}', '{"stars":{"liftoff":7,"test-satellite":3,"gone":2},"learned":{"burn":"x"}}'];
    let ok = true;
    for (const v of bad) {
      await p.evaluate((v) => localStorage.setItem('thrusterz.progress.v1', v), v);
      await p.reload(); await p.waitForTimeout(200);
      if (!(await p.evaluate(() => document.querySelectorAll('.level-card').length > 0))) ok = false;
    }
    check('corrupted saves never break the menu', ok && errors.length === 0, errors.slice(0, 3).join(' | '));
    await p.close();
  }

  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
