// Talks to the native app shell (Expo, mobile/App.js) when the game runs
// inside it. The shell injects window.__THRUSTERZ_NATIVE before the page
// loads (platform, a snapshot of saved data, whether Sign in with Apple is
// available) and answers requests sent with postMessage.
(function (root) {
  'use strict';
  const host = root.__THRUSTERZ_NATIVE || null;
  const rn = root.ReactNativeWebView || null;
  const inApp = !!(host && rn);
  let seq = 0;
  const pending = new Map();

  // The shell calls this with the answer to a request.
  root.__nativeReply = (id, ok, value) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(value); else p.reject(new Error(value || 'Request failed'));
  };

  // Request with an answer (e.g. Sign in with Apple).
  function call(type, payload) {
    if (!inApp) return Promise.reject(new Error('Only available in the app'));
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      rn.postMessage(JSON.stringify(Object.assign({ id, type }, payload)));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('The app did not answer')); } }, 120000);
    });
  }

  // Fire and forget (save a value, buzz, open a link).
  function send(type, payload) { if (inApp) rn.postMessage(JSON.stringify(Object.assign({ type }, payload))); }

  root.Bridge = {
    inApp,
    platform: inApp ? host.platform : 'web',
    appleSignIn: inApp && !!host.appleSignIn,
    // Saved values as the app had them at launch (strings, as stored).
    stored: (key) => (inApp && host.store && typeof host.store[key] === 'string' ? host.store[key] : null),
    save: (key, value) => send('set', { key, value }),
    haptic: (kind) => send('haptic', { kind }),
    open: (url) => send('open', { url }),
    call,
  };
})(window);
