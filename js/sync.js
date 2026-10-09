// Progress merging, shared by the game and the server. Progress only ever
// improves, so merging two copies (this phone and the cloud, or two phones)
// keeps the best of each: most stars, lowest Δv, highest score.
(function (root) {
  'use strict';

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

  function mergeProgress(a, b) {
    a = a || {}; b = b || {};
    const out = { unlocked: Math.max(num(a.unlocked) || 0, num(b.unlocked) || 0), stars: {}, best: {}, score: {}, learned: {} };
    const pick = (key, better) => {
      for (const src of [a[key], b[key]]) {
        if (!src || typeof src !== 'object') continue;
        for (const [k, v0] of Object.entries(src)) {
          const v = num(v0);
          if (v == null) continue;
          if (!(k in out[key]) || better(v, out[key][k])) out[key][k] = v;
        }
      }
    };
    pick('stars', (x, y) => x > y);
    pick('best', (x, y) => x < y);
    pick('score', (x, y) => x > y);
    pick('learned', (x, y) => x > y);
    return out;
  }

  // Did merging add anything that `base` didn't already have?
  function improves(base, merged) {
    return JSON.stringify(mergeProgress(base, merged)) !== JSON.stringify(mergeProgress(base, {}));
  }

  const Sync = { mergeProgress, improves };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sync;
  else root.Sync = Sync;
})(typeof window !== 'undefined' ? window : globalThis);
