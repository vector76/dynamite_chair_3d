// Per-level parameters + the canyon centerline path.
// Everything derives from the level's fixed seed: identical terrain every
// run, so personal-best times are comparable.
import { mulberry32 } from './rng.js';

export function levelParams(level, seedOverride) {
  const seed = seedOverride != null ? seedOverride : Math.imul(level, 2654435761) >>> 0;
  return {
    level, seed,
    length: 800 + (level - 1) * 100,          // canyon length, m
    halfWidth: Math.max(16, 34 - (level - 1) * 3),  // flat-floor half-width, m
    // max curvature step per segment, rad; capped because past ~0.6 a bounded
    // meander self-intersects for essentially every seed (nothing to resample to)
    turniness: Math.min(0.6, 0.20 + (level - 1) * 0.04),
    floorStart: -10,                          // floor height at the canyon mouth
    floorDrop: 80 + (level - 1) * 10,         // total descent over the length
  };
}

// Canyon centerline: a meandering polyline marched from the origin, heading
// roughly -Z, with random-walk curvature pulled back toward straight.
// Segments are short (30 m) and turns gentle, so the polyline itself is
// smooth enough — no spline interpolation needed.
const STEP = 30;

// Min distance between 2D segments ab and cd (point-to-segment, both ways).
function segSegDist(a, b, c, d) {
  const f = (px, pz, ax, az, bx, bz) => {
    const abx = bx - ax, abz = bz - az;
    let u = ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1e-9);
    u = Math.max(0, Math.min(1, u));
    return Math.hypot(px - (ax + abx * u), pz - (az + abz * u));
  };
  return Math.min(
    f(a.x, a.z, c.x, c.z, d.x, d.z), f(b.x, b.z, c.x, c.z, d.x, d.z),
    f(c.x, c.z, a.x, a.z, b.x, b.z), f(d.x, d.z, a.x, a.z, b.x, b.z));
}

// Self-intersection test: any two segments that are far apart *along the path*
// yet closer than `hitDist` (= 2*halfWidth) in space overlap the canyon floors
// — a visible fold. The along-path skip scales with canyon width: a fat, gently
// curving corridor's own near-neighbours sit closer than hitDist without being a
// fold, so segments within ~1.5*hitDist of arc length don't count.
function pathFolds(pts, hitDist) {
  const s = pts.length - 1;
  const skip = Math.ceil(1.5 * hitDist / STEP) + 1;
  for (let i = 0; i < s; i++)
    for (let j = i + skip; j < s; j++)
      if (segSegDist(pts[i], pts[i + 1], pts[j], pts[j + 1]) < hitDist) return true;
  return false;
}

// One meandering walk from the origin, heading roughly -Z, with random-walk
// curvature pulled back toward straight. `dirCap` (radians, optional) bounds how
// far the heading may swing off -Z; with cap <= ~0.8 the path always advances in
// -Z (cos >= 0.7), which makes self-intersection impossible (see makePath).
function walk(params, seed, dirCap) {
  const rnd = mulberry32(seed);
  const n = Math.ceil(params.length / STEP);
  const pts = [];
  let x = 0, z = 0, dir = 0, curv = 0;
  for (let i = 0; i <= n; i++) {
    pts.push({ x, z });
    curv += (rnd() * 2 - 1) * params.turniness * 0.6;
    curv *= 0.9;                                   // curvature decays: no death spirals
    curv = Math.max(-params.turniness, Math.min(params.turniness, curv));
    dir += curv;
    dir *= 0.98;                                   // gentle pull back toward -Z overall
    if (dirCap) dir = Math.max(-dirCap, Math.min(dirCap, dir));
    x += Math.sin(dir) * STEP;
    z -= Math.cos(dir) * STEP;
  }
  return pts;
}

export function makePath(params) {
  // The turnier high levels can fold back and cross themselves. Local steering
  // can't always escape a committed approach in one step, so instead regenerate
  // with a perturbed seed until the walk doesn't self-intersect. Attempt 0 uses
  // the level's own seed, so any level that already doesn't fold is unchanged.
  const hitDist = 2 * params.halfWidth;
  let pts = walk(params, params.seed);
  for (let attempt = 1; attempt < 256 && pathFolds(pts, hitDist); attempt++) {
    pts = walk(params, (params.seed + Math.imul(attempt, 0x9e3779b1)) >>> 0);
  }
  // Pathologically long/turny levels have no free-meander seed that avoids
  // folding. Fall back to a heading-capped walk: cos(dir) >= 0.7 means the path
  // always advances in -Z, so two segments far apart along it are far apart in Z
  // too and can never overlap — a guaranteed non-self-intersecting canyon.
  if (pathFolds(pts, hitDist)) pts = walk(params, params.seed, 0.8);
  const n = pts.length - 1;
  const length = n * STEP;

  // distance from (x,z) to the polyline + arc-length parameter t of the
  // closest point. Brute force over segments — tiny (≤ ~40 segments).
  function closest(px, pz) {
    let bestD2 = Infinity, bestT = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, az = pts[i].z;
      const bx = pts[i + 1].x, bz = pts[i + 1].z;
      const abx = bx - ax, abz = bz - az;
      let u = ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz);
      u = Math.max(0, Math.min(1, u));
      const dx = px - (ax + abx * u), dz = pz - (az + abz * u);
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; bestT = (i + u) * STEP; }
    }
    return { dist: Math.sqrt(bestD2), t: bestT };
  }

  function pointAt(t) {
    const u = Math.max(0, Math.min(length, t)) / STEP;
    const i = Math.min(pts.length - 2, Math.floor(u));
    const f = u - i;
    return {
      x: pts[i].x + (pts[i + 1].x - pts[i].x) * f,
      z: pts[i].z + (pts[i + 1].z - pts[i].z) * f,
    };
  }

  function dirAt(t) {
    const u = Math.max(0, Math.min(length, t)) / STEP;
    const i = Math.min(pts.length - 2, Math.floor(u));
    const dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z;
    const m = Math.hypot(dx, dz);
    return { x: dx / m, z: dz / m };
  }

  return { points: pts, length, closest, pointAt, dirAt };
}
