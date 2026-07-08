// Blast + crash particle bursts: one pooled THREE.Points, additive-blended,
// gravity-affected, short-lived. Pure visual — gameplay never reads these,
// so unseeded Math.random is fine (determinism only matters for gameplay).
import * as THREE from 'three';
import { CFG } from './config.js';

const MAX = 300;

// the 2D game's palette: hot core, orange flame, gray smoke
function hotColor(hot) {
  if (hot > 0.6) return [1.0, 0.94, 0.70];
  if (hot > 0.3) return [1.0, 0.59, 0.16];
  return [0.33, 0.30, 0.33];   // smoke, pre-dimmed for additive blending
}

export function createEffects(scene) {
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setDrawRange(0, 0);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.45, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  points.frustumCulled = false;
  scene.add(points);

  // particle store: parallel arrays, alive particles packed at the front
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const baseCol = new Float32Array(MAX * 3);
  let count = 0;

  function emit(x, y, z, vx, vy, vz, dur, hot) {
    if (count >= MAX) return;   // pool full: drop (the rest are already fading)
    const i = count++;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = dur; maxLife[i] = dur;
    const [r, g, b] = hotColor(hot);
    baseCol[i * 3] = r; baseCol[i * 3 + 1] = g; baseCol[i * 3 + 2] = b;
  }

  return {
    // ejecta out the tail: opposite the nose, in a cone, inheriting some
    // craft velocity — like the 2D spawnBlast
    spawnBlast(pos, noseDir, craftVel) {
      for (let i = 0; i < 22; i++) {
        // random direction within a cone around -noseDir
        let dx = -noseDir.x + (Math.random() - 0.5) * 1.1;
        let dy = -noseDir.y + (Math.random() - 0.5) * 1.1;
        let dz = -noseDir.z + (Math.random() - 0.5) * 1.1;
        const m = Math.hypot(dx, dy, dz) || 1;
        const spd = 6 + Math.random() * 12;
        emit(
          pos.x - noseDir.x, pos.y - noseDir.y, pos.z - noseDir.z,
          (dx / m) * spd + craftVel.x * 0.3,
          (dy / m) * spd + craftVel.y * 0.3,
          (dz / m) * spd + craftVel.z * 0.3,
          0.4 + Math.random() * 0.4,
          Math.random(),
        );
      }
    },

    // debris in every direction with a slight upward bias — like spawnCrash
    spawnCrash(pos) {
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const y = Math.random() * 2 - 1;
        const r = Math.sqrt(1 - y * y);
        const spd = 4 + Math.random() * 18;
        emit(
          pos.x, pos.y, pos.z,
          Math.cos(a) * r * spd,
          y * spd + 2,
          Math.sin(a) * r * spd,
          0.5 + Math.random() * 0.8,
          Math.random(),
        );
      }
    },

    update(dt) {
      for (let i = count - 1; i >= 0; i--) {
        life[i] -= dt;
        if (life[i] <= 0) {
          // swap-with-last keeps the alive particles packed
          const j = --count;
          if (i !== j) {
            for (let k = 0; k < 3; k++) {
              positions[i * 3 + k] = positions[j * 3 + k];
              vel[i * 3 + k] = vel[j * 3 + k];
              baseCol[i * 3 + k] = baseCol[j * 3 + k];
            }
            life[i] = life[j]; maxLife[i] = maxLife[j];
          }
          continue;
        }
        vel[i * 3 + 1] -= CFG.gravity * 0.6 * dt;   // lighter than the craft
        positions[i * 3] += vel[i * 3] * dt;
        positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const f = life[i] / maxLife[i];   // fade to black = invisible (additive)
        colors[i * 3] = baseCol[i * 3] * f;
        colors[i * 3 + 1] = baseCol[i * 3 + 1] * f;
        colors[i * 3 + 2] = baseCol[i * 3 + 2] * f;
      }
      geo.setDrawRange(0, count);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
