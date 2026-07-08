// DOM HUD + banners, in the 2D game's style.
import { CFG } from './config.js';
import { speed } from './physics.js';

const hud = document.getElementById('hud');
const banner = document.getElementById('banner');
const pause = document.getElementById('pause');

const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);

export function updateHud(s, heightAt) {
  const spd = speed(s);
  const spdCls = spd <= CFG.safeSpeed ? 'ok' : 'warn';
  const alt = s.pos.y - CFG.feetOffset - heightAt(s.pos.x, s.pos.z);
  hud.innerHTML =
    '<div><span class="k">TIME</span> <span class="v">' + fmt(s.time) + '</span> <span class="k">s</span></div>' +
    '<div><span class="k">SPEED</span> <span class="' + spdCls + '">' + fmt(spd) + '</span> <span class="k">m/s (safe contact &le; ' + fmt(CFG.safeSpeed) + ')</span></div>' +
    '<div><span class="k">DESCENT</span> <span class="v">' + fmt(-s.vel.y) + '</span> <span class="k">ALT</span> <span class="v">' + fmt(alt) + '</span> <span class="k">m</span></div>';
}

export function showBanner(mode) {
  pause.classList.add('hidden');
  banner.classList.remove('hidden');
  if (mode === 'crashed') {
    banner.innerHTML =
      '<h2 class="lose">💀 KABOOM 💀</h2>' +
      '<p>You hit the ground too fast.</p>' +
      '<p style="margin-top:12px;"><span class="key">Click to try again</span></p>';
  }
  // 'ready' keeps the intro banner markup from index.html
}

export function showPause() {
  banner.classList.add('hidden');
  pause.classList.remove('hidden');
}

export function hideOverlays() {
  banner.classList.add('hidden');
  pause.classList.add('hidden');
}
