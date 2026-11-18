// The follow camera. On foot it floats behind the player and the mouse
// orbits it; in a car it settles behind the car's heading so driving reads
// ahead. Either way it eases toward its spot instead of snapping, and the
// sun's shadow frustum travels with it so shadows stay crisp.

import * as THREE from 'three';
import { S, playerPos } from './state.js';
import { clamp, angleDelta } from './rng.js';
import * as input from './input.js';

const SUN_OFFSET = new THREE.Vector3(-90, 130, -55);
let smoothPos = null;

export function updateCamera(dt) {
  const target = playerPos().clone();
  target.y += 1.4;

  const mouse = input.takeMouseDelta();
  if (S.started && !S.paused) {
    S.cameraYaw -= mouse.x * 0.0031;
    S.cameraPitch = clamp(S.cameraPitch + mouse.y * 0.0024, 0.1, 0.95);
  }

  const inCar = !!S.player.inCar;
  if (inCar && Math.abs(S.player.inCar.speed) > 3) {
    // ease the view behind the car while it is moving
    const want = S.player.inCar.heading;
    S.cameraYaw += angleDelta(S.cameraYaw, want) * Math.min(1, dt * 2.4);
  }

  const dist = inCar ? 10.5 : 7.4;
  const height = Math.sin(S.cameraPitch) * dist;
  const flat = Math.cos(S.cameraPitch) * dist;
  const desired = new THREE.Vector3(
    target.x - Math.sin(S.cameraYaw) * flat,
    target.y + height,
    target.z - Math.cos(S.cameraYaw) * flat,
  );
  if (desired.y < 1.1) desired.y = 1.1;

  if (!smoothPos) smoothPos = desired.clone();
  smoothPos.lerp(desired, 1 - Math.exp(-dt * 7));
  S.camera.position.copy(smoothPos);

  const ahead = new THREE.Vector3(
    target.x + Math.sin(S.cameraYaw) * 5,
    target.y + 0.4,
    target.z + Math.cos(S.cameraYaw) * 5,
  );
  S.camera.lookAt(ahead);

  if (S.sun) {
    S.sun.position.copy(target).add(SUN_OFFSET);
    S.sun.target.position.copy(target);
    S.sun.target.updateMatrixWorld();
  }
}
