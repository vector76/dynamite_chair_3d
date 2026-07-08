# Dynamite Chair 3D — Technical Architecture

*Draft v0.1 — 2026-07-07*

## Hard constraints

1. **100% static hosting** — served from GitHub Pages. No backend, no server
   processing, no paid services.
2. **No build step** (strongly preferred) — like the 2D game, the repo should
   be directly servable: clone → open → play. This also makes GitHub Pages
   deployment trivial (Pages serves the repo as-is).
3. **No large binary assets** — terrain is procedural, audio is synthesized,
   the craft is built from primitives or a small inline geometry. Keeps the
   repo light and load times instant.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Rendering | **Three.js** (ES module, vendored) | The standard for web 3D; scene graph, cameras, materials out of the box. |
| Physics | **Hand-rolled** (~100 lines) | Same as 2D: gravity integration + impulse kicks + heightfield collision. A physics engine (Rapier, cannon-es) is massive overkill for one ballistic body vs. a heightfield. |
| Audio | **WebAudio, synthesized** | Port the 2D game's synth functions directly. |
| UI/HUD | **HTML/CSS overlay** | Same as 2D — DOM for HUD and banners, canvas for the world. |
| Build | **None.** ES modules + import map | `three.module.min.js` vendored into `/vendor`. No npm, no bundler. |

### Why vendor Three.js instead of a CDN?

A CDN `<script>` still counts as static hosting, but vendoring means the game
works offline, is immune to CDN outages/URL rot, and pins the version
explicitly. Three.js's module build is a single file (~600 KB min, ~150 KB
gzipped over Pages) — acceptable. Vendor it once in `vendor/` with the version
recorded in a comment and in this doc.

## Proposed file layout

```
/
├── index.html            # entry point; import map, canvas, HUD DOM, banners
├── vendor/
│   └── three.module.min.js   # pinned Three.js (record version here + in file header)
├── src/
│   ├── main.js           # bootstrap, game loop, mode state machine
│   ├── config.js         # all tunables in one place (gravity, impulse, ...)
│   ├── physics.js        # integration, blast impulse, collision queries
│   ├── terrain.js        # seeded heightfield + canyon carve + mesh build
│   ├── level.js          # level params, canyon spline, coin placement
│   ├── craft.js          # craft mesh (built from primitives) + orientation
│   ├── camera.js         # chase camera controller
│   ├── input.js          # pointer lock, mouse aim, keys, touch (later)
│   ├── coins.js          # coin meshes, spin animation, pickup detection
│   ├── effects.js        # blast particles, crash debris, screen shake
│   ├── audio.js          # ported 2D synth (boom, chime, crash, fanfare)
│   ├── hud.js            # DOM HUD + banners + stats table
│   ├── score.js          # (coins, time) frontier: dominance test, localStorage, plot
│   └── viz.js            # trajectory prediction line, assists
└── docs/                 # design documents (this folder)
```

Modules stay small and dependency-light; `main.js` owns the state machine
(`ready | playing | paused | finished | crashed`), in the spirit of the 2D
game's mode field.

## Core systems

### Physics (the heart — keep it exact)

Identical model to 2D, in 3D vectors:

```
each frame:  v += g * dt;  p += v * dt        (semi-implicit Euler, dt clamped)
on blast:    v += IMPULSE * noseDir;  cooldown = C    (unlimited charges, ~3 s cooldown)
```

- One dynamic body (the craft). Coins/goal are trigger spheres.
- Deterministic given inputs — which keeps the trajectory-prediction assist
  honest (it runs the same integrator forward).

### Terrain & collision

- **Heightfield**: `h(x, z)` from layered value/simplex noise with a
  **seeded PRNG** (e.g. mulberry32) — every level is reproducible from
  `(levelNumber)` → seed.
- **Canyon carve**: a 2D spline path (sequence of smoothed control points,
  also seeded) defines the canyon centerline. Terrain height is depressed
  within a falloff distance of the path: `h' = h - depth * falloff(distToPath)`.
  Width/depth/twistiness are level parameters.
- **Mesh**: one `PlaneGeometry` grid displaced by `h'`, flat-shaded. A chunked
  LOD scheme is *not* needed for v1 — a single ~256×256 grid over the level
  bounds is fine.
