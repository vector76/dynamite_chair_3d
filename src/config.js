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

  // Aim: the nose is a point on a sphere around the craft, relative to the
  // heading frame. foreAft is the arc in the vertical fore-aft plane
  // (0 = forward horizontal, 90° = straight up, 180° = backward horizontal);
  // lateral tilts the whole thing left/right, and always moves the nose tip
  // screen-left/right regardless of foreAft — no inversion when aiming
  // backward past vertical.
  mouseSens: 0.0025,   // rad per pixel of mouse movement
  startForeAft: 60 * Math.PI / 180,   // initial aim: forward-up
  foreAftMin: -80 * Math.PI / 180,
  foreAftMax: 180 * Math.PI / 180,    // full backward horizontal
  lateralMax:  85 * Math.PI / 180,    // just short of pure sideways (pole)

  // Heading: the frame the aim sphere and chase camera live in. It follows
  // the horizontal direction of travel (smoothed), not the mouse — you steer
  // by kicking, and the view swings to follow the actual flight path.
  headingMinSpeed: 1.0,  // m/s horizontal speed below which heading holds
  headingDamping: 2.0,   // higher = camera aligns to travel direction faster

  // Chase camera
  camDist: 12,
  camHeight: 5,
  camDamping: 4.0,     // higher = snappier follow
  camMinY: 1.2,        // never sink below the ground

  // Loop
  dtMax: 0.05,
};
