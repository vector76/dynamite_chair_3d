// Trajectory-prediction assist: forward-integrate the same physics with no
// further blasts and draw the committed arc as a dashed line, with a marker
// where it meets the terrain. The cooldown makes every kick a commitment —
// this shows what you're committed to. Toggleable (V), off by default.
import * as THREE from 'three';
import { CFG } from './config.js';
import { step } from './physics.js';

const VIZ_KEY = 'dc3d.showViz';

export function createTrajectoryViz(scene) {
  const MAX = Math.ceil(CFG.vizHorizon / CFG.vizDt) + 1;

  // dashed arc; lineDistance is recomputed every frame (the material dashes
  // along it, and the geometry changes constantly)
  const positions = new Float32Array(MAX * 3);
  const distances = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('lineDistance', new THREE.BufferAttribute(distances, 1));
  const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
    color: 0xbfe4ff, dashSize: 1.5, gapSize: 1.1,
    transparent: true, opacity: 0.55,
  }));
  line.frustumCulled = false;
  scene.add(line);

  // impact marker: a ring laid onto the terrain (tilted to the local slope,
  // so it reads on canyon walls too)
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.1, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd479, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    }),
  );
  scene.add(marker);

  let visible = localStorage.getItem(VIZ_KEY) === '1';   // off by default

  // scratch state for the forward simulation (same integrator, no blasts)
  const sim = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
  const prev = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const _z = new THREE.Vector3(0, 0, 1);   // RingGeometry faces +Z

  function update(state, heightAt) {
    line.visible = visible;
    marker.visible = false;
    if (!visible) return;

    sim.pos.copy(state.pos);
    sim.vel.copy(state.vel);
    positions[0] = sim.pos.x; positions[1] = sim.pos.y; positions[2] = sim.pos.z;
    let n = 1, hit = false;
    for (; n < MAX; n++) {
      prev.copy(sim.pos);
      step(sim, CFG.vizDt);
      if (sim.pos.y - CFG.feetOffset <= heightAt(sim.pos.x, sim.pos.z)) {
        // Refine the crossing inside this step by bisection, else the marker
        // quantizes to whole steps and jitters as the step phase shifts under
        // a moving craft. The integrator moves the position linearly within a
        // step (pos += vel * dt with vel already updated), so interpolating
        // along sim.vel retraces its path exactly.
        let lo = 0, hi = 1;
        for (let k = 0; k < 12; k++) {
          const mid = (lo + hi) / 2;
          const x = prev.x + sim.vel.x * mid * CFG.vizDt;
          const y = prev.y + sim.vel.y * mid * CFG.vizDt;
          const z = prev.z + sim.vel.z * mid * CFG.vizDt;
          if (y - CFG.feetOffset <= heightAt(x, z)) hi = mid; else lo = mid;
        }
        sim.pos.copy(prev).addScaledVector(sim.vel, hi * CFG.vizDt);
        hit = true;
      }
      positions[n * 3] = sim.pos.x;
      positions[n * 3 + 1] = sim.pos.y;
      positions[n * 3 + 2] = sim.pos.z;
      if (hit) { n++; break; }
    }

    distances[0] = 0;
    for (let i = 1; i < n; i++) {
      distances[i] = distances[i - 1] + Math.hypot(
        positions[i * 3] - positions[(i - 1) * 3],
        positions[i * 3 + 1] - positions[(i - 1) * 3 + 1],
        positions[i * 3 + 2] - positions[(i - 1) * 3 + 2],
      );
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.lineDistance.needsUpdate = true;
    geo.setDrawRange(0, n);

    if (hit) {
      const x = sim.pos.x, z = sim.pos.z;
      const y = heightAt(x, z);
      // terrain normal by central differences, to lay the ring on the slope
      normal.set(
        heightAt(x - 0.5, z) - heightAt(x + 0.5, z),
        1,
        heightAt(x, z - 0.5) - heightAt(x, z + 0.5),
      ).normalize();
      marker.position.set(x, y, z).addScaledVector(normal, 0.15);
      marker.quaternion.setFromUnitVectors(_z, normal);
      marker.visible = true;
    }
  }

  return {
    update,
    isOn() { return visible; },
    toggle() {
      visible = !visible;
      localStorage.setItem(VIZ_KEY, visible ? '1' : '0');
      return visible;
    },
  };
}
