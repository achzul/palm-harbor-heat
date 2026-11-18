// The people of Palm Harbor: fifteen pedestrians strolling the block
// perimeters, and Sol, who waits by her garage. Pedestrians keep to their
// loop until danger comes close — a shot, a crash, a fast car — then they run
// from it. A pedestrian knocked down by a car lies still for a few seconds
// and gets back up; nothing graphic, this is a friendly city.

import * as THREE from 'three';
import { S } from './state.js';
import { ROAD_LINES, ROAD_WIDTH } from './config.js';
import { makeRng, range, pick, clamp } from './rng.js';
import { SOL_POS } from './city.js';

const SHIRTS = [0xd96a4a, 0x4a7ad9, 0xe8e4da, 0x63b06a, 0xc2b13d, 0x9a5fc2, 0xd94a7a, 0x3dc2b0];

function makePedMesh(shirt) {
  const group = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), legMat);
  legL.position.set(-0.13, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.66, 0.3), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.05;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 9, 7), new THREE.MeshLambertMaterial({ color: pick(makeRng(Date.now() % 997), [0xc98d64, 0x8a5a3b, 0xe8b48c, 0x6b4226]) }));
  head.position.y = 1.58;
  group.add(legL, legR, torso, head);
  group.userData = { legL, legR };
  return group;
}

function blockLoop(rng) {
  // a rectangle path around one block, on the sidewalk line
  const i = Math.floor(rng() * 9);
  const j = Math.floor(rng() * 9);
  const inset = ROAD_WIDTH / 2 + 0.9;
  const x0 = ROAD_LINES[i] + inset;
  const x1 = ROAD_LINES[i + 1] - inset;
  const z0 = ROAD_LINES[j] + inset;
  const z1 = ROAD_LINES[j + 1] - inset;
  return [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ];
}

export function spawnPeds() {
  const rng = makeRng(777);
  for (let n = 0; n < 15; n++) {
    const loop = blockLoop(rng);
    const wp = Math.floor(rng() * 4);
    const group = makePedMesh(pick(rng, SHIRTS));
    group.position.set(loop[wp].x, 0, loop[wp].z);
    S.scene.add(group);
    S.peds.push({
      group,
      loop,
      wp,
      speed: range(rng, 1.1, 1.7),
      heading: 0,
      walkPhase: range(rng, 0, 6),
      fleeUntil: 0,
      fleeFrom: { x: 0, z: 0 },
      downUntil: 0,
      isSol: false,
    });
  }

  // Sol Duarte, in her orange jacket, with a gold marker overhead
  const sol = makePedMesh(0xff8c42);
  sol.position.set(SOL_POS.x, 0, SOL_POS.z);
  S.scene.add(sol);
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshBasicMaterial({ color: 0xffc21f }),
  );
  marker.position.set(SOL_POS.x, 2.6, SOL_POS.z);
  S.scene.add(marker);
  const ped = { group: sol, loop: null, wp: 0, speed: 0, heading: Math.PI / 2, walkPhase: 0, fleeUntil: 0, fleeFrom: { x: 0, z: 0 }, downUntil: 0, isSol: true, marker };
  S.peds.push(ped);
  S.solNpc = ped;
}

export function knockDownPed(ped) {
  if (ped.isSol || S.time < ped.downUntil) return;
  ped.downUntil = S.time + 4;
  ped.group.rotation.x = -Math.PI / 2;
  ped.group.position.y = 0.25;
}

export function scarePeds(x, z, radius) {
  for (const ped of S.peds) {
    if (ped.isSol) continue;
    const d = Math.hypot(ped.group.position.x - x, ped.group.position.z - z);
    if (d < radius) {
      ped.fleeUntil = S.time + range(Math.random, 2.2, 3.4);
      ped.fleeFrom = { x, z };
    }
  }
}

export function updatePeds(dt) {
  const pp = S.player.group.position;
  for (const ped of S.peds) {
    const g = ped.group;
    if (ped.isSol) {
      // Sol idles, turning to face a nearby player, marker bobbing
      const d = Math.hypot(pp.x - g.position.x, pp.z - g.position.z);
      if (d < 9) ped.heading = Math.atan2(pp.x - g.position.x, pp.z - g.position.z);
      g.rotation.y = ped.heading;
      if (ped.marker) ped.marker.position.y = 2.6 + Math.sin(S.time * 2.4) * 0.18;
      continue;
    }
    if (S.time < ped.downUntil) continue;
    if (g.rotation.x !== 0) {
      g.rotation.x = 0;
      g.position.y = 0;
    }

    let tx;
    let tz;
    let speed = ped.speed;
    if (S.time < ped.fleeUntil) {
      const away = Math.atan2(g.position.x - ped.fleeFrom.x, g.position.z - ped.fleeFrom.z);
      tx = g.position.x + Math.sin(away) * 6;
      tz = g.position.z + Math.cos(away) * 6;
      speed = 4.6;
    } else {
      const target = ped.loop[ped.wp];
      tx = target.x;
      tz = target.z;
      if (Math.hypot(tx - g.position.x, tz - g.position.z) < 0.7) {
        ped.wp = (ped.wp + 1) % ped.loop.length;
        continue;
      }
    }
    const want = Math.atan2(tx - g.position.x, tz - g.position.z);
    let delta = want - ped.heading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    ped.heading += clamp(delta, -4 * dt, 4 * dt);
    g.position.x += Math.sin(ped.heading) * speed * dt;
    g.position.z += Math.cos(ped.heading) * speed * dt;
    g.rotation.y = ped.heading;
    ped.walkPhase += dt * (speed > 3 ? 13 : 8);
    const swing = Math.sin(ped.walkPhase) * 0.5;
    g.userData.legL.rotation.x = swing;
    g.userData.legR.rotation.x = -swing;
  }
}
