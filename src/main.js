// Bootstrap + game loop + mode state machine:
// ready | playing | paused | finished | crashed.
import * as THREE from 'three';
import { CFG } from './config.js';
import { step, blast, resolveGround } from './physics.js';
import { createInput } from './input.js';
import { createCraft } from './craft.js';
import { createChaseCamera } from './camera.js';
import { updateHud, updateCooldown, showBanner, showPause, hideOverlays,
         setLevelBadge, setHardMode, initLevelNav, showLevelNav } from './hud.js';
import { maxLevel, unlock, record as recordScore } from './scores.js';
import { levelParams, makePath } from './level.js';
import { buildTerrain } from './terrain.js';
import { createTrajectoryViz } from './viz.js';
import { createEffects } from './effects.js';
import { createAttitude } from './attitude.js';
import { initAudio, resumeAudio, sfxBoom, sfxCrash, sfxWin, sfxChime, toggleMute, isMuted } from './audio.js';
import { createCoins } from './coins.js';
import { createGate } from './gate.js';

// ---- Renderer & scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
// craft shadow: the strongest altitude cue there is. The shadow camera is a
// small box that follows the craft (see the frame loop), so one 1024 map
// stays sharp wherever you fly.
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 1.0;   // prevents striping (acne) on sloped terrain
scene.add(sun);
scene.add(sun.target);

// ---- Stars ----
// The dome is re-centered on the camera every frame so the stars show zero
// parallax — infinitely far away, as stars should be.
let stars;
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
  stars = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xcfd3ff, size: 1.6, sizeAttenuation: false, fog: false,
  }));
  scene.add(stars);
}

// ---- Craft & camera ----
const craft = createCraft();
scene.add(craft.object);
const chase = createChaseCamera(camera);
const viz = createTrajectoryViz(scene);
const effects = createEffects(scene);
const attitude = createAttitude();

// any click may be the gesture that unlocks audio (browser autoplay policy)
document.addEventListener('pointerdown', () => { initAudio(); resumeAudio(); });

// ---- Level, terrain, coins, gate ----
// Debug URL params: ?level=N picks the level, ?seed=S overrides its seed.
const query = new URLSearchParams(location.search);
const startLevel = Math.max(1, parseInt(query.get('level') || '1', 10) || 1);
const seedOverride = query.has('seed') ? (parseInt(query.get('seed'), 10) >>> 0) : null;

let levelNum, params, path, terrain, coins, gate;

// (Re)build everything derived from the level number, disposing the previous
// level's GPU resources — advancing levels needs no page reload.
function loadLevel(n) {
  levelNum = n;
  setLevelBadge(n);
  // the ?seed= override pins the URL-requested level only; levels reached by
  // progression use their own fixed seed
  params = levelParams(n, n === startLevel ? seedOverride : null);
  path = makePath(params);
  if (terrain) {
    scene.remove(terrain.mesh);
    terrain.mesh.geometry.dispose();
    terrain.mesh.material.map.dispose();
    terrain.mesh.material.dispose();
  }
  terrain = buildTerrain(params, path);
  scene.add(terrain.mesh);
  chase.setGround(terrain.heightAt);
  if (coins) { scene.remove(coins.group); coins.dispose(); }
  coins = createCoins(params, path, terrain.heightAt);
  scene.add(coins.group);
  if (gate) { scene.remove(gate.group); gate.dispose(); }
  gate = createGate(params, path, terrain.heightAt);
  scene.add(gate.group);
  // keep ?level= current so a reload or shared link lands on this level
  const url = new URL(location);
  url.searchParams.set('level', n);
  if (n !== startLevel) url.searchParams.delete('seed');
  history.replaceState(null, '', url);
}

// long aim line: kick direction stays readable from the raised, distant camera
const aimLine = (() => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: 0x6bff9e, transparent: true, opacity: 0.75,
  }));
  line.frustumCulled = false;
  scene.add(line);
  return line;
})();
function updateAimLine() {
  const a = aimLine.geometry.attributes.position.array;
  a[0] = state.pos.x + noseDir.x * 1.6;
  a[1] = state.pos.y + noseDir.y * 1.6;
  a[2] = state.pos.z + noseDir.z * 1.6;
  a[3] = state.pos.x + noseDir.x * (1.6 + CFG.aimLineLength);
  a[4] = state.pos.y + noseDir.y * (1.6 + CFG.aimLineLength);
  a[5] = state.pos.z + noseDir.z * (1.6 + CFG.aimLineLength);
  aimLine.geometry.attributes.position.needsUpdate = true;
}

