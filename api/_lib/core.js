// Thrusterz API: player accounts, cloud saves and replay-verified leaderboards.
// Every route is a plain (req, res) handler so it runs on Vercel Functions and
// under tools/dev-server.js alike.
'use strict';
const crypto = require('crypto');
const { getStore } = require('./store');

// The game's own simulation, so the server can re-fly submitted runs.
// (Plain relative requires so Vercel's bundler includes these files.)
globalThis.Phys = globalThis.Phys || require('../../js/physics.js');
const { Mission } = require('../../js/flight.js');
const { LEVELS } = require('../../js/levels.js');
const Replay = require('../../js/replay.js');
const { mergeProgress } = require('../../js/sync.js');

const LEVEL_BY_ID = Object.fromEntries(LEVELS.filter(l => !l.test).map(l => [l.id, l]));
const HASHES = Object.fromEntries(Object.values(LEVEL_BY_ID).map(l => [l.id, Replay.levelHash(l)]));

// ------------------------------------------------------------------ http
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function cors(res) {
  // Auth is a bearer token, never a cookie, so any origin (the web build, the
  // iOS app's WebView) may call the API.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 2e6) throw new HttpError(413, 'Request too large'); }
  return raw ? JSON.parse(raw) : {};
}

// Wrap a route: CORS, JSON errors, method check.
function route(methods, fn) {
  return async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'Method not allowed');
      const body = req.method === 'GET' ? {} : await readBody(req).catch(() => { throw new HttpError(400, 'Bad JSON'); });
      const url = new URL(req.url, 'http://x');
      const store = getStore();
      if (!store) throw new HttpError(503, 'Online features are not set up on this server yet');
      send(res, 200, await fn({ req, body, query: Object.fromEntries(url.searchParams), store }));
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      send(res, e.status || 500, { error: e.status ? e.message : 'Server error' });
    }
  };
}

// --------------------------------------------------------------- players
const rand = (n) => crypto.randomBytes(n);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
function restoreCode() {
  const b = rand(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
}
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3');

const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'bitch', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'penis', 'vagina', 'dick', 'cock', 'pussy', 'asshole'];
function cleanName(name) {
  const n = String(name || '').replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (n.length < 3) throw new HttpError(400, 'Names need 3–16 letters, numbers, spaces, _ . or -');
  // Undo the usual l33t substitutions before checking.
  const flat = n.toLowerCase().replace(/[0134578]/g, (d) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' })[d]).replace(/[^a-z]/g, '');
  if (BLOCKED.some(w => flat.includes(w))) throw new HttpError(400, 'Please pick a different name');
  return n;
}

function publicPlayer(p) { return { id: p.id, name: p.name, code: p.code, apple: !!p.appleSub, created: p.created }; }

// A device session: "<playerId>.<secret>". Only the secret's hash is stored.
async function newSession(store, p) {
  const secret = rand(24).toString('base64url');
  p.tokens = (p.tokens || []).concat(sha(secret)).slice(-10); // up to 10 devices
  await store.set('player:' + p.id, p);
  return p.id + '.' + secret;
}

async function createPlayer(store) {
  let id;
  do { id = rand(9).toString('base64url'); } while (await store.get('player:' + id));
  let code;
  do { code = restoreCode(); } while (!(await store.setnx('code:' + code, id)));
  const p = { id, name: 'Pilot-' + id.slice(0, 4).toUpperCase(), code, created: Date.now(), tokens: [] };
  const token = await newSession(store, p);
  return { player: p, token };
}

async function authed(req, store, optional) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(h);
  if (!m) { if (optional) return null; throw new HttpError(401, 'Sign in required'); }
  const p = await store.get('player:' + m[1]);
  if (!p || !(p.tokens || []).includes(sha(m[2]))) { if (optional) return null; throw new HttpError(401, 'Session expired'); }
  return p;
}

async function limit(store, key, max, seconds) {
  const n = await store.incr('rate:' + key + ':' + Math.floor(Date.now() / 1000 / seconds), seconds);
  if (n > max) throw new HttpError(429, 'Too many requests, slow down');
}

function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || 'local').split(',')[0].trim(); }

