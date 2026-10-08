// Level definitions. Each level introduces or combines a mechanic.
(function (root) {
  'use strict';

  const VE = 10; // exhaust velocity for all stock engines

  // Single-stage ship sized for a Δv budget and a starting acceleration.
  function ship(o) {
    const fuel = Math.exp(o.dv / VE) - 1; // dry mass 1
    return {
      start: o.start,
      heading: o.heading,
      stages: [{ dryMass: 1, fuel, thrust: o.accel * (1 + fuel), ve: VE }],
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
      intro: 'Your ship is bolted upright to a spinning asteroid. No side thrusters yet — the planet\'s rotation is your steering. Press and hold SPACE to fire the main engine when the target is lined up.',
      objective: 'Crash-land on Verdant.',
      teaches: 'Main engine · launch timing',
      bodies: [
        { id: 'pebble', name: 'Pebble', gm: 2000, radius: 30, color: C.rock, spin: 0.25 },
        { id: 'verdant', name: 'Verdant', gm: 6000, radius: 50, color: C.green, x: 420, y: 160 },
      ],
      ship: ship({ start: { landed: { body: 'pebble', angle: Math.PI / 2 } }, dv: 30, accel: 4, rcs: false }),
      goals: [{ type: 'hit', body: 'verdant' }],
      par: 12, bounds: 2500, tMax: 300, predict: 150, view: { x: 210, y: 80, span: 760 }, startCam: 'overview',
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
      objective: 'Hold an orbit between 180 and 220 around Terra for 60 s.',
      teaches: 'Prograde burns · camera',
      introduces: ['camera'],
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 200, angle: Math.PI / 2, speed: 0.75 } }, heading: 'up', dv: 5, accel: 1 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 180, rMax: 220, hold: 60 }],
      par: 3.2, bounds: 2000, tMax: 600, predict: 100, view: { x: 0, y: 0, span: 600 },
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
      objective: 'Hold an orbit between 180 and 230 around Terra for 60 s.',
      teaches: 'Two-burn Hohmann transfer',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: -Math.PI / 2 } }, heading: 'up', dv: 8, accel: 1 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 180, rMax: 230, hold: 60 }],
      par: 4.8, bounds: 2000, tMax: 900, predict: 120, view: { x: 0, y: 0, span: 600 },
    },
    {
      id: 'skimmer',
      name: 'Skimmer',
      intro: 'Pyre is heavy, and the survey needs a pass just above its surface. Going down costs fuel just like going up: burn retrograde to drop, then retrograde again at the bottom so you stop falling and skim around.',
      objective: 'Orbit Pyre between 54 and 68 for 30 s.',
      teaches: 'Lowering an orbit',
      bodies: [
        { id: 'pyre', name: 'Pyre', gm: 30000, radius: 50, color: C.red },
      ],
      ship: ship({ start: { orbit: { body: 'pyre', r: 120, angle: 0 } }, heading: 'prograde', dv: 8, accel: 1.3 }),
      goals: [{ type: 'orbit', body: 'pyre', rMin: 54, rMax: 68, hold: 30 }],
      par: 7, bounds: 2000, tMax: 900, predict: 80, view: { x: 0, y: 0, span: 400 },
    },
    {
      id: 'wrongway',
      name: 'Wrong Way',
      intro: 'You are orbiting clockwise and need to go counter-clockwise. Flipping your velocity directly would take more fuel than you have. Instead, climb high: far out you move slowly, so turning around there is cheap. Then fall back and circularize.',
      objective: 'Orbit Terra counter-clockwise between 100 and 160 for 40 s.',
      teaches: 'Orbit direction · bi-elliptic transfer',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 120, angle: 0, dir: -1 } }, heading: 'prograde', dv: 16, accel: 2 }),
      goals: [{ type: 'orbit', body: 'terra', rMin: 100, rMax: 160, hold: 40, dir: 1 }],
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
      objective: 'Orbit Luna between 30 and 120 for 30 s.',
      teaches: 'Capture burns · reference frames',
      bodies: [
        { id: 'terra', name: 'Terra', gm: 20000, radius: 50, color: C.blue },
        { id: 'luna', name: 'Luna', gm: 1500, radius: 18, color: C.grey, orbit: { parent: 'terra', a: 400, phase: 2.6 } },
      ],
      ship: ship({ start: { orbit: { body: 'terra', r: 90, angle: 0 } }, heading: 'prograde', dv: 10, accel: 1 }),
      goals: [{ type: 'orbit', body: 'luna', rMin: 30, rMax: 120, hold: 30 }],
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
      objective: 'Stay within 40 of L4 for 30 s.',
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
      objective: 'Stay within 40 of L5 for 30 s.',
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
      id: 'escape',
      name: 'Escape Velocity',
      intro: 'Behemoth is heavy and your tank is small. A burn does the most good where you are moving fastest, at the bottom of your orbit (the Oberth effect). Coast down to your lowest point, then burn prograde hard.',
      objective: 'Get more than 1500 from Behemoth.',
      teaches: 'The Oberth effect',
      bodies: [
        { id: 'behemoth', name: 'Behemoth', gm: 40000, radius: 50, color: C.red },
      ],
      ship: ship({ start: { orbit: { body: 'behemoth', r: 400, angle: Math.PI / 2, speed: 0.546 } }, heading: 'prograde', dv: 3, accel: 1.5 }),
      goals: [{ type: 'escape', body: 'behemoth', r: 1500, label: 'Escape' }],
      par: 2.3, bounds: 4000, tMax: 900, predict: 200, view: { x: 0, y: 0, span: 900 },
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
      id: 'ringside',
      name: 'Ringside',
      intro: 'Saturnus wears two rings of rock with a clear gap between them. Climb from inside the inner ring, thread through it, and circularize in the gap. Watch for red CRASH marks on your path.',
      objective: 'Orbit Saturnus between 200 and 240 for 40 s.',
      teaches: 'Orbit insertion through obstacles',
      bodies: [
        { id: 'saturnus', name: 'Saturnus', gm: 40000, radius: 60, color: C.tan },
        ...belt('saturnus', 45, 150, 190, 777, 'inner'),
        ...belt('saturnus', 60, 250, 300, 1999, 'outer'),
      ],
      ship: ship({ start: { orbit: { body: 'saturnus', r: 110, angle: 0 } }, heading: 'prograde', dv: 7, accel: 1.2 }),
      goals: [{ type: 'orbit', body: 'saturnus', rMin: 200, rMax: 240, hold: 40 }],
      par: 6, bounds: 2500, tMax: 1500, predict: 120, view: { x: 0, y: 0, span: 720 },
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

  const Levels = { LEVELS, ship, VE };
  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;
  else root.Levels = Levels;
})(typeof window !== 'undefined' ? window : globalThis);
