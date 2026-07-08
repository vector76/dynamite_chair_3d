// Pointer-lock mouse aim + fire/restart keys.
// Owns the aim state in the heading frame: foreAft (arc through vertical)
// and lateral (left/right tilt) -> local nose direction. main.js rotates it
// into world space by the current heading.
import * as THREE from 'three';
import { CFG } from './config.js';

const INVERT_KEY = 'dc3d.invertY';

export function createInput(dom, handlers) {
  // The aim is controlled as a 2D point on the orientation gauge: `right` and
  // `fwd` are the screen-plane offsets (radians) of the nose away from straight
  // up. The mouse moves that point directly, so the gauge dot tracks the mouse.
  // Mapping the plane onto the sphere (azimuthal-equidistant: distance from
  // centre = angle from vertical, direction = bearing) keeps every direction
  // live except the rim, straight down — so there is no gimbal at vertical, and
  // pointing sideways, forward/back still swings the nose.
  const aim = {
    right: 0,   // + leans the nose screen-right   (radians of tilt from up)
    fwd: 0,     // + leans the nose forward / up-screen
    localDir: new THREE.Vector3(),   // derived unit nose dir in the heading frame
  };
  // invert mouse: mouse back = pitch up, like pulling back on a stick
  let invertY = localStorage.getItem(INVERT_KEY) === '1';

  function updateDir() {
    const th = Math.hypot(aim.right, aim.fwd);   // angle from straight up
    if (th < 1e-6) { aim.localDir.set(0, 1, 0); return; }
    const s = Math.sin(th) / th;                 // spread the tilt onto the sphere
    aim.localDir.set(aim.right * s, Math.cos(th), -aim.fwd * s);
  }

  function resetAim() {
    aim.right = 0;
    aim.fwd = Math.PI / 2 - CFG.startForeAft;    // startForeAft = angle up from forward
    updateDir();
  }
  resetAim();

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== dom) return;
    aim.right += e.movementX * CFG.mouseSens;
    aim.fwd += (invertY ? 1 : -1) * e.movementY * CFG.mouseSens;
    // clamp the tilt to at most straight down (the plane's rim = the antipode)
    const th = Math.hypot(aim.right, aim.fwd);
    if (th > Math.PI) { const k = Math.PI / th; aim.right *= k; aim.fwd *= k; }
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

  // mouse wheel: pull the chase camera in/out for a wider view around bends
  dom.addEventListener('wheel', (e) => {
    if (document.pointerLockElement !== dom) return;
    e.preventDefault();
    handlers.onZoom(e.deltaY);
  }, { passive: false });

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
      case 'KeyV':
        handlers.onToggleViz();
        break;
      case 'KeyM':
        handlers.onToggleMute();
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