// ---- Game state ----
const state = {
  mode: 'ready',
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  time: 0,      // simulation clock (accumulates clamped dt, not wall clock)
  heading: 0,   // frame for aim + camera; follows horizontal travel direction
  cooldown: 0,  // s until the next blast is available (ticks on the sim clock)
};

// world nose direction = aim.localDir rotated about Y by heading
const noseDir = new THREE.Vector3();
function updateNoseDir() {
  const l = input.aim.localDir, c = Math.cos(state.heading), s = Math.sin(state.heading);
  noseDir.set(l.x * c - l.z * s, l.y, l.x * s + l.z * c);
}

// swing heading toward the horizontal travel direction (shortest arc, damped);
// below a minimum horizontal speed the heading just holds (e.g. hovering)
function updateHeading(dt) {
  const hSpeed = Math.hypot(state.vel.x, state.vel.z);
  if (hSpeed < CFG.headingMinSpeed) return;
  const target = Math.atan2(state.vel.x, -state.vel.z);
  let d = (target - state.heading) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  state.heading += d * (1 - Math.exp(-CFG.headingDamping * dt));
}

function resetRun() {
  const spawnT = 15;   // a little way in from the canyon mouth
  const p = path.pointAt(spawnT);
  const d = path.dirAt(spawnT);
  state.pos.set(p.x, terrain.heightAt(p.x, p.z) + CFG.spawnAltitude, p.z);
  state.vel.set(d.x * CFG.startSpeed, 0, d.z * CFG.startSpeed);
  state.time = 0;
  state.cooldown = 0;
  state.heading = Math.atan2(d.x, -d.z);
  coins.reset();
  input.resetAim();
  chase.snap();
}

// ---- Run & banner transitions ----
function fireBlast() {
  if (state.cooldown > 0) return;
  updateNoseDir();
  blast(state, noseDir);
  state.cooldown = CFG.blastCooldown;
  craft.setFlash();
  effects.spawnBlast(state.pos, noseDir, state.vel);
  resumeAudio();   // keyboard fire / tab refocus may find the context suspended
  sfxBoom(0.8);
}

function startRun() {
  resetRun();
  state.mode = 'playing';
  hideOverlays();
}

function nextLevel() {
  loadLevel(levelNum + 1);
  startRun();
}

// Browse to a level from an overlay (level nav arrows). Bounded to unlocked
// levels; drops you at that level's ready banner to launch when you're set.
function goToLevel(n) {
  n = Math.max(1, Math.min(maxLevel(), n));
  loadLevel(n);
  resetRun();
  state.mode = 'ready';
  showBanner('ready', { level: n });
  showLevelNav(n, maxLevel());
}

// short grace after a banner appears, so a blast-click queued at the moment
// the run ended doesn't instantly dismiss it
let bannerAt = 0;
const bannerReady = () => performance.now() - bannerAt > 600;

function endRun(result) {   // 'finished' | 'crashed'
  state.mode = result;
  bannerAt = performance.now();
  if (result === 'crashed') {
    effects.spawnCrash(state.pos); sfxCrash();
    showBanner('crashed', { level: levelNum });
  } else {
    sfxWin();
    unlock(levelNum + 1);   // clearing a level opens the next for browsing
    const score = recordScore(levelNum, { coins: coins.collected, time: state.time });
    showBanner('finished', {
      level: levelNum, coins: coins.collected, total: coins.total, time: state.time, score,
    });
  }
  showLevelNav(levelNum, maxLevel());
}

