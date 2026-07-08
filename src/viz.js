// Trajectory-prediction assist: forward-integrate the same physics with no
// further blasts and draw the committed arc as a dashed line, with a marker
// where it meets the terrain. The cooldown makes every kick a commitment —
// this shows what you're committed to. Toggleable (V), on by default.
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

  let visible = localStorage.getItem(VIZ_KEY) !== '0';   // on by default

  // scratch state for the forward simulation (same integrator, no blasts)
  const sim = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
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
      step(sim, CFG.vizDt);
      positions[n * 3] = sim.pos.x;
      positions[n * 3 + 1] = sim.pos.y;
      positions[n * 3 + 2] = sim.pos.z;
      if (sim.pos.y - CFG.feetOffset <= heightAt(sim.pos.x, sim.pos.z)) {
        n++; hit = true;
        break;
      }
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
