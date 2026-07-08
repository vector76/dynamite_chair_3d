// Chase camera: sits behind the heading (direction of travel), smoothed,
// never below the ground.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createChaseCamera(camera) {
  const target = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let initialized = false;
  let groundFn = null;   // heightAt(x, z); set once the terrain exists

  return {
    setGround(fn) { groundFn = fn; },
    update(craftPos, heading, dt) {
      target.set(
        craftPos.x - Math.sin(heading) * CFG.camDist,
        craftPos.y + CFG.camHeight,
        craftPos.z + Math.cos(heading) * CFG.camDist,
      );
      const minY = groundFn
        ? groundFn(target.x, target.z) + CFG.camClearance
        : CFG.camMinY;
      if (target.y < minY) target.y = minY;

      if (!initialized) {
        camera.position.copy(target);
        initialized = true;
      } else {
        // critically-damped-ish exponential smoothing, framerate independent
        const k = 1 - Math.exp(-CFG.camDamping * dt);
        camera.position.lerp(target, k);
      }

      lookAt.set(craftPos.x, craftPos.y + 1, craftPos.z);
      camera.lookAt(lookAt);
    },
    snap() { initialized = false; },
  };
}
