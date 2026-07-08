# Dynamite Chair 3D — Game Design Document

*Draft v0.2 — 2026-07-07*

## Concept

A 3D flight game built on the Dynamite Chair mechanic: your craft has **no
throttle** — only **fixed-impulse charges**. Each blast delivers one identical
velocity kick in the direction the craft is pointing. Between blasts you are in
pure ballistic free-fall under gravity.

Where the 2D game asked you to land gently on a pad, the 3D game asks you to
**fly along a finite canyon carved into terrain, collecting coins** placed
along the route, **as fast as you can**. The challenge shifts from "arrive at
zero velocity" to "manage a trajectory": keep forward speed, blast to arrest
your descent before the canyon floor, and steer with angled kicks to thread
the walls and sweep up coins.

Charges are **unlimited**. The economy is not ammunition — it is **time and
trajectory**: every blast you spend braking or correcting is speed you gave
up.

## Core loop

1. Level starts: craft is launched into the canyon with initial velocity; the
   clock starts.
2. Player orients the craft (aim) and fires charges (impulse kicks) to shape a
   ballistic arc through the canyon.
3. Coins along the canyon are collected by flying close enough to them.
4. The run ends at the finish gate at the canyon's end (or in a crash).
5. Result: **coins collected** and **elapsed time** — two axes of mastery.

## Scoring: the coins-vs-time frontier

There is deliberately **no single score**. A run produces a point
`(coins, time)`. Per level, the game keeps your **personal-best frontier**:
the set of non-dominated runs.

- A run **dominates** another if it collected ≥ coins in ≤ time (strict in at
  least one). Dominated runs drop off the list.
- Fewer coins in less time is *not* strictly better or worse — it's a
  different point on the frontier ("speedrun line" vs "completionist line").
- Presented as a small **2D scatter plot** (time on X, coins on Y) on the
  end-of-level screen: your frontier as connected points, this run highlighted
  — green if it made the frontier, gray if dominated.
- Stored in `localStorage`, keyed per level. No names, no server — personal
  bests only (static-hosting constraint).

This requires **fixed, reproducible levels** (fixed seed per level number) so
times are comparable across runs. A possible "coins per second" composite
metric stays on the shelf unless the frontier proves unsatisfying.

## The craft

Same fiction as the 2D game: a chair (lunar-lander-styled craft) propelled by
dynamite. The blast fires opposite the craft's nose direction, kicking the
craft along its nose vector — exactly like 2D, generalized to 3D.

- **State**: position, velocity, orientation (quaternion).
- **Between blasts**: gravity only. No lift, no drag (pure ballistic; drag is
  a possible future variant).
- **Blast**: instantaneous `velocity += impulse * noseDirection`, fixed
  magnitude, **unlimited count**, **no gameplay cooldown**.

### Impulse vs. gravity is the balance lever

There is no meaningful blast cooldown. What keeps the mechanic from
degenerating into a continuous throttle is the **ratio of impulse to
gravity**: with low gravity and a large impulse, each blast commits you to a
meaningfully different ballistic arc — rapid firing doesn't approximate
hover, it just chains large committed kicks. (High gravity + rapid small
kicks *would* feel like a throttle; that combination is simply avoided in
tuning.) The M1 prototype's central job is finding this ratio.

Only a minimal technical debounce is needed (ignore key auto-repeat; one
blast per press/click). A real cooldown may return later as a property of the
half-kick power-up charges, where finer control could justify a constraint.

## Controls

- **Mouse (pointer lock)** — aims the craft. The nose is a point on a sphere
  around the craft: mouse forward/back moves it along the fore-aft arc
  (through straight-up, all the way to backward horizontal — braking kicks),
  mouse left/right tilts it laterally. Left/right always moves the nose tip
  screen-left/right, even when aiming backward past vertical.
- **Click / Space** — fire a charge.
- **Camera** — chase camera behind the craft, following the smoothed
  horizontal *direction of travel* (not the mouse). You steer by kicking;
  the view swings to follow the actual flight path. Below a minimum
  horizontal speed the heading holds steady (hovering, resting).
- **Keyboard fallback** — WASD/arrows drive the same two aim angles.
- **P / Esc** pause, **R** restart level, **V** toggle trajectory assist,
  **M** mute.

Roll is physically meaningless (the kick is along the nose axis) —
auto-level roll to keep the horizon sane.

### Pause

Pausing stops the simulation clock — but it also **hides the scene and HUD**
behind a blackout overlay, so pause can't be used as a free strategy screen
(freezing the world to line up the perfect kick would cheapen timed runs).
Click/keypress resumes; the world reappears at that instant.

