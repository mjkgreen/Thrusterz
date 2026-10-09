// Storage for the API: Upstash Redis over its REST API when configured
// (UPSTASH_REDIS_REST_URL / _TOKEN, or Vercel KV's KV_REST_API_URL / _TOKEN),
// otherwise an in-memory store for local development and tests.
'use strict';

function redisStore(url, token) {
  const cmd = async (...args) => {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    const j = await r.json();
    if (j.error) throw new Error('redis: ' + j.error);
    return j.result;
  };
  return {
    kind: 'redis',
    get: async (k) => { const v = await cmd('GET', k); return v == null ? null : JSON.parse(v); },
    set: async (k, v) => { await cmd('SET', k, JSON.stringify(v)); },
    setnx: async (k, v) => (await cmd('SET', k, JSON.stringify(v), 'NX')) === 'OK',
    del: async (k) => { await cmd('DEL', k); },
    incr: async (k, ttl) => { const n = await cmd('INCR', k); if (n === 1 && ttl) await cmd('EXPIRE', k, ttl); return n; },
    // Sorted sets. better: 'GT' keeps the higher score, 'LT' the lower.
    zadd: async (k, member, score, better) => { await cmd('ZADD', k, better, score, member); },
    zscore: async (k, member) => { const v = await cmd('ZSCORE', k, member); return v == null ? null : +v; },
    zrank: async (k, member, desc) => cmd(desc ? 'ZREVRANK' : 'ZRANK', k, member),
    zrange: async (k, start, stop, desc) => {
      const flat = await cmd(desc ? 'ZREVRANGE' : 'ZRANGE', k, start, stop, 'WITHSCORES');
      const out = [];
      for (let i = 0; i < flat.length; i += 2) out.push([flat[i], +flat[i + 1]]);
      return out;
    },
    zcard: async (k) => cmd('ZCARD', k),
    zrem: async (k, member) => { await cmd('ZREM', k, member); },
    mget: async (keys) => (keys.length ? (await cmd('MGET', ...keys)).map(v => (v == null ? null : JSON.parse(v))) : []),
  };
}

function memoryStore() {
  const kv = new Map(), z = new Map();
  const zs = (k) => { if (!z.has(k)) z.set(k, new Map()); return z.get(k); };
  const sorted = (k, desc) => [...zs(k).entries()].sort((a, b) => (desc ? b[1] - a[1] : a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
  return {
    kind: 'memory',
    get: async (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null),
    set: async (k, v) => { kv.set(k, JSON.stringify(v)); },
    setnx: async (k, v) => { if (kv.has(k)) return false; kv.set(k, JSON.stringify(v)); return true; },
    del: async (k) => { kv.delete(k); z.delete(k); },
    incr: async (k) => { const n = (kv.has(k) ? JSON.parse(kv.get(k)) : 0) + 1; kv.set(k, JSON.stringify(n)); return n; },
    zadd: async (k, member, score, better) => {
      const s = zs(k), old = s.get(member);
      if (old == null || (better === 'GT' ? score > old : score < old)) s.set(member, score);
    },
    zscore: async (k, member) => (zs(k).has(member) ? zs(k).get(member) : null),
    zrank: async (k, member, desc) => { const i = sorted(k, desc).findIndex(e => e[0] === member); return i < 0 ? null : i; },
    zrange: async (k, start, stop, desc) => sorted(k, desc).slice(start, stop + 1),
    zcard: async (k) => zs(k).size,
    zrem: async (k, member) => { zs(k).delete(member); },
    mget: async (keys) => keys.map(k => (kv.has(k) ? JSON.parse(kv.get(k)) : null)),
    _reset: () => { kv.clear(); z.clear(); },
  };
}

let store = null;
function getStore() {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) store = redisStore(url, token);
  // On Vercel, memory would be wiped between requests: refuse instead of
  // silently losing accounts. Locally and in tests, memory is fine.
  else if (process.env.VERCEL) return null;
  else store = memoryStore();
  return store;
}

module.exports = { getStore, memoryStore };
