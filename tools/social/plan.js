// Picks what the next social post can be, and refuses repeats. The scheduled
// run feeds it every earlier post.json (from Drive) as one JSON array.
//
//   node tools/social/plan.js suggest <history.json> [--date YYYY-MM-DD]
//     → what's allowed today: pillar order, unused missions, unused tip topics.
//   node tools/social/plan.js check <history.json> <post.json>
//     → exit 0 if the post is new, else exit 1 and say why. Run before uploading.
//
// What counts as a repeat:
//   - a post already made for the same date (a retried or double-fired run)
//   - the same key: pillar + subject (mission id, tip topic or feature commit),
//     until every subject for that pillar has been used once
//   - the same mission in any pillar within MISSION_GAP_DAYS
//   - the same pillar as the previous post
//   - a hook that reads too much like an earlier one (word overlap)
'use strict';
const fs = require('fs');
const path = require('path');

const MISSION_GAP_DAYS = 45;
const HOOK_OVERLAP = 0.5;
const PILLARS = ['gameplay', 'challenge', 'tip', 'still', 'feature'];
// Share of posts per pillar over time (3/2/1/1/1 of every 8).
const MIX = { gameplay: 3, challenge: 2, tip: 1, still: 1, feature: 1 };

// Ideas the game actually teaches, each with missions that show it.
const TIPS = {
  prograde: { idea: 'Burn prograde to raise the far side of your orbit', levels: ['circularize', 'reachorbit', 'satellite'] },
  retrograde: { idea: 'Burn retrograde to drop the far side (and to land)', levels: ['deorbit', 'landing', 'splashdown'] },
  hohmann: { idea: 'Two burns, half an orbit apart: the cheapest way between orbits', levels: ['moonprobe', 'moonshot', 'leanburn'] },
  periapsis: { idea: 'Burns at periapsis do the most (the Oberth effect)', levels: ['escapeprobe', 'sundiverprobe', 'kickstage'] },
  phasing: { idea: 'To catch something ahead of you, drop to a lower, faster orbit', levels: ['inertia', 'rescue', 'stationstop'] },
  gravityassist: { idea: 'Steal speed from a moon with a close flyby', levels: ['slingshot', 'relaysling', 'slingdrop'] },
  staging: { idea: 'Drop dead weight: every empty tank costs you Δv', levels: ['threestages', 'burndry', 'kickstage'] },
  inertia: { idea: 'No friction in space: you keep moving until you burn the other way', levels: ['stop', 'longcoast', 'brake'] },
  freereturn: { idea: 'A free return: loop the Moon and fall home with no extra fuel', levels: ['freereturn', 'homecoming', 'roundtrip'] },
  spin: { idea: 'Launch with the planet\'s spin, not against it', levels: ['againstspin', 'spinburn', 'reachorbit'] },
  lagrange: { idea: 'Lagrange points: places where you can park next to a planet', levels: ['lagrange', 'trojan', 'trojanrelay'] },
  debris: { idea: 'Every stage you drop stays in orbit. Plan where it goes', levels: ['leavenojunk', 'clearstation', 'busyorbit'] },
};

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
// Hooks are compared on the words that carry meaning.
const STOP = new Set('a an the one can you your to of in on at it is and or for with this that be do does how what why just i we our its into from out up so'.split(' '));
const words = (s) => new Set((String(s || '').toLowerCase().replace(/<[^>]*>/g, ' ').match(/[a-z0-9']+/g) || []).filter(w => !STOP.has(w)));
function overlap(a, b) {
  const A = words(a), B = words(b);
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n >= 3 ? n / Math.min(A.size, B.size) : 0;
}
// The subject of a post, so the same idea can't come back under a new hook.
function key(p) {
  const subj = p.pillar === 'tip' ? p.topic : p.pillar === 'feature' ? (p.commit || p.feature) : p.level;
  return p.pillar + ':' + (subj || '?');
}

function missions() {
  globalThis.Phys = globalThis.Phys || require('../../js/physics.js');
  const P = require('../proofs.js');
  const { LEVELS } = require('../../js/levels.js');
  return LEVELS.filter(l => P[l.id]).map(l => ({ id: l.id, name: l.name }));
}

function history(file) {
  const h = read(file);
  return (Array.isArray(h) ? h : h.posts || []).filter(p => p && p.date).sort((a, b) => a.date.localeCompare(b.date));
}

function suggest(hist, date) {
  const last = hist[hist.length - 1];
  const all = missions();
  const used = new Set(hist.map(key));
  const recent = new Set(hist.filter(p => p.level && days(p.date, date) < MISSION_GAP_DAYS).map(p => p.level));
  // Pillars furthest behind their share go first; never the last one used.
  const n = hist.length + 1, count = {};
  for (const p of PILLARS) count[p] = hist.filter(h => h.pillar === p).length;
  const order = PILLARS.filter(p => !last || p !== last.pillar)
    .sort((a, b) => (count[a] - n * MIX[a] / 8) - (count[b] - n * MIX[b] / 8));
  const fresh = (pillar) => {
    const pool = all.filter(m => !recent.has(m.id));
    const unused = pool.filter(m => !used.has(pillar + ':' + m.id));
    return (unused.length ? unused : pool).map(m => m.id + ' — ' + m.name);
  };
  const tipsLeft = Object.keys(TIPS).filter(t => !used.has('tip:' + t));
  const tips = (tipsLeft.length ? tipsLeft : Object.keys(TIPS)).map(t => ({ topic: t, idea: TIPS[t].idea, levels: TIPS[t].levels.filter(l => !recent.has(l) && all.some(m => m.id === l)) }));
  return {
    date,
    alreadyPostedToday: hist.some(p => p.date === date),
    lastPost: last ? { date: last.date, pillar: last.pillar, level: last.level } : null,
    pillarOrder: order,
    missions: { gameplay: fresh('gameplay').slice(0, 15), challenge: fresh('challenge').slice(0, 15), still: fresh('still').slice(0, 15) },
    tips: tips.slice(0, 6),
    lastFeatureDate: (hist.filter(p => p.pillar === 'feature').pop() || {}).date || null,
    featureCommitsUsed: hist.filter(p => p.pillar === 'feature').map(p => p.commit).filter(Boolean),
    recentHooks: hist.slice(-12).map(p => p.hook),
  };
}

function check(hist, post) {
  const why = [];
  if (!PILLARS.includes(post.pillar)) why.push('unknown pillar "' + post.pillar + '"');
  if (post.pillar === 'tip' && !TIPS[post.topic]) why.push('tip posts need a "topic" from: ' + Object.keys(TIPS).join(', '));
  if (post.pillar === 'feature' && !post.commit) why.push('feature posts need the "commit" hash they show');
  if (post.pillar !== 'tip' && post.pillar !== 'feature' && !post.level) why.push('"level" is missing');
  if (hist.some(p => p.date === post.date)) why.push('a post for ' + post.date + ' already exists');
  const last = hist[hist.length - 1];
  if (last && last.pillar === post.pillar) why.push('same pillar as the previous post (' + last.date + ')');
  const k = key(post), pillarSubjects = post.pillar === 'tip' ? Object.keys(TIPS).length : post.pillar === 'feature' ? Infinity : missions().length;
  const sameKey = hist.filter(p => key(p) === k);
  const usedForPillar = new Set(hist.filter(p => p.pillar === post.pillar).map(key)).size;
  if (sameKey.length && usedForPillar < pillarSubjects) why.push(k + ' was already posted on ' + sameKey.map(p => p.date).join(', '));
  if (post.level) {
    const near = hist.filter(p => p.level === post.level && days(p.date, post.date) < MISSION_GAP_DAYS);
    if (near.length) why.push('mission ' + post.level + ' was used ' + days(near[near.length - 1].date, post.date) + ' days ago (gap is ' + MISSION_GAP_DAYS + ')');
  }
  for (const p of hist) {
    const o = overlap(p.hook, post.hook);
    if (o >= HOOK_OVERLAP) { why.push('hook is too close to ' + p.date + '\'s: "' + p.hook + '"'); break; }
  }
  return why;
}

module.exports = { suggest, check, key, TIPS };

if (require.main === module) {
  const [cmd, hf, pf, ...rest] = process.argv.slice(2);
  if (!cmd || !hf) { console.error('usage: plan.js suggest <history.json> [--date d] | check <history.json> <post.json>'); process.exit(2); }
  const hist = history(path.resolve(hf));
  if (cmd === 'suggest') {
    const di = [pf, ...rest].indexOf('--date');
    const date = di >= 0 ? [pf, ...rest][di + 1] : new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    console.log(JSON.stringify(suggest(hist, date), null, 2));
  } else if (cmd === 'check') {
    const why = check(hist, read(path.resolve(pf)));
    if (why.length) { console.log('REPEAT: do not post this.\n- ' + why.join('\n- ')); process.exit(1); }
    console.log('OK: new post.');
  } else { console.error('unknown command ' + cmd); process.exit(2); }
}
