// Coins along the canyon path: seeded placement, spin animation, pickup test.
// Placement draws from its own stream off the level seed, so every run of a
// level offers the identical coin set — required for comparable (coins, time)
// personal bests (M4).
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32 } from './rng.js';

export function createCoins(params, path, heightAt) {
  const rnd = mulberry32((params.seed ^ 0x0C01F00D) >>> 0);

  // ---- placement ----
  // March along the path; each coin rolls a spot type: most sit near the
  // centerline at varying heights, the rest tempt risky detours (floor
  // scrapers, tucked near a wall, hung on the outside of a bend).
  const positions = [];
  const hw = params.halfWidth;
  const t0 = 70, t1 = path.length - 60;   // clear of the spawn and the gate
  for (let t = t0; t <= t1; t += CFG.coinSpacing * (0.75 + rnd() * 0.5)) {
    const roll = rnd();
    let lateral, height;                  // lateral is along the left normal, m
    if (roll < 0.55) {                    // centerline, varying heights
      lateral = (rnd() * 2 - 1) * hw * 0.35;
      height = 4 + rnd() * 12;
    } else if (roll < 0.7) {              // floor scraper
      lateral = (rnd() * 2 - 1) * hw * 0.3;
      height = 2.2 + rnd() * 1.3;
    } else if (roll < 0.85) {             // tucked near a wall
      lateral = (rnd() < 0.5 ? -1 : 1) * hw * (0.6 + rnd() * 0.15);
      height = 4 + rnd() * 8;
    } else {                              // outside of the local bend
      const a = path.dirAt(t - 25), b = path.dirAt(t + 25);
      const cross = a.x * b.z - a.z * b.x;   // >= 0: right turn, outside is left
      lateral = (cross >= 0 ? 1 : -1) * hw * (0.55 + rnd() * 0.2);
      height = 5 + rnd() * 8;
    }
    const p = path.pointAt(t), d = path.dirAt(t);
    const x = p.x + d.z * lateral;        // left normal = (d.z, -d.x)
    const z = p.z - d.x * lateral;
    positions.push(new THREE.Vector3(x, heightAt(x, z) + height, z));
  }

  // ---- meshes ----
  // A few dozen coins: individual meshes sharing one geometry/material are
  // plenty (InstancedMesh would buy nothing at this count).
  const geo = new THREE.CylinderGeometry(1.0, 1.0, 0.22, 20);
  geo.rotateZ(Math.PI / 2);               // axis along X: the coin stands on edge
  const mat = new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0x6a5210 });
  const group = new THREE.Group();
  const meshes = [];
  for (const pos of positions) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.rotation.y = rnd() * Math.PI * 2;   // desynced spin phases
    m.castShadow = true;
    group.add(m);
    meshes.push(m);
  }

  const api = {
    group,
    total: meshes.length,
    collected: 0,
    reset() {
      api.collected = 0;
      for (const m of meshes) m.visible = true;
    },
    update(dt) {
      for (const m of meshes) if (m.visible) m.rotation.y += CFG.coinSpin * dt;
    },
    // sphere-distance pickup; returns how many were collected this call
    collect(pos) {
      const r2 = CFG.coinRadius * CFG.coinRadius;
      let got = 0;
      for (const m of meshes) {
        if (!m.visible) continue;
        if (pos.distanceToSquared(m.position) <= r2) {
          m.visible = false;
          api.collected++;
          got++;
        }
      }
      return got;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
  return api;
}
