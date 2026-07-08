// Per-level personal-best "frontier" + how far the player has unlocked.
// A run is scored on two axes we can't collapse into one number: coins
// collected (more is better) and time (less is better). So instead of a single
// best, we keep the Pareto frontier — every run not beaten on *both* axes by
// some other run. Persisted in localStorage; identical seeds make times
// comparable across sessions (see level.js).
const KEY = 'dc3d.scores.v1';

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') {
      return { maxLevel: d.maxLevel || 1, levels: d.levels || {} };
    }
  } catch (e) { /* corrupt or absent — start fresh */ }
  return { maxLevel: 1, levels: {} };
}

let data = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode, quota */ }
}

// Highest level the player may jump to (finishing level N unlocks N+1).
export function maxLevel() { return data.maxLevel; }

export function unlock(level) {
  if (level > data.maxLevel) { data.maxLevel = level; persist(); }
}

// A defensive copy of the stored frontier for `level` (each {coins, time}).
export function frontier(level) {
  return (data.levels[level] || []).map((p) => ({ coins: p.coins, time: p.time }));
}

// a "beats" b: at least as good on both axes and strictly better on one.
function dominates(a, b) {
  return a.coins >= b.coins && a.time <= b.time &&
    (a.coins > b.coins || a.time < b.time);
}

// Fold a finished run into `level`'s frontier. Returns the frontier as it was
// *before* this run (`prev`), the frontier after (`frontier`), and whether the
// run earned a spot on it (`record`).
export function record(level, run) {
  run = { coins: run.coins, time: run.time };
  const prev = frontier(level);

  const isRecord =
    !prev.some((p) => dominates(p, run)) &&
    !prev.some((p) => p.coins === run.coins && p.time === run.time);

  // Rebuild: keep every point not dominated by another, then drop exact dupes.
  const all = prev.concat([run]);
  const kept = all.filter((p, i) => !all.some((q, j) => j !== i && dominates(q, p)));
  const front = [];
  for (const p of kept) {
    if (!front.some((q) => q.coins === p.coins && q.time === p.time)) front.push(p);
  }
  front.sort((a, b) => a.time - b.time);

  data.levels[level] = front;
  persist();
  return { record: isRecord, frontier: front, prev };
}