- **Collision**: bilinear-interpolated height lookup at the craft position
  (plus a few sample points around its footprint). Compare craft altitude vs.
  ground; on contact, check speed against the safe threshold → bounce/rest or
  crash. No mesh raycasting needed for the ground.
- Canyon **walls** are just steep terrain — the same height lookup handles
  them as long as we also check the craft's horizontal neighborhood (sample
  height at position + velocity-direction offset to avoid tunneling through
  steep slopes at speed; if needed, substep the collision query).

### Trajectory prediction (assist)

Forward-integrate the same physics for N seconds with no further blasts;
render as a dashed `Line` in world space with an impact marker where it hits
`h'(x,z)`. This is the 2D game's parabola, now genuinely useful for judging
canyon bends.

### Coins & goal

- Coins: `InstancedMesh` of a torus/cylinder, spin in the render loop,
  sphere-distance pickup test (cheap: only test coins within the active
  region ahead of the craft).
- Goal: the finish gate is a trigger plane spanning the canyon at its end;
  crossing it stops the clock and ends the run.

### Timing, pause & scoring

- **Timer**: accumulate the same clamped `dt` the physics uses (not wall
  clock), so pauses/tab-switches don't corrupt times and the recorded time is
  exactly the simulated time.
- **Pause**: freezes the update loop and clock, and covers the scene + HUD
  with an opaque overlay (no strategizing on a frozen frame). Auto-pause on
  pointer-lock loss (`pointerlockchange`) and tab blur (`visibilitychange`) —
  Esc exits pointer lock in browsers anyway, so Esc-to-pause falls out for
  free. Resume re-requests pointer lock on click.
- **Frontier**: per level, keep the list of non-dominated `(coins, timeMs)`
  runs. On run completion: drop the new run if any entry has `coins ≥` and
  `time ≤` (strict in one); otherwise insert it and evict entries it
  dominates. The list is tiny (≤ max coins + 1 entries) — no data-structure
  cleverness needed.
- **Persistence**: `localStorage` key like `dc3d.frontier.level3`
  (versioned prefix so a format change can migrate/reset cleanly). Fixed seed
  per level number guarantees times are comparable.
- **Plot**: the end-of-level frontier chart is a small 2D canvas (time on X,
  coins on Y) drawn with plain 2D-canvas calls — no charting library.

### Camera

Chase camera: position = craft position − (behind offset along smoothed
velocity or aim direction) + height offset, with critically-damped smoothing.
Must never clip into terrain — clamp camera altitude to `h'(cam) + margin`.
Camera code is isolated in `camera.js` so we can trial cockpit/tactical views.

### Input

- **Pointer lock** on canvas click → mouse deltas rotate the aim direction
  (yaw/pitch). Craft orientation slews toward aim at a capped rate (or
  instantly, like 2D mouse-steer — prototype both).
- Space/click fires. R restarts, F/V/M toggles as in 2D.
- Touch support deferred to a later milestone (virtual stick + fire button).

## Performance budget

- One terrain mesh (~130k tris max), one craft (a few hundred tris),
  ≤100 instanced coins, ≤300 particles. Trivial for any GPU from the last
  decade; target 60 fps on integrated graphics.
- No textures required (vertex colors / flat materials) → near-zero load time.

## Testing & verification

- Physics and terrain modules are pure functions of (state, params, seed) —
  unit-testable without a browser if we ever add a test runner; at minimum,
  keep them side-effect-free so they can be exercised from the console.
- A `?seed=` / `?level=` URL param for jumping to reproducible scenarios.

## Deployment

- GitHub Pages, **deploy from `main` branch root** (Settings → Pages →
  `main` / `/root`). Because there's no build step, there is no Actions
  workflow needed — push to `main` and it's live at
  `https://vector76.github.io/dynamite_chair_3d/`.
- All asset URLs must be **relative** (`./vendor/three.module.min.js`) so the
  project-subpath URL works.

## Explicit non-goals (v1)

- Multiplayer, leaderboards, accounts (would need a backend — excluded by
  constraint). A local-storage best-score table is fine.
- Physics engine integration, skeletal animation, textures, asset pipeline.
- Mobile/touch (deferred, not excluded — the architecture shouldn't preclude it).
