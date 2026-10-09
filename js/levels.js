// Level definitions. Each level introduces or combines a mechanic.
(function (root) {
  'use strict';
  const DM = root.DMath || (typeof require !== 'undefined' ? require('./dmath.js') : null);

  const VE = 10; // exhaust velocity for all stock engines

  // Ship sized for a Δv budget and a starting acceleration. With `payload`,
  // the ship is a booster carrying a lighter second stage (a satellite with a
  // tiny tank of its own): o.dv is the booster's Δv with the payload aboard,
  // payload.dv the payload's own Δv once the booster is dropped.
  // o.ve: exhaust velocity (defaults to VE). Launch vehicles use a higher one
  // so a climb from the surface lasts long enough to steer.
  // o.stack: [{ name, dv, accel, dry?, ve?, sprite? }, ...] from the bottom
  // stage up; each stage's Δv is with everything above it still attached.
  // o.cargo: [{ id, name, mass, sprite? }] engineless items dropped with E.
  function ship(o) {
    let stages;
    const ve = o.ve || VE;
    const cargoMass = (o.cargo || []).reduce((a, c) => a + c.mass, 0);
    if (o.stack) {
      stages = new Array(o.stack.length);
      let above = cargoMass;
      for (let k = o.stack.length - 1; k >= 0; k--) {
        const st = o.stack[k], sve = st.ve || ve, dry = st.dry != null ? st.dry : 1;
        const fuel = (dry + above) * (DM.exp(st.dv / sve) - 1);
        stages[k] = { id: st.id, name: st.name, sprite: st.sprite || (k === o.stack.length - 1 ? 'satellite' : 'booster'), dryMass: dry, fuel, thrust: st.accel * (dry + fuel + above), ve: sve };
        above += dry + fuel;
      }
    } else if (o.payload) {
      const p = o.payload, pDry = p.dry || 0.25, pve = p.ve || ve;
      const pFuel = pDry * (DM.exp(p.dv / pve) - 1), pMass = pDry + pFuel;
      const bFuel = (1 + pMass) * (DM.exp(o.dv / ve) - 1); // booster dry mass 1
      stages = [
        { name: o.name || 'Booster', sprite: 'booster', dryMass: 1, fuel: bFuel, thrust: o.accel * (1 + bFuel + pMass), ve },
        { name: p.name || 'Satellite', sprite: 'satellite', dryMass: pDry, fuel: pFuel, thrust: p.accel * pMass, ve: pve },
      ];
    } else {
      const fuel = (1 + cargoMass) * (DM.exp(o.dv / ve) - 1); // dry mass 1, Δv with cargo aboard
      stages = [{ dryMass: 1, fuel, thrust: o.accel * (1 + fuel + cargoMass), ve }];
    }
    return {
      start: o.start,
      heading: o.heading,
      stages,
      cargo: o.cargo || [],
      rcs: o.rcs === false ? null : Object.assign({ fuel: 60, accel: 1.2, maxRate: 1.6 }, o.rcs || {}),
      canRotate: o.rcs !== false,
    };
  }

  const C = {
    rock: '#a89f91', green: '#5fbf7f', blue: '#4f8fe0', grey: '#b8bcc6',
    red: '#d9694a', sun: '#ffcf5a', sun2: '#ff8a5a', ice: '#9fe0f0',
    station: '#e6e6f0', purple: '#a98be8', tan: '#d8b67a', comet: '#cfefff',
  };

  // A deterministic ring of small, massless rocks on their own circular orbits.
  function belt(parent, n, rMin, rMax, seed, prefix) {
    let x = seed;
    const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
    const rocks = [];
    for (let i = 0; i < n; i++) {
      rocks.push({
        id: (prefix || 'rock') + i, name: 'Asteroid', kind: 'rock', noRail: true, gm: 0,
        radius: 7 + rnd() * 9, color: '#8d8478',
        orbit: { parent, a: rMin + rnd() * (rMax - rMin), phase: rnd() * Math.PI * 2 },
      });
    }
    return rocks;
  }

  const LEVELS = [
    {
      id: 'liftoff',
      name: 'Liftoff',
      intro: 'Your ship sits on the asteroid Pebble, pointing straight at Verdant. Press and hold SPACE to fire the main engine and fly there. That is all there is to it, for now.',
      objective: 'Crash-land on Verdant.',
      teaches: 'Main engine',
      bodies: [
        { id: 'pebble', name: 'Pebble', gm: 2000, radius: 30, color: C.rock },
        { id: 'verdant', name: 'Verdant', gm: 6000, radius: 50, color: C.green, x: 0, y: 340 },
      ],
      ship: ship({ start: { landed: { body: 'pebble', angle: Math.PI / 2 } }, dv: 30, accel: 4, rcs: false }),
      goals: [{ type: 'hit', body: 'verdant' }],
      par: 22, bounds: 2500, tMax: 300, predict: 150, view: { x: 0, y: 100, span: 700 }, startCam: 'overview',
    },
    {
      id: 'point',
      name: 'Point and Burn',
      intro: 'Side thrusters online. Hold A or D to spin the ship. Out here nothing stops a spin for you, so tap the opposite key to stop turning. Point the nose at the beacon, then burn.',
      objective: 'Fly into the beacon.',
      teaches: 'Side thrusters · rotation',
      bodies: [
        { id: 'drift', name: 'Drift', gm: 3000, radius: 40, color: C.purple, x: -150, y: -700 },
      ],
      ship: ship({ start: { free: { x: 0, y: 0 } }, heading: Math.PI, dv: 6, accel: 1 }),
      goals: [{ type: 'reach', x: 320, y: 120, r: 40, label: 'Beacon' }],
      par: 2, bounds: 2000, tMax: 400, predict: 120, view: { x: 120, y: -40, span: 760 }, startCam: 'overview',
    },
    {
      id: 'stop',
      name: 'Full Stop',
      intro: 'Your engine only pushes forward. To stop, turn around and burn the other way. Point at the buoy and give a short burn, then press . to speed up time while you coast. Near the buoy, drop back to 1× with , then flip 180° and burn until your relative speed is nearly zero.',
      objective: 'Park beside Buoy 7: within 40, relative speed under 1.',
      teaches: 'Flip and burn · time warp',
      introduces: ['warp'],
      bodies: [
        { id: 'drift', name: 'Drift', gm: 3000, radius: 40, color: C.purple, x: -150, y: -700 },
        { id: 'buoy', name: 'Buoy 7', gm: 0, radius: 4, color: C.station, kind: 'station', x: 400, y: 0 },
      ],
      ship: ship({ start: { free: { x: 0, y: 0 } }, heading: Math.PI / 2, dv: 8, accel: 1 }),
      goals: [{ type: 'rendezvous', body: 'buoy', dist: 40, relVel: 1 }],
      par: 4, bounds: 2000, tMax: 600, predict: 120, view: { x: 180, y: -40, span: 760 }, startCam: 'overview',
    },
    {
      id: 'circularize',
      name: 'Circularize',
      intro: 'You are coasting at the highest point of a stretched orbit. Turn to face prograde (the green marker, your direction of travel) and burn. Press O to zoom out to an overview and watch the dashed path swell into a circle, then F to follow your ship again.',
      objective: 'Get into an orbit that stays between 180 and 220 from Terra.',
      teaches: 'Prograde burns · camera',
      introduces: ['camera'],
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 200, angle: Math.PI / 2, speed: 0.75 } }, heading: 'up', dv: 5, accel: 1 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 180, rMax: 220 }],
      par: 3.2, bounds: 2000, tMax: 600, predict: 100, view: { x: 0, y: 0, span: 600 },
    },
    {
      id: 'reachorbit',
      name: 'Reach Orbit',
      intro: 'Going up is easy. Staying up means going sideways fast enough that you keep falling around the planet instead of into it. Launch straight up to clear the ground, then use A / D to tilt toward the horizon in the direction Gaia spins (its spin gives you free speed), and keep burning. Watch PE, your lowest point: once it is above the ground, you are in orbit.',
      objective: 'Reach an orbit that stays between 70 and 170 from Gaia.',
      teaches: 'Launching into orbit · gravity turn',
      introduces: ['gravityturn'],
      bodies: [
        { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
      ],
      ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, dv: 12, accel: 1.8, ve: 30 }),
      goals: [{ type: 'orbit', body: 'gaia', rMin: 70, rMax: 170 }],
      par: 8.5, bounds: 2000, tMax: 900, predict: 120, view: { x: 0, y: 0, span: 420 }, startCam: 'overview',
    },
    {
      id: 'deorbit',
      name: 'Deorbit',
      intro: 'To come down, slow down. Turn to retrograde (the yellow marker, opposite your motion) and burn until the dashed path dips into Terra.',
      objective: 'Impact Terra.',
      teaches: 'Retrograde burns',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 100, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1 }),
      goals: [{ type: 'hit', body: 'terra' }],
      par: 3.5, bounds: 2000, tMax: 600, predict: 80, view: { x: 0, y: 0, span: 500 },
    },
    {
      id: 'landing',
      name: 'Landing Zone',
      intro: 'Terra turns beneath you, carrying the landing zone with it. Burn retrograde and watch the end of the dashed path: keep burning until its mark turns green and reads IMPACT, then stop. Too early or late and it reads OFF TARGET.',
      objective: 'Impact Terra inside the landing zone.',
      teaches: 'Timing a deorbit burn',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue, spin: 0.05 },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 100, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1 }),
      goals: [{ type: 'hit', body: 'terra', site: { angle: Math.PI, width: 0.9 }, label: 'Landing zone' }],
      par: 3.5, bounds: 2000, tMax: 600, predict: 80, view: { x: 0, y: 0, span: 500 },
    },
    {
      id: 'turn',
      name: 'Turn and Burn',
      intro: 'Burning prograde raises the far side of your orbit. Burn once to climb, coast to the top of the new orbit, then burn prograde again to round it out. This two-burn move is a Hohmann transfer.',
      objective: 'Get into an orbit that stays between 180 and 230 from Terra.',
      teaches: 'Two-burn Hohmann transfer',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: -Math.PI / 2 } }, heading: 'up', dv: 8, accel: 1 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 180, rMax: 230 }],
      par: 4.8, bounds: 2000, tMax: 900, predict: 120, view: { x: 0, y: 0, span: 600 },
    },
    {
      id: 'skimmer',
      name: 'Skimmer',
      intro: 'Pyre is heavy, and the survey needs a pass just above its surface. Going down costs fuel just like going up: burn retrograde to drop, then retrograde again at the bottom so you stop falling and skim around.',
      objective: 'Orbit Pyre, staying between 54 and 68 from its centre.',
      teaches: 'Lowering an orbit',
      bodies: [
        { id: 'pyre', name: 'Pyre', gm: 30000, radius: 50, color: C.red },
      ],
      ship: ship({ start: { orbit: { body: 'pyre', r: 120, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1.3 }),
      goals: [{ type: 'orbit', body: 'pyre', rMin: 54, rMax: 68 }],
      par: 7, bounds: 2000, tMax: 900, predict: 80, view: { x: 0, y: 0, span: 400 },
    },
    {
      id: 'wrongway',
      name: 'Wrong Way',
      intro: 'You are orbiting clockwise and need to go counter-clockwise. Flipping your velocity directly would take more fuel than you have. Instead, climb high: far out you move slowly, so turning around there is cheap. Then fall back and circularize.',
      objective: 'Orbit Terra counter-clockwise, staying between 100 and 160.',
      teaches: 'Orbit direction · bi-elliptic transfer',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0, dir: -1 } }, heading: 'prograde', dv: 16, accel: 2 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 100, rMax: 160, dir: 1 }],
      par: 13, bounds: 3000, tMax: 2400, predict: 400, view: { x: 0, y: 0, span: 1800 },
    },
    {
      id: 'moonshot',
      name: 'Moonshot',
      intro: 'Luna is moving. A transfer takes time, so burn when Luna is roughly 110° ahead of you. Watch the dashed ghost: it shows where Luna will be at your closest approach.',
      objective: 'Impact Luna.',
      teaches: 'Intercepting a moving target · phasing',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 2.4 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1 }),
      goals: [{ type: 'hit', body: 'luna' }],
      par: 4, bounds: 2500, tMax: 1200, predict: 160, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'freereturn',
      name: 'Free Return',
      intro: 'Apollo-style: one burn sends you around the back of Luna, and its gravity swings you home without another burn. Aim to pass just behind Luna, then let the dashed path bring you back near Terra.',
      objective: 'Fly past Luna, then come back within 110 of Terra.',
      teaches: 'Free-return trajectory',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 2.4 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1 }),
      goals: [
        { type: 'reach', body: 'luna', r: 70, label: 'Luna flyby' },
        { type: 'reach', body: 'terra', r: 110, label: 'Home' },
      ],
      par: 4.6, bounds: 3000, tMax: 1500, predict: 260, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'cycler',
      name: 'Cycler',
      intro: 'A cycler loops between two worlds forever. Fly past Luna, swing back close to Terra, then out past Luna again. Small correction burns on the way back are fine.',
      objective: 'Luna flyby → Terra pass → Luna flyby.',
      teaches: 'Repeating trajectories',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 2.4 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1 }),
      goals: [
        { type: 'reach', body: 'luna', r: 70, label: 'Luna flyby' },
        { type: 'reach', body: 'terra', r: 110, label: 'Terra pass' },
        { type: 'reach', body: 'luna', r: 70, label: 'Luna flyby' },
      ],
      par: 5, bounds: 3000, tMax: 2500, predict: 300, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'inertia',
      name: 'Docking',
      intro: 'Station Kepler orbits below you, and lower orbits are faster. Burn retrograde to drop toward it, then match its speed when you meet. If the station is far ahead or behind, wait an orbit or two: the lower, faster orbit lets it catch up.',
      objective: 'Rendezvous with Station Kepler: within 35, relative speed under 1.5.',
      teaches: 'Phasing · rendezvous',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'station', name: 'Station Kepler', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 160, phase: 1.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 250, angle: 0 } }, heading: 'prograde', dv: 6, accel: 0.8 }),
      goals: [{ type: 'rendezvous', body: 'station', dist: 35, relVel: 1.5 }],
      par: 3, bounds: 2000, tMax: 1500, predict: 120, view: { x: 0, y: 0, span: 640 },
    },
    {
      id: 'constellation',
      name: 'Constellation',
      intro: 'Three satellites share your orbit, spaced evenly around it. To catch one ahead of you, drop slightly lower: a lower orbit is faster, so you gain on it. Visit all three in order.',
      objective: 'Fly past Sat A, then B, then C.',
      teaches: 'Phasing within an orbit',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'sata', name: 'Sat A', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 250, phase: 1.05 } },
        { id: 'satb', name: 'Sat B', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 250, phase: 3.14 } },
        { id: 'satc', name: 'Sat C', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 250, phase: 5.24 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 250, angle: 0 } }, heading: 'prograde', dv: 6, accel: 0.8 }),
      goals: [
        { type: 'reach', body: 'sata', r: 25, label: 'Sat A' },
        { type: 'reach', body: 'satb', r: 25, label: 'Sat B' },
        { type: 'reach', body: 'satc', r: 25, label: 'Sat C' },
      ],
      par: 2, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 640 },
    },
    {
      id: 'rescue',
      name: 'Rescue',
      intro: 'A crew capsule is drifting on a stretched orbit, fast when it swings low and slow at the top. Meet it and match its speed. The slow, high end of its orbit is the easiest place to catch it.',
      objective: 'Rendezvous with the capsule: within 20, relative speed under 1.',
      teaches: 'Rendezvous on an eccentric orbit',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'capsule', name: 'Capsule', gm: 0, radius: 4, color: C.station, kind: 'station', orbit: { parent: 'terra', a: 260, e: 0.4, phase: 2.0, argp: 1.0 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 95, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1 }),
      goals: [{ type: 'rendezvous', body: 'capsule', dist: 20, relVel: 1 }],
      par: 5, bounds: 2500, tMax: 2500, predict: 220, view: { x: 0, y: 0, span: 900 },
    },
    {
      id: 'capture',
      name: 'Lunar Capture',
      intro: 'Get to Luna, then burn retrograde near closest approach so Luna\'s gravity captures you. Press V to view your path relative to Luna, which makes the capture orbit easy to see.',
      objective: 'Get captured into an orbit around Luna that stays between 30 and 120.',
      teaches: 'Capture burns · reference frames',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 2.6 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 10, accel: 1 }),
      goals: [{ type: 'orbit', body: 'luna', rMin: 30, rMax: 120 }],
      par: 4.5, bounds: 2500, tMax: 1500, predict: 160, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'moonlanding',
      name: 'Moon Landing',
      intro: 'You are orbiting Luna, and the landing zone turns with it. Burn retrograde to come down, and watch the end of the dashed path: stop burning when it turns green and reads IMPACT.',
      objective: 'Land in the zone on Luna.',
      teaches: 'Landing on a moving, spinning moon',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 3000, radius: 16, color: C.grey, spin: 0.08, orbit: { parent: 'terra', a: 400, phase: 0.5 } },
      ],
      ship: ship({ start: { orbit: { body: 'luna', r: 40, angle: 0 } }, heading: 'prograde', dv: 4, accel: 1 }),
      goals: [{ type: 'hit', body: 'luna', site: { angle: Math.PI / 2, width: 0.9 }, label: 'Landing zone' }],
      par: 2.6, bounds: 2500, tMax: 900, predict: 60, view: { x: 0, y: 0, span: 900 },
    },
    {
      id: 'moon2moon',
      name: 'Moon to Moon',
      intro: 'You are parked around Luna. Selene orbits Terra farther out. Leave Luna in the direction it is moving so its speed adds to yours, then coast out to Selene. V switches between Luna, Terra and Selene views.',
      objective: 'Impact Selene.',
      teaches: 'Leaving a moon · nested orbits',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 3000, radius: 16, color: C.grey, orbit: { parent: 'terra', a: 300, phase: 0 } },
        { id: 'selene', name: 'Selene', gm: 1200, radius: 16, color: C.purple, orbit: { parent: 'terra', a: 620, phase: 1.6 } },
      ],
      ship: ship({ start: { orbit: { body: 'luna', r: 32, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1 }),
      goals: [{ type: 'hit', body: 'selene' }],
      par: 3.5, bounds: 3000, tMax: 2000, predict: 260, view: { x: 0, y: 0, span: 1500 },
    },
    {
      id: 'lagrange',
      name: 'Lagrange Point',
      intro: 'Sixty degrees ahead of Vesta, along its orbit, Terra\'s and Vesta\'s gravity balance: the L4 point. Something parked there rides along forever. Get there and match its motion, the same as docking.',
      objective: 'Park at L4: stay within 40 of it, moving with it, for 30 s.',
      teaches: 'Lagrange points · co-orbital rendezvous',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'vesta', name: 'Vesta', gm: 500, radius: 14, color: C.tan, orbit: { parent: 'terra', a: 400, phase: 1.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 150, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1 }),
      goals: [{ type: 'hold', lagrange: { body: 'vesta', lead: Math.PI / 3 }, r: 40, hold: 30, label: 'L4' }],
      par: 5, bounds: 2500, tMax: 2000, predict: 200, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'trojan',
      name: 'Trojan Swap',
      intro: 'You are parked at L4, 60° ahead of Vesta. The survey wants you at L5, 60° behind it. Climb a little higher so you orbit slower and drift backwards past Vesta, then drop back down to match.',
      objective: 'Park at L5: stay within 40 of it, moving with it, for 30 s.',
      teaches: 'Drifting with orbital period',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'vesta', name: 'Vesta', gm: 500, radius: 14, color: C.tan, orbit: { parent: 'terra', a: 400, phase: 0 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 400, angle: Math.PI / 3 } }, heading: 'prograde', dv: 4, accel: 0.8 }),
      goals: [{ type: 'hold', lagrange: { body: 'vesta', lead: -Math.PI / 3 }, r: 40, hold: 30, label: 'L5' }],
      par: 1.2, bounds: 2500, tMax: 1500, predict: 400, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'eventhorizon',
      name: 'Event Horizon',
      intro: 'A black hole. Your tank holds almost nothing, but at the bottom of your orbit you will be moving incredibly fast, and that is where a burn is worth the most. Coast down, burn prograde at the lowest point, and get out.',
      objective: 'Get more than 3000 from the black hole.',
      teaches: 'Extreme Oberth effect',
      bodies: [
        { id: 'abyss', name: 'Abyss', gm: 300000, radius: 15, color: '#1a1020', kind: 'blackhole' },
      ],
      ship: ship({ start: { orbit: { body: 'abyss', r: 1200, angle: Math.PI / 2, speed: 0.354 } }, heading: 'prograde', dv: 2.4, accel: 2 }),
      goals: [{ type: 'escape', body: 'abyss', r: 3000, label: 'Escape' }],
      par: 1.9, bounds: 6000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 2600 },
    },
    {
      id: 'slingshot',
      name: 'Slingshot',
      intro: 'Not enough fuel to reach the Jump Gate directly. Fly close behind Goliath as it orbits — it will fling you outward. Passing behind a moon steals some of its momentum.',
      objective: 'Fly through the Jump Gate.',
      teaches: 'Gravity assists',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'goliath', name: 'Goliath', gm: 5000, radius: 26, color: C.tan, orbit: { parent: 'terra', a: 350, phase: 2.0 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 5, accel: 1 }),
      goals: [{ type: 'reach', x: -1500, y: 0, r: 120, label: 'Jump Gate' }],
      par: 3.6, bounds: 3500, tMax: 1500, predict: 300, view: { x: -500, y: 0, span: 2400 },
    },
    {
      id: 'twins',
      name: 'Twin Suns',
      intro: 'A binary star system. Gravity here never settles into a neat ellipse — the predicted path shifts as the suns circle each other. Escape Helios and reach Haven.',
      objective: 'Impact Haven.',
      teaches: 'Three-body chaos',
      bodies: [
        { id: 'helios', name: 'Helios', gm: 30000, radius: 40, color: C.sun },
        { id: 'ember', name: 'Ember', gm: 20000, radius: 32, color: C.sun2, orbit: { parent: 'helios', a: 300 } },
        { id: 'haven', name: 'Haven', gm: 2500, radius: 24, color: C.green, orbit: { parent: 'helios', a: 1000, mu: 52500, phase: 2.2, reflex: false } },
      ],
      ship: ship({ start: { orbit: { body: 'helios', r: 62, angle: 0 } }, heading: 'prograde', dv: 12, accel: 1.4 }),
      goals: [{ type: 'hit', body: 'haven' }],
      par: 8, bounds: 4000, tMax: 1800, predict: 250, view: { x: 0, y: 0, span: 2400 },
    },
    {
      id: 'interplanetary',
      name: 'Interplanetary',
      intro: 'You are orbiting Terra, which orbits the Sun. Escape Terra in the direction of its motion to raise your solar orbit out to Rust. Launch window: Rust should be about 55° ahead of Terra.',
      objective: 'Impact Rust.',
      teaches: 'Escape burns · transfer windows',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 200000, radius: 70, color: C.sun },
        { id: 'terra', name: 'Terra', gm: 6000, radius: 24, color: C.blue, orbit: { parent: 'sun', a: 800, phase: 0 } },
        { id: 'rust', name: 'Rust', gm: 4000, radius: 22, color: C.red, orbit: { parent: 'sun', a: 1400, phase: 1.4 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 45, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1.2 }),
      goals: [{ type: 'hit', body: 'rust' }],
      par: 5.5, bounds: 5000, tMax: 3000, predict: 500, view: { x: 0, y: 0, span: 3200 },
    },
    {
      id: 'sundiver',
      name: 'Sundiver',
      intro: 'Falling into a star is surprisingly hard: you have to cancel almost all of your orbital speed. Burn retrograde until your lowest point dips near Sol, dive past it, and coast back out.',
      objective: 'Pass within 160 of Sol, then climb back out past 850.',
      teaches: 'Why the Sun is hard to reach',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 200000, radius: 60, color: C.sun },
      ],
      ship: ship({ start: { orbit: { body: 'sun', r: 900, angle: 0 } }, heading: 'prograde', dv: 8.5, accel: 1.5 }),
      goals: [
        { type: 'reach', body: 'sun', r: 160, label: 'Perihelion' },
        { type: 'escape', body: 'sun', r: 850, label: 'Back out' },
      ],
      par: 7.7, bounds: 4000, tMax: 2000, predict: 300, view: { x: 0, y: 0, span: 2000 },
    },
    {
      id: 'belt',
      name: 'Asteroid Belt',
      intro: 'Halcyon lies beyond a belt of tumbling rocks. Transfer out as usual, but watch the dashed path: a red CRASH mark means a rock will be in your way. Nudge your timing until the path threads through.',
      objective: 'Impact Halcyon without hitting an asteroid.',
      teaches: 'Threading moving obstacles',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 200000, radius: 60, color: C.sun },
        { id: 'halcyon', name: 'Halcyon', gm: 3000, radius: 22, color: C.green, orbit: { parent: 'sun', a: 1100, phase: 1.3 } },
        ...belt('sun', 60, 650, 850, 4242),
      ],
      ship: ship({ start: { orbit: { body: 'sun', r: 450, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1.2 }),
      goals: [{ type: 'hit', body: 'halcyon' }],
      par: 5.5, bounds: 4000, tMax: 2500, predict: 300, view: { x: 0, y: 0, span: 2500 },
    },
    {
      id: 'comet',
      name: 'Comet Chaser',
      intro: 'Comet Iris swings on a long, eccentric orbit — fast near the Sun, slow far out. Raise your orbit until it crosses the comet\'s path, then time it so you both arrive together.',
      objective: 'Impact Comet Iris.',
      teaches: 'Eccentric orbits · Kepler\'s 2nd law',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 400000, radius: 70, color: C.sun },
        { id: 'iris', name: 'Comet Iris', gm: 40, radius: 14, color: C.comet, kind: 'comet', orbit: { parent: 'sun', a: 1000, e: 0.6, phase: 3.6, argp: 0.6 } },
      ],
      ship: ship({ start: { orbit: { body: 'sun', r: 300, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1 }),
      goals: [{ type: 'hit', body: 'iris' }],
      par: 3.2, bounds: 5000, tMax: 3000, predict: 400, view: { x: -300, y: -300, span: 3400 },
    },
    {
      id: 'juggler',
      name: 'Moon Juggler',
      intro: 'Two moons, one tank. Break out of orbit around Luna, cross to Selene and get captured into orbit there, then do the whole thing in reverse and settle back around Luna. Leave each moon in the direction it is moving, and brake at closest approach to get captured.',
      objective: 'Orbit Selene, then return to orbit Luna.',
      teaches: 'Chained escapes and captures',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 14, color: C.grey, orbit: { parent: 'terra', a: 300, phase: 0 } },
        { id: 'selene', name: 'Selene', gm: 1500, radius: 14, color: C.purple, orbit: { parent: 'terra', a: 520, phase: 1.0 } },
      ],
      ship: ship({ start: { orbit: { body: 'luna', r: 28, angle: 0 } }, heading: 'prograde', dv: 11, accel: 1.2 }),
      goals: [
        { type: 'orbit', body: 'selene', rMin: 20, rMax: 120 },
        { type: 'orbit', body: 'luna', rMin: 18, rMax: 90 },
      ],
      par: 8.5, bounds: 3000, tMax: 4000, predict: 260, view: { x: 0, y: 0, span: 1300 },
    },
    {
      id: 'tour',
      name: 'Grand Tour',
      intro: 'Jove\'s moons line up once a generation. Fly past Io and Europa (within the dashed rings), then land on Ganymede. Every flyby bends your path — use them.',
      objective: 'Flyby Io → flyby Europa → impact Ganymede.',
      teaches: 'Multi-body trajectory planning',
      bodies: [
        { id: 'jove', name: 'Jove', gm: 60000, radius: 70, color: C.tan },
        { id: 'io', name: 'Io', gm: 700, radius: 14, color: '#e8d16a', orbit: { parent: 'jove', a: 280, phase: 0.9 } },
        { id: 'europa', name: 'Europa', gm: 1000, radius: 13, color: C.ice, orbit: { parent: 'jove', a: 420, phase: 2.6 } },
        { id: 'ganymede', name: 'Ganymede', gm: 2500, radius: 20, color: C.purple, orbit: { parent: 'jove', a: 650, phase: 4.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'jove', r: 130, angle: 0 } }, heading: 'prograde', dv: 11, accel: 1.5 }),
      goals: [
        { type: 'reach', body: 'io', r: 60, label: 'Io flyby' },
        { type: 'reach', body: 'europa', r: 60, label: 'Europa flyby' },
        { type: 'hit', body: 'ganymede' },
      ],
      par: 6.5, bounds: 3000, tMax: 3000, predict: 200, view: { x: 0, y: 0, span: 1500 },
    },
  ];

  // ---------------------------------------------------------------- World 2
  // Payloads: rockets that come apart. Stages are dropped when they run dry,
  // payloads are handed off or released to coast on their own, and every
  // piece you drop keeps flying.
  const WORLD2 = [
    // Chapter 1 · Hand-off: drop the spent stage, fly the payload.
    {
      id: 'satellite',
      name: 'Launch a Satellite',
      intro: 'Your booster can lift the satellite high, but it does not have the fuel to reach orbit. Launch and tilt toward the horizon as you climb, just like in Reach Orbit. When the booster runs dry, press E to deploy the satellite. It is much lighter, so its small tank goes a long way: coast to the top of the arc and burn prograde until your lowest point clears the ground.',
      objective: 'Put the satellite in an orbit that stays between 60 and 200.',
      teaches: 'Payload deploy',
      introduces: ['deploy'],
      bodies: [
        { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
      ],
      ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, dv: 6.5, accel: 1.8, ve: 30, payload: { dv: 6, accel: 0.9 } }),
      goals: [{ type: 'orbit', body: 'gaia', rMin: 60, rMax: 200 }],
      par: 9, bounds: 2000, tMax: 900, predict: 120, view: { x: 0, y: 0, span: 420 }, startCam: 'overview',
    },
    {
      id: 'burndry',
      name: 'Burn It Dry',
      intro: 'A booster is heavy, and every drop of fuel in it is Δv you only get while it is attached. Raise your orbit with the booster: burn prograde until the high point reaches the band, coast up to it, and keep using the booster there. Drop it only when it is empty. The satellite\'s own tank is small and cannot finish the job alone.',
      objective: 'Put the satellite in an orbit between 200 and 260 from Terra.',
      teaches: 'Use every stage fully',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', stack: [
        { name: 'Booster', dv: 3.5, accel: 1.0 },
        { name: 'Satellite', dv: 2.0, accel: 0.5, dry: 0.3 },
      ] }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 200, rMax: 260 }],
      par: 5.2, bounds: 2000, tMax: 900, predict: 160, view: { x: 0, y: 0, span: 640 },
    },
    {
      id: 'againstspin',
      name: 'Against the Spin',
      intro: 'This customer wants a clockwise orbit, against Kiri\'s spin. Launching that way you lose the free speed the spin gives you and must cancel it as well, so it takes a lot more Δv. Lift off, tilt toward the left (clockwise), drop the booster when it runs dry and let the satellite finish.',
      objective: 'Put the satellite in a clockwise orbit between 70 and 170 from Kiri.',
      teaches: 'Launch direction · retrograde orbit',
      bodies: [
        { id: 'kiri', name: 'Kiri', gm: 2000, radius: 40, color: C.tan, spin: 0.06 },
      ],
      ship: ship({ start: { landed: { body: 'kiri', angle: Math.PI / 2 } }, ve: 30, stack: [
        { name: 'Booster', dv: 9, accel: 1.8 },
        { name: 'Satellite', dv: 5.5, accel: 0.9, dry: 0.25 },
      ] }),
      goals: [{ type: 'orbit', body: 'kiri', rMin: 70, rMax: 170, dir: -1 }],
      par: 14.3, bounds: 2000, tMax: 900, predict: 120, view: { x: 0, y: 0, span: 420 }, startCam: 'overview',
    },
    {
      id: 'stationary',
      name: 'Stationary',
      intro: 'At just the right height a satellite circles once for every turn of the planet, so from the ground it seems to hang still in the sky. For Mira that height is 140. Launch, let the booster climb as far as it can, drop it, and use the satellite to raise and round off the orbit at 140.',
      objective: 'Put the satellite in an orbit between 130 and 150 from Mira, turning the same way Mira spins.',
      teaches: 'Synchronous orbit',
      bodies: [
        { id: 'mira', name: 'Mira', gm: 2000, radius: 40, color: C.green, spin: 0.027 },
      ],
      ship: ship({ start: { landed: { body: 'mira', angle: Math.PI / 2 } }, ve: 30, stack: [
        { name: 'Booster', dv: 6.5, accel: 1.8 },
        { name: 'Satellite', dv: 6.5, accel: 0.8, dry: 0.25 },
      ] }),
      goals: [{ type: 'orbit', body: 'mira', rMin: 130, rMax: 150, dir: 1 }],
      par: 12, bounds: 2000, tMax: 1200, predict: 160, view: { x: 0, y: 0, span: 440 }, startCam: 'overview',
    },
    {
      id: 'moonprobe',
      name: 'Moon Probe',
      intro: 'The booster sends you to Luna; the probe has to stop there. Burn prograde so your path reaches Luna\'s orbit just as Luna arrives. Near Luna, burn retrograde to be captured: finish the transfer stage\'s fuel first, drop it, then let the probe finish the job.',
      objective: 'Put the probe in an orbit between 25 and 80 from Luna.',
      teaches: 'Transfer stage + capture',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 420, phase: 2.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', stack: [
        { name: 'Transfer stage', dv: 4.5, accel: 1.0 },
        { name: 'Probe', dv: 2.8, accel: 0.5, dry: 0.3 },
      ] }),
      goals: [{ type: 'orbit', body: 'luna', rMin: 25, rMax: 80 }],
      par: 6.2, bounds: 2500, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'homecoming',
      name: 'Homecoming',
      intro: 'Time to bring the samples home. The return stage throws you out of Luna\'s orbit and back toward Terra; the capsule has only a sip of fuel for aiming. Drop the stage once your path falls to Terra, then nudge the capsule so it lands in the recovery zone. Terra turns while you fall, so the zone moves.',
      objective: 'Land the capsule in the recovery zone on Terra.',
      teaches: 'Return stage · targeted landing',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue, spin: 0.03 },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 420, phase: 0 } },
      ],
      ship: ship({ start: { orbit: { body: 'luna', r: 32, angle: Math.PI / 2 } }, heading: 'prograde', stack: [
        { name: 'Return stage', dv: 3.5, accel: 0.8 },
        { name: 'Capsule', dv: 1.2, accel: 0.4, dry: 0.3, sprite: 'satellite' },
      ] }),
      goals: [{ type: 'hit', body: 'terra', site: { angle: 0, width: 0.7 }, label: 'Recovery zone' }],
      par: 3.8, bounds: 2500, tMax: 1500, predict: 300, view: { x: 0, y: 0, span: 1000 },
    },

    // Chapter 2 · Passive drop: cargo has no engine and coasts where you leave it.
    {
      id: 'releasepoint',
      name: 'Release Point',
      intro: 'You carry a supply pod with no engine. Drop it and it simply coasts, so your dashed path is exactly where it will go. Burn retrograde until the path ends in the green drop zone (it reads DROP NOW → IMPACT), press E to release the pod, then burn prograde to save yourself before you hit the ground too.',
      objective: 'Land the pod in the drop zone, then get back into a safe orbit.',
      teaches: 'Passive drop · release timing',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue, spin: 0.03 },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 150, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1, cargo: [{ id: 'pod', name: 'Pod', mass: 0.3 }] }),
      goals: [
        { type: 'hit', body: 'terra', craft: 'pod', site: { angle: Math.PI, width: 0.8 }, label: 'Drop zone' },
        { type: 'orbit', body: 'terra', rMin: 65, rMax: 200 },
      ],
      par: 4.5, bounds: 2000, tMax: 900, predict: 90, view: { x: 0, y: 0, span: 440 },
    },
    {
      id: 'impactor',
      name: 'Impactor',
      intro: 'Science wants a crater on Luna, and a camera in orbit to watch it. Aim your whole ship at Luna, drop the impactor (E) while the path still ends on Luna, then steer yourself off the collision course and brake into orbit around Luna.',
      objective: 'Crash the impactor into Luna, then orbit Luna between 30 and 100.',
      teaches: 'Drop, then dodge',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 420, phase: 2.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1, cargo: [{ id: 'impactor', name: 'Impactor', mass: 0.4 }] }),
      goals: [
        { type: 'hit', body: 'luna', craft: 'impactor' },
        { type: 'orbit', body: 'luna', rMin: 30, rMax: 100 },
      ],
      par: 6.8, bounds: 2500, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'relaydrop',
      name: 'Relay Drop',
      intro: 'A relay has no engine, so it stays on whatever orbit you let it go on. Climb to the band, round off your orbit there, release the relay, then come back down to your own orbit.',
      objective: 'Leave the relay in an orbit between 280 and 340, then return to an orbit between 120 and 180.',
      teaches: 'Place cargo on an orbit',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 150, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1, cargo: [{ id: 'relay', name: 'Relay', mass: 0.4 }] }),
      goals: [
        { type: 'orbit', body: 'terra', craft: 'relay', rMin: 280, rMax: 340 },
        { type: 'orbit', body: 'terra', rMin: 120, rMax: 180 },
      ],
      par: 6, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 760 },
    },
    {
      id: 'moonmail',
      name: 'Moon Mail',
      intro: 'Luna Base needs a supply pod, but your carrier only has fuel for one trip out and a nudge, not a landing. Burn so your path ends on Luna, drop the pod (E) while it still reads DROP NOW → IMPACT, then nudge yourself sideways so you swing around behind Luna instead. Luna\'s gravity throws you home on a free return.',
      objective: 'Land the pod on Luna, then come back within 110 of Terra.',
      teaches: 'Drop on a flyby',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 2.4 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 5.5, accel: 1, cargo: [{ id: 'pod', name: 'Pod', mass: 0.3 }] }),
      goals: [
        { type: 'hit', body: 'luna', craft: 'pod' },
        { type: 'reach', body: 'terra', r: 110, label: 'Home' },
      ],
      par: 4.7, bounds: 3000, tMax: 1500, predict: 260, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'twinprobes',
      name: 'Twin Probes',
      intro: 'Two probes, two moons. Each probe only follows the path you are on when you drop it, so line up a path to one moon, drop a probe, then change course for the other and drop the second. They can land in either order. Don\'t follow them in: the carrier has to end up in a safe orbit of its own.',
      objective: 'Land probe A on Io and probe B on Rhea, then put the carrier in an orbit between 80 and 600.',
      teaches: 'Two drops, two targets',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'io', name: 'Io', gm: 600, radius: 15, color: '#e8d16a', orbit: { parent: 'terra', a: 260, phase: 1.4 } },
        { id: 'rhea', name: 'Rhea', gm: 800, radius: 16, color: C.purple, orbit: { parent: 'terra', a: 460, phase: 2.6 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 110, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1, cargo: [{ id: 'a', name: 'Probe A', mass: 0.25 }, { id: 'b', name: 'Probe B', mass: 0.25 }] }),
      goals: [
        { type: 'hit', body: 'io', craft: 'a' },
        { type: 'hit', body: 'rhea', craft: 'b' },
        { type: 'orbit', body: 'terra', rMin: 80, rMax: 600 },
      ],
      par: 4.8, bounds: 2500, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 1100 },
    },
    {
      id: 'satnet',
      name: 'Constellation',
      intro: 'Three satellites cover a whole planet if they are spread evenly around it. But a dropped satellite rides right alongside you on the same orbit, so waiting does nothing. Change your lap time instead: after a drop, burn prograde so one lap takes about a third longer. When you come back around, the last satellite is a third of a lap ahead. Burn retrograde at the same spot to round off, and drop the next. Last, park the empty carrier in a graveyard orbit above the constellation, out of everyone\'s way.',
      objective: 'Spread three satellites at least 100° apart in orbits between 180 and 230 from Terra, then park the carrier in an orbit between 280 and 400.',
      teaches: 'Phasing orbits',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0 } }, heading: 'prograde', dv: 8.5, accel: 1, cargo: [
        { id: 's1', name: 'Sat 1', mass: 0.2 }, { id: 's2', name: 'Sat 2', mass: 0.2 }, { id: 's3', name: 'Sat 3', mass: 0.2 },
      ] }),
      goals: [
        { type: 'spread', body: 'terra', crafts: ['s1', 's2', 's3'], rMin: 180, rMax: 230, minSep: 100 * Math.PI / 180 },
        { type: 'orbit', body: 'terra', rMin: 280, rMax: 400, label: 'Graveyard orbit' },
      ],
      par: 8, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 640 },
    },

    // Chapter 3 · Stacks: three or more stages, each lighter than the last.
    {
      id: 'threestages',
      name: 'Three Stages',
      intro: 'A taller rocket for a higher orbit: booster, upper stage, then the satellite. Climb and tilt over as in Reach Orbit. Each time a stage runs dry, press E to drop it and light the next one. Every stage you drop makes the rest of the rocket lighter.',
      objective: 'Put the satellite in an orbit that stays between 150 and 280 from Atlas.',
      teaches: 'Multi-stage rockets',
      bodies: [
        { id: 'atlas', name: 'Atlas', gm: 2000, radius: 40, color: C.green, spin: 0.085 },
      ],
      ship: ship({ start: { landed: { body: 'atlas', angle: Math.PI / 2 } }, ve: 30, stack: [
        { name: 'Booster', dv: 4.5, accel: 1.8 },
        { name: 'Upper stage', dv: 4, accel: 1.0, dry: 0.5 },
        { name: 'Satellite', dv: 3, accel: 0.6, dry: 0.25 },
      ] }),
      goals: [{ type: 'orbit', body: 'atlas', rMin: 150, rMax: 280 }],
      par: 10, bounds: 2500, tMax: 1200, predict: 160, view: { x: 0, y: 0, span: 640 }, startCam: 'overview',
    },
    {
      id: 'kickstage',
      name: 'Kick Stage',
      intro: 'The upper stage throws the satellite toward a high orbit; a small kick motor rounds it off at the top. The kick motor is weak, so its burn is long: start it a little before you reach the high point so the burn is centred on it. The satellite\'s own thrusters are only for trimming.',
      objective: 'Put the satellite in an orbit between 330 and 380 from Terra.',
      teaches: 'Apogee kick · long, weak burns',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', stack: [
        { name: 'Upper stage', dv: 4.0, accel: 0.8 },
        { name: 'Kick motor', dv: 2.4, accel: 0.25, dry: 0.5 },
        { name: 'Satellite', dv: 0.7, accel: 0.2, dry: 0.25 },
      ] }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 330, rMax: 380 }],
      par: 6.9, bounds: 2500, tMax: 1200, predict: 220, view: { x: 0, y: 0, span: 900 },
    },
    {
      id: 'escapeprobe',
      name: 'Escape Velocity',
      intro: 'To leave a planet for good you need escape velocity: enough speed that gravity can slow you but never stop you. Three stages get you there. Launch with the spin, tilt over early and keep burning sideways: speed gained low down is worth the most.',
      objective: 'Fly the probe 900 away from Gaia.',
      teaches: 'Escape velocity',
      bodies: [
        { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
      ],
      ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, ve: 30, stack: [
        { name: 'Booster', dv: 5, accel: 2 },
        { name: 'Upper stage', dv: 4, accel: 1.2, dry: 0.5 },
        { name: 'Probe', dv: 3, accel: 0.6, dry: 0.25 },
      ] }),
      goals: [{ type: 'escape', body: 'gaia', r: 900, label: 'Escape' }],
      par: 8, bounds: 3000, tMax: 900, predict: 200, view: { x: 0, y: 0, span: 900 }, startCam: 'overview',
    },
    {
      id: 'sundiverprobe',
      name: 'Solar Probe',
      intro: 'A probe to touch the Sun\'s corona. Falling inward means cancelling almost all of your orbital speed, more than any one stage can do. Burn retrograde through all three stages, dropping each as it runs dry, until your lowest point is inside the corona ring.',
      objective: 'Fly the probe within 100 of Sol.',
      teaches: 'Stacks for big Δv',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 200000, radius: 60, color: C.sun },
      ],
      ship: ship({ start: { orbit: { body: 'sun', r: 900, angle: 0 } }, heading: 'retrograde', stack: [
        { name: 'Booster', dv: 4, accel: 1.2 },
        { name: 'Upper stage', dv: 3, accel: 0.8, dry: 0.5 },
        { name: 'Probe', dv: 2.5, accel: 0.5, dry: 0.25 },
      ] }),
      goals: [{ type: 'reach', body: 'sun', r: 100, label: 'Corona' }],
      par: 9.2, bounds: 4000, tMax: 1500, predict: 300, view: { x: 0, y: 0, span: 2000 },
    },
    {
      id: 'outerplanet',
      name: 'Outer Planet',
      intro: 'An orbiter for Rust. The transfer stage escapes Terra in the direction Terra moves, sending you out along a Hohmann transfer; leave when Rust is about 55° ahead of Terra. When you arrive, drop the empty transfer stage and brake the orbiter into orbit around Rust.',
      objective: 'Put the orbiter in an orbit between 40 and 140 from Rust.',
      teaches: 'Interplanetary orbiter',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 200000, radius: 70, color: C.sun },
        { id: 'terra', name: 'Terra', gm: 6000, radius: 24, color: C.blue, orbit: { parent: 'sun', a: 800, phase: 0 } },
        { id: 'rust', name: 'Rust', gm: 4000, radius: 22, color: C.red, orbit: { parent: 'sun', a: 1400, phase: 1.4 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 45, angle: 0 } }, heading: 'prograde', stack: [
        { name: 'Transfer stage', dv: 5.2, accel: 1.2 },
        { name: 'Orbiter', dv: 3.3, accel: 0.5, dry: 0.3 },
      ] }),
      goals: [{ type: 'orbit', body: 'rust', rMin: 40, rMax: 140 }],
      par: 7, bounds: 5000, tMax: 3000, predict: 500, view: { x: 0, y: 0, span: 3200 },
    },
    {
      id: 'splashdown',
      name: 'Splashdown',
      intro: 'Spent boosters fall back to the ground, so launch sites aim them at empty ocean. The splash zone here is close to the pad. Climb steeply, and drop the booster (E) when its dashed path ends in the zone: the readout says DEPLOY NOW → IMPACT. Any fuel left in it is wasted, so the satellite has to make up the difference.',
      objective: 'Drop the booster into the splash zone and put the satellite in an orbit between 60 and 200.',
      teaches: 'Range safety',
      bodies: [
        { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
      ],
      ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, ve: 30, stack: [
        { id: 'booster', name: 'Booster', dv: 6.5, accel: 1.8 },
        { name: 'Satellite', dv: 6.5, accel: 0.9, dry: 0.25 },
      ] }),
      goals: [
        { type: 'hit', body: 'gaia', craft: 'booster', site: { angle: 1.7, width: 0.35 }, label: 'Splash zone' },
        { type: 'orbit', body: 'gaia', rMin: 60, rMax: 200 },
      ],
      par: 8.5, bounds: 2000, tMax: 900, predict: 120, view: { x: 0, y: 0, span: 420 }, startCam: 'overview',
    },

    // Chapter 4 · Debris: everything you drop keeps flying.
    {
      id: 'clearstation',
      name: 'Clear the Station',
      intro: 'Kepler Station orbits just below you, and spent stages are dangerous: once dropped they drift forever. A booster dropped right here sinks into a lower orbit and drifts straight into the station. Even a near miss doesn\'t count: if the stage\'s orbit crosses the station\'s, they meet eventually. Burn the booster first so its leftover orbit stays clear of the station\'s, then deploy and raise the satellite. The red dashed line shows where a dropped stage will go.',
      objective: 'Put the satellite in an orbit between 260 and 340 without your spent booster hitting the station.',
      teaches: 'Debris hazards',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'kepler', name: 'Kepler Station', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 15, orbit: { parent: 'terra', a: 171, phase: -0.397 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 200, angle: 0 } }, heading: 'prograde', stack: [
        { name: 'Booster', dv: 0.9, accel: 0.8 },
        { name: 'Satellite', dv: 2.5, accel: 0.6, dry: 0.3 },
      ] }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 260, rMax: 340 }],
      par: 2, bounds: 2000, tMax: 1200, predict: 160, view: { x: 0, y: 0, span: 760 },
    },
    {
      id: 'busyorbit',
      name: 'Busy Orbit',
      intro: 'Orbital Lab circles Gaia at 110, right where a normal launch leaves its booster. Your booster is strong enough to reach orbit on its own, and a booster left in an orbit that crosses the lab\'s will hit it sooner or later. Drop it while it will still fall back to Gaia, or carry it to an orbit that stays clear of the lab\'s, then raise the satellite.',
      objective: 'Put the satellite in an orbit between 160 and 230 without leaving the booster on a path that hits Orbital Lab.',
      teaches: 'Where your booster ends up',
      bodies: [
        { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
        { id: 'lab', name: 'Orbital Lab', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 12, orbit: { parent: 'gaia', a: 110, phase: 2.4 } },
      ],
      ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, ve: 30, stack: [
        { name: 'Booster', dv: 8, accel: 1.8 },
        { name: 'Satellite', dv: 4, accel: 0.8, dry: 0.25 },
      ] }),
      goals: [{ type: 'orbit', body: 'gaia', rMin: 160, rMax: 230 }],
      par: 8, bounds: 2000, tMax: 900, predict: 140, view: { x: 0, y: 0, span: 520 }, startCam: 'overview',
    },
    {
      id: 'leavenojunk',
      name: 'Leave No Junk',
      intro: 'Space agencies now have to bring their spent upper stages down instead of leaving them in orbit. Use the upper stage to climb, then at the top of the transfer burn it retrograde until your path dips into Terra. Turn back to prograde and drop it: the separation spring pushes it the opposite way from your nose, down toward Terra. It falls and burns up while the satellite rounds off the orbit on its own engine.',
      objective: 'Make the upper stage reenter Terra, and put the satellite in an orbit between 220 and 280.',
      teaches: 'Deorbiting the upper stage',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 100, angle: 0 } }, heading: 'prograde', stack: [
        { id: 'upper', name: 'Upper stage', dv: 4.8, accel: 0.8 },
        { name: 'Satellite', dv: 5.4, accel: 0.9, dry: 0.3 },
      ] }),
      goals: [
        { type: 'hit', body: 'terra', craft: 'upper', deorbit: true },
        { type: 'orbit', body: 'terra', rMin: 220, rMax: 280 },
      ],
      par: 7.8, bounds: 2000, tMax: 1200, predict: 200, view: { x: 0, y: 0, span: 640 },
    },
    {
      id: 'fueldepot',
      name: 'Fuel Depot',
      intro: 'The customer wants a high orbit, higher than your tanks can reach. A fuel canister circles at 250: time your climb so your path passes through it (it glows green when it will), top up, and keep going.',
      objective: 'Put the satellite in an orbit between 420 and 480 from Terra.',
      teaches: 'Pickups on the way up',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'canister', name: 'Fuel', gm: 0, radius: 7, color: '#ffb35a', kind: 'fuel', pickup: true, dv: 3, orbit: { parent: 'terra', a: 250, phase: 1.6 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 100, angle: 0 } }, heading: 'prograde', stack: [
        { name: 'Transfer stage', dv: 3.5, accel: 1.0 },
        { name: 'Satellite', dv: 2, accel: 0.5, dry: 0.3 },
      ] }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 420, rMax: 480 }],
      par: 7.2, bounds: 2500, tMax: 1500, predict: 260, view: { x: 0, y: 0, span: 1100 },
    },
    {
      id: 'trojanrelay',
      name: 'Relay Pair',
      intro: 'Two relays for Vesta\'s Lagrange points, where anything parked rides along with Vesta forever. You start at L4, 60° ahead of Vesta: drop the first relay right away. Vesta sits between the two points. Either climb well above its orbit (a nudge too small leaves you drifting into Vesta: watch the dashed path) to drift back to L5, or drop lower to race ahead the long way round. Match L5\'s motion and drop the second relay, then head down to a working orbit.',
      objective: 'Park one relay at L4 and one at L5, each staying within 40 for 30 s, then return to an orbit between 150 and 300.',
      teaches: 'Lagrange drops',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'vesta', name: 'Vesta', gm: 200, radius: 10, color: C.tan, orbit: { parent: 'terra', a: 400, phase: 0 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 400, angle: Math.PI / 3 } }, heading: 'prograde', dv: 6, accel: 0.8, cargo: [
        { id: 'r4', name: 'Relay L4', mass: 0.2 }, { id: 'r5', name: 'Relay L5', mass: 0.2 },
      ] }),
      goals: [
        { type: 'hold', craft: 'r4', lagrange: { body: 'vesta', lead: Math.PI / 3 }, r: 40, hold: 30, label: 'L4' },
        { type: 'hold', craft: 'r5', lagrange: { body: 'vesta', lead: -Math.PI / 3 }, r: 40, hold: 30, label: 'L5' },
        { type: 'orbit', body: 'terra', rMin: 150, rMax: 300 },
      ],
      par: 4.5, bounds: 2500, tMax: 1500, predict: 400, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'junkyard',
      name: 'Junkyard',
      intro: 'Two weather satellites already circle Gaia, at 100 and 170. Your three-stage rocket is going higher, and no spent stage may be left on an orbit that crosses theirs. The booster falls back by itself. The upper stage is the problem: drop it while its path still falls back to Gaia, or only once its whole orbit is above 180.',
      objective: 'Put the satellite in an orbit between 230 and 300 without endangering the weather satellites.',
      teaches: 'Planning every drop',
      bodies: [
        { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
        { id: 'w1', name: 'Weather 1', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 10, orbit: { parent: 'gaia', a: 100, phase: 0.6 } },
        { id: 'w2', name: 'Weather 2', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 10, orbit: { parent: 'gaia', a: 170, phase: 3.5 } },
      ],
      ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, ve: 30, stack: [
        { name: 'Booster', dv: 5, accel: 1.8 },
        { name: 'Upper stage', dv: 4.5, accel: 1.0, dry: 0.5 },
        { name: 'Satellite', dv: 3, accel: 0.6, dry: 0.25 },
      ] }),
      goals: [{ type: 'orbit', body: 'gaia', rMin: 230, rMax: 300 }],
      par: 8.5, bounds: 2500, tMax: 1200, predict: 160, view: { x: 0, y: 0, span: 700 }, startCam: 'overview',
    },

    // Chapter 5 · Grand missions: everything together.
    {
      id: 'apollo',
      name: 'Lander and Orbiter',
      intro: 'One ship, two jobs. Fly to Luna with the lander aboard. On the way in, drop it on a path that ends in the landing zone (Luna turns, so the zone moves), then steer yourself off the collision course and brake into orbit to relay its signal home.',
      objective: 'Land the lander in the zone on Luna, then orbit Luna between 30 and 100.',
      teaches: 'Targeted drop + capture',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, spin: 0.02, orbit: { parent: 'terra', a: 420, phase: 2.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 8.5, accel: 1, cargo: [{ id: 'lander', name: 'Lander', mass: 0.4 }] }),
      goals: [
        { type: 'hit', body: 'luna', craft: 'lander', site: { angle: 2.3, width: 1.0 }, label: 'Landing zone' },
        { type: 'orbit', body: 'luna', rMin: 30, rMax: 100 },
      ],
      par: 6.8, bounds: 2500, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 1000 },
    },
    {
      id: 'cometprobe',
      name: 'Deep Impact',
      intro: 'Comet Iris on its long, eccentric orbit. Get on a collision course, release the impactor, then nudge yourself aside so you sail past just behind it and photograph the crater. The flyby only counts after the impact.',
      objective: 'Crash the impactor into Iris, then fly within 120 of the comet.',
      teaches: 'Impactor + flyby',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 400000, radius: 70, color: C.sun },
        { id: 'iris', name: 'Comet Iris', gm: 40, radius: 14, color: C.comet, kind: 'comet', orbit: { parent: 'sun', a: 1000, e: 0.6, phase: 3.6, argp: 0.6 } },
      ],
      ship: ship({ start: { orbit: { body: 'sun', r: 300, angle: 0 } }, heading: 'prograde', dv: 6, accel: 1, cargo: [{ id: 'impactor', name: 'Impactor', mass: 0.3 }] }),
      goals: [
        { type: 'hit', body: 'iris', craft: 'impactor' },
        { type: 'reach', body: 'iris', r: 120, label: 'Flyby' },
      ],
      par: 3.2, bounds: 5000, tMax: 3000, predict: 400, view: { x: -300, y: -300, span: 3400 },
    },
    {
      id: 'voyager',
      name: 'Voyager',
      intro: 'The probe is bound for deep space, far beyond what your fuel can reach directly. Use the transfer stage to fly close behind Goliath and let it fling you outward, then drop the stage and spend the probe\'s fuel where it counts: low and fast.',
      objective: 'Send the probe 1600 away from Terra.',
      teaches: 'Gravity assist with a stack',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'goliath', name: 'Goliath', gm: 5000, radius: 26, color: C.tan, orbit: { parent: 'terra', a: 350, phase: 2.0 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', stack: [
        { name: 'Transfer stage', dv: 3, accel: 1 },
        { name: 'Probe', dv: 1.5, accel: 0.4, dry: 0.3 },
      ] }),
      goals: [{ type: 'escape', body: 'terra', r: 1600, label: 'Deep space' }],
      par: 3.6, bounds: 3500, tMax: 1500, predict: 300, view: { x: 0, y: 0, span: 2400 },
    },
    {
      id: 'moonnet',
      name: 'Moon Network',
      intro: 'A relay for each moon, so the far side of both can talk to Terra. Fly to Luna, brake into orbit and drop the first relay. Then break out of Luna\'s orbit in the direction Luna moves, cross to Selene, brake into orbit and drop the second. Finally, crash the empty carrier into Selene so it can\'t drift into your relays.',
      objective: 'Leave one relay orbiting Luna (25–70) and one orbiting Selene (25–100), then crash the carrier into Selene.',
      teaches: 'Multi-stop delivery',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 16, color: C.grey, orbit: { parent: 'terra', a: 300, phase: 2.0 } },
        { id: 'selene', name: 'Selene', gm: 1500, radius: 16, color: C.purple, orbit: { parent: 'terra', a: 520, phase: 4.0 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 110, angle: 0 } }, heading: 'prograde', dv: 12.5, accel: 1, cargo: [
        { id: 'ra', name: 'Relay A', mass: 0.25 }, { id: 'rb', name: 'Relay B', mass: 0.25 },
      ] }),
      goals: [
        { type: 'orbit', body: 'luna', craft: 'ra', rMin: 25, rMax: 70 },
        { type: 'orbit', body: 'selene', craft: 'rb', rMin: 25, rMax: 100 },
        { type: 'hit', body: 'selene', deorbit: true },
      ],
      par: 10.8, bounds: 2500, tMax: 3000, predict: 260, view: { x: 0, y: 0, span: 1300 },
    },
    {
      id: 'beltsurvey',
      name: 'Belt Survey',
      intro: 'Two asteroids worth a closer look: Ceres in the inner belt and Pallas in the outer. Probes have no engines and asteroids have almost no gravity, so each drop has to be dead on. Climb through the belt, drop one probe on a path that meets each target, and stay clear of the rocks yourself: the carrier flies on beyond the belt to Halcyon\'s orbit.',
      objective: 'Crash probe A into Ceres and probe B into Pallas, then fly the carrier out past 1000 from Sol.',
      teaches: 'Precision drops on small targets',
      bodies: [
        { id: 'sun', name: 'Sol', gm: 200000, radius: 60, color: C.sun },
        { id: 'ceres', name: 'Ceres', kind: 'rock', noRail: false, gm: 0, radius: 20, color: '#b9ad98', orbit: { parent: 'sun', a: 650, phase: 1.0 } },
        { id: 'pallas', name: 'Pallas', kind: 'rock', noRail: false, gm: 0, radius: 20, color: '#a7b4c4', orbit: { parent: 'sun', a: 860, phase: 2.0 } },
        ...belt('sun', 30, 690, 820, 977),
      ],
      ship: ship({ start: { orbit: { body: 'sun', r: 450, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1.2, cargo: [
        { id: 'pa', name: 'Probe A', mass: 0.2 }, { id: 'pb', name: 'Probe B', mass: 0.2 },
      ] }),
      goals: [
        { type: 'hit', body: 'ceres', craft: 'pa' },
        { type: 'hit', body: 'pallas', craft: 'pb' },
        { type: 'escape', body: 'sun', r: 1000, label: 'Beyond the belt' },
      ],
      par: 4.6, bounds: 4000, tMax: 3000, predict: 400, view: { x: 0, y: 0, span: 2200 },
    },
    {
      id: 'granddeploy',
      name: 'Grand Deployment',
      intro: 'The big one: launch a carrier with three satellites past a busy orbit and spread them into a constellation. Mind Orbital Lab at 110 when you drop the booster (remember the separation spring pushes it the opposite way from your nose). Then circularise in the band, drop a satellite, and use phasing laps (a third longer each) to space out the other two. Then bring the empty carrier down into Gaia, without hitting the lab on the way.',
      objective: 'Spread three satellites at least 100° apart in orbits between 170 and 230 from Gaia, then deorbit the carrier, without endangering Orbital Lab.',
      teaches: 'Everything at once',
      bodies: [
        { id: 'gaia', name: 'Gaia', gm: 2000, radius: 40, color: C.blue, spin: 0.085 },
        { id: 'lab', name: 'Orbital Lab', gm: 0, radius: 4, color: C.station, kind: 'station', protect: true, protectRadius: 12, orbit: { parent: 'gaia', a: 110, phase: 2.4 } },
      ],
      ship: ship({ start: { landed: { body: 'gaia', angle: Math.PI / 2 } }, ve: 30, stack: [
        { name: 'Booster', dv: 8, accel: 1.8 },
        { name: 'Carrier', dv: 5, accel: 0.8, dry: 0.4 },
      ], cargo: [
        { id: 'g1', name: 'Sat 1', mass: 0.15 }, { id: 'g2', name: 'Sat 2', mass: 0.15 }, { id: 'g3', name: 'Sat 3', mass: 0.15 },
      ] }),
      goals: [
        { type: 'spread', body: 'gaia', crafts: ['g1', 'g2', 'g3'], rMin: 170, rMax: 230, minSep: 100 * Math.PI / 180 },
        { type: 'hit', body: 'gaia', deorbit: true },
      ],
      par: 10.8, bounds: 2500, tMax: 2600, predict: 200, view: { x: 0, y: 0, span: 560 }, startCam: 'overview',
    },
  ];
  for (const L of WORLD2) L.world = 2;
  LEVELS.push(...WORLD2);

  // World 3: No-Fly Zones. Keep-out zones (ship only, or closed to
  // everything: zone 'all'), weaving through rocks and zone fields, and
  // side-thruster budgets that make every flip count.
  // ---- BEGIN WORLD 3 (generated by tools/w3/build.js from tools/w3/ch*.js; edit those) ----
  const WORLD3 = [
    // Chapter: Keep Out
    {
      "id": "nofly",
      "name": "No-Fly Zone",
      "intro": "A guard satellite circles between your low orbit and the high orbit you need, inside a red keep-out zone that moves with it. Your dashed path turns red where it would cross the zone. Wait until the guard has gone by, then burn prograde to climb and round off your orbit at the top.",
      "objective": "Orbit Terra between 280 and 360 without entering the guard's keep-out zone.",
      "teaches": "Keep-out zones",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "guard",
          "name": "Guard",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 60,
          "orbit": {
            "parent": "terra",
            "a": 210,
            "phase": 1.2
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 120,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.2255409284924679,
            "thrust": 2.225540928492468,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 280,
          "rMax": 360
        }
      ],
      "par": 5,
      "bounds": 2000,
      "tMax": 1200,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 800
      }
    },
    {
      "id": "patrol",
      "name": "Patrol",
      "intro": "Three guard satellites now patrol the orbit between you and the high orbit you need, each inside a red keep-out zone that moves with it. The gaps between them are narrower, and the climb has to fit through one all the way up. Watch where your dashed path turns red, wait for a gap, then climb through it and round off your orbit up top.",
      "objective": "Orbit Terra between 300 and 360 without entering any keep-out zone.",
      "teaches": "Moving keep-out zones",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "guard1",
          "name": "Guard 1",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 55,
          "orbit": {
            "parent": "terra",
            "a": 220,
            "phase": 1.2
          }
        },
        {
          "id": "guard2",
          "name": "Guard 2",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 55,
          "orbit": {
            "parent": "terra",
            "a": 220,
            "phase": 3.294395102393195
          }
        },
        {
          "id": "guard3",
          "name": "Guard 3",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 55,
          "orbit": {
            "parent": "terra",
            "a": 220,
            "phase": 5.388790204786391
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 120,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.1170000166126748,
            "thrust": 2.117000016612675,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 300,
          "rMax": 360
        }
      ],
      "par": 5.3,
      "bounds": 2000,
      "tMax": 1500,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 800
      }
    },
    {
      "id": "supplyrun",
      "name": "Supply Run",
      "intro": "Haven Station needs supplies, but no ship may come inside its red keep-out zone. Get on a path that meets the station, drop the pod (E) before you reach the zone so it drifts in on its own, then turn away and settle back into a lower orbit.",
      "objective": "Deliver the pod to Haven Station without entering the keep-out zone, then orbit Terra between 100 and 250.",
      "teaches": "Dropping cargo into a keep-out zone",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "haven",
          "name": "Haven Station",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 45,
          "orbit": {
            "parent": "terra",
            "a": 300,
            "phase": 1.2
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 150,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.6393721069336514,
            "thrust": 1.9393721069336516,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "pod",
            "name": "Pod",
            "mass": 0.3
          }
        ],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "body": "haven",
          "craft": "pod",
          "r": 12,
          "label": "Docking arm"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 100,
          "rMax": 250
        }
      ],
      "par": 2.5,
      "bounds": 2000,
      "tMax": 1200,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 760
      }
    },
    {
      "id": "wideberth",
      "name": "Wide Berth",
      "intro": "Slingshot again, but Goliath now has a radiation belt: no ship may come inside its red keep-out zone. A wider pass behind Goliath still bends your path, just less, so you need a little more speed going in.",
      "objective": "Fly through the Jump Gate without entering Goliath's keep-out zone.",
      "teaches": "Gravity assist around a keep-out zone",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "goliath",
          "name": "Goliath",
          "gm": 5000,
          "radius": 26,
          "color": "#d8b67a",
          "keepOut": 110,
          "orbit": {
            "parent": "terra",
            "a": 350,
            "phase": 2
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.7332530178673953,
            "thrust": 1.7332530178673953,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "x": -1500,
          "y": 0,
          "r": 120,
          "label": "Jump Gate"
        }
      ],
      "par": 3.7,
      "bounds": 3500,
      "tMax": 1800,
      "predict": 300,
      "view": {
        "x": -500,
        "y": 0,
        "span": 2400
      }
    },
    {
      "id": "hotmoon",
      "name": "Hot Moon",
      "intro": "Luna is wrapped in a radiation belt: no ship may come inside its red keep-out zone. Aim your transfer so you pass Luna just outside the zone, not straight at it, then burn retrograde at closest approach to get captured. Press V to view your path relative to Luna.",
      "objective": "Get captured into an orbit around Luna that stays between 60 and 110, without entering its keep-out zone.",
      "teaches": "Capture outside a keep-out zone",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 1500,
          "radius": 18,
          "color": "#b8bcc6",
          "keepOut": 50,
          "orbit": {
            "parent": "terra",
            "a": 400,
            "phase": 2.6
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.7182818284590455,
            "thrust": 2.7182818284590455,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "luna",
          "rMin": 60,
          "rMax": 110
        }
      ],
      "par": 6.6,
      "bounds": 2500,
      "tMax": 1200,
      "predict": 160,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    {
      "id": "crowdedtrojans",
      "name": "Crowded Trojans",
      "intro": "You share Luna's orbit just ahead of its L4 point, slowly drifting back toward it, but L4 has filled with a debris cloud nobody may enter. Park at L5, 60° behind Luna, instead. A higher orbit drifts you backwards, a lower one forwards: pick the way round that keeps you out of the cloud.",
      "objective": "Park at L5: stay within 40 of it, moving with it, for 30 s, without entering the debris cloud.",
      "teaches": "Choosing the direction of drift",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 30,
          "radius": 14,
          "color": "#b8bcc6",
          "orbit": {
            "parent": "terra",
            "a": 400,
            "phase": 0
          }
        },
        {
          "id": "cloud",
          "name": "Debris Cloud",
          "gm": 0,
          "radius": 6,
          "color": "#a89f91",
          "kind": "station",
          "keepOut": 70,
          "orbit": {
            "parent": "terra",
            "a": 400,
            "phase": 1.0471975511965976,
            "mu": 20030
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 400,
            "angle": 1.75
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.16183424272828306,
            "thrust": 0.9294673941826265,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "hold",
          "lagrange": {
            "body": "luna",
            "lead": -1.0471975511965976
          },
          "r": 40,
          "relVel": 0.2,
          "hold": 30,
          "label": "L5"
        }
      ],
      "par": 0.9,
      "bounds": 2500,
      "tMax": 2400,
      "predict": 400,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    // Chapter: Weaving
    {
      "id": "asteroidrun",
      "name": "Asteroid Run",
      "intro": "A ring of tumbling rocks circles Terra between your low orbit and the one you need. Climb through Gate 1 and Gate 2 in order, then round off your orbit above the rocks. The gates line up with your climb once a lap, but the rocks drift at their own pace: if the dashed path shows a CRASH mark, wait a lap and look again.",
      "objective": "Fly through Gates 1 and 2, then orbit Terra between 270 and 330.",
      "teaches": "Weaving through orbiting rocks",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "rock0",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.001620058436701,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 182.0295301834259,
            "phase": 2.3808397221252258
          }
        },
        {
          "id": "rock1",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 11.940577308154003,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 200.29171683839138,
            "phase": 0.22657973950112498
          }
        },
        {
          "id": "rock2",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.738235556398628,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 229.11107903770687,
            "phase": 3.9195599088737745
          }
        },
        {
          "id": "rock3",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 11.481429459751318,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 245.6438225813414,
            "phase": 5.947515918600191
          }
        },
        {
          "id": "rock4",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 8.009826645259665,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 243.61268337052906,
            "phase": 1.4427299684402488
          }
        },
        {
          "id": "rock5",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 8.647940020378652,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 214.9148667021258,
            "phase": 1.1124900013577228
          }
        },
        {
          "id": "rock6",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 14.367039706263244,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 222.9897170341526,
            "phase": 3.783592270721143
          }
        },
        {
          "id": "rock7",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 14.161951458622678,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 223.71702285656568,
            "phase": 2.5135215467918637
          }
        },
        {
          "id": "rock8",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 11.156546335274609,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 189.54895075855262,
            "phase": 0.7237757444790883
          }
        },
        {
          "id": "rock9",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.361225195862923,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 225.4388166058058,
            "phase": 0.8003752177045648
          }
        },
        {
          "id": "rock10",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 15.436411911359249,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 222.4443930212615,
            "phase": 0.22882641009073337
          }
        },
        {
          "id": "rock11",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.825154337484927,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 254.3906676370607,
            "phase": 3.4519015892212916
          }
        },
        {
          "id": "rock12",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 11.956183552721601,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 211.79529415061478,
            "phase": 4.987968654072572
          }
        },
        {
          "id": "rock13",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 10.625104840204635,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 234.55154950476788,
            "phase": 3.761470245879712
          }
        },
        {
          "id": "rock14",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 12.59070296054273,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 206.1747363704139,
            "phase": 6.1884802331461595
          }
        },
        {
          "id": "rock15",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 13.045977770372284,
          "color": "#8d8478",
          "orbit": {
            "parent": "terra",
            "a": 222.20788130639488,
            "phase": 2.188206979114286
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 110,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.2255409284924679,
            "thrust": 2.225540928492468,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "x": -35,
          "y": 162,
          "r": 25,
          "label": "Gate 1"
        },
        {
          "type": "reach",
          "x": -174,
          "y": 151,
          "r": 25,
          "label": "Gate 2"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 280,
          "rMax": 320
        }
      ],
      "par": 5.5,
      "bounds": 2000,
      "tMax": 600,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 760
      }
    },
    {
      "id": "debriscloud",
      "name": "Debris Cloud",
      "intro": "A ring of debris clouds drifts around Terra, between you and Luna, and no ship may enter one. Your usual Moon Shot window sends you straight through a cloud. Watch where the dashed path turns red: wait for a later window, or burn a little harder or later so you cross the ring in a gap.",
      "objective": "Impact Luna without entering any debris cloud.",
      "teaches": "Timing a transfer through a gap",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 1500,
          "radius": 18,
          "color": "#b8bcc6",
          "orbit": {
            "parent": "terra",
            "a": 400,
            "phase": 2.4
          }
        },
        {
          "id": "cloud0",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": false,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 0.25
          }
        },
        {
          "id": "cloud1",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": true,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 1.0353981633974483
          }
        },
        {
          "id": "cloud2",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": true,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 1.8207963267948966
          }
        },
        {
          "id": "cloud3",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": true,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 2.606194490192345
          }
        },
        {
          "id": "cloud4",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": true,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 3.391592653589793
          }
        },
        {
          "id": "cloud5",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": true,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 4.176990816987241
          }
        },
        {
          "id": "cloud6",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": true,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 4.96238898038469
          }
        },
        {
          "id": "cloud7",
          "name": "Debris Cloud",
          "kind": "rock",
          "gm": 0,
          "radius": 5,
          "color": "#a89f91",
          "noRail": true,
          "keepOut": 52,
          "orbit": {
            "parent": "terra",
            "a": 250,
            "phase": 5.747787143782138
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 120,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.6487212707001282,
            "thrust": 1.6487212707001282,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "hit",
          "body": "luna"
        }
      ],
      "par": 3.1,
      "bounds": 2500,
      "tMax": 1000,
      "predict": 220,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    {
      "id": "detour",
      "name": "Detour",
      "intro": "Your tank can't reach the high orbit on its own, but a fuel canister circles at 220. It floats just above a tanker's keep-out zone, so the cheap climb straight up into it is closed. Aim a little higher than the canister and let it drift in under you from ahead (it glows green when your path will collect it), then push on up.",
      "objective": "Collect the fuel canister without entering the tanker's keep-out zone, then orbit Terra between 400 and 460.",
      "teaches": "Is the detour worth the fuel?",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "canister",
          "name": "Fuel",
          "gm": 0,
          "radius": 7,
          "color": "#ffb35a",
          "kind": "fuel",
          "pickup": true,
          "dv": 5,
          "orbit": {
            "parent": "terra",
            "a": 220,
            "phase": 1.6
          }
        },
        {
          "id": "tanker",
          "name": "Tanker",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 22,
          "orbit": {
            "parent": "canister",
            "a": 32,
            "n": 0.043339208602072375,
            "phase": 4.741592653589793
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 100,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.4190675485932571,
            "thrust": 1.4190675485932571,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 400,
          "rMax": 460
        }
      ],
      "par": 7.6,
      "bounds": 2500,
      "tMax": 600,
      "predict": 220,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    {
      "id": "sentryfield",
      "name": "Sentry Field",
      "intro": "Zero gravity, and a field of sentries you may not come near: two stand still, one circles. The survey beacon has to go to the marker in the middle of the closed zone, where you can't follow. Line up so your path runs through the marker, drop the beacon (E), then steer clear of the zone and stop at the depot. Turning costs propellant you don't have much of.",
      "objective": "Drop the beacon into the marked spot inside the closed zone, then park beside the depot (within 25, relative speed under 0.6) without entering any keep-out zone.",
      "teaches": "Zero-G · keep-out zones · drops",
      "zeroG": true,
      "bodies": [
        {
          "id": "depot",
          "name": "Depot",
          "gm": 0.000001,
          "radius": 6,
          "color": "#e6e6f0",
          "kind": "station",
          "x": 900,
          "y": 0
        },
        {
          "id": "closed",
          "name": "Closed Zone",
          "gm": 0,
          "radius": 3,
          "color": "#ff8a8a",
          "kind": "station",
          "keepOut": 90,
          "x": 450,
          "y": 0
        },
        {
          "id": "sentryA",
          "name": "Sentry A",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 55,
          "x": 250,
          "y": 200
        },
        {
          "id": "sentryB",
          "name": "Sentry B",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 55,
          "x": 650,
          "y": -200
        },
        {
          "id": "sentryC",
          "name": "Sentry C",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 45,
          "orbit": {
            "parent": "depot",
            "a": 170,
            "n": 0.03,
            "phase": 2.2
          }
        }
      ],
      "ship": {
        "start": {
          "free": {
            "x": 0,
            "y": 0
          }
        },
        "heading": 0,
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.216503248964572,
            "thrust": 2.416503248964572,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "beacon",
            "name": "Beacon",
            "mass": 0.2
          }
        ],
        "rcs": {
          "fuel": 5,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "body": "closed",
          "craft": "beacon",
          "r": 15,
          "label": "Survey mark"
        },
        {
          "type": "rendezvous",
          "body": "depot",
          "dist": 25,
          "relVel": 0.6
        }
      ],
      "par": 5.5,
      "bounds": 2500,
      "tMax": 1500,
      "predict": 250,
      "view": {
        "x": 450,
        "y": 0,
        "span": 1200
      },
      "startCam": "overview"
    },
    {
      "id": "moonmaze",
      "name": "Moon Maze",
      "intro": "Goliath's inner moons each carry a keep-out zone: three on one ring, two on the next, all moving at different speeds. Titan, far out, is open. Most Titan windows run into a zone somewhere on the way out. Keep checking the dashed path window after window until it threads both rings.",
      "objective": "Impact Titan without entering any keep-out zone.",
      "teaches": "Threading several moving zones",
      "bodies": [
        {
          "id": "goliath",
          "name": "Goliath",
          "gm": 30000,
          "radius": 40,
          "color": "#d8b67a"
        },
        {
          "id": "mimas",
          "name": "Mimas",
          "gm": 100,
          "radius": 9,
          "color": "#b8bcc6",
          "keepOut": 50,
          "orbit": {
            "parent": "goliath",
            "a": 160,
            "phase": 2.09
          }
        },
        {
          "id": "enceladus",
          "name": "Enceladus",
          "gm": 100,
          "radius": 9,
          "color": "#9fe0f0",
          "keepOut": 50,
          "orbit": {
            "parent": "goliath",
            "a": 160,
            "phase": 4.184395102393195
          }
        },
        {
          "id": "tethys",
          "name": "Tethys",
          "gm": 100,
          "radius": 9,
          "color": "#b8bcc6",
          "keepOut": 50,
          "orbit": {
            "parent": "goliath",
            "a": 160,
            "phase": 6.27879020478639
          }
        },
        {
          "id": "rhea",
          "name": "Rhea",
          "gm": 150,
          "radius": 11,
          "color": "#a98be8",
          "keepOut": 60,
          "orbit": {
            "parent": "goliath",
            "a": 330,
            "phase": 3.34
          }
        },
        {
          "id": "dione",
          "name": "Dione",
          "gm": 150,
          "radius": 11,
          "color": "#b8bcc6",
          "keepOut": 60,
          "orbit": {
            "parent": "goliath",
            "a": 330,
            "phase": 6.481592653589793
          }
        },
        {
          "id": "titan",
          "name": "Titan",
          "gm": 600,
          "radius": 18,
          "color": "#9fe0f0",
          "orbit": {
            "parent": "goliath",
            "a": 520,
            "phase": 3.86
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "goliath",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.4596031111569499,
            "thrust": 2.45960311115695,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "hit",
          "body": "titan"
        }
      ],
      "par": 6,
      "bounds": 3000,
      "tMax": 800,
      "predict": 250,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1100
      }
    },
    {
      "id": "closequarters",
      "name": "Close Quarters",
      "intro": "The depot shares its orbit with two guard satellites just ahead of it and just behind it, and their keep-out zones close the usual approach along the orbit. Come straight up from below instead: time your climb so you arrive just under the depot as it passes, then burn to match its speed.",
      "objective": "Rendezvous with the depot (within 12, relative speed under 0.3) without entering either guard's keep-out zone.",
      "teaches": "Rendezvous from below",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "depot",
          "name": "Depot",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "orbit": {
            "parent": "terra",
            "a": 260,
            "phase": 1.6
          }
        },
        {
          "id": "guardA",
          "name": "Guard A",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 35,
          "orbit": {
            "parent": "terra",
            "a": 260,
            "phase": 1.79
          }
        },
        {
          "id": "guardB",
          "name": "Guard B",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 35,
          "orbit": {
            "parent": "terra",
            "a": 260,
            "phase": 1.4100000000000001
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 150,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.49182469764127035,
            "thrust": 1.4918246976412703,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "rendezvous",
          "body": "depot",
          "dist": 12,
          "relVel": 0.3
        }
      ],
      "par": 2.4,
      "bounds": 2000,
      "tMax": 600,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 800
      }
    },
    // Chapter: Flip Burns
    {
      "id": "spinburn",
      "name": "Spin Burn",
      "intro": "The side thrusters have only a few taps of propellant left: enough to start a slow spin, not to aim every burn. Tap to set the ship turning, then fire short bursts each time the nose swings past prograde (the green marker). Raise the high point to the band, then do the same at the top of the orbit to lift the low point.",
      "objective": "Orbit Terra between 230 and 270 with 1 s of side-thruster propellant.",
      "teaches": "Spin-stabilised burns",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 120,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.8221188003905089,
            "thrust": 1.8221188003905089,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 1,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 230,
          "rMax": 270
        }
      ],
      "par": 4.2,
      "bounds": 2000,
      "tMax": 1500,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 640
      }
    },
    {
      "id": "oneflip",
      "name": "One Flip",
      "intro": "You need to come down to a low orbit, and both burns point backwards. Turn round once, slowly, with a few taps, and make the first burn. Then one gentle tap sets the nose turning with your fall, so it still points backwards at the bottom: no second flip needed. Holding the turn keys empties the side thrusters in a single turn.",
      "objective": "Orbit Terra between 150 and 200 with 1 s of side-thruster propellant.",
      "teaches": "Slow flips · turning with the orbit",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 300,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.37712776433595696,
            "thrust": 1.377127764335957,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 1,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 150,
          "rMax": 200
        }
      ],
      "par": 2.1,
      "bounds": 2000,
      "tMax": 600,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 800
      }
    },
    {
      "id": "brake",
      "name": "Brake at Luna",
      "intro": "Burn prograde to send yourself to Luna, then burn retrograde as you pass Luna to be captured. That capture burn points backwards, and the side thrusters can only afford a slow turn: make it during the long coast out, not in a rush at the last moment. Press V to see your path relative to Luna.",
      "objective": "Orbit Luna between 30 and 90 with 1.8 s of side-thruster propellant.",
      "teaches": "Pre-pointing during a coast",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 1500,
          "radius": 18,
          "color": "#b8bcc6",
          "orbit": {
            "parent": "terra",
            "a": 400,
            "phase": 1.75
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 2.0041660239464334,
            "thrust": 3.0041660239464334,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 1.8,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "luna",
          "rMin": 30,
          "rMax": 90
        }
      ],
      "par": 7.2,
      "bounds": 2500,
      "tMax": 1000,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    {
      "id": "stationstop",
      "name": "Station Stop",
      "intro": "Tycho Station orbits below you. Burn retrograde to fall toward it: you meet it at the bottom of your fall moving faster than it is, so you have to brake there, and braking points backwards too. Your nose stays put while you fall and the markers swing round, so start the turn early and make it slow.",
      "objective": "Rendezvous with Tycho Station (within 25, relative speed under 0.5) with 1.1 s of side-thruster propellant.",
      "teaches": "Planning the braking flip",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "tycho",
          "name": "Tycho Station",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "orbit": {
            "parent": "terra",
            "a": 130,
            "phase": -0.5
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 260,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.46228458943422446,
            "thrust": 1.1698276715473797,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 1.1,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "rendezvous",
          "body": "tycho",
          "dist": 25,
          "relVel": 0.5
        }
      ],
      "par": 2.5,
      "bounds": 2000,
      "tMax": 900,
      "predict": 160,
      "view": {
        "x": 0,
        "y": 0,
        "span": 640
      }
    },
    {
      "id": "downgap",
      "name": "Down Through the Gap",
      "intro": "Three guard satellites patrol between you and the low orbit you need, each inside a red keep-out zone. Turn round while you wait for a gap, drop through it, and let the nose turn slowly on the way down so it points backwards at the bottom. Dropping as soon as you have turned runs into a guard.",
      "objective": "Orbit Terra between 110 and 160 without entering any keep-out zone, with 0.9 s of side-thruster propellant.",
      "teaches": "Flip burns · moving keep-out zones",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "guard1",
          "name": "Guard 1",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 50,
          "orbit": {
            "parent": "terra",
            "a": 230,
            "phase": 0
          }
        },
        {
          "id": "guard2",
          "name": "Guard 2",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 50,
          "orbit": {
            "parent": "terra",
            "a": 230,
            "phase": 2.0943951023931953
          }
        },
        {
          "id": "guard3",
          "name": "Guard 3",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 50,
          "orbit": {
            "parent": "terra",
            "a": 230,
            "phase": 4.1887902047863905
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 340,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 0.8221188003905089,
            "thrust": 1.8221188003905089,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 0.9,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 110,
          "rMax": 160
        }
      ],
      "par": 4,
      "bounds": 2000,
      "tMax": 900,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 800
      }
    },
    {
      "id": "roundtrip",
      "name": "Round Trip",
      "intro": "Fly out to Luna, get captured, then come home to an orbit round Terra. Every burn points somewhere new: prograde to leave, backwards at Luna, against Luna's motion to fall home, backwards again at Terra. Work out where the nose needs to be next and turn there slowly during the coast before it.",
      "objective": "Orbit Luna between 30 and 90, then orbit Terra between 120 and 220, with 2.7 s of side-thruster propellant.",
      "teaches": "Planning every flip",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 1500,
          "radius": 18,
          "color": "#b8bcc6",
          "orbit": {
            "parent": "terra",
            "a": 400,
            "phase": 1.75
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 2.3201169227365472,
            "thrust": 3.3201169227365472,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 2.7,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "luna",
          "rMin": 30,
          "rMax": 90
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 120,
          "rMax": 220
        }
      ],
      "par": 8.3,
      "bounds": 2500,
      "tMax": 1500,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    // Chapter: Zone Drops
    {
      "id": "cleanzone",
      "name": "Clean Zone",
      "intro": "Haven Station's amber zone is closed to everything: your ship, dropped cargo and spent stages. A booster dropped on an orbit that crosses the zone's orbit drifts in sooner or later. Climb on the booster, and keep burning it at the top until its whole orbit is above the zone's band (watch PE) before you deploy the satellite to finish the job.",
      "objective": "Put the satellite in an orbit between 320 and 380 without your ship or your spent booster entering Haven's zone.",
      "teaches": "Zones closed to everything",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "haven",
          "name": "Haven Station",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 200,
            "phase": 2
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 150,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "id": "booster",
            "name": "Booster",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 0.5722865563336594,
            "thrust": 1.569092465866713,
            "ve": 10
          },
          {
            "name": "Satellite",
            "sprite": "satellite",
            "dryMass": 0.3,
            "fuel": 0.08907902599973154,
            "thrust": 0.23344741559983892,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 320,
          "rMax": 380
        }
      ],
      "par": 4.1,
      "bounds": 2000,
      "tMax": 1200,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 840
      }
    },
    {
      "id": "shieldedmoon",
      "name": "Shielded Moon",
      "intro": "Science wants a crater on Luna and close-up photos of it, but Luna now has a red keep-out zone for ships. Probes may pass. Aim your whole ship at Luna and drop the probe (E) while the path still ends on Luna, then nudge yourself off the collision course so you sweep past just outside the zone. The earlier you dodge, the smaller the nudge. After the flyby, any orbit around Terra will do.",
      "objective": "Crash the probe into Luna, then pass within 75 of Luna without entering its zone, and stay in an orbit between 80 and 600 from Terra.",
      "teaches": "Drop, then dodge a zone",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 2500,
          "radius": 18,
          "color": "#b8bcc6",
          "keepOut": 45,
          "orbit": {
            "parent": "terra",
            "a": 420,
            "phase": 2.2
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.5638000232577447,
            "thrust": 2.9638000232577446,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "probe",
            "name": "Probe",
            "mass": 0.4
          }
        ],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "hit",
          "body": "luna",
          "craft": "probe"
        },
        {
          "type": "reach",
          "body": "luna",
          "r": 75,
          "label": "Photo pass"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 80,
          "rMax": 600
        }
      ],
      "par": 5.3,
      "bounds": 3000,
      "tMax": 1000,
      "predict": 260,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    {
      "id": "rangesafety",
      "name": "Range Safety",
      "intro": "Your upper stage has to come down, not stay in orbit, but Port Kiri sits under the usual reentry path and its amber zone is closed to everything. Climb on the upper stage, burn it retrograde at the top until its path falls into Terra, then turn prograde and deploy the satellite. Before you deploy, check where the dashed path hits the ground: it must be open sea. When you start the climb decides where that is.",
      "objective": "Bring the upper stage down anywhere outside Port Kiri's zone, and put the satellite in an orbit between 220 and 280.",
      "teaches": "Where the stage comes down",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "port",
          "name": "Port Kiri",
          "gm": 0,
          "radius": 3,
          "color": "#ffb466",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "x": 49.003,
          "y": 9.933
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 100,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "id": "upper",
            "name": "Upper stage",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 0.9736672114281307,
            "thrust": 2.043283929398992,
            "ve": 10
          },
          {
            "name": "Satellite",
            "sprite": "satellite",
            "dryMass": 0.3,
            "fuel": 0.28043770032060944,
            "thrust": 0.5223939302885484,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "hit",
          "body": "terra",
          "craft": "upper",
          "deorbit": true,
          "label": "Open sea"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 220,
          "rMax": 280
        }
      ],
      "par": 8.1,
      "bounds": 2000,
      "tMax": 900,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 640
      }
    },
    {
      "id": "airdrop",
      "name": "Air Drop",
      "intro": "The survey beacon has to settle inside an amber drop zone that rides its own orbit, and you may not follow it in. Thrown in from a transfer orbit, it just sails through. Round off your orbit a little below the zone's, behind it, so you creep up on it slowly. Drop the beacon (E) and it drifts through the marker slowly enough to count. But you are on the same path: leave it at once, down to your working orbit.",
      "objective": "Get the beacon within 20 of the marker, moving slower than 1.5 relative to it, for 8 s; then orbit Terra between 150 and 250 without entering the zone.",
      "teaches": "Drop zones in space",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "mark",
          "name": "Drop Zone",
          "gm": 0,
          "radius": 3,
          "color": "#ffb466",
          "kind": "station",
          "keepOut": 40,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 300,
            "phase": 1.6
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 150,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 1.0986489948166753,
            "thrust": 2.2986489948166753,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "beacon",
            "name": "Beacon",
            "mass": 0.2
          }
        ],
        "rcs": {
          "fuel": 60,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "hold",
          "body": "mark",
          "craft": "beacon",
          "r": 20,
          "hold": 8,
          "relVel": 1.5,
          "label": "Marker"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 150,
          "rMax": 250
        }
      ],
      "par": 4.1,
      "bounds": 2000,
      "tMax": 900,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 760
      }
    },
    {
      "id": "twinzones",
      "name": "Twin Zones",
      "intro": "Two stations, one probe each, and both amber zones are closed to everything: each lets in only its own probe. Get on a path through Station Alpha, drop Probe A (E) short of its zone, and burn on toward Beta at once: that is also your dodge. Drop Probe B the same way and push a little higher so Beta passes beneath you. Then turn round once and brake down to your working orbit. Side-thruster propellant is short: hold still between burns and turn slowly.",
      "objective": "Deliver Probe A to Alpha and Probe B to Beta (each within 12) without any craft entering the wrong zone, then orbit Terra between 100 and 180.",
      "teaches": "Two drops, two closed zones",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "alpha",
          "name": "Station Alpha",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 210,
            "phase": 1.26
          }
        },
        {
          "id": "beta",
          "name": "Station Beta",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 35,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 330,
            "phase": 2.45
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 120,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "dryMass": 1,
            "fuel": 2.378564488973769,
            "thrust": 3.878564488973769,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "a",
            "name": "Probe A",
            "mass": 0.25
          },
          {
            "id": "b",
            "name": "Probe B",
            "mass": 0.25
          }
        ],
        "rcs": {
          "fuel": 6.5,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "body": "alpha",
          "craft": "a",
          "r": 12,
          "label": "Alpha dock"
        },
        {
          "type": "reach",
          "body": "beta",
          "craft": "b",
          "r": 12,
          "label": "Beta dock"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 100,
          "rMax": 180
        }
      ],
      "par": 6.2,
      "bounds": 2500,
      "tMax": 1000,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 860
      }
    },
    {
      "id": "crossingtraffic",
      "name": "Crossing Traffic",
      "intro": "Two guard satellites patrol a long, stretched orbit, and their amber zones are closed to everything. Their lane sweeps from 85 to 405, so any spent stage left in orbit here crosses it sooner or later. The booster has to come down. At the top of your climb, burn it retrograde until its path falls into Terra, then flip once, deploy, and let the satellite round off the orbit. Side-thruster propellant is short: your nose already points the right way at the top, if you leave it alone.",
      "objective": "Put the satellite in an orbit between 300 and 360, with the booster brought down and no craft entering a guard's zone.",
      "teaches": "Planned flips · deorbiting a booster",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "guard1",
          "name": "Guard 1",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 25,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 245,
            "e": 0.55,
            "phase": 1,
            "argp": 2
          }
        },
        {
          "id": "guard2",
          "name": "Guard 2",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 25,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 245,
            "e": 0.55,
            "phase": 4.141592653589793,
            "argp": 2
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 62,
            "angle": 0,
            "speed": 1.2976
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "id": "booster",
            "name": "Booster",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 0.32049098898494144,
            "thrust": 1.414430718621858,
            "ve": 10
          },
          {
            "name": "Satellite",
            "sprite": "satellite",
            "dryMass": 0.3,
            "fuel": 0.1475474092923811,
            "thrust": 0.26852844557542865,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 1.6,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 300,
          "rMax": 360
        }
      ],
      "par": 3.8,
      "bounds": 2000,
      "tMax": 600,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 900
      }
    },
    // Chapter: Grand Missions
    {
      "id": "resupplyrun",
      "name": "Resupply Run",
      "intro": "Haven Station's amber zone is closed to everything but its supply pod, and that includes your spent kick stage: a stage left in an orbit that reaches Haven's height drifts in sooner or later. So drop the kick stage (the stage button) while your high point is still well below the station. Then climb the rest with the carrier, release the pod (E) on a path that meets Haven, and turn round to brake back down.",
      "objective": "Deliver the pod to Haven Station, then orbit Terra between 100 and 220, leaving nothing in Haven's way.",
      "teaches": "Stage before the zone · flip to come home",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "haven",
          "name": "Haven Station",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 40,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 300,
            "phase": 1.3
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 140,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "name": "Kick stage",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 0.5275527885476036,
            "thrust": 2.472453953850806,
            "ve": 10
          },
          {
            "name": "Carrier",
            "sprite": "satellite",
            "dryMass": 0.4,
            "fuel": 0.24490116530320222,
            "thrust": 0.5669406991819214,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "pod",
            "name": "Supply pod",
            "mass": 0.3
          }
        ],
        "rcs": {
          "fuel": 2,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "body": "haven",
          "craft": "pod",
          "r": 12,
          "label": "Docking arm"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 100,
          "rMax": 220
        }
      ],
      "par": 3.7,
      "bounds": 2000,
      "tMax": 1500,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 800
      }
    },
    {
      "id": "blockade",
      "name": "Blockade Run",
      "intro": "Three patrol ships guard the orbit at 220, each inside an amber zone closed to everything. Ride the big descent stage down through their band to a low orbit, timing your fall to pass between them. Don't drop the stage after the first burn: an empty stage whose orbit still reaches the band drifts into a zone sooner or later, so only let it go once its whole orbit is below the patrols.",
      "objective": "Orbit Terra between 100 and 150 without your ship or its stage entering a patrol zone.",
      "teaches": "Carry the stage across the band",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "pat1",
          "name": "Patrol 1",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 35,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 220,
            "phase": 0.4
          }
        },
        {
          "id": "pat2",
          "name": "Patrol 2",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 35,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 220,
            "phase": 2.4939999999999998
          }
        },
        {
          "id": "pat3",
          "name": "Patrol 3",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 35,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 220,
            "phase": 4.589
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 360,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "name": "Descent stage",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 0.8602031018032628,
            "thrust": 1.8990506147826876,
            "ve": 10
          },
          {
            "name": "Shuttle",
            "sprite": "satellite",
            "dryMass": 0.4,
            "fuel": 0.11361016667509656,
            "thrust": 0.2568050833375483,
            "ve": 10
          }
        ],
        "cargo": [],
        "rcs": {
          "fuel": 5,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 100,
          "rMax": 150
        }
      ],
      "par": 4.7,
      "bounds": 2000,
      "tMax": 1500,
      "predict": 200,
      "view": {
        "x": 0,
        "y": 0,
        "span": 860
      }
    },
    {
      "id": "mooncourier",
      "name": "Moon Courier",
      "intro": "Luna Gate circles Luna inside an amber zone closed to everything but its supply pod. Ride the transfer stage out, drop it, and release the pod (E) early, on a path that meets the Gate. Then nudge yourself clear of the zone and flip late to brake into a low orbit beneath it: turning round early and chasing retrograde all the way in empties the side thrusters.",
      "objective": "Deliver the pod to Luna Gate, then orbit Luna between 30 and 70 without entering the Gate's zone.",
      "teaches": "Stage, drop, swerve, capture",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 1500,
          "radius": 18,
          "color": "#b8bcc6",
          "orbit": {
            "parent": "terra",
            "a": 420,
            "phase": 2.2
          }
        },
        {
          "id": "gate",
          "name": "Luna Gate",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 25,
          "zone": "all",
          "orbit": {
            "parent": "luna",
            "a": 110,
            "phase": 2.55
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "name": "Transfer stage",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 1.244808896289946,
            "thrust": 3.3760609778249715,
            "ve": 10
          },
          {
            "name": "Carrier",
            "sprite": "satellite",
            "dryMass": 0.4,
            "fuel": 0.43125208153502537,
            "thrust": 0.6787512489210151,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "pod",
            "name": "Supply pod",
            "mass": 0.3
          }
        ],
        "rcs": {
          "fuel": 5,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "body": "gate",
          "craft": "pod",
          "r": 12,
          "label": "Docking arm"
        },
        {
          "type": "orbit",
          "body": "luna",
          "rMin": 30,
          "rMax": 70
        }
      ],
      "par": 7.3,
      "bounds": 2500,
      "tMax": 1500,
      "predict": 220,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1000
      }
    },
    {
      "id": "relaysling",
      "name": "Slingshot Relay",
      "intro": "The relay needs Goliath's slingshot to leave Terra for good; your carrier stays home to talk to it. Put the stack on a path that swings wide of Goliath's zone, which is closed to everything, then drop the stage and release the relay (E) on it. Flip and brake so you fall back into a low orbit while the relay flies on.",
      "objective": "Send the relay 1600 away from Terra, then orbit Terra between 120 and 250 yourself.",
      "teaches": "Send the cargo, stay home",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "goliath",
          "name": "Goliath",
          "gm": 5000,
          "radius": 26,
          "color": "#d8b67a",
          "keepOut": 70,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 350,
            "phase": 2
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 90,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "name": "Transfer stage",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 0.8707339450369631,
            "thrust": 2.641149195049608,
            "ve": 10
          },
          {
            "name": "Carrier",
            "sprite": "satellite",
            "dryMass": 0.4,
            "fuel": 0.17041525001264488,
            "thrust": 0.46224915000758693,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "relay",
            "name": "Relay",
            "mass": 0.2
          }
        ],
        "rcs": {
          "fuel": 5.5,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "escape",
          "body": "terra",
          "craft": "relay",
          "r": 1600,
          "label": "Deep space"
        },
        {
          "type": "orbit",
          "body": "terra",
          "rMin": 120,
          "rMax": 250
        }
      ],
      "par": 4.6,
      "bounds": 3500,
      "tMax": 1500,
      "predict": 300,
      "view": {
        "x": 0,
        "y": 0,
        "span": 2400
      }
    },
    {
      "id": "surveydrop",
      "name": "Survey Drop",
      "intro": "Two survey sites ride the asteroid belt, each in an amber zone closed to everything but its own probe. Drop the transfer stage while your high point is still below the belt, then release probe A (E) when your path meets Site A, climb a little more and release probe B for Site B. Then turn round before the zones and rocks and brake back down to your home orbit.",
      "objective": "Deliver probe A to Site A and probe B to Site B, then orbit Sol between 430 and 520.",
      "teaches": "Two drops on one climb · flip home",
      "bodies": [
        {
          "id": "sun",
          "name": "Sol",
          "gm": 200000,
          "radius": 60,
          "color": "#ffcf5a"
        },
        {
          "id": "sitea",
          "name": "Site A",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "sun",
            "a": 720,
            "phase": 0.88
          }
        },
        {
          "id": "siteb",
          "name": "Site B",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "sun",
            "a": 840,
            "phase": 1.05
          }
        },
        {
          "id": "rock0",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.068817264898129,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 782.2354228572153,
            "phase": 1.4225117998172432
          }
        },
        {
          "id": "rock1",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.910610002889582,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 782.4463713040791,
            "phase": 5.800165704003691
          }
        },
        {
          "id": "rock2",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 15.663310373976506,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 735.1491084625708,
            "phase": 4.225998195869704
          }
        },
        {
          "id": "rock3",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 8.75463400769729,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 812.6753473666847,
            "phase": 2.9518122482714952
          }
        },
        {
          "id": "rock4",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 14.678288366030106,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 829.8513573593699,
            "phase": 1.457808560599729
          }
        },
        {
          "id": "rock5",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 11.653799996084441,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 818.3306838238288,
            "phase": 3.274343342199208
          }
        },
        {
          "id": "rock6",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 12.373817087790844,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 744.8758900141697,
            "phase": 5.5530606094152954
          }
        },
        {
          "id": "rock7",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 15.792459785841618,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 767.4324128019774,
            "phase": 0.2290557137222568
          }
        },
        {
          "id": "rock8",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 13.345468241882262,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 835.6948263038391,
            "phase": 5.338811686450773
          }
        },
        {
          "id": "rock9",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 14.909435493829397,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 767.6468958135913,
            "phase": 0.3971649962726429
          }
        },
        {
          "id": "rock10",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 10.451062495564605,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 810.147259086439,
            "phase": 2.6174167248685767
          }
        },
        {
          "id": "rock11",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 10.355469031424946,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 717.3602231812479,
            "phase": 4.302969896897279
          }
        },
        {
          "id": "rock12",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.790927435174085,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 692.3480594169107,
            "phase": 1.530116891331327
          }
        },
        {
          "id": "rock13",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 15.422931690431634,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 754.2584216893922,
            "phase": 5.979265316624841
          }
        },
        {
          "id": "rock14",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.352904019575987,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 695.157140272277,
            "phase": 3.3530063462257007
          }
        },
        {
          "id": "rock15",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.1269687675530875,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 709.2815252948932,
            "phase": 2.2548128961319516
          }
        },
        {
          "id": "rock16",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 10.938737757475458,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 757.309797800756,
            "phase": 5.43745590440719
          }
        },
        {
          "id": "rock17",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 13.695409686162794,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 745.011906761216,
            "phase": 3.6692732571192717
          }
        },
        {
          "id": "rock18",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.016963039998414,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 811.95626506673,
            "phase": 2.0576376491168
          }
        },
        {
          "id": "rock19",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.09172766333992,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 743.336755080771,
            "phase": 1.0766113239472312
          }
        },
        {
          "id": "rock20",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 14.614640912327282,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 855.3962696927582,
            "phase": 2.6216495115602463
          }
        },
        {
          "id": "rock21",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 13.256651638660884,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 860.8818194693335,
            "phase": 3.8655489821395883
          }
        },
        {
          "id": "rock22",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.208652010750329,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 806.2868936156327,
            "phase": 6.067497446288282
          }
        },
        {
          "id": "rock23",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 7.4756183426247995,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 724.3496899001066,
            "phase": 1.92817521852949
          }
        },
        {
          "id": "rock24",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 13.380269933203362,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 833.9353469777551,
            "phase": 3.5387128333670566
          }
        },
        {
          "id": "rock25",
          "name": "Asteroid",
          "kind": "rock",
          "noRail": true,
          "gm": 0,
          "radius": 13.87213879538334,
          "color": "#8d8478",
          "orbit": {
            "parent": "sun",
            "a": 750.7346801556342,
            "phase": 5.856255981535009
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "sun",
            "r": 450,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "name": "Transfer stage",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 0.8363069314365414,
            "thrust": 3.664651411117738,
            "ve": 10
          },
          {
            "name": "Carrier",
            "sprite": "satellite",
            "dryMass": 0.4,
            "fuel": 0.4175692444949071,
            "thrust": 0.7305415466969443,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "pa",
            "name": "Probe A",
            "mass": 0.2
          },
          {
            "id": "pb",
            "name": "Probe B",
            "mass": 0.2
          }
        ],
        "rcs": {
          "fuel": 3.3,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "body": "sitea",
          "craft": "pa",
          "r": 12,
          "label": "Site A"
        },
        {
          "type": "reach",
          "body": "siteb",
          "craft": "pb",
          "r": 12,
          "label": "Site B"
        },
        {
          "type": "orbit",
          "body": "sun",
          "rMin": 430,
          "rMax": 520
        }
      ],
      "par": 5.9,
      "bounds": 4000,
      "tMax": 1200,
      "predict": 400,
      "view": {
        "x": 0,
        "y": 0,
        "span": 2200
      }
    },
    {
      "id": "longhaul",
      "name": "The Long Haul",
      "intro": "Everything at once, and every zone is closed to everything. Ride the booster up through the patrol band and drop it in the gap below Haven Station, where its whole orbit touches neither zone. Fly the carrier to Luna and brake into a low orbit beneath Luna Gate. Then, at your low point, raise your high point to the Gate, release the pod (E) and flip at once to come back down before you reach the zone.",
      "objective": "Deliver pod A to Haven Station and pod B to Luna Gate, then orbit Luna between 25 and 55.",
      "teaches": "Everything at once",
      "bodies": [
        {
          "id": "terra",
          "name": "Terra",
          "gm": 20000,
          "radius": 50,
          "color": "#4f8fe0"
        },
        {
          "id": "pat1",
          "name": "Patrol 1",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 200,
            "phase": 0.3
          }
        },
        {
          "id": "pat2",
          "name": "Patrol 2",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 200,
            "phase": 2.3939999999999997
          }
        },
        {
          "id": "pat3",
          "name": "Patrol 3",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 200,
            "phase": 4.489
          }
        },
        {
          "id": "haven",
          "name": "Haven Station",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 30,
          "zone": "all",
          "orbit": {
            "parent": "terra",
            "a": 340,
            "phase": 3.2
          }
        },
        {
          "id": "luna",
          "name": "Luna",
          "gm": 800,
          "radius": 16,
          "color": "#b8bcc6",
          "orbit": {
            "parent": "terra",
            "a": 480,
            "phase": 3.54
          }
        },
        {
          "id": "gate",
          "name": "Luna Gate",
          "gm": 0,
          "radius": 4,
          "color": "#e6e6f0",
          "kind": "station",
          "keepOut": 15,
          "zone": "all",
          "orbit": {
            "parent": "luna",
            "a": 80,
            "phase": 0
          }
        }
      ],
      "ship": {
        "start": {
          "orbit": {
            "body": "terra",
            "r": 110,
            "angle": 0
          }
        },
        "heading": "prograde",
        "stages": [
          {
            "name": "Booster",
            "sprite": "booster",
            "dryMass": 1,
            "fuel": 1.7572331767706904,
            "thrust": 4.098111757080417,
            "ve": 10
          },
          {
            "name": "Carrier",
            "sprite": "satellite",
            "dryMass": 0.4,
            "fuel": 0.6408785803097273,
            "thrust": 0.6704392901548637,
            "ve": 10
          }
        ],
        "cargo": [
          {
            "id": "pod",
            "name": "Supply pod",
            "mass": 0.3
          }
        ],
        "rcs": {
          "fuel": 15,
          "accel": 1.2,
          "maxRate": 1.6
        },
        "canRotate": true
      },
      "goals": [
        {
          "type": "reach",
          "body": "gate",
          "craft": "pod",
          "r": 10,
          "label": "Gate dock"
        },
        {
          "type": "orbit",
          "body": "luna",
          "rMin": 25,
          "rMax": 55
        }
      ],
      "par": 10,
      "bounds": 2500,
      "tMax": 1200,
      "predict": 260,
      "view": {
        "x": 0,
        "y": 0,
        "span": 1200
      }
    },
  ];
  for (const L of WORLD3) L.world = 3;
  LEVELS.push(...WORLD3);
  // ---- END WORLD 3 ----

  // ---------------------------------------------------------- test levels
  // Prototypes for upcoming mechanics. Shown in their own menu section.
  LEVELS.push(
    {
      id: 'test-fuel',
      test: true,
      name: 'Fuel Run',
      intro: 'Your tank can only get you halfway to Luna. A fuel canister orbits higher up: fly through it to top up, then push on to Luna. Watch the canister glow green when your predicted path will collect it.',
      objective: 'Collect fuel, then impact Luna.',
      teaches: 'Fuel pickups',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 420, phase: 2.6 } },
        { id: 'canister', name: 'Fuel', gm: 0, radius: 7, color: '#ffb35a', kind: 'fuel', pickup: true, dv: 4, orbit: { parent: 'terra', a: 200, phase: 2.2 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 3.2, accel: 1 }),
      goals: [{ type: 'hit', body: 'luna' }],
      par: 5, bounds: 2500, tMax: 1500, predict: 200, view: { x: 0, y: 0, span: 1000 },
    },
  );

  // Worlds in menu order. theme picks the in-flight backdrop; unlock is how
  // many stars the previous world must have earned to open this one.
  const WORLDS = [
    { n: 1, name: 'Flight School', theme: 'deep' },
    { n: 2, name: 'Payloads', theme: 'nebula', unlock: 50 },
    { n: 3, name: 'No-Fly Zones', theme: 'ember', unlock: 50 },
  ];

  const Levels = { LEVELS, WORLDS, ship, VE, C, belt };
  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;
  else root.Levels = Levels;
})(typeof window !== 'undefined' ? window : globalThis);
