// Run recording and replay. The game advances the simulation in fixed ticks
// (TICK seconds of real time, times the warp factor) and records each tick's
// controls plus discrete actions (deploy, drop, gyro, tether). Replaying the log
// through a fresh Mission reproduces the flight exactly, which is how the
// leaderboard server checks a submitted run. Pure logic, runs in Node too.
(function (root) {
  'use strict';

  const TICK = 1 / 60;
  const WARPS = [1, 2, 5, 10, 25, 50, 100];
  const FORMAT = 1;

  // Ticks are run-length encoded: [count, warpIndex, thrust 0/1, throttle×10, rotate -1/0/1].
  class Recorder {
    constructor(levelId, levelHash) {
      this.level = levelId; this.hash = levelHash;
      this.ticks = []; this.events = []; this.n = 0;
    }
    tick(w, c) {
      const th = c.thrust ? 1 : 0, thr = Math.round(c.throttle * 10), rot = c.rotate || 0;
      const last = this.ticks[this.ticks.length - 1];
      if (last && last[1] === w && last[2] === th && last[3] === thr && last[4] === rot) last[0]++;
      else this.ticks.push([1, w, th, thr, rot]);
      this.n++;
    }
    // A discrete action taken before tick number n.
    event(type) { this.events.push([this.n, type]); }
    toJSON() { return { v: FORMAT, level: this.level, hash: this.hash, ticks: this.ticks, events: this.events }; }
  }

  const ACTIONS = {
    deploy: (m) => m.deploy(),
    drop: (m) => m.release(),
    gyro: (m) => { if (m.level.ship.canRotate) m.gyro = !m.gyro; },
    tether: (m) => m.toggleTether(),
  };

  // Validate the log's shape before trusting it (it may come from anyone).
  function validLog(log) {
    if (!log || log.v !== FORMAT || !Array.isArray(log.ticks) || !Array.isArray(log.events)) return false;
    if (log.ticks.length > 200000 || log.events.length > 1000) return false;
    for (const r of log.ticks) {
      if (!Array.isArray(r) || r.length !== 5) return false;
      const [n, w, th, thr, rot] = r;
      if (!(Number.isInteger(n) && n > 0 && n <= 1e6)) return false;
      if (!(Number.isInteger(w) && w >= 0 && w < WARPS.length)) return false;
      if (!(th === 0 || th === 1) || !(Number.isInteger(thr) && thr >= 0 && thr <= 10) || !(rot === -1 || rot === 0 || rot === 1)) return false;
    }
    let prev = 0;
    for (const e of log.events) {
      if (!Array.isArray(e) || e.length !== 2 || !Number.isInteger(e[0]) || e[0] < prev || !ACTIONS[e[1]]) return false;
      prev = e[0];
    }
    return true;
  }

  // Re-fly a log. Returns the finished Mission (status, t, dvUsed(), score()...).
  // maxSimTime guards against logs that would run forever.
  function replay(level, log, Mission) {
    const m = new Mission(level);
    let n = 0, ei = 0;
    const apply = () => { while (ei < log.events.length && log.events[ei][0] === n) { if (m.status === 'flying') ACTIONS[log.events[ei][1]](m); ei++; } };
    outer: for (const [count, w, th, thr, rot] of log.ticks) {
      const c = { thrust: th === 1, throttle: thr / 10, rotate: rot };
      for (let k = 0; k < count; k++) {
        apply();
        if (m.status !== 'flying') break outer;
        m.advance(WARPS[w] * TICK, c);
        n++;
        if (m.status !== 'flying') break outer;
      }
    }
    if (m.status === 'flying') apply();
    return m;
  }

  // Fingerprint of everything that affects a level's physics and scoring, so
  // leaderboards reset when a level is retuned.
  function levelHash(level) {
    const s = JSON.stringify([level.bodies, level.ship, level.goals, level.par, level.tMax, level.bounds]);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }

  const Replay = { Recorder, replay, validLog, levelHash, TICK, WARPS, FORMAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = Replay;
  else root.Replay = Replay;
})(typeof window !== 'undefined' ? window : globalThis);
