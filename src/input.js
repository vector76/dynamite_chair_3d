// Pointer-lock mouse aim + fire/restart keys.
// Owns the aim state (yaw/pitch -> nose direction); reports events via handlers.
import * as THREE from 'three';
import { CFG } from './config.js';

const INVERT_KEY = 'dc3d.invertY';

export function createInput(dom, handlers) {
  const aim = {
    yaw: 0,                    // 0 faces -Z; positive turns right
    pitch: CFG.startPitch,
    dir: new THREE.Vector3(),  // unit nose direction, derived from yaw/pitch
  };
  // invert mouse: mouse back = pitch up, like pulling back on a stick
  let invertY = localStorage.getItem(INVERT_KEY) === '1';

  function updateDir() {
    const cp = Math.cos(aim.pitch);
    aim.dir.set(
      Math.sin(aim.yaw) * cp,
      Math.sin(aim.pitch),
      -Math.cos(aim.yaw) * cp,
    );
  }
  updateDir();

  function resetAim() {
    aim.yaw = 0;
    aim.pitch = CFG.startPitch;
    updateDir();
  }

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== dom) return;
    aim.yaw += e.movementX * CFG.mouseSens;
    aim.pitch += (invertY ? 1 : -1) * e.movementY * CFG.mouseSens;
    aim.pitch = Math.min(CFG.pitchMax, Math.max(CFG.pitchMin, aim.pitch));
    updateDir();
  });

  document.addEventListener('pointerlockchange', () => {
    handlers.onLockChange(document.pointerLockElement === dom);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handlers.onHidden();
  });

  dom.addEventListener('pointerdown', () => {
    if (document.pointerLockElement === dom) handlers.onFire();
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;             // debounce: one blast per press
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        handlers.onFire();
        break;
      case 'KeyR':
        handlers.onRestart();
        break;
      case 'KeyI':
        invertY = !invertY;
        localStorage.setItem(INVERT_KEY, invertY ? '1' : '0');
        handlers.onInvertChange(invertY);
        break;
    }
  });

  if (invertY) handlers.onInvertChange(true);   // reflect persisted state in the UI

  function requestLock() {
    // May reject (e.g. browser cooldown right after Esc) — stay paused, the
    // user just clicks again.
    const p = dom.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }

  return { aim, resetAim, requestLock };
}