// ---- Input & mode transitions ----
const input = createInput(renderer.domElement, {
  onFire() {
    // After a crash/finish the pointer is still locked, so the "click to
    // continue" click lands here (on the canvas), not on the banner overlay.
    if (state.mode === 'playing') fireBlast();
    else if (state.mode === 'crashed' && bannerReady()) startRun();
    else if (state.mode === 'finished' && bannerReady()) nextLevel();
  },
  onRestart() {
    if (state.mode === 'playing' || state.mode === 'crashed' || state.mode === 'finished') {
      startRun();
    }
  },
  onLockChange(locked) {
    if (locked) {
      if (state.mode === 'ready') startRun();
      else if (state.mode === 'paused') { state.mode = 'playing'; hideOverlays(); }
      else if (state.mode === 'crashed') startRun();
      else if (state.mode === 'finished') nextLevel();
    } else {
      if (state.mode === 'playing') { state.mode = 'paused'; showPause(); showLevelNav(levelNum, maxLevel()); }
    }
  },
  onHidden() {
    if (state.mode === 'playing') { state.mode = 'paused'; showPause(); showLevelNav(levelNum, maxLevel()); }
  },
  onInvertChange(inverted) {
    document.getElementById('invhint').textContent =
      'I = invert mouse' + (inverted ? ' (ON)' : ' (OFF)');
  },
  onToggleViz() { updateVizHint(viz.toggle()); },
  onToggleMute() { updateMuteHint(toggleMute()); },
  onZoom(deltaY) { chase.zoomBy(deltaY); },
});

function updateVizHint(on) {
  document.getElementById('vizhint').textContent = 'V = trajectory' + (on ? ' (ON)' : ' (OFF)');
  setHardMode(!on);   // trajectory off = hard mode, flagged on the HUD
}
function updateMuteHint(muted) {
  document.getElementById('mutehint').textContent = 'M = mute' + (muted ? ' (MUTED)' : '');
}
// reflect persisted toggles in the UI, like input.js does for invert
if (!viz.isOn()) updateVizHint(false);
if (isMuted()) updateMuteHint(true);

// level browser (prev / next) on the overlays — lets you drop back to any
// level you've reached and replay it
initLevelNav({
  onPrev: () => goToLevel(levelNum - 1),
  onNext: () => goToLevel(levelNum + 1),
});

document.getElementById('banner').addEventListener('pointerdown', () => {
  if (document.pointerLockElement) {
    if (state.mode === 'crashed' && bannerReady()) startRun();
    else if (state.mode === 'finished' && bannerReady()) nextLevel();
  } else {
    input.requestLock();
  }
});
document.getElementById('pause').addEventListener('pointerdown', () => input.requestLock());

// Console handle for debugging/verification (ARCHITECTURE.md: keep the game
// exercisable from the console — pointer lock isn't grantable to scripts, and
// tick() lets a script drive frames even where requestAnimationFrame is
// throttled, e.g. a hidden tab).
window.dc3d = {
  state, input, loadLevel, goToLevel, scene,
  start: startRun,
  fire: () => { if (state.mode === 'playing') fireBlast(); },
  tick: (dt) => tick(Math.min(dt, CFG.dtMax)),
  get level() { return { params, path, terrain, coins, gate }; },
};

// ---- Main loop ----
loadLevel(startLevel);
unlock(startLevel);   // a ?level= deep link is reachable from the browser
resetRun();
showLevelNav(startLevel, maxLevel());   // the intro banner is up at boot
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > CFG.dtMax) dt = CFG.dtMax;
  tick(dt);
  requestAnimationFrame(frame);
}

function tick(dt) {
  if (state.mode === 'playing') {
    state.time += dt;
    state.cooldown = Math.max(0, state.cooldown - dt);
    const prevX = state.pos.x, prevZ = state.pos.z;
    step(state, dt);
    updateHeading(dt);
    if (coins.collect(state.pos)) sfxChime();
    if (gate.crossed(prevX, prevZ, state.pos)) {
      endRun('finished');
    } else if (resolveGround(state, terrain.heightAt) === 'crash') {
      endRun('crashed');
    }
    updateHud(state, terrain.heightAt, coins);
  }
  updateCooldown(state.cooldown / CFG.blastCooldown);

  updateNoseDir();
  attitude.update(input.aim.localDir);
  craft.object.position.copy(state.pos);
  craft.setAim(noseDir);
  craft.update(dt);
  coins.update(dt);
  updateAimLine();
  viz.update(state, noseDir, terrain.heightAt);
  effects.update(dt);
  chase.update(state.pos, state.heading, dt);
  stars.position.copy(camera.position);   // zero parallax: stars at infinity
  // keep the sun's shadow box centered on the craft (fixed light direction)
  sun.position.set(state.pos.x + 50, state.pos.y + 80, state.pos.z + 20);
  sun.target.position.copy(state.pos);

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