// --------------------------------------------------------- Sign in with Apple
let appleKeys = null, appleKeysAt = 0;
async function verifyAppleToken(idToken) {
  const aud = (process.env.APPLE_CLIENT_IDS || process.env.APPLE_CLIENT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!aud.length) throw new HttpError(501, 'Sign in with Apple is not configured on the server');
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new HttpError(400, 'Bad Apple token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (!appleKeys || Date.now() - appleKeysAt > 3600e3) {
    appleKeys = (await (await fetch('https://appleid.apple.com/auth/keys')).json()).keys;
    appleKeysAt = Date.now();
  }
  const jwk = appleKeys.find(k => k.kid === header.kid);
  if (!jwk || header.alg !== 'RS256') throw new HttpError(401, 'Unknown Apple key');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new HttpError(401, 'Apple token signature is invalid');
  if (claims.iss !== 'https://appleid.apple.com' || !aud.includes(claims.aud) || claims.exp * 1000 < Date.now()) throw new HttpError(401, 'Apple token is expired or not for this app');
  return claims;
}

// Apple requires that deleting an account also revokes its Sign in with Apple
// tokens. With APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY (a .p8 key
// with Sign in with Apple enabled) set, the server trades the one-time
// authorization code for a refresh token at sign-in and revokes it on delete.
function appleClientSecret(clientId) {
  const { APPLE_TEAM_ID: team, APPLE_KEY_ID: kid } = process.env;
  const pem = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!team || !kid || !pem) return null;
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = enc({ alg: 'ES256', kid }) + '.' + enc({ iss: team, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId });
  const sig = crypto.sign('sha256', Buffer.from(data), { key: pem, dsaEncoding: 'ieee-p1363' });
  return data + '.' + sig.toString('base64url');
}
async function appleForm(endpoint, fields) {
  const r = await fetch('https://appleid.apple.com/auth/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
  return endpoint === 'token' ? r.json() : r.ok;
}
async function appleRefreshToken(code, clientId) {
  const secret = code && appleClientSecret(clientId);
  if (!secret) return null;
  try {
    const j = await appleForm('token', { client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' });
    return j.refresh_token || null;
  } catch (e) { return null; }
}
async function appleRevoke(p) {
  const secret = p.appleRefresh && appleClientSecret(p.appleAud);
  if (!secret) return false;
  try { return await appleForm('revoke', { client_id: p.appleAud, client_secret: secret, token: p.appleRefresh, token_type_hint: 'refresh_token' }); } catch (e) { return false; }
}

// ---------------------------------------------------------------- routes
const routes = {
  // POST: create an account (first launch). GET: who am I. PATCH: rename.
  player: route(['GET', 'POST', 'PATCH', 'DELETE'], async ({ req, body, store }) => {
    if (req.method === 'POST') {
      await limit(store, 'new:' + clientIp(req), 20, 3600);
      const { player, token } = await createPlayer(store);
      return { player: publicPlayer(player), token };
    }
    const p = await authed(req, store);
    if (req.method === 'DELETE') {
      // Delete everything the server holds about this pilot.
      const revoked = await appleRevoke(p);
      for (const L of Object.values(LEVEL_BY_ID)) {
        const key = 'board:' + L.id + ':' + HASHES[L.id];
        await store.zrem(key + ':score', p.id); await store.zrem(key + ':time', p.id);
        await store.del('best:' + key + ':' + p.id);
      }
      await store.del('progress:' + p.id);
      await store.del('code:' + p.code);
      if (p.appleSub) await store.del('apple:' + p.appleSub);
      await store.del('player:' + p.id);
      return { deleted: true, appleRevoked: revoked };
    }
    if (req.method === 'PATCH') {
      await limit(store, 'name:' + p.id, 10, 3600);
      p.name = cleanName(body.name);
      await store.set('player:' + p.id, p);
    }
    return { player: publicPlayer(p) };
  }),

  // Restore an account on a new device with its code.
  restore: route(['POST'], async ({ req, body, store }) => {
    await limit(store, 'restore:' + clientIp(req), 10, 600);
    const id = await store.get('code:' + normCode(body.code));
    const p = id && await store.get('player:' + id);
    if (!p) throw new HttpError(404, 'No account with that code');
    const token = await newSession(store, p);
    return { player: publicPlayer(p), token, progress: (await store.get('progress:' + p.id)) || {} };
  }),

  // Sign in with Apple. Signed in already: link Apple to this account.
  // Not signed in: return the linked account, or make a new one.
  apple: route(['POST'], async ({ req, body, store }) => {
    await limit(store, 'apple:' + clientIp(req), 20, 600);
    const claims = await verifyAppleToken(body.identityToken), sub = claims.sub;
    const linked = await store.get('apple:' + sub);
    const me = await authed(req, store, true);
    const attach = async (p) => {
      p.appleSub = sub; p.appleAud = claims.aud;
      const refresh = await appleRefreshToken(body.authorizationCode, claims.aud);
      if (refresh) p.appleRefresh = refresh;
      await store.set('player:' + p.id, p); await store.set('apple:' + sub, p.id);
    };
    if (me && body.link) {
      if (linked && linked !== me.id) throw new HttpError(409, 'That Apple ID is already linked to another pilot');
      await attach(me);
      return { player: publicPlayer(me) };
    }
    let p = linked && await store.get('player:' + linked);
    if (!p) { p = (await createPlayer(store)).player; await attach(p); }
    else if (!p.appleRefresh && body.authorizationCode) await attach(p);
    const token = await newSession(store, p);
    return { player: publicPlayer(p), token, progress: (await store.get('progress:' + p.id)) || {} };
  }),

  // Cloud save. PUT merges the device's progress in and returns the result.
  progress: route(['GET', 'PUT'], async ({ req, body, store }) => {
    const p = await authed(req, store);
    let saved = (await store.get('progress:' + p.id)) || {};
    if (req.method === 'PUT') {
      await limit(store, 'save:' + p.id, 60, 60);
      saved = mergeProgress(saved, body.progress);
      await store.set('progress:' + p.id, saved);
    }
    return { progress: saved };
  }),

  // Submit a finished run: the server re-flies the recorded inputs and ranks
  // the result it computes itself.
  runs: route(['POST'], async ({ req, body, store }) => {
    const p = await authed(req, store);
    await limit(store, 'run:' + p.id, 30, 60);
    const log = body.log, L = log && LEVEL_BY_ID[log.level];
    if (!L || !Replay.validLog(log)) throw new HttpError(400, 'Not a valid run');
    if (log.hash !== HASHES[L.id]) throw new HttpError(409, 'This mission has changed; update the game to submit runs');
    const m = Replay.replay(L, log, Mission);
    if (m.status !== 'won') throw new HttpError(422, 'The run could not be verified');
    const run = { score: m.score(), time: +m.t.toFixed(2), dv: +m.dvUsed().toFixed(3), stars: m.stars(), at: Date.now() };
    const key = 'board:' + L.id + ':' + HASHES[L.id];
    const prevScore = await store.zscore(key + ':score', p.id), prevTime = await store.zscore(key + ':time', p.id);
    await store.zadd(key + ':score', p.id, run.score, 'GT');
    await store.zadd(key + ':time', p.id, run.time, 'LT');
    if (prevScore == null || run.score > prevScore) await store.set('best:' + key + ':' + p.id, { run, log }); // replay kept for ghosts / audits
    const rank = async (kind) => { const r = await store.zrank(key + ':' + kind, p.id, kind === 'score'); return r == null ? null : r + 1; };
    return { run, best: { score: Math.max(run.score, prevScore || 0), time: prevTime == null ? run.time : Math.min(prevTime, run.time) }, rank: { score: await rank('score'), time: await rank('time') }, total: await store.zcard(key + ':score') };
  }),

  // Leaderboard for one mission: ?level=id&kind=score|time
  board: route(['GET'], async ({ req, query, store }) => {
    const L = LEVEL_BY_ID[query.level];
    if (!L) throw new HttpError(404, 'Unknown mission');
    const kind = query.kind === 'time' ? 'time' : 'score', desc = kind === 'score';
    const key = 'board:' + L.id + ':' + HASHES[L.id] + ':' + kind;
    const top = await store.zrange(key, 0, 19, desc);
    const players = await store.mget(top.map(([id]) => 'player:' + id));
    const me = await authed(req, store, true);
    let mine = null;
    if (me) {
      const r = await store.zrank(key, me.id, desc);
      if (r != null) mine = { rank: r + 1, value: await store.zscore(key, me.id), name: me.name };
    }
    return {
      level: L.id, kind, total: await store.zcard(key),
      top: top.map(([id, value], i) => ({ rank: i + 1, name: players[i] ? players[i].name : 'Pilot', value, me: !!me && me.id === id })),
      me: mine,
    };
  }),
};

module.exports = { routes, HttpError, mergeProgress, cleanName, normCode, HASHES };
