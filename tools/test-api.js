// API tests against the local server with the in-memory store: accounts,
// restore codes, Sign in with Apple, cloud saves and replay-checked runs.
//   node tools/test-api.js   (part of npm test)
'use strict';
delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL;
const crypto = require('crypto');
globalThis.Phys = require('../js/physics.js');
const { Mission } = require('../js/flight.js');
const { LEVELS } = require('../js/levels.js');
const Replay = require('../js/replay.js');

let failed = 0;
const check = (name, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) failed++; };

// Fake Apple: a local RSA key whose public half is served as Apple's JWKS.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'test', alg: 'RS256', use: 'sig' });
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => (String(url) === 'https://appleid.apple.com/auth/keys'
  ? Promise.resolve({ json: async () => ({ keys: [jwk] }) }) : realFetch(url, opts));
process.env.APPLE_CLIENT_ID = 'com.example.thrusterz';
const appleToken = (sub, aud = process.env.APPLE_CLIENT_ID) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = enc({ alg: 'RS256', kid: 'test' }), body = enc({ iss: 'https://appleid.apple.com', aud, sub, exp: Math.floor(Date.now() / 1000) + 600 });
  return head + '.' + body + '.' + crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), privateKey).toString('base64url');
};

// A real winning run: fly Deorbit tick by tick and record it.
function winningLog(wait = 0) {
  const L = LEVELS.find(l => l.id === 'deorbit');
  for (let turn = 30; turn <= 160; turn += 4) for (let burn = 100; burn <= 260; burn += 20) {
    const m = new Mission(L), rec = new Replay.Recorder(L.id, Replay.levelHash(L));
    const plan = [[wait, { thrust: false, throttle: 1, rotate: 0 }, 0], [turn, { thrust: false, throttle: 1, rotate: 1 }, 0], [turn, { thrust: false, throttle: 1, rotate: -1 }, 0], [burn, { thrust: true, throttle: 1, rotate: 0 }, 0], [4000, { thrust: false, throttle: 1, rotate: 0 }, 3]];
    for (const [n, c, w] of plan) for (let k = 0; k < n && m.status === 'flying'; k++) { rec.tick(w, c); m.advance(Replay.WARPS[w] * Replay.TICK, c); }
    if (m.status === 'won') return { log: JSON.parse(JSON.stringify(rec)), m };
  }
  return null;
}

