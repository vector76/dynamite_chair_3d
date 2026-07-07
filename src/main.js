// Bootstrap + game loop + mode state machine: ready | playing | paused | crashed.
import * as THREE from 'three';
import { CFG } from './config.js';
import { step, blast, resolveGround } from './physics.js';
import { createInput } from './input.js';
import { createCraft } from './craft.js';
import { createChaseCamera } from './camera.js';
import { updateHud, showBanner, showPause, hideOverlays } from './hud.js';

// ---- Renderer & scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c1a);
scene.fog = new THREE.Fog(0x0a0c1a, 100, 700);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Lights ----
scene.add(new THREE.HemisphereLight(0xb0b6ff, 0x444450, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(50, 80, 20);
scene.add(sun);

// ---- Stars ----
{
  const N = 800, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // random points on the upper hemisphere of a big dome
    const a = Math.random() * Math.PI * 2;
    const y = Math.random() * 0.85 + 0.08;
    const r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(a) * r * 900;
    pos[i * 3 + 1] = y * 900;
    pos[i * 3 + 2] = Math.sin(a) * r * 900;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xcfd3ff, size: 1.6, sizeAttenuation: false, fog: false,
  }));
  scene.add(stars);
}

// ---- Ground (flat plane for M1; heightfield terrain arrives in M2) ----
{
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshLambertMaterial({ color: 0xcbcbd4 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(2000, 200, 0x8d8d9c, 0xb2b2bf); // parallax cue on flat ground
  grid.position.y = 0.02;
  scene.add(grid);
}

// ---- Craft & camera ----
const craft = createCraft();
scene.add(craft.object);
const chase = createChaseCamera(camera);

// ---- Game state ----
const state = {
  mode: 'ready',
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  time: 0,      // simulation clock (accumulates clamped dt, not wall clock)
};

function resetRun() {
  state.pos.set(CFG.startPos.x, CFG.startPos.y, CFG.startPos.z);
  state.vel.set(0, 0, 0);
  state.time = 0;
  input.resetAim();
  chase.snap();
}

// ---- Input & mode transitions ----
const input = createInput(renderer.domElement, {
  onFire() {
    if (state.mode !== 'playing') return;
    blast(state, input.aim.dir);
    craft.setFlash();
  },
  onRestart() {
    if (state.mode === 'playing' || state.mode === 'crashed') {
      resetRun();
      state.mode = 'playing';
      hideOverlays();
    }
  },
  onLockChange(locked) {
    if (locked) {
      if (state.mode === 'ready') { resetRun(); state.mode = 'playing'; hideOverlays(); }
      else if (state.mode === 'paused') { state.mode = 'playing'; hideOverlays(); }
      else if (state.mode === 'crashed') { resetRun(); state.mode = 'playing'; hideOverlays(); }
    } else {
      if (state.mode === 'playing') { state.mode = 'paused'; showPause(); }
    }
  },
  onHidden() {
    if (state.mode === 'playing') { state.mode = 'paused'; showPause(); }
  },
  onInvertChange(inverted) {
    document.getElementById('invhint').textContent =
      'I = invert mouse' + (inverted ? ' (ON)' : ' (OFF)');
  },
});

document.getElementById('banner').addEventListener('pointerdown', () => {
  if (state.mode === 'crashed' && document.pointerLockElement) {
    resetRun(); state.mode = 'playing'; hideOverlays();
  } else {
    input.requestLock();
  }
});
document.getElementById('pause').addEventListener('pointerdown', () => input.requestLock());

// ---- Main loop ----
resetRun();
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > CFG.dtMax) dt = CFG.dtMax;

  if (state.mode === 'playing') {
    state.time += dt;
    step(state, dt);
    const contact = resolveGround(state, dt);
    if (contact === 'crash') {
      state.mode = 'crashed';
      showBanner('crashed');
    }
    updateHud(state);
  }

  craft.object.position.copy(state.pos);
  craft.setAim(input.aim.dir);
  craft.update(dt);
  chase.update(state.pos, input.aim.yaw, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
