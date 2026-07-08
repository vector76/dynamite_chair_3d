// Seeded heightfield terrain with a canyon carved along the level path.
// heightAt(x, z) is an analytic function (noise + carve blend), so collision
// queries and the mesh sample the exact same surface at any position.
import * as THREE from 'three';
import { fbm, vnoise, mulberry32 } from './rng.js';

// Fine-grained regolith noise, multiplied over the vertex colors. Pure
// visual texture — gives the smooth Lambert surface the optical grain the
// eye needs to judge distance and closing speed. Seeded: deterministic.
function makeGrainTexture() {
  const S = 256;
  const rnd = mulberry32(0xD1CE);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 235 - rnd() * 50;          // mid-gray grain, ~±10% brightness
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildTerrain(params, path) {
  const seed = params.seed;

  // canyon floor descends linearly from mouth to end
  function floorYAt(t) {
    return params.floorStart - (t / path.length) * params.floorDrop;
  }

  // core evaluation: returns height + canyon blend factor (0 floor .. 1 outside)
  function evalTerrain(x, z) {
    // base rolling terrain, roughly [0 .. 55]
    const base = 28 + fbm(x / 260, z / 260, seed) * 42;

    const { dist, t } = path.closest(x, z);
    const hw = params.halfWidth;

    // blend: flat floor inside hw, wall climb from hw to ~2.2*hw, terrain outside
    const s = smoothstep(hw, hw * 2.2, dist);

    // raised rim ridge just outside the canyon edge — reads as a levee and
    // keeps the canyon a canyon even where the base terrain dips low
    const rim = 14 * smoothstep(hw * 0.8, hw * 1.8, dist) * (1 - smoothstep(hw * 2.0, hw * 4.5, dist));

    // floor gets small-scale roughness (never enough to hide a safe landing)
    const floor = floorYAt(t) + vnoise(x / 18, z / 18, seed + 77) * 1.2;

    return { h: floor * (1 - s) + (base + rim) * s, s };
  }

  function heightAt(x, z) {
    return evalTerrain(x, z).h;
  }

  // ---- mesh ----
  // bounds: path bounding box + margin, sampled on a ~4 m grid
  const MARGIN = 260, CELL = 4;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of path.points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  minX -= MARGIN; maxX += MARGIN; minZ -= MARGIN; maxZ += MARGIN;
  const nx = Math.min(420, Math.ceil((maxX - minX) / CELL));
  const nz = Math.min(420, Math.ceil((maxZ - minZ) / CELL));

  const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, nx, nz);
  geo.rotateX(-Math.PI / 2);   // plane in XZ, +Y up
  geo.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const floorCol = new THREE.Color(0x9d978f);   // canyon floor: warm dark gray
  const rimCol = new THREE.Color(0xcbcbd4);     // regolith gray
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const { h, s } = evalTerrain(pos.getX(i), pos.getZ(i));
    pos.setY(i, h);
    c.copy(floorCol).lerp(rimCol, s);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const grain = makeGrainTexture();
  // one texture tile per ~24 m; 256 texels/tile ≈ 9 cm grain up close,
  // mipmaps + anisotropy keep it calm at distance
  grain.repeat.set((maxX - minX) / 24, (maxZ - minZ) / 24);
  grain.anisotropy = 4;

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: grain,
  }));
  mesh.receiveShadow = true;

  return { mesh, heightAt, floorYAt };
}

function smoothstep(a, b, x) {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}
