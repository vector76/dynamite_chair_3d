// Pointer-lock mouse aim + fire/restart keys.
// Owns the aim state in the heading frame: foreAft (arc through vertical)
// and lateral (left/right tilt) -> local nose direction. main.js rotates it
// into world space by the current heading.
import * as THREE from 'three';
import { CFG } from './config.js';

const INVERT_KEY = 'dc3d.invertY';

export function createInput(dom, handlers) {
  const aim = {
    foreAft: CFG.startForeAft,   // 0 fwd horizontal, 90° up, 180° back horizontal
    lateral: 0,                  // + tilts right, - tilts left
    localDir: new THREE.Vector3(),  // unit nose direction in the heading frame
  };
  // invert mouse: mouse back = pitch up, like pulling back on a stick
  let invertY = localStorage.getItem(INVERT_KEY) === '1';

  function updateDir() {
    const cb = Math.cos(aim.lateral);
    aim.localDir.set(
      Math.sin(aim.lateral),
      cb * Math.sin(aim.foreAft),
      -cb * Math.cos(aim.foreAft),
    );
  }
  updateDir();

  function resetAim() {
    aim.foreAft = CFG.startForeAft;
    aim.lateral = 0;
    updateDir();
  }

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== dom) return;
    aim.lateral += e.movementX * CFG.mouseSens;
    aim.lateral = Math.min(CFG.lateralMax, Math.max(-CFG.lateralMax, aim.lateral));
    aim.foreAft += (invertY ? 1 : -1) * e.movementY * CFG.mouseSens;
    aim.foreAft = Math.min(CFG.foreAftMax, Math.max(CFG.foreAftMin, aim.foreAft));
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
