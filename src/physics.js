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

// Terrain contact for the timed race: there's no landing, so any contact with
// the ground (or a canyon wall) ends the run. Returns 'none' | 'crash'.
export function resolveGround(s, heightAt) {
  const groundY = heightAt(s.pos.x, s.pos.z);
  return s.pos.y - CFG.feetOffset > groundY ? 'none' : 'crash';
}
