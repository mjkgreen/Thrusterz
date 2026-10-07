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
