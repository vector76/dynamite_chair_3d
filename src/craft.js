// Placeholder craft built from primitives (proper 2D-lander-styled model is M4).
// Local +Y is the nose axis: the blast kicks the craft along it.
import * as THREE from 'three';

export function createCraft() {
  const group = new THREE.Group();

  // gold-foil descent stage
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xcaa84a }),
  );
  body.castShadow = true;
  group.add(body);

  // gray cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.55, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xaeb6c2 }),
  );
  cabin.position.y = 0.62;
  cabin.castShadow = true;
  group.add(cabin);

  // engine bell under the body
  const bell = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.5, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x3a3f4a, side: THREE.DoubleSide }),
  );
  bell.position.y = -0.55;
  bell.castShadow = true;
  group.add(bell);

  // four legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x8b93a0 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), legMat);
    leg.castShadow = true;
    leg.position.set(sx * 0.75, -0.35, sz * 0.75);
    leg.rotation.z = -sx * 0.5;
    leg.rotation.x = sz * 0.5;
    group.add(leg);
  }

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

  const _up = new THREE.Vector3(0, 1, 0);

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
