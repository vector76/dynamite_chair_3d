// Ballistic physics: gravity integration + impulse kicks + ground contact.
// Pure functions of (state, dt) — no scene-graph or DOM dependencies, so the
// trajectory-prediction assist can run the same integrator forward.
import { CFG } from './config.js';

// Semi-implicit Euler. dt is already clamped by the caller.
export function step(s, dt) {
  s.vel.y -= CFG.gravity * dt;
  s.pos.x += s.vel.x * dt;
  s.pos.y += s.vel.y * dt;
  s.pos.z += s.vel.z * dt;
}

// The kick: one identical impulse along the nose direction. Unlimited charges,
// no cooldown — debounced per press by the input layer.
export function blast(s, noseDir) {
  s.vel.x += noseDir.x * CFG.impulse;
  s.vel.y += noseDir.y * CFG.impulse;
  s.vel.z += noseDir.z * CFG.impulse;
}

export function speed(s) {
  return Math.hypot(s.vel.x, s.vel.y, s.vel.z);
}

// Terrain contact. heightAt(x, z) gives the ground height; (prevX, prevZ) is
// the position before this frame's move, for backing out of walls.
// Returns 'none' | 'rest' | 'crash'. Slow contact is survivable: the craft
// scrapes the floor and can blast back up — a legitimate recovery.
export function resolveGround(s, dt, heightAt, prevX, prevZ) {
  const groundY = heightAt(s.pos.x, s.pos.z);
  const feetY = s.pos.y - CFG.feetOffset;
  if (feetY > groundY) return 'none';
  const contactSpeed = speed(s);
  if (contactSpeed > CFG.safeSpeed) return 'crash';

  const penetration = groundY - feetY;
  if (penetration > CFG.wallThreshold) {
    // deep overlap = flew sideways into a wall, not settled onto ground:
    // back out horizontally and stop the horizontal motion (a slow thud)
    s.pos.x = prevX;
    s.pos.z = prevZ;
    s.vel.x = 0;
    s.vel.z = 0;
    return 'rest';
  }

  s.pos.y = groundY + CFG.feetOffset;
  if (s.vel.y < 0) s.vel.y = 0;
  const f = Math.exp(-CFG.groundFriction * dt);
  s.vel.x *= f;
  s.vel.z *= f;
  return 'rest';
}
