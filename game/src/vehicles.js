// Vehicles: one car factory every kind of car comes from (parked, traffic,
// mission and police), plus the arcade driving physics and the collision
// response the player, traffic and police all share.

import * as THREE from 'three';
import { S } from './state.js';
import { clamp, angleDelta } from './rng.js';
import { WORLD_BOUNDS } from './config.js';

const bodyGeo = new THREE.BoxGeometry(2.0, 0.62, 4.3);
const cabinGeo = new THREE.BoxGeometry(1.8, 0.55, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1d2b36 });
const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x776f3a });

// Builds one car's meshes. The Cielo GT sits lower with a spoiler and gold
// paint; a cruiser is white with a lightbar whose two halves flash.
export function makeCarMesh(paint, { cielo = false, police = false } = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: paint });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, cielo ? 0.5 : 0.62, cielo ? 4.5 : 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.05, cielo ? -0.25 : -0.1);
  cabin.scale.y = cielo ? 0.8 : 1;
  group.add(cabin);

  const brakeMat = new THREE.MeshLambertMaterial({ color: 0x7a1610, emissive: 0x2a0503 });
  for (const sx of [-0.72, 0.72]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), lightMat);
    head.position.set(sx, 0.62, 2.16);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), brakeMat);
    tail.position.set(sx, 0.62, -2.16);
    group.add(tail);
  }
  group.userData.brakeMat = brakeMat;

  for (const [wx, wz] of [[-0.95, 1.42], [0.95, 1.42], [-0.95, -1.42], [0.95, -1.42]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }

  if (cielo) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), bodyMat);
    spoiler.position.set(0, 0.98, -2.05);
    group.add(spoiler);
  }

  if (police) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 4.32),
      new THREE.MeshLambertMaterial({ color: 0x22335c }),
    );
    stripe.position.y = 0.42;
    group.add(stripe);
    const barRed = new THREE.MeshLambertMaterial({ color: 0xff2a20, emissive: 0x550000 });
    const barBlue = new THREE.MeshLambertMaterial({ color: 0x2255ff, emissive: 0x000a55 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.5), barRed);
    left.position.set(-0.45, 1.42, -0.1);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.5), barBlue);
    right.position.set(0.45, 1.42, -0.1);
    group.add(left, right);
    group.userData.barRed = barRed;
    group.userData.barBlue = barBlue;
  }
  return group;
}

export function spawnCar(x, z, heading, kind, paint, opts = {}) {
  const group = makeCarMesh(paint, opts);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  S.scene.add(group);
  const car = {
    group,
    kind,
    heading,
    speed: 0,
    radius: 2.25,
    paint,
    cielo: !!opts.cielo,
    missionTag: opts.missionTag || null,
    route: null,
    slotAngle: opts.slotAngle || 0,
    wrecked: false,
  };
  S.cars.push(car);
  if (kind === 'police') S.police.push(car);
  return car;
}

export function removeCar(car) {
  S.scene.remove(car.group);
  S.cars = S.cars.filter((c) => c !== car);
  S.police = S.police.filter((c) => c !== car);
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

// Push a circle (the car or the player) out of every building AABB and back
// inside the world bounds. Returns the speed lost to the hardest hit, so the
// caller can play a crash and charge heat for it.
export function collideCircle(pos, radius) {
  let impact = 0;
  for (const b of S.colliders) {
    const nearX = clamp(pos.x, b.minX, b.maxX);
    const nearZ = clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - nearX;
    const dz = pos.z - nearZ;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nearX + (dx / d) * radius;
      pos.z = nearZ + (dz / d) * radius;
    } else {
      // centre inside the box: leave by the shallowest side
      const pushLeft = pos.x - (b.minX - radius);
      const pushRight = b.maxX + radius - pos.x;
      const pushNear = pos.z - (b.minZ - radius);
      const pushFar = b.maxZ + radius - pos.z;
      const m = Math.min(pushLeft, pushRight, pushNear, pushFar);
      if (m === pushLeft) pos.x = b.minX - radius;
      else if (m === pushRight) pos.x = b.maxX + radius;
      else if (m === pushNear) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
    }
    impact = 1;
  }
  pos.x = clamp(pos.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  pos.z = clamp(pos.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);
  return impact;
}

// Arcade driving for the player's car: throttle -1..1, steer -1..1.
export function driveCar(car, dt, throttle, steer, handbrake) {
  const topSpeed = car.cielo ? 34 : 29;
  const accel = throttle > 0 ? 13 : throttle < 0 ? (car.speed > 0.5 ? 22 : 8) : 0;
  if (throttle !== 0) car.speed += accel * throttle * dt * (car.speed < 0 && throttle > 0 ? 2 : 1);
  const drag = handbrake ? 3.2 : 0.55;
  car.speed -= car.speed * drag * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 3.2 * dt);
  car.speed = clamp(car.speed, -9, topSpeed);
  if (Math.abs(car.speed) > 0.05) {
    const turn = steer * clamp(car.speed / 9, -1.15, 1.15) * 1.55;
    car.heading -= turn * dt * Math.sign(car.speed);
  }
  const f = carForward(car);
  const before = { x: car.group.position.x, z: car.group.position.z };
  car.group.position.x += f.x * car.speed * dt;
  car.group.position.z += f.z * car.speed * dt;
  const hit = collideCircle(car.group.position, car.radius);
  let impact = 0;
  if (hit) {
    const moved = Math.hypot(car.group.position.x - before.x, car.group.position.z - before.z);
    const wanted = Math.abs(car.speed) * dt;
    if (wanted - moved > 0.25 && Math.abs(car.speed) > 5) impact = Math.abs(car.speed);
    car.speed *= 0.35;
  }
  car.group.rotation.y = car.heading;
  return impact;
}

// Soft push-apart between two cars so traffic never overlaps.
export function separateCars(a, b) {
  const dx = b.group.position.x - a.group.position.x;
  const dz = b.group.position.z - a.group.position.z;
  const d = Math.hypot(dx, dz);
  const min = a.radius + b.radius - 0.4;
  if (d > 0.01 && d < min) {
    const push = ((min - d) / 2) * 0.8;
    const nx = dx / d;
    const nz = dz / d;
    a.group.position.x -= nx * push;
    a.group.position.z -= nz * push;
    b.group.position.x += nx * push;
    b.group.position.z += nz * push;
    return true;
  }
  return false;
}

export function steerToward(car, targetX, targetZ, dt, maxTurn) {
  const dx = targetX - car.group.position.x;
  const dz = targetZ - car.group.position.z;
  const want = Math.atan2(dx, dz);
  const delta = angleDelta(car.heading, want);
  car.heading += clamp(delta, -maxTurn * dt, maxTurn * dt);
  return Math.abs(delta);
}
