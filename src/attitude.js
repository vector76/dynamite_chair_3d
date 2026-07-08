// Orientation gauge: a top-down attitude disc for the aim direction. The centre
// is straight up; the dot's distance from centre is the angle away from vertical
// (mid ring = horizontal, rim = straight down) and its bearing is the aim's
// heading relative to the camera view. Reads the aim in the heading frame, which
// is already camera-relative (the chase camera follows the heading), so a nose
// pointing forward-down-canyon shows at the top.
const R = 46;   // rim radius in the SVG's viewBox units (straight down)

export function createAttitude() {
  const dot = document.getElementById('att-dot');

  return {
    // localDir: unit nose direction in the heading frame (input.aim.localDir)
    update(localDir) {
      const ang = Math.acos(Math.max(-1, Math.min(1, localDir.y)));   // 0 = up
      const r = (ang / Math.PI) * R;
      const az = Math.atan2(localDir.x, -localDir.z);   // 0 = forward (top)
      dot.setAttribute('cx', (r * Math.sin(az)).toFixed(2));
      dot.setAttribute('cy', (-r * Math.cos(az)).toFixed(2));
    },
  };
}
