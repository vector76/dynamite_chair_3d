// All tunables in one place. Units: meters, seconds, radians.
export const CFG = {
  // Physics — the impulse-to-gravity ratio is THE balance lever (see docs/GAME_DESIGN.md):
  // gravity low + impulse large means each blast commits you to a meaningfully different
  // arc, so rapid firing chains committed kicks instead of approximating a throttle.
  gravity: 4.0,        // m/s^2 downward
  impulse: 28.0,       // m/s velocity kick per blast
  blastCooldown: 3.0,  // s between blasts; keeps gravity the ever-present adversary
  safeSpeed: 5.0,      // max ground-contact speed to survive, m/s
  groundFriction: 4.0, // exponential decay rate of horizontal speed while resting
  wallThreshold: 2.5,  // ground overlap beyond this = hit a wall, not a landing

  // Craft & spawn (position comes from the level's canyon start)
  feetOffset: 0.8,     // distance from craft center to its feet
  spawnAltitude: 20,   // height above the canyon floor at spawn
  startSpeed: 8,       // initial velocity along the canyon, m/s

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

  // Chase camera: raised and pulled back so you can see ahead over canyon
  // bends; looks at a point ahead of the craft down the heading.
  camDist: 16,
  camHeight: 11,
  camLookAhead: 14,    // how far ahead of the craft the camera looks, m
  camDamping: 4.0,     // higher = snappier follow
  camMinY: 1.2,        // floor for the camera before terrain exists
  camClearance: 2.0,   // min camera height above the terrain surface

  // Mouse-wheel zoom: scales camDist & camHeight together. 1 = default framing;
  // scroll out to pull the camera back for a broader view coming around a bend.
  zoomMin: 0.6,        // closest (scroll in)
  zoomMax: 5.0,        // widest (scroll out)
  zoomSens: 0.0016,    // multiplicative rate per wheel-delta unit

  // Aim line: long pointing-direction indicator (readable from the far camera)
  aimLineLength: 9,

  // Trajectory assist: how far the committed (no-further-blasts) arc is
  // forward-integrated, and at what step (same integrator as the live sim)
  vizHorizon: 9,       // s of lookahead
  vizDt: 0.05,         // prediction timestep, s

  // Coins & finish gate
  coinRadius: 3.2,     // pickup distance — forgiving, ~2× the craft's size
  coinSpacing: 38,     // mean spacing along the canyon path, m
  coinSpin: 2.4,       // spin rate, rad/s
  gateHeight: 30,      // finish gate opening height above the floor, m

  // Loop
  dtMax: 0.05,
};
