// The pistol and the Sandy Range. On foot, the player fires toward the
// camera's aim: a ray into the world that knocks down pedestrians (and
// brings heat), sparks off cars, and rings the range's bullseyes for $15 a
// hit. Tracers and spark bursts are short-lived effects, updated here.

import * as THREE from 'three';
import { S, addCash } from './state.js';
import * as input from './input.js';
import { RANGE_HIT_PAY } from './config.js';
import { reportCrime } from './wanted.js';
import { knockDownPed, scarePeds } from './peds.js';
import { playGunshot, playPickup } from './audio.js';
import { writeSave } from './save.js';
import { showToast } from './hud.js';

let cooldown = 0;
const raycaster = new THREE.Raycaster();
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));

// distance from a point to the aim ray, and how far along it the point sits
function rayPointDistance(origin, dir, point) {
  const rx = point.x - origin.x;
  const ry = point.y - origin.y;
  const rz = point.z - origin.z;
  const along = rx * dir.x + ry * dir.y + rz * dir.z;
  if (along < 0) return { along, dist: Infinity };
  const cx = origin.x + dir.x * along - point.x;
  const cy = origin.y + dir.y * along - point.y;
  const cz = origin.z + dir.z * along - point.z;
  return { along, dist: Math.hypot(cx, cy, cz) };
}

function addTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95 }));
  S.scene.add(line);
  S.effects.push({ obj: line, until: S.time + 0.07, kind: 'tracer' });
}

function addSparks(at) {
  const count = 7;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = at.x;
    positions[i * 3 + 1] = at.y;
    positions[i * 3 + 2] = at.z;
    velocities.push({
      x: (Math.random() - 0.5) * 3.4,
      y: Math.random() * 3.2,
      z: (Math.random() - 0.5) * 3.4,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffc21f, size: 0.16 }));
  S.scene.add(points);
  S.effects.push({ obj: points, until: S.time + 0.34, kind: 'sparks', velocities });
}

function shoot() {
  const P = S.player;
  const origin = S.camera.position.clone();
  const dir = new THREE.Vector3();
  S.camera.getWorldDirection(dir);
  raycaster.set(origin, dir);
  raycaster.far = 130;

  const muzzle = P.group.position.clone().add(new THREE.Vector3(0, 1.45, 0));
  let hitPoint = origin.clone().add(dir.clone().multiplyScalar(70));
  let bestAlong = 70;
  let hitWhat = null;

  for (const ped of S.peds) {
    if (S.time < ped.downUntil) continue;
    const c = ped.group.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    const r = rayPointDistance(origin, dir, c);
    if (r.dist < 0.85 && r.along < bestAlong) {
      bestAlong = r.along;
      hitPoint = c;
      hitWhat = { kind: 'ped', ped };
    }
  }
  for (const car of S.cars) {
    if (car === P.inCar) continue;
    const c = car.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    const r = rayPointDistance(origin, dir, c);
    if (r.dist < 2.1 && r.along < bestAlong) {
      bestAlong = r.along;
      hitPoint = c;
      hitWhat = { kind: 'car', car };
    }
  }
  for (const target of S.rangeTargets) {
    if (!target.alive) continue;
    const c = new THREE.Vector3(target.x, 1.9, target.z);
    const r = rayPointDistance(origin, dir, c);
    if (r.dist < 0.95 && r.along < bestAlong) {
      bestAlong = r.along;
      hitPoint = c;
      hitWhat = { kind: 'range', target };
    }
  }

  addTracer(muzzle, hitPoint);
  addSparks(hitPoint);
  playGunshot();
  reportCrime('gunshot', P.group.position.x, P.group.position.z);
  scarePeds(P.group.position.x, P.group.position.z, 24);

  if (!hitWhat) return;
  if (hitWhat.kind === 'ped') {
    knockDownPed(hitWhat.ped);
    reportCrime('hitPed', hitWhat.ped.group.position.x, hitWhat.ped.group.position.z);
  } else if (hitWhat.kind === 'car') {
    reportCrime(hitWhat.car.kind === 'police' ? 'hitPolice' : 'hitCar', hitWhat.car.group.position.x, hitWhat.car.group.position.z);
  } else if (hitWhat.kind === 'range') {
    const target = hitWhat.target;
    target.alive = false;
    target.respawnAt = S.time + 2.5;
    target.group.visible = false;
    addCash(RANGE_HIT_PAY);
    playPickup();
    showToast(`Bullseye +$${RANGE_HIT_PAY}`);
    writeSave();
  }
}

export function updateCombat(dt) {
  cooldown -= dt;
  if (!S.player.inCar && input.isFiring() && cooldown <= 0 && S.started && !S.paused) {
    shoot();
    cooldown = 0.22;
  }
  for (const target of S.rangeTargets) {
    if (!target.alive && S.time >= target.respawnAt) {
      target.alive = true;
      target.group.visible = true;
    }
  }
  // effects fade and die
  for (let i = S.effects.length - 1; i >= 0; i--) {
    const fx = S.effects[i];
    if (S.time >= fx.until) {
      S.scene.remove(fx.obj);
      fx.obj.geometry?.dispose?.();
      S.effects.splice(i, 1);
      continue;
    }
    if (fx.kind === 'sparks') {
      const pos = fx.obj.geometry.getAttribute('position');
      for (let j = 0; j < fx.velocities.length; j++) {
        const v = fx.velocities[j];
        v.y -= 9 * dt;
        pos.setXYZ(j, pos.getX(j) + v.x * dt, Math.max(0.05, pos.getY(j) + v.y * dt), pos.getZ(j) + v.z * dt);
      }
      pos.needsUpdate = true;
    }
  }
}