(async () => {
  const server = require('./dev-server.js');
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, route, body, token, query) => {
    const r = await realFetch(base + '/api/' + route + (query ? '?' + new URLSearchParams(query) : ''), {
      method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  // Accounts
  const a = await call('POST', 'player');
  check('create a player', a.status === 200 && a.body.token && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(a.body.player.code), JSON.stringify(a.body && a.body.player));
  const tokA = a.body.token;
  check('who am I', (await call('GET', 'player', null, tokA)).body.player.id === a.body.player.id);
  check('a bad token is refused', (await call('GET', 'player', null, a.body.player.id + '.nope')).status === 401);
  check('rename', (await call('PATCH', 'player', { name: '  Ace  Pilot!! ' }, tokA)).body.player.name === 'Ace Pilot');
  check('rude names are refused', (await call('PATCH', 'player', { name: 'sh1tlord' }, tokA)).status === 400 || (await call('PATCH', 'player', { name: 'fuckface' }, tokA)).status === 400);
  check('too-short names are refused', (await call('PATCH', 'player', { name: 'a' }, tokA)).status === 400);

  // Cloud save
  await call('PUT', 'progress', { progress: { stars: { liftoff: 2, point: 3 }, best: { liftoff: 9 }, unlocked: 3 } }, tokA);
  const merged = await call('PUT', 'progress', { progress: { stars: { liftoff: 3, point: 1 }, best: { liftoff: 12 }, score: { liftoff: 5000 } } }, tokA);
  const pr = merged.body.progress;
  check('cloud save keeps the best of both', pr.stars.liftoff === 3 && pr.stars.point === 3 && pr.best.liftoff === 9 && pr.score.liftoff === 5000 && pr.unlocked === 3, JSON.stringify(pr));

  // Restore on a second device
  const r = await call('POST', 'restore', { code: a.body.player.code.toLowerCase().replace(/-/g, ' ') });
  check('restore with the code (any case, any spacing)', r.status === 200 && r.body.player.id === a.body.player.id && r.body.progress.stars.point === 3);
  check('both devices stay signed in', (await call('GET', 'player', null, tokA)).status === 200 && (await call('GET', 'player', null, r.body.token)).status === 200);
  check('a wrong code is refused', (await call('POST', 'restore', { code: 'AAAA-BBBB-CCCC' })).status === 404);

  // Sign in with Apple
  const ap = await call('POST', 'apple', { identityToken: appleToken('apple-user-1'), link: true }, tokA);
  check('link Apple to an account', ap.status === 200 && ap.body.player.apple === true, JSON.stringify(ap.body));
  const ap2 = await call('POST', 'apple', { identityToken: appleToken('apple-user-1') });
  check('Sign in with Apple on a new device finds the account', ap2.status === 200 && ap2.body.player.id === a.body.player.id && ap2.body.progress.stars.liftoff === 3);
  check('an Apple token for another app is refused', (await call('POST', 'apple', { identityToken: appleToken('x', 'com.evil.app') })).status === 401);
  const forged = appleToken('apple-user-1').split('.'); forged[2] = forged[2].slice(0, -4) + 'AAAA';
  check('a forged Apple token is refused', (await call('POST', 'apple', { identityToken: forged.join('.') })).status === 401);

  // Runs and leaderboards
  const win = winningLog();
  check('found a winning Deorbit run to submit', !!win);
  const sub = await call('POST', 'runs', { log: win.log }, tokA);
  check('a real run is verified and ranked', sub.status === 200 && sub.body.run.score === win.m.score() && sub.body.rank.score === 1, JSON.stringify(sub.body));
  const tampered = JSON.parse(JSON.stringify(win.log)); tampered.ticks[2][0] = 5; // burn far too short
  check('a tampered run is rejected', (await call('POST', 'runs', { log: tampered }, tokA)).status === 422);
  check('a run for an old version of the mission is refused', (await call('POST', 'runs', { log: Object.assign({}, win.log, { hash: 'old' }) }, tokA)).status === 409);
  check('garbage is refused', (await call('POST', 'runs', { log: { v: 1, level: 'deorbit', ticks: 'x' } }, tokA)).status === 400);
  check('runs need an account', (await call('POST', 'runs', { log: win.log })).status === 401);

  const b = await call('POST', 'player'); await call('PATCH', 'player', { name: 'Second' }, b.body.token);
  // Player B dawdles for 3 s before starting: slower, so lower score too.
  const slow = winningLog(180).log;
  const subB = await call('POST', 'runs', { log: slow }, b.body.token);
  check('a second, slower pilot ranks second', subB.status === 200 && subB.body.rank.score === 2 && subB.body.rank.time === 2, JSON.stringify(subB.body && subB.body.rank));
  const board = await call('GET', 'board', null, tokA, { level: 'deorbit', kind: 'time' });
  check('time board: fastest first, names shown, me marked', board.body.top.length === 2 && board.body.top[0].name === 'Ace Pilot' && board.body.top[0].me && board.body.top[0].value <= board.body.top[1].value && board.body.me.rank === 1, JSON.stringify(board.body));
  const again = await call('POST', 'runs', { log: slow }, tokA);
  check('a worse repeat does not lower your best', again.body.best.score === sub.body.run.score && again.body.rank.score === 1);

  // World boards: total score over the world's missions; a world time only
  // once every mission in it has been finished.
  const core = require('../api/_lib/core.js'), store = require('../api/_lib/store.js').getStore();
  const w1 = core.WORLD_LEVELS[1];
  check('world 1 run reports world progress', sub.body.world && sub.body.world.score === sub.body.run.score && sub.body.world.time === null && sub.body.world.done === 1 && sub.body.world.of === w1.length, JSON.stringify(sub.body.world));
  let ws = await call('GET', 'board', null, tokA, { world: 1, kind: 'score' });
  check('world score board ranks total score', ws.status === 200 && ws.body.top.length === 2 && ws.body.top[0].me && ws.body.top[0].value === sub.body.run.score && ws.body.missions === w1.length, JSON.stringify(ws.body));
  let wt = await call('GET', 'board', null, tokA, { world: 1, kind: 'time' });
  check('no world time until every mission is done', wt.status === 200 && wt.body.total === 0 && wt.body.me === null && wt.body.progress.done === 1, JSON.stringify(wt.body));
  // Pretend A has finished every other world-1 mission in 100 s each.
  for (const L of w1) if (L.id !== 'deorbit') { await store.zadd(core.boardKey(L) + ':score', a.body.player.id, 1000, 'GT'); await store.zadd(core.boardKey(L) + ':time', a.body.player.id, 100, 'LT'); }
  const last = await call('POST', 'runs', { log: win.log }, tokA);
  const wantTime = +(100 * (w1.length - 1) + sub.body.best.time).toFixed(2);
  check('finishing the world posts a world time', last.body.world.time === wantTime && last.body.world.done === w1.length, JSON.stringify(last.body.world));
  wt = await call('GET', 'board', null, tokA, { world: 1, kind: 'time' });
  check('world time board shows it', wt.body.total === 1 && wt.body.me.rank === 1 && wt.body.top[0].value === wantTime, JSON.stringify(wt.body));
  check('unknown worlds are refused', (await call('GET', 'board', null, null, { world: 9 })).status === 404 && (await call('GET', 'board', null, null, { world: '__proto__' })).status === 404);
  check('world 2 board starts empty', (await call('GET', 'board', null, tokA, { world: 2, kind: 'score' })).body.total === 0);

  // Reporting a pilot name: once per reporter; three different reporters
  // reset it to the neutral default.
  const rowB = (await call('GET', 'board', null, tokA, { level: 'deorbit', kind: 'score' })).body.top.find(e => e.name === 'Second');
  check('leaderboard rows carry the pilot id for reporting', !!(rowB && rowB.id), JSON.stringify(rowB));
  check('you cannot report yourself', (await call('POST', 'report', { player: a.body.player.id }, tokA)).status === 400);
  const r1 = await call('POST', 'report', { player: rowB.id }, tokA);
  await call('POST', 'report', { player: rowB.id }, tokA); // same reporter again: counted once
  const nameAfterOne = (await call('GET', 'player', null, b.body.token)).body.player.name;
  check('a report is taken, a repeat report is not counted twice', r1.status === 200 && nameAfterOne === 'Second', nameAfterOne);
  for (let k = 0; k < 2; k++) { const x = await call('POST', 'player'); await call('POST', 'report', { player: rowB.id }, x.body.token); }
  const reset = (await call('GET', 'player', null, b.body.token)).body.player.name;
  check('three reports reset a name to the default', /^Pilot-/.test(reset), reset);
  check('reports need an account and a real pilot', (await call('POST', 'report', { player: rowB.id })).status === 401 && (await call('POST', 'report', { player: 'nobody' }, tokA)).status === 404);

  // Crash reports: anyone may send a short one; only the admin key reads them.
  check('a crash report is accepted', (await call('POST', 'crash', { msg: 'TypeError: x is undefined', stack: 'at frame (game.js:1:1)', level: 'deorbit', version: '1.0.0' })).status === 200);
  process.env.ADMIN_KEY = 'test-admin';
  const list = await realFetch(base + '/api/crash', { headers: { 'x-admin-key': 'test-admin' } }).then(r => r.json());
  check('crash reports are readable with the admin key only', list.crashes && list.crashes[0].msg.startsWith('TypeError') && (await call('GET', 'crash')).status === 403, JSON.stringify(list).slice(0, 120));

  // Account deletion (required by the App Store), including Apple revocation.
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  Object.assign(process.env, { APPLE_TEAM_ID: 'TEAM', APPLE_KEY_ID: 'KEY', APPLE_PRIVATE_KEY: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const appleCalls = [];
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (/appleid\.apple\.com\/auth\/(token|revoke)/.test(url)) {
      const f = new URLSearchParams(opts.body), secret = f.get('client_secret').split('.');
      const okSig = crypto.verify('sha256', Buffer.from(secret[0] + '.' + secret[1]), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(secret[2], 'base64url'));
      appleCalls.push({ url: String(url), okSig, form: Object.fromEntries(f) });
      return { ok: true, json: async () => ({ refresh_token: 'rt-1' }) };
    }
    return prevFetch(url, opts);
  };
  const c = await call('POST', 'player');
  await call('POST', 'apple', { identityToken: appleToken('apple-user-del'), authorizationCode: 'code-1', link: true }, c.body.token);
  await call('POST', 'runs', { log: win.log }, c.body.token);
  const del = await call('DELETE', 'player', null, c.body.token);
  const after = await call('GET', 'board', null, null, { level: 'deorbit', kind: 'score' });
  check('delete account removes it everywhere', del.status === 200 && (await call('GET', 'player', null, c.body.token)).status === 401
    && !after.body.top.some(e => e.value === win.m.score() && e.name.startsWith('Pilot-')) && after.body.total === 2
    && (await call('POST', 'restore', { code: c.body.player.code })).status === 404
    && (await call('GET', 'board', null, null, { world: 1, kind: 'score' })).body.total === 2, JSON.stringify(after.body.top));
  check('deleting revokes the Sign in with Apple token', del.body.appleRevoked === true && appleCalls.length === 2 && appleCalls.every(x => x.okSig)
    && appleCalls[1].url.endsWith('/revoke') && appleCalls[1].form.token === 'rt-1', JSON.stringify(appleCalls.map(x => x.url)));

  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
