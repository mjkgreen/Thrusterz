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
      let r = await p.evaluate(() => { const S = window.Thrusterz.state; return { t: S.mission.t, status: S.mission.status, paused: S.paused }; });
      // A stray window blur (headless WebKit sends them) pauses the mission on
      // purpose. That isn't a stall, but the loop must run again once unpaused.
      if (r.status === 'flying' && !(r.t > t0) && r.paused) {
        await p.evaluate(() => { window.Thrusterz.state.paused = false; document.getElementById('pause').classList.add('hidden'); });
        await p.waitForTimeout(400);
        r = await p.evaluate(() => { const S = window.Thrusterz.state; return { t: S.mission.t, status: S.mission.status, paused: S.paused }; });
      }
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

  // 3c. Phones: held upright, the game is drawn sideways (no "rotate your
  //     phone" screen), and every briefing fits with Launch on screen.
  for (const [w, h] of [[390, 844], [740, 360]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p);
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(500);
    const r = await p.evaluate(async () => {
      const T = window.Thrusterz, lh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lh')) || innerHeight;
      const over = [];
      for (let i = 0; i < T.levelCount; i++) {
        T.showBriefing(i);
        await new Promise(r => requestAnimationFrame(r));
        const b = document.getElementById('btn-brief-go').getBoundingClientRect();
        if (b.bottom > innerHeight + 1 || b.right > innerWidth + 1 || b.top < -1 || b.left < -1) over.push(i + 1);
      }
      // A full leaderboard (20 rows) still shows its Done button.
      document.getElementById('briefing').classList.add('hidden');
      document.getElementById('board').classList.remove('hidden');
      document.getElementById('board-list').innerHTML = Array.from({ length: 20 }, (_, i) => `<li><span class="rk">#${i + 1}</span><span class="nm">Pilot</span><span>4,780</span></li>`).join('');
      await new Promise(r => requestAnimationFrame(r));
      const d = document.getElementById('btn-board-close').getBoundingClientRect();
      if (d.bottom > innerHeight + 1 || d.right > innerWidth + 1 || d.top < -1 || d.left < -1) over.push('board');
      document.getElementById('board').classList.add('hidden');
      const c = document.querySelector('canvas');
      return { rotated: document.documentElement.classList.contains('rotated'), cw: c.clientWidth, ch: c.clientHeight, over: over.join(','), lh, gate: document.getElementById('gate').dataset.reason || '' };
    });
    if (h > w) check('a phone held upright plays sideways (no rotate screen)', r.rotated && r.cw === h && r.ch === w && r.gate !== 'rotate', JSON.stringify(r));
    check(`${w}x${h}: every briefing's Launch button (and a full leaderboard's Done) is on screen`, r.over === '', r.over);
    await ctx.close();
    errors.length = 0;
  }

  // 3d. A tap that closes a screen must not also hit what appears under it
  //     (Settings' Done sits over a level card on the menu).
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p);
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(400);
    await p.evaluate(() => { document.getElementById('gate').classList.add('hidden'); document.getElementById('btn-settings-menu').click(); });
    await p.waitForTimeout(200);
    await p.tap('#btn-settings-close');
    await p.waitForTimeout(500);
    const brief = await p.isVisible('#briefing'), menu = await p.isVisible('#menu');
    check('closing a screen with a tap does not tap what is underneath', menu && !brief, `menu ${menu} briefing ${brief}`);
    await ctx.close();
    errors.length = 0;
  }

  // 3. First visit (as a real browser, not an automated one): the landing
  //    page, Play straight into the first mission, the pilot name asked only
  //    after the first win, then on to the next mission; a return visit goes
  //    straight to the menu.
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 } });
    await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
    // The win below is faked, so the server's replay check would refuse the run.
    await ctx.route('**/api/runs', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage();
    watch(p);
    await p.goto(URL);
    await p.waitForTimeout(300);
    const landing = await p.isVisible('#landing') && !(await p.isVisible('#menu'));
    await p.click('#btn-ld-play');
    const flying = await p.evaluate(() => window.Thrusterz.state.screen === 'flight' && window.Thrusterz.state.levelIndex === 0 && document.getElementById('landing').classList.contains('hidden'));
    await p.evaluate(() => { const m = window.Thrusterz.state.mission; m.status = 'won'; });
    await p.waitForSelector('#result:not(.hidden)', { timeout: 5000 }).catch(() => {});
    await p.click('#btn-res-next');
    const asked = await p.isVisible('#welcome');
    await p.click('#btn-wl-skip');
    const nextBrief = await p.isVisible('#briefing') && await p.evaluate(() => window.Thrusterz.state.levelIndex === 1);
    await p.reload(); await p.waitForTimeout(300);
    const back = await p.isVisible('#menu') && !(await p.isVisible('#landing'));
    check('first visit: landing, Play flies mission 1, name asked after the first win, return visit goes to the menu', landing && flying && asked && nextBrief && back && errors.length === 0, JSON.stringify({ landing, flying, asked, nextBrief, back }) + ' ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
    errors.length = 0;
  }

  // 3a. First launch: a new pilot is asked for a name and gets a restore code.
  {
    const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    watch(p);
    await p.goto(URL + '?welcome');
    await p.waitForTimeout(600);
    const shown = await p.isVisible('#welcome');
    await p.fill('#wl-name', 'Test Pilot'); await p.click('#btn-wl-save');
    await p.waitForSelector('#wl-done:not(.hidden)', { timeout: 5000 }).catch(() => {});
    const code = await p.textContent('#wl-code');
    await p.click('#btn-wl-go'); await p.waitForTimeout(200);
    check('first launch asks for a name and hands out a restore code', shown && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code) && await p.isVisible('#menu'), code);
    await p.close();
    errors.length = 0;
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
    check('app shell: saved stars handed in at launch appear', /★ 5\/21/.test(r.stars), r.stars);
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

  // 5. Auto frame and auto zoom can be turned off: the frame stays on the
  //    body you start around, and following the ship keeps your zoom.
  {
    const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    watch(p);
    await p.addInitScript(() => localStorage.setItem('thrusterz.settings', JSON.stringify({ autoFrame: false, autoZoom: false })));
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const T = window.Thrusterz, S = T.state;
      T.startLevel(T.state ? window.Levels.LEVELS.findIndex(l => l.id === 'moonshot') : 0);
      document.getElementById('gate').classList.add('hidden');
      const frame = S.frameMode;
      // Zoom out, then ask to follow: the zoom must stay where it is.
      S.cam.follow = false; S.cam.zoom = S.cam.tzoom = 0.05;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
      await new Promise(res => setTimeout(res, 200));
      return { frame, tzoom: S.cam.tzoom, follow: S.cam.follow };
    });
    check('with Auto frame and Auto zoom off, the frame is fixed and following keeps your zoom',
      typeof r.frame === 'number' && r.tzoom === 0.05 && r.follow && errors.length === 0, JSON.stringify(r) + ' ' + errors.slice(0, 2).join(' | '));
    errors.length = 0;
    await p.close();
  }

  // 6. Tilt to steer: on by default (said once); tipping the phone fires the side
  //    thrusters like holding ⟲ / ⟳, the buttons still work and win, and
  //    the steering maths reads a landscape phone the right way round.
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p);
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const T = window.Thrusterz, S = T.state, wait = (ms) => new Promise(res => setTimeout(res, ms));
      const deg = Math.PI / 180, out = {};
      // Beta/gamma that steer by phi on this screen (search; for fake readings).
      const steerOf = (phi, screen) => {
        let best = null;
        for (let b = -180; b < 180; b += 1) for (let g = -90; g < 90; g += 1) {
          const a = T.tiltAngle(b, g, screen);
          if (a == null) continue;
          const err = Math.abs(a - phi);
          if (!best || err < best.err) best = { b, g, err };
        }
        return best;
      };
      // Screen turned 90° (landscape): the device's +x edge points up. Held
      // upright with the right side 20° down, gravity in device axes is
      // (-cos 20°, -sin 20°, 0); invert the spec's gravity = (cos b sin g,
      // -sin b, -cos b cos g) for the beta/gamma that give it.
      const gx = -Math.cos(20 * deg), gy = -Math.sin(20 * deg); // device axes, gz = 0
      const b = Math.asin(-gy) / deg, g = Math.asin(gx / Math.cos(b * deg)) / deg;
      out.landscapeRight = T.tiltAngle(b, g, 90) / deg;
      out.flat = T.tiltAngle(0, 0, 0);
      out.portraitRight = T.tiltAngle(60, 20, 0) / deg;
      // In flight, with tilt on: fake readings for the current screen angle.
      const sa = screen.orientation ? screen.orientation.angle : 0;
      const right = steerOf(25 * deg, sa), level = steerOf(0, sa);
      T.startLevel(window.Levels.LEVELS.findIndex(l => l.id === 'point'));
      document.getElementById('gate').classList.add('hidden');
      const send = (o) => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 0, beta: o.b, gamma: o.g }));
      out.onByDefault = T.settings.tilt === true;
      // With readings coming in, the first mission says once that tilt is on.
      const keep = setInterval(() => send(level), 50);
      await wait(2800);
      out.noticeShown = /Tilt to steer is on/.test(document.getElementById('toast').textContent);
      // Off and back on the way a player does (readings must arrive to keep it on).
      const sw = document.querySelector('#settings .toggle[data-set="tilt"]');
      sw.click(); await wait(50);
      out.switchedOff = T.settings.tilt === false && sw.getAttribute('aria-pressed') === 'false';
      sw.click(); await wait(1700);
      clearInterval(keep);
      out.switchedOn = T.settings.tilt === true && sw.getAttribute('aria-pressed') === 'true';
      const keepR = setInterval(() => send(right), 30);
      await wait(100);
      out.tiltRotate = T.controls().rotate;
      const w0 = S.mission.ship.omega;
      await wait(500);
      out.spunRight = S.mission.ship.omega < w0 - 0.05;
      out.buttonLit = document.querySelector('#touch [data-key="rotR"]').classList.contains('tilt-on');
      out.buttonsVisible = getComputedStyle(document.querySelector('#touch [data-key="rotL"]')).visibility !== 'hidden';
      // A held button wins over tilt.
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
      out.buttonWins = T.controls().rotate === 1;
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
      clearInterval(keepR);
      // Readings stop (or the switch goes off): no rotation.
      await wait(600);
      out.staleIsZero = T.controls().rotate === 0;
      sw.click(); await wait(50);
      send(right);
      out.offIsZero = T.settings.tilt === false && T.controls().rotate === 0;
      return out;
    });
    check('tilt: the steering angle reads a landscape phone the right way round',
      Math.abs(r.landscapeRight - 20) < 0.5 && Math.abs(r.portraitRight - 0) > 5 && r.portraitRight > 0 && r.flat === null, JSON.stringify(r));
    check('tilt: on by default with a one-time note, and switches off and on in Settings', r.onByDefault && r.noticeShown && r.switchedOff && r.switchedOn, JSON.stringify(r));
    check('tilt: tipping right fires the right thruster and lights ⟳', r.tiltRotate === -1 && r.spunRight && r.buttonLit && r.buttonsVisible, JSON.stringify(r));
    check('tilt: the buttons still work and win', r.buttonWins, JSON.stringify(r));
    check('tilt: no readings or switched off means no rotation', r.staleIsZero && r.offIsZero, JSON.stringify(r));
    check('no page errors with tilt', errors.length === 0, errors.slice(0, 3).join(' | '));
    errors.length = 0;
    await ctx.close();
  }

  // 7. Storm Warning: the bottom-centre warning escalates (steady, then
  //    flashing in the last minute) and reports the storm while it blows.
  {
    const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    watch(p);
    await p.goto(URL + '?unlock');
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const T = window.Thrusterz, S = T.state, wait = (ms) => new Promise(res => setTimeout(res, ms));
      T.startLevel(window.Levels.LEVELS.findIndex(l => l.id === 'test-storm'));
      document.querySelectorAll('.screen').forEach(e => e.classList.add('hidden'));
      const el = document.getElementById('alert'), out = {};
      // The HUD only refreshes while the mission runs; a stray blur (headless
      // WebKit sends them) pauses it, so unpause before reading the warning.
      const at = async (t) => {
        const m = S.mission;
        while (m.t < t) m.advance(0.25, { thrust: false, throttle: 1, rotate: 0 });
        S.paused = false; document.getElementById('pause').classList.add('hidden');
        await wait(200);
        return [el.className, el.textContent];
      };
      out.far = await at(5); out.soon = await at(30); out.on = await at(76);
      out.row = document.getElementById('mech-text').textContent;
      return out;
    });
    check('storm warning: steady, then flashing, then the storm itself, bottom-centre (not in the HUD row)',
      r.far[0] === 'far' && /STORM IN 1:1/.test(r.far[1]) && r.soon[0] === 'soon' && /STORM IN 0:4/.test(r.soon[1]) && r.on[0] === 'on' && /LEFT/.test(r.on[1]) && !/storm in/i.test(r.row), JSON.stringify(r));
    check('no page errors in Storm Warning', errors.length === 0, errors.slice(0, 3).join(' | '));
    errors.length = 0;
    await p.close();
  }

  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
