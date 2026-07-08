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
    turniness: 0.20 + (level - 1) * 0.04,     // max curvature step per segment, rad
    floorStart: -10,                          // floor height at the canyon mouth
    floorDrop: 80 + (level - 1) * 10,         // total descent over the length
  };
}

// Canyon centerline: a meandering polyline marched from the origin, heading
// roughly -Z, with random-walk curvature pulled back toward straight.
// Segments are short (30 m) and turns gentle, so the polyline itself is
// smooth enough — no spline interpolation needed.
const STEP = 30;

export function makePath(params) {
  const rnd = mulberry32(params.seed);
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
    x += Math.sin(dir) * STEP;
    z -= Math.cos(dir) * STEP;
  }
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
