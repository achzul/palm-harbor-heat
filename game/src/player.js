// Nico Vega: the character on foot, walking and sprinting around Palm Harbor,
// getting into cars (his own or, with consequences, other people's), and the
// arcade driving of whichever car he is in.

import * as THREE from 'three';
import { S, playerPos } from './state.js';
import { clamp } from './rng.js';
import * as input from './input.js';
import { driveCar, collideCircle } from './vehicles.js';
import { reportCrime } from './wanted.js';
import { playCrash } from './audio.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f7a8c });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3138 });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), pants);
  legL.position.set(-0.16, 0.39, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.14;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.72;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0xd94f3d }));
  cap.position.y = 1.88;
  group.add(legL, legR, torso, head, cap);
  group.userData = { legL, legR };
  return group;
}

export function spawnPlayer(x, z, heading) {
  S.player.group = makePlayerMesh();
  S.player.group.position.set(x, 0, z);
  S.player.heading = heading;
  S.scene.add(S.player.group);
}

function nearestCarToPlayer(maxDist) {
  const p = S.player.group.position;
  let best = null;
  let bestD = maxDist;
  for (const car of S.cars) {
    if (car.kind !== 'parked' && car.kind !== 'driven') continue;
    const d = Math.hypot(car.group.position.x - p.x, car.group.position.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(car) {
  S.player.inCar = car;
  S.player.group.visible = false;
  if (car.kind === 'parked') {
    // taking a car that is not yours: the city notices. Sol's delivery sedan
    // is a loaner, so it is the one parked car that raises no heat.
    if (car.missionTag !== 'delivery') {
      reportCrime('steal', car.group.position.x, car.group.position.z);
    }
    car.kind = 'driven';
  }
}

function exitCar() {
  const car = S.player.inCar;
  if (!car) return;
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  S.player.group.position.set(
    car.group.position.x + side.x * 2.6,
    0,
    car.group.position.z + side.z * 2.6,
  );
  collideCircle(S.player.group.position, S.player.radius);
  S.player.group.visible = true;
  S.player.inCar = null;
  car.speed = 0;
}

export function updatePlayer(dt) {
  const P = S.player;
  if (P.inCar) {
    const car = P.inCar;
    const axes = input.moveAxes();
    const throttle = axes.z;
    const steer = axes.x;
    const impact = driveCar(car, dt, throttle, steer, input.isDown('Space'));
    if (impact > 0) {
      playCrash(impact / 10);
      if (impact > 12) {
        reportCrime('crash', car.group.position.x, car.group.position.z);
        P.health -= impact * 0.22;
      }
    }
    P.speed = Math.abs(car.speed);
    S.prompt = 'E — exit car';
    if (input.wasPressed('KeyE')) exitCar();
    return;
  }

  // on foot: WASD moves relative to the camera, the mouse turns the camera
  const axes = input.moveAxes();
  const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = sprint ? 9.2 : 5.6;
  let mx = 0;
  let mz = 0;
  if (axes.x !== 0 || axes.z !== 0) {
    const sin = Math.sin(S.cameraYaw);
    const cos = Math.cos(S.cameraYaw);
    // forward is the camera's look direction; right is forward cross up
    mx = sin * axes.z - cos * axes.x;
    mz = cos * axes.z + sin * axes.x;
    const len = Math.hypot(mx, mz) || 1;
    mx = (mx / len) * speed;
    mz = (mz / len) * speed;
    P.heading = Math.atan2(mx, mz);
    P.speed = speed;
    P.walkPhase += dt * (sprint ? 13 : 10);
  } else {
    P.speed = 0;
  }
  P.group.position.x += mx * dt;
  P.group.position.z += mz * dt;
  collideCircle(P.group.position, P.radius);
  P.group.rotation.y = P.heading;

  const { legL, legR } = P.group.userData;
  const swing = P.speed > 0 ? Math.sin(P.walkPhase) * 0.55 : 0;
  legL.rotation.x = swing;
  legR.rotation.x = -swing;

  // getting into a car
  const near = nearestCarToPlayer(3.4);
  if (near) {
    S.prompt = near.missionTag === 'cielo' ? 'E — steal the Cielo GT' : 'E — enter car';
    if (input.wasPressed('KeyE')) enterCar(near);
  }
}

export function respawnAt(x, z) {
  const P = S.player;
  if (P.inCar) {
    P.inCar.speed = 0;
    P.inCar = null;
  }
  P.group.visible = true;
  P.group.position.set(x, 0, z);
  P.health = 100;
  S.wanted.heat = 0;
  S.wanted.stars = 0;
  S.wanted.bustedMeter = 0;
}

export function playerSpeed() {
  return S.player.speed;
}

export { playerPos };
