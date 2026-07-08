// Trajectory-prediction assist. Two forward-integrated arcs, both run through
// the same integrator as the live sim:
//   - committed arc (cyan): where you go if you DON'T blast again.
//   - blast arc (green): where you'd go if you kicked RIGHT NOW along the aim.
// Each ends in a ring where it meets the terrain. Toggleable (V), off by
// default. The green arc dims while the blast is on cooldown — you can see the
// planned kick, but it isn't available yet.
import * as THREE from 'three';
import { CFG } from './config.js';
import { step, blast } from './physics.js';

const VIZ_KEY = 'dc3d.showViz';

export function createTrajectoryViz(scene) {
  const MAX = Math.ceil(CFG.vizHorizon / CFG.vizDt) + 1;

  // One predicted arc: a dashed line (lineDistance recomputed every frame,
  // since the geometry changes constantly) plus a terrain-laid impact ring.
  function makeArc(lineColor, lineOpacity, markerColor) {
    const positions = new Float32Array(MAX * 3);
    const distances = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('lineDistance', new THREE.BufferAttribute(distances, 1));
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
      color: lineColor, dashSize: 1.5, gapSize: 1.1,
      transparent: true, opacity: lineOpacity,
    }));
    line.frustumCulled = false;
    scene.add(line);

    // impact marker: a ring tilted to the local slope, so it reads on walls too
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.1, 24),
      new THREE.MeshBasicMaterial({
        color: markerColor, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      }),
    );
    scene.add(marker);
    return { positions, distances, geo, line, marker };
  }

  const committed = makeArc(0xbfe4ff, 0.55, 0xffd479);   // no further blasts
  const blastArc = makeArc(0x6bff9e, 0.60, 0x6bff9e);    // if you kick now (aim color)

  let visible = localStorage.getItem(VIZ_KEY) === '1';   // off by default

  // scratch state for the forward simulation (same integrator, no blasts)
  const sim = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
  const bvel = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const _z = new THREE.Vector3(0, 0, 1);   // RingGeometry faces +Z

  // Integrate from (pos0, vel0) with no further blasts, filling arc's buffers.
  // Returns the terrain hit point {x,y,z} or null if the arc never lands within
  // the horizon.
  function trace(arc, pos0, vel0, heightAt) {
    const { positions, distances } = arc;
    sim.pos.copy(pos0);
    sim.vel.copy(vel0);
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
    arc.geo.attributes.position.needsUpdate = true;
    arc.geo.attributes.lineDistance.needsUpdate = true;
    arc.geo.setDrawRange(0, n);

    return hit ? { x: sim.pos.x, y: sim.pos.y, z: sim.pos.z } : null;
  }

  // Lay an arc's impact ring onto the terrain at its hit point (or hide it).
  function placeMarker(marker, hit, heightAt) {
    if (!hit) { marker.visible = false; return; }
    const x = hit.x, z = hit.z;
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

  function update(state, noseDir, heightAt) {
    committed.line.visible = visible;
    blastArc.line.visible = visible;
    committed.marker.visible = false;
    blastArc.marker.visible = false;
    if (!visible) return;

    // committed arc: keep flying, no more kicks
    placeMarker(committed.marker, trace(committed, state.pos, state.vel, heightAt), heightAt);

    // blast arc: same start, one impulse added along the current aim. Dim it
    // while the kick is on cooldown (you can plan it, but can't fire yet).
    bvel.copy(state.vel);
    blast({ vel: bvel }, noseDir);
    const ready = state.cooldown <= 0;
    blastArc.line.material.opacity = ready ? 0.60 : 0.20;
    blastArc.marker.material.opacity = ready ? 0.85 : 0.30;
    placeMarker(blastArc.marker, trace(blastArc, state.pos, bvel, heightAt), heightAt);
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
