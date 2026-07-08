// Finish gate: a marked frame spanning the canyon at the path's end.
// Crossing its plane inside the frame ends the run and stops the clock.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createGate(params, path, heightAt) {
  const t = path.length - 10;             // just shy of the end, well inside terrain
  const p = path.pointAt(t);
  const d = path.dirAt(t);
  const hw = params.halfWidth;
  const floorY = heightAt(p.x, p.z);
  const H = CFG.gateHeight;

  const group = new THREE.Group();
  group.position.set(p.x, floorY, p.z);
  group.rotation.y = Math.atan2(d.x, d.z);   // local +Z -> path direction

  // two pillars, sunk into the floor so slope under a foot never shows a gap
  const pillarGeo = new THREE.BoxGeometry(1.6, H + 8, 1.6);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x3f4552 });
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(sx * hw, (H - 8) / 2, 0);
    pillar.castShadow = true;
    group.add(pillar);
  }
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2 + 1.6, 1.6, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x6bff9e }),
  );
  bar.position.y = H + 0.8;
  group.add(bar);
  // translucent sheet: makes the opening readable from far down the canyon
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(hw * 2, H),
    new THREE.MeshBasicMaterial({
      color: 0x6bff9e, transparent: true, opacity: 0.14,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  sheet.position.y = H / 2;
  group.add(sheet);

  // Did the craft cross the gate plane this frame, inside the frame?
  // (prevX, prevZ) is the position before this frame's move.
  function crossed(prevX, prevZ, pos) {
    const before = (prevX - p.x) * d.x + (prevZ - p.z) * d.z;
    const after = (pos.x - p.x) * d.x + (pos.z - p.z) * d.z;
    if (before >= 0 || after < 0) return false;
    const lateral = (pos.x - p.x) * d.z - (pos.z - p.z) * d.x;
    return Math.abs(lateral) <= hw + 1 && pos.y <= floorY + H + 1;
  }

  function dispose() {
    pillarGeo.dispose();
    pillarMat.dispose();
    bar.geometry.dispose();
    bar.material.dispose();
    sheet.geometry.dispose();
    sheet.material.dispose();
  }

  return { group, crossed, dispose };
}
