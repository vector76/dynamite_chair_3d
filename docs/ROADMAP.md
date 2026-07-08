# Dynamite Chair 3D — Implementation Roadmap

*Draft v0.1 — 2026-07-07*

Milestones are ordered so that every one produces something playable/visible,
and the riskiest design questions (does the mechanic feel good in 3D?) get
answered first.

## M0 — Skeleton *(scene on screen)*
- Repo scaffolding: `index.html`, import map, vendored Three.js, module layout.
- Empty scene: sky, lights, flat ground plane, placeholder craft box, chase
  camera, render loop with dt-clamped updates.
- Deployed to GitHub Pages from day one so the pipeline is proven early.

## M1 — The mechanic *(the make-or-break milestone)*
- Ballistic physics + fixed-impulse blast along the nose vector (unlimited
  charges, cooldown-limited).
- Pointer-lock mouse aim + fire; keyboard fallback.
- Flat ground collision with safe-speed crash rule (slow contact survivable).
- Blast particles, screen shake, ported boom sound.
- **Exit questions: is aim-and-blast fun in 3D, and what impulse-to-gravity
  ratio keeps rapid blasts feeling like committed kicks rather than a
  throttle?** Tune those two numbers here before building anything else. Also
  settle camera feel (chase distance, smoothing) and whether craft
  orientation snaps to aim or slews.

## M2 — Terrain & canyon
- Seeded heightfield + canyon carve along a spline; flat-shaded mesh.
- Heightfield collision (with anti-tunneling sampling on steep slopes).
- Craft spawns at canyon start with initial velocity down the canyon.
- Debug URL params (`?seed=`, `?level=`).

## M3 — Coins, timing & level flow
- Coin placement along the canyon path; pickup detection (forgiving radius);
  chime.
- Run timer (simulation-clock based); finish gate at canyon end.
- Pause (blackout overlay, clock stops; auto-pause on pointer-lock loss and
  tab blur).
- Win/lose banners with run stats (coins, time) in the 2D game's style.
- Level progression: level N → fixed seed → narrower/twistier/longer canyon.
- Full state machine: ready → playing → finished/crashed → next/retry.
- Sanity-check that crash-ends-run feels fair on longer canyons.

## M4 — Scoring frontier, assists & polish *(done)*
- Personal-best (coins, time) frontier: dominance logic, localStorage
  persistence, end-of-level frontier plot with this run highlighted. *(src/scores.js;
  plot in hud.js)*
- 3D trajectory prediction line with impact marker (toggleable; hard-mode
  flag when off). *(HUD hard-mode badge tracks the V toggle)*
- HUD: speed, descent rate, elapsed time, coins (n / total), level.
  *(level shown as an always-on badge)*
- Level browser: an always-visible LEVEL badge plus prev/next arrows on the
  overlays to replay any level reached (unlocked levels tracked in scores.js).
- Crash effects, win fanfare, mute toggle, restart.
- Proper craft model from primitives (port the 2D lander look to 3D).

## M5 — Release pass
- README with play link, controls, and screenshots/GIF. *(done — docs/img/screenshot.jpg
  captured from the live renderer)*
- Tuning pass across levels 1–10 for difficulty curve. *(done at the generator level:
  makePath now picks, per level, the candidate seed whose meander best matches a rising
  per-level target — realized twist was previously dominated by seed luck and was
  non-monotonic, peaking at level 6. Playfeel tuning of gravity/impulse/cooldown remains
  a human call.)*
- Performance check on integrated graphics; browser matrix sanity pass. *(measured in
  Chromium: ≤1 ms/frame after warm-up on levels 1–10, terrain mesh bounded at ~88k verts
  by the 420² cap; integrated-GPU and cross-browser passes still need a human on real
  hardware)*

## Later / maybe (see GAME_DESIGN.md "Future ideas")
- Power-ups: half-kick charges, enlarged coin radius, others.
- Touch controls (virtual stick + fire).
- Air-drag variant/mutator.
- Landing-pad finale at canyon end (ties back to the 2D game).
- Daily-seed challenge mode (shareable `?seed=` links — still fully static).
- Endless-canyon mode.