Pointer lock interacts naturally here: pressing **Esc** releases pointer lock
(browser behavior we can't prevent), so losing pointer lock — and losing tab
focus — should *auto-pause*. This turns a browser quirk into the pause
feature.

## Terrain & the canyon

- Procedurally generated heightfield terrain with a **fixed seed per level**
  (required for comparable times; also makes runs shareable).
- A **canyon of finite length** is carved along a spline path: it meanders
  horizontally and descends gradually. Width, depth, and twistiness are the
  primary difficulty knobs.
- A clearly marked **finish gate** spans the canyon at its end; crossing it
  stops the clock and ends the run.
- The player is not fenced in — flying up over the rim is an intended
  **escape mechanism**: about to crash, you can always blast up and out of
  the canyon, and nothing bad happens. There are **no coins outside the
  canyon**, so the escape simply costs time (and the detour past whatever
  coins you overflew).

## Coins

- Placed along the canyon path — mostly near the centerline at varying
  heights, with some tempting risky detours (low near the floor, tucked near
  a wall, on the outside of a bend).
- Collected by proximity (sphere test), with a **forgiving radius** (~2× the
  craft). A tighter or larger radius can become a difficulty knob or power-up
  later.
- No required count, no par: every coin is optional; coins are one axis of
  the score.

## Failure

- **Crash**: contact with terrain above a safe-speed threshold (same spirit
  as the 2D safe-landing speed). Slow contact is survivable — scraping the
  floor and blasting back up is a legitimate recovery, and it preserves the
  2D game's "one kick's worth of speed" literacy.
- A crash **ends the run** with no frontier entry; restart is instant (R or
  the banner). With unlimited charges and short levels, retry is cheap —
  no checkpoints in the MVP.

## Difficulty progression

Per-level knobs, in rough order of application:

1. Narrower / deeper / twistier canyon.
2. Longer canyon.
3. Coins placed in riskier spots.
4. Stronger gravity or weaker impulse (used sparingly — the 2D game found
   raising gravity softened the mechanic; prefer geometry-based difficulty).

(Charge scarcity is gone as a knob — charges are infinite by design.)

## Assists

- **Trajectory prediction** (toggleable, on by default): the predicted
  ballistic arc as a dashed 3D curve with a terrain-impact marker. The 2D
  game's most valuable assist, ported.
- There is **no auto-fire analog** — nothing corresponds to it in this design.
- Hard mode = trajectory assist off; flagged in the run stats.

## HUD

- Speed, descent rate, **elapsed time**, coin count (`7 / 23` style, since
  the level total is knowable), level number.
- End-of-level banner: run stats + the coins-vs-time frontier plot.

## Audio

Synthesized with WebAudio exactly like the 2D game (no audio assets): boom,
coin chime, crash, win fanfare. Port the 2D synth code.

## Aesthetic

Keep the 2D game's look, extruded to 3D: dark sky, stars, light-gray regolith
terrain, gold-foil lander craft, orange blast particles. Low-poly /
flat-shaded is both stylistically consistent and cheap to render.

## Future ideas (explicitly post-MVP, not on the roadmap)

- **Power-ups**, e.g.:
  - **Half-kick charges**: pick up a power-up granting N charges at half
    impulse — finer trajectory control as a scarce resource layered on top of
    the infinite full kicks.
  - **Enlarged coin-collection radius** for a stretch of canyon.
- **Air drag** as a variant/mutator (dilutes energy purity — off by default).
- **Landing finale**: a gentle touchdown pad after the finish gate as an
  optional flourish tying back to the 2D game.
- **Daily seed** challenge (still fully static — seed derived from the date).
- **Endless canyon** mode (the finite race came first by decision, but the
  generator could run indefinitely).

## Remaining open questions (to settle during early milestones)

1. **Impulse-to-gravity ratio** — the central tuning question; must be large
   enough that rapid blasts stay committed kicks, not throttle. Settle in M1.
2. **Timer semantics** — clock starts at spawn (proposed) vs. at first input.
3. **Aim slew** — nose snaps to the pointer instantly (2D mouse-steer feel)
   vs. slews at a capped rate. Prototype both in M1.
4. **Coin visibility** — is the chase camera enough to read upcoming coins,
   or do we need subtle guidance (glow through walls, edge arrows)? Assess
   in M3.
5. **Crash-ends-run feel** — confirmed as the rule; verify it isn't too
   punishing on longer canyons (M3), given restart is instant.
