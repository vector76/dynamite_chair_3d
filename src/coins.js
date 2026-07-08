// Coins along the canyon path: seeded placement, spin animation, pickup test.
// Placement draws from its own stream off the level seed, so every run of a
// level offers the identical coin set — required for comparable (coins, time)
// personal bests (M4).
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32 } from './rng.js';

// One soft radial-gradient disc, reused by every coin's contact shadow.
function makeBlobTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

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

  // Ground shadows are fake contact blobs, not the sun's shadow map: that map is
  // a small box that follows the craft (for a crisp craft shadow), so a coin's
  // real shadow only appears once it drifts close — jarring. A soft disc laid on
  // the floor under every coin renders at any distance, so no shadow ever pops in.
  const blobTex = makeBlobTexture();
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  const blobMat = new THREE.MeshBasicMaterial({
    map: blobTex, transparent: true, depthWrite: false, opacity: 0.85,
  });

  const group = new THREE.Group();
  const meshes = [];
  const blobs = [];
  for (const pos of positions) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.rotation.y = rnd() * Math.PI * 2;   // desynced spin phases
    m.castShadow = false;                 // shadowed by its blob instead (see above)
    group.add(m);
    meshes.push(m);

    // Contact shadow on the floor. The sun sits at craft+(50,80,20), so light
    // travels (-50,-80,-20): a coin h above the floor throws its shadow
    // h*(-0.625,-0.25) along the ground. Lean is clamped so a tall coin still
    // lands a usable disc on the floor rather than way off on a wall.
    const h = pos.y - heightAt(pos.x, pos.z);
    const lean = Math.min(h, 8);
    const sx = pos.x - 0.625 * lean;
    const sz = pos.z - 0.25 * lean;
    const r = 1.8 + h * 0.05;             // higher coin -> broader, softer disc
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.rotation.x = -Math.PI / 2;          // lay flat on the floor
    b.position.set(sx, heightAt(sx, sz) + 0.2, sz);
    b.scale.set(2 * r, 2 * r, 1);
    b.renderOrder = 1;                    // draw over the terrain it rests on
    group.add(b);
    blobs.push(b);
  }

  const api = {
    group,
    total: meshes.length,
    collected: 0,
    reset() {
      api.collected = 0;
      for (let i = 0; i < meshes.length; i++) {
        meshes[i].visible = true;
        blobs[i].visible = true;
      }
    },
    update(dt) {
      for (const m of meshes) if (m.visible) m.rotation.y += CFG.coinSpin * dt;
    },
    // sphere-distance pickup; returns how many were collected this call
    collect(pos) {
      const r2 = CFG.coinRadius * CFG.coinRadius;
      let got = 0;
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        if (!m.visible) continue;
        if (pos.distanceToSquared(m.position) <= r2) {
          m.visible = false;
          blobs[i].visible = false;   // its contact shadow goes with it
          api.collected++;
          got++;
        }
      }
      return got;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      blobGeo.dispose();
      blobMat.dispose();
      blobTex.dispose();
    },
  };
  return api;
}
