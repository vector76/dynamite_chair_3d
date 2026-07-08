// Chase camera: sits behind the heading (direction of travel), smoothed,
// never below the ground.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createChaseCamera(camera) {
  const target = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let initialized = false;
  let groundFn = null;   // heightAt(x, z); set once the terrain exists
  let zoom = 1;          // mouse-wheel multiplier on distance & height; persists across runs

  return {
    setGround(fn) { groundFn = fn; },
    // deltaY > 0 (scroll out) pulls the camera back; multiplicative so each
    // notch feels the same at any distance. Clamped to the config range.
    zoomBy(deltaY) {
      zoom *= Math.exp(deltaY * CFG.zoomSens);
      zoom = Math.min(CFG.zoomMax, Math.max(CFG.zoomMin, zoom));
    },
    update(craftPos, heading, dt) {
      target.set(
        craftPos.x - Math.sin(heading) * CFG.camDist * zoom,
        craftPos.y + CFG.camHeight * zoom,
        craftPos.z + Math.cos(heading) * CFG.camDist * zoom,
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

      // look past the craft, down the canyon — shows what's coming at a bend
      lookAt.set(
        craftPos.x + Math.sin(heading) * CFG.camLookAhead,
        craftPos.y + 1,
        craftPos.z - Math.cos(heading) * CFG.camLookAhead,
      );
      camera.lookAt(lookAt);
    },
    snap() { initialized = false; },
  };
}
