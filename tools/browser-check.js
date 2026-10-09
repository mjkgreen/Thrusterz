// Browser checks: runs the real game in headless Chromium and fails on any
// page error, freeze or dead button.   npm run test:browser
//   1. every mission loads, flies and renders
//   2. random input on every mission (burn, rotate, drop, warp, camera)
//   3. pause and retry work with another finger held down (phones)
//   4. corrupted saved progress never breaks the menu
//   5. the game loop never stops (sim time keeps advancing)
'use strict';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

// Served over HTTP like the website and app (WebKit won't load fonts from file://).
let URL = '';
let failed = 0;
const check = (name, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) failed++; };

(async () => {
  const server = require('./dev-server.js');
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  URL = 'http://127.0.0.1:' + server.address().port + '/index.html';
  // BROWSER=webkit runs the same checks in Safari's engine (where installed).
  const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
  const browser = await playwright[engine].launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log('engine: ' + engine);
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

  // 2b. A flight recorded by the real game loop replays identically in Node
  //     (what the leaderboard server does with a submitted run).
  {
    globalThis.Phys = globalThis.Phys || require('../js/physics.js');
    const { Mission } = require('../js/flight.js');
    const { LEVELS } = require('../js/levels.js');
    const Replay = require('../js/replay.js');
    const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    watch(p);
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(300);
    const bad = [];
    for (const i of [3, 12, 30, 36, 59]) {
      await p.evaluate((i) => { window.Thrusterz.startLevel(i); document.getElementById('gate').classList.add('hidden'); }, i);
      for (const [key, ms] of [['KeyA', 300], ['Space', 900], ['KeyD', 200], ['KeyE', 50], ['Space', 600], ['Period', 50], ['Period', 50], ['KeyG', 50]]) {
        await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key);
      }
      await p.waitForTimeout(800);
      const r = await p.evaluate(() => { const S = window.Thrusterz.state, m = S.mission; S.paused = true; return { log: JSON.parse(JSON.stringify(S.rec)), t: m.t, x: m.ship.x, y: m.ship.y, status: m.status, id: m.level.id }; });
      const L = LEVELS.find(l => l.id === r.id), m = Replay.replay(L, r.log, Mission);
      if (!(m.t === r.t && m.ship.x === r.x && m.ship.y === r.y && m.status === r.status)) bad.push(`${r.id} (browser t=${r.t} x=${r.x}, node t=${m.t} x=${m.ship.x})`);
    }
    check('flights recorded in the browser replay exactly in Node', bad.length === 0, bad.join('; '));
    await p.close();
  }

  // 3. Two-finger taps on a phone: pause and retry while BURN is held.
  //    (Raw multi-touch input needs Chromium's DevTools protocol.)
  if (engine === 'chromium') {
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

  // 3b. The bundled app page (mobile/assets/game/game.html) talking to a fake
  //     native shell: saved data handed in at launch, saves sent back, Sign in
  //     with Apple answered, haptics, no fullscreen prompt on a phone.
  if (engine === 'chromium') {
    require('./build-mobile.js');
    const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'mobile', 'assets', 'game', 'game.html'), 'utf8');
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p);
    await p.route('https://app.thrusterz.game/', r => r.fulfill({ contentType: 'text/html', body: html }));
    // Stand in for the live API (whatever js/config.js points at), so the
    // test never depends on the real server.
    const cfg = {}; new Function('window', require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'config.js'), 'utf8'))(cfg);
    await p.route(cfg.THRUSTERZ_CONFIG.apiBase.replace(/\/$/, '') + '/**', r => r.fulfill({ status: 503, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
      body: '{"error":"offline in test"}' }));
    await p.addInitScript(() => {
      window.__sent = [];
      window.__THRUSTERZ_NATIVE = { platform: 'ios', appleSignIn: true, store: { 'thrusterz.progress.v1': JSON.stringify({ stars: { liftoff: 3, point: 2 }, best: {}, unlocked: 1 }) } };
      window.ReactNativeWebView = { postMessage: (s) => {
        const m = JSON.parse(s); window.__sent.push(m);
        if (m.type === 'appleSignIn') setTimeout(() => window.__nativeReply(m.id, false, 'Sign in was cancelled'), 10);
      } };
    });
    await p.goto('https://app.thrusterz.game/');
    await p.waitForTimeout(600);
    const r = await p.evaluate(async () => {
      const gateHidden = document.getElementById('gate').classList.contains('hidden');
      const stars = document.querySelector('.wtab.active .wstars').textContent;
      let apple = null;
      try { await window.Bridge.call('appleSignIn'); } catch (e) { apple = e.message; }
      window.Thrusterz.startLevel(0);
      const m = window.Thrusterz.state.mission; m.status = 'crashed'; m.message = 'x';
      await new Promise(res => setTimeout(res, 300));
      return { gateHidden, stars, apple, sent: window.__sent.map(x => x.type + (x.key ? ':' + x.key : '') + (x.kind ? ':' + x.kind : '')) };
    });
    check('app shell: saved stars handed in at launch appear', /★ 5\/90/.test(r.stars), r.stars);
    check('app shell: no fullscreen prompt inside the app', r.gateHidden);
    check('app shell: progress is saved back to native storage', r.sent.includes('set:thrusterz.progress.v1'), r.sent.join(','));
    check('app shell: Sign in with Apple answers come back (here: cancelled)', r.apple === 'Sign in was cancelled', r.apple);
    check('app shell: a crash buzzes', r.sent.includes('haptic:heavy'), r.sent.join(','));
    const real = errors.filter(e => !/Failed to load resource/.test(e)); // the fake API's 503s
    check('app shell: no page errors', real.length === 0, real.slice(0, 3).join(' | '));
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
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
