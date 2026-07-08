// Chase camera: sits behind the heading (direction of travel), smoothed,
// never below the ground.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createChaseCamera(camera) {
  const target = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let initialized = false;

  return {
    update(craftPos, heading, dt) {
      target.set(
        craftPos.x - Math.sin(heading) * CFG.camDist,
        craftPos.y + CFG.camHeight,
        craftPos.z + Math.cos(heading) * CFG.camDist,
      );
      if (target.y < CFG.camMinY) target.y = CFG.camMinY;

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
