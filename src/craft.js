// The craft: the 2D game's lunar lander, extruded to 3D primitives —
// octagonal gold-foil descent stage, gray cabin, engine bell, four A-frame
// legs with footpads, antenna. Local +Y is the nose axis: the blast kicks
// the craft along it. Footpad bottoms sit at local y = -CFG.feetOffset.
import * as THREE from 'three';
import { CFG } from './config.js';

// the 2D game's palette
const GOLD = 0xcaa84a, GOLD_D = 0x8f7328;
const GRAY = 0xaeb6c2, GRAY_D = 0x6b7280;
const METAL = 0x3a3f4a, PAD = 0xcfd6df, WINDOW = 0x1a2c48;

const _up = new THREE.Vector3(0, 1, 0);

// cylinder strut from point a to point b
function strut(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  m.castShadow = true;
  return m;
}

export function createCraft() {
  const group = new THREE.Group();
  const add = (mesh) => { mesh.castShadow = true; group.add(mesh); return mesh; };

  // ---------- descent stage: octagonal gold-foil body ----------
  const goldMat = new THREE.MeshLambertMaterial({ color: GOLD, flatShading: true });
  const body = add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.55, 8), goldMat));
  body.position.y = -0.1;
  // darker foil skirt along the bottom edge — reads as the 2D paneling seam
  const skirt = add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.87, 0.87, 0.14, 8),
    new THREE.MeshLambertMaterial({ color: GOLD_D, flatShading: true }),
  ));
  skirt.position.y = -0.32;

  // ---------- ascent stage: gray crew cabin, tapering up ----------
  const cabin = add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.55, 0.55, 8),
    new THREE.MeshLambertMaterial({ color: GRAY, flatShading: true }),
  ));
  cabin.position.y = 0.45;
  // forward window (decorative — the craft rolls freely about the nose axis)
  const win = add(new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.26, 0.05),
    new THREE.MeshLambertMaterial({ color: WINDOW }),
  ));
  win.position.set(0, 0.5, -0.44);
  win.rotation.x = -0.26;   // lean with the cabin taper

  // ---------- descent-engine bell (open cone under the body) ----------
  const bell = add(new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.45, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: METAL, side: THREE.DoubleSide }),
  ));
  bell.position.y = -0.5;

  // ---------- four A-frame legs with footpads ----------
  const legMat = new THREE.MeshLambertMaterial({ color: GRAY_D });
  const padMat = new THREE.MeshLambertMaterial({ color: PAD });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const dx = sx * Math.SQRT1_2, dz = sz * Math.SQRT1_2;
    const hip = new THREE.Vector3(dx * 0.72, -0.28, dz * 0.72);
    const pad = new THREE.Vector3(dx * 1.06, -0.72, dz * 1.06);
    const knee = new THREE.Vector3(dx * 0.92, -0.54, dz * 0.92);
    group.add(strut(hip, pad, 0.045, legMat));                              // main strut
    group.add(strut(new THREE.Vector3(dx * 0.66, 0.05, dz * 0.66), knee, 0.03, legMat)); // A-frame brace
    const foot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 8), padMat));
    foot.position.set(pad.x, -CFG.feetOffset + 0.04, pad.z);   // pad bottom = feetOffset
  }

  // ---------- antenna / rendezvous radar (leans out like the 2D one) ----------
  group.add(strut(
    new THREE.Vector3(-0.2, 0.7, -0.15), new THREE.Vector3(-0.34, 1.1, -0.25), 0.018, legMat,
  ));
  const dish = add(new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshLambertMaterial({ color: GRAY }),
  ));
  dish.position.set(-0.34, 1.12, -0.25);

  // nose arrow: shows the kick direction (green, like the 2D thrust indicator)
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.55, 8),
    new THREE.MeshBasicMaterial({ color: 0x6bff9e }),
  );
  arrow.position.y = 1.35;
  group.add(arrow);

  // blast flash: expanding fading sphere at the tail, driven by setFlash/update
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb45a, transparent: true, opacity: 0 }),
  );
  flash.position.y = -1.0;
  group.add(flash);

  let flashT = 0;
  const FLASH_DUR = 0.15;

  return {
    object: group,
    // orient local +Y (nose) along the aim direction
    setAim(dir) {
      group.quaternion.setFromUnitVectors(_up, dir);
    },
    setFlash() { flashT = FLASH_DUR; },
    update(dt) {
      if (flashT > 0) {
        flashT = Math.max(0, flashT - dt);
        const f = flashT / FLASH_DUR;
        flash.material.opacity = f * 0.9;
        flash.scale.setScalar(1 + (1 - f) * 2.5);
      } else {
        flash.material.opacity = 0;
      }
    },
  };
}
