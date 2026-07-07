// All tunables in one place. Units: meters, seconds, radians.
export const CFG = {
  // Physics — the impulse-to-gravity ratio is THE balance lever (see docs/GAME_DESIGN.md):
  // gravity low + impulse large means each blast commits you to a meaningfully different
  // arc, so rapid firing chains committed kicks instead of approximating a throttle.
  gravity: 3.0,        // m/s^2 downward
  impulse: 12.0,       // m/s velocity kick per blast
  safeSpeed: 5.0,      // max ground-contact speed to survive, m/s
  groundFriction: 4.0, // exponential decay rate of horizontal speed while resting

  // Craft
  feetOffset: 0.8,     // distance from craft center to its feet
  startPos: { x: 0, y: 30, z: 0 },
  startPitch: 60 * Math.PI / 180,  // initial aim: forward-up

  // Aim
  mouseSens: 0.0025,   // rad per pixel of mouse movement
  pitchMin: -80 * Math.PI / 180,
  pitchMax:  88 * Math.PI / 180,

  // Chase camera
  camDist: 12,
  camHeight: 5,
  camDamping: 4.0,     // higher = snappier follow
  camMinY: 1.2,        // never sink below the ground

  // Loop
  dtMax: 0.05,
};
