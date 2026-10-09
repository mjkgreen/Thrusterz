// Online features: a pilot account that is created on first use, cloud saves,
// restore codes, Sign in with Apple, and leaderboard runs. Everything here is
// optional: offline (or with no server) the game plays exactly the same, runs
// wait in a queue, and the next successful call catches up.
(function (root) {
  'use strict';

  const CFG = root.THRUSTERZ_CONFIG || {};
  const Bridge = root.Bridge || { inApp: false };
  const native = () => Bridge.inApp;

  // The website talks to its own /api; the app to the configured server.
  function apiBase() {
    if (native()) return CFG.apiBase || null;
    if (/^https?:$/.test(location.protocol)) return '';
    return null; // file:// — no server
  }

  // ------------------------------------------------------------ storage
  // localStorage is the fast synchronous copy. In the app every write is also
  // mirrored to native storage, which the OS doesn't clear under storage
  // pressure the way it can clear WebView storage.
  const Store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) {
      const s = JSON.stringify(v);
      try { localStorage.setItem(k, s); } catch (e) { /* full or blocked */ }
      if (Bridge.inApp) Bridge.save(k, s);
    },
    // Native copy, as the app had it at launch.
    async getNative(k) {
      try { const s = Bridge.inApp ? Bridge.stored(k) : null; return s ? JSON.parse(s) : null; } catch (e) { return null; }
    },
  };

  const ACCOUNT = 'thrusterz.account.v1';
  const QUEUE = 'thrusterz.runs.v1';
  const listeners = [];
  const state = {
    account: Store.get(ACCOUNT),   // { player, token }
    status: apiBase() == null ? 'unavailable' : 'idle', // idle | syncing | synced | offline | unavailable
    queue: Store.get(QUEUE) || [],
    lastError: '',
  };
  const emit = () => listeners.forEach(f => { try { f(state); } catch (e) { /* ignore */ } });
  const setStatus = (s, err) => { state.status = s; state.lastError = err || ''; emit(); };

  async function api(method, route, body, query) {
    const base = apiBase();
    if (base == null) throw Object.assign(new Error('Online features need the app or the website'), { offline: true });
    const headers = { 'Content-Type': 'application/json' };
    if (state.account && state.account.token) headers.Authorization = 'Bearer ' + state.account.token;
    let r;
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl && setTimeout(() => ctl.abort(), 15000);
      r = await fetch(base + '/api/' + route + (query ? '?' + new URLSearchParams(query) : ''), { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl && ctl.signal });
      if (timer) clearTimeout(timer);
    } catch (e) { throw Object.assign(new Error('No connection'), { offline: true }); }
    let data = null;
    try { data = await r.json(); } catch (e) { /* not JSON: no API here */ }
    if (!data) throw Object.assign(new Error('Server unavailable'), { offline: true });
    if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: r.status });
    return data;
  }

  function saveAccount(a) { state.account = a; Store.set(ACCOUNT, a); emit(); }

  // Create the account the first time anything needs one.
  async function ensureAccount() {
    if (state.account && state.account.token) return state.account;
    const r = await api('POST', 'player');
    saveAccount({ player: r.player, token: r.token });
    return state.account;
  }

  // If the server says our session is gone, forget it (a new one is made next time).
  const guard = async (fn) => {
    try { return await fn(); } catch (e) {
      if (e.status === 401 && state.account) { saveAccount(null); }
      throw e;
    }
  };

  // ------------------------------------------------------------ progress
  let pushTimer = null, getLocal = null, applyMerged = null;
  // The game registers how to read its progress and how to take a merged copy.
  function bindProgress(read, apply) { getLocal = read; applyMerged = apply; }

  function saveProgressSoon() {
    if (apiBase() == null) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncNow().catch(() => {}), 1500);
  }

  async function syncNow() {
    if (!getLocal || apiBase() == null) return;
    setStatus('syncing');
    try {
      await guard(async () => {
        await ensureAccount();
        const r = await api('PUT', 'progress', { progress: getLocal() });
        if (applyMerged) applyMerged(r.progress);
        await flushRuns();
      });
      setStatus('synced');
    } catch (e) {
      setStatus(e.offline ? 'offline' : 'idle', e.message);
      throw e;
    }
  }

  // ------------------------------------------------------------ runs
  // Every win is queued, then submitted; the server re-flies it and ranks it.
  async function submitRun(log) {
    if (apiBase() == null) return { queued: false, unavailable: true };
    state.queue.push(log);
    if (state.queue.length > 50) state.queue.shift();
    Store.set(QUEUE, state.queue);
    try {
      return await guard(async () => {
        await ensureAccount();
        const r = await api('POST', 'runs', { log });
        state.queue = state.queue.filter(x => x !== log); Store.set(QUEUE, state.queue);
        return r;
      });
    } catch (e) {
      if (!e.offline) { state.queue = state.queue.filter(x => x !== log); Store.set(QUEUE, state.queue); }
      return { queued: !!e.offline, error: e.message };
    }
  }

  async function flushRuns() {
    for (const log of state.queue.slice()) {
      try { await api('POST', 'runs', { log }); } catch (e) { if (e.offline) return; }
      state.queue = state.queue.filter(x => x !== log); Store.set(QUEUE, state.queue);
    }
  }

  // ------------------------------------------------------------ account
  const board = (level, kind) => api('GET', 'board', null, { level, kind });

  async function rename(name) {
    return guard(async () => {
      await ensureAccount();
      const r = await api('PATCH', 'player', { name });
      saveAccount(Object.assign({}, state.account, { player: r.player }));
      return r.player;
    });
  }

  // Switch this device to another account (restore code or Apple), merging
  // what's on the device into it so nothing is lost either way.
  async function adopt(r) {
    const local = getLocal ? getLocal() : {};
    saveAccount({ player: r.player, token: r.token });
    if (applyMerged) applyMerged(r.progress || {});
    await api('PUT', 'progress', { progress: Object.assign({}, local) }).then(x => applyMerged && applyMerged(x.progress)).catch(() => {});
    setStatus('synced');
    return r.player;
  }

  async function restore(code) { return adopt(await api('POST', 'restore', { code })); }

  const appleAvailable = () => native() && Bridge.appleSignIn;

  // The native sheet returns Apple's identity token and one-time code.
  async function appleToken() {
    const r = await Bridge.call('appleSignIn');
    if (!r || !r.identityToken) throw new Error('Sign in with Apple did not return a token');
    return { identityToken: r.identityToken, authorizationCode: r.authorizationCode };
  }

  // Signed in with a code-only account: link Apple to it. Otherwise sign in.
  async function signInWithApple() {
    const tok = await appleToken();
    if (state.account && state.account.token) {
      try {
        const r = await api('POST', 'apple', Object.assign({ link: true }, tok));
        saveAccount(Object.assign({}, state.account, { player: r.player }));
        return r.player;
      } catch (e) {
        if (e.status !== 409) throw e;
        // That Apple ID already has a pilot: switch to it (keeping local stars).
      }
    }
    return adopt(await api('POST', 'apple', tok));
  }

  // Delete the account and everything the server holds about it. Stars on
  // this device stay; a fresh account is made the next time one is needed.
  async function deleteAccount() {
    if (!(state.account && state.account.token)) return;
    await api('DELETE', 'player');
    state.queue = []; Store.set(QUEUE, []);
    saveAccount(null);
    setStatus('idle');
  }

  // At startup: pull the native copies (they survive WebView storage being
  // cleared), then sync with the server in the background.
  async function start() {
    const acct = await Store.getNative(ACCOUNT);
    if (acct && acct.token && !(state.account && state.account.token)) saveAccount(acct);
    const q = await Store.getNative(QUEUE);
    if (Array.isArray(q) && !state.queue.length) state.queue = q;
    if (apiBase() != null && (state.account || (getLocal && Object.keys((getLocal() || {}).stars || {}).length))) syncNow().catch(() => {});
  }

  const Online = {
    state, Store, start, bindProgress, saveProgressSoon, syncNow, submitRun, board, rename, restore,
    signInWithApple, appleAvailable, ensureAccount, deleteAccount,
    available: () => apiBase() != null,
    onChange: (f) => listeners.push(f),
    native,
  };
  root.Online = Online;
})(window);
