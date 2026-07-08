// DOM HUD + banners, in the 2D game's style.
import { CFG } from './config.js';
import { speed } from './physics.js';

const hud = document.getElementById('hud');
const banner = document.getElementById('banner');
const pause = document.getElementById('pause');
const cooldownFill = document.querySelector('#cooldown .fill');
const levelBadge = document.getElementById('levelbadge');
const hardmode = document.getElementById('hardmode');
const levelnav = document.getElementById('levelnav');
const levelPrev = document.getElementById('levelprev');
const levelNext = document.getElementById('levelnext');
const levelCur = levelnav.querySelector('.cur');

const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);

// Always-on "LEVEL N" readout, top-left.
export function setLevelBadge(n) {
  levelBadge.innerHTML = '<span class="k">LEVEL</span> ' + n;
}

// Flag shown when the trajectory assist is off — you're flying blind.
export function setHardMode(on) {
  hardmode.classList.toggle('hidden', !on);
}

// Level browser (prev / next), shown only while an overlay is up. Buttons stop
// propagation so a browse click isn't also read as "continue" on the banner.
export function initLevelNav({ onPrev, onNext }) {
  levelPrev.addEventListener('pointerdown', (e) => { e.stopPropagation(); onPrev(); });
  levelNext.addEventListener('pointerdown', (e) => { e.stopPropagation(); onNext(); });
}
export function showLevelNav(cur, max) {
  levelCur.textContent = 'LEVEL ' + cur;
  levelPrev.disabled = cur <= 1;
  levelNext.disabled = cur >= max;   // can't skip past the furthest level reached
  levelnav.classList.remove('hidden');
}
export function hideLevelNav() {
  levelnav.classList.add('hidden');
}

export function updateHud(s, heightAt, coins) {
  const spd = speed(s);
  const alt = s.pos.y - CFG.feetOffset - heightAt(s.pos.x, s.pos.z);
  hud.innerHTML =
    '<div><span class="k">TIME</span> <span class="v">' + fmt(s.time) + '</span> <span class="k">s</span> <span class="k">COINS</span> <span class="v">' + coins.collected + ' / ' + coins.total + '</span></div>' +
    '<div><span class="k">SPEED</span> <span class="v">' + fmt(spd) + '</span> <span class="k">m/s</span></div>' +
    '<div><span class="k">DESCENT</span> <span class="v">' + fmt(-s.vel.y) + '</span> <span class="k">ALT</span> <span class="v">' + fmt(alt) + '</span> <span class="k">m</span></div>';
}

// frac: 1 = just blasted (bar spans the screen), 0 = ready (bar gone)
export function updateCooldown(frac) {
  cooldownFill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac)) + ')';
}

// Scatter of a level's personal-best frontier (x = time, faster is left;
// y = coins, more is higher), with the just-finished run highlighted in gold.
// `prev` is the frontier before this run, `front` after; drawing both shows
// what the run pushed past.
function frontierPlotSVG(prev, run, front, total) {
  const W = 300, H = 168, ml = 34, mr = 12, mt = 10, mb = 26;
  const iw = W - ml - mr, ih = H - mt - mb;
  let tMax = 1;
  for (const p of front.concat(prev, [run])) tMax = Math.max(tMax, p.time);
  tMax *= 1.1;
  const cMax = Math.max(1, total);
  const X = (t) => (ml + (t / tMax) * iw).toFixed(1);
  const Y = (c) => (mt + ih - (c / cMax) * ih).toFixed(1);

  // Staircase, not a diagonal: coins are discrete, so between two frontier
  // points we hold the lower coin count until the next point's (better) time,
  // then step up. The flat tread at each level runs from that coin count's best
  // time rightward; its left edge is the "best time for N coins".
  const stairs = (arr, cls) => {
    if (arr.length < 2) return '';
    const s = arr.slice().sort((a, b) => a.time - b.time);
    let d = 'M' + X(s[0].time) + ' ' + Y(s[0].coins);
    for (let i = 1; i < s.length; i++) {
      d += ' L' + X(s[i].time) + ' ' + Y(s[i - 1].coins) +   // hold coins, advance in time
           ' L' + X(s[i].time) + ' ' + Y(s[i].coins);        // step up to more coins
    }
    return '<path class="' + cls + '" d="' + d + '"/>';
  };
  const dots = (arr, cls) =>
    arr.map((p) => '<circle class="' + cls + '" cx="' + X(p.time) + '" cy="' + Y(p.coins) + '" r="3"/>').join('');

  return '<svg class="fplot" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
    // axes
    '<line class="axis" x1="' + ml + '" y1="' + mt + '" x2="' + ml + '" y2="' + (mt + ih) + '"/>' +
    '<line class="axis" x1="' + ml + '" y1="' + (mt + ih) + '" x2="' + (ml + iw) + '" y2="' + (mt + ih) + '"/>' +
    '<text class="lbl" x="' + ml + '" y="' + (mt - 2) + '">COINS</text>' +
    '<text class="lbl" x="' + (ml + iw) + '" y="' + (mt + ih + 16) + '" text-anchor="end">TIME (s) &#8594;</text>' +
    '<text class="lbl" x="' + (ml - 4) + '" y="' + (mt + 4) + '" text-anchor="end">' + cMax + '</text>' +
    '<text class="lbl" x="' + (ml + iw) + '" y="' + (mt + ih - 3) + '" text-anchor="end">' + fmt(tMax) + '</text>' +
    // previous frontier (faint), new frontier (bright), then the run on top
    stairs(prev, 'prevline') + dots(prev, 'prevdot') +
    stairs(front, 'frontline') + dots(front, 'frontdot') +
    '<circle class="runring" cx="' + X(run.time) + '" cy="' + Y(run.coins) + '" r="6"/>' +
    '<circle class="run" cx="' + X(run.time) + '" cy="' + Y(run.coins) + '" r="3.5"/>' +
    '</svg>';
}

export function showBanner(mode, stats) {
  pause.classList.add('hidden');
  banner.classList.remove('hidden');
  if (mode === 'crashed') {
    banner.innerHTML =
      '<h2 class="lose">💀 KABOOM 💀</h2>' +
      '<p>You hit the ground.</p>' +
      '<p style="margin-top:12px;"><span class="key">Click to try again</span></p>';
  } else if (mode === 'finished') {
    const s = stats.score;
    const run = { coins: stats.coins, time: stats.time };
    banner.innerHTML =
      '<h2 class="win">🏁 LEVEL ' + stats.level + ' COMPLETE 🏁</h2>' +
      '<p class="stats">COINS <b>' + stats.coins + ' / ' + stats.total + '</b> &middot; TIME <b>' + fmt(stats.time) + ' s</b></p>' +
      (s.record ? '<p class="rec">★ NEW PERSONAL BEST ★</p>' : '<p class="norec">personal best frontier</p>') +
      frontierPlotSVG(s.prev, run, s.frontier, stats.total) +
      '<p style="margin-top:10px;"><span class="key">Click for level ' + (stats.level + 1) + '</span> &middot; R = retry this level</p>';
  } else if (mode === 'ready') {
    banner.innerHTML =
      '<h2 class="win">LEVEL ' + stats.level + '</h2>' +
      '<p>Race the canyon, sweep up coins, reach the gate.</p>' +
      '<p style="margin-top:14px;"><span class="key">Click to launch</span></p>';
  }
}

export function showPause() {
  banner.classList.add('hidden');
  pause.classList.remove('hidden');
}

export function hideOverlays() {
  banner.classList.add('hidden');
  pause.classList.add('hidden');
  hideLevelNav();
}
