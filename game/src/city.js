// Palm Harbor itself: the 9x9 street grid, its buildings, the beach and
// marina on the east edge, the named places with their signs, the parked cars
// (including the two the story needs), the palms and lamps, and the collision
// boxes every moving thing respects. Built once at boot from a seeded random
// generator, so the city is identical on every visit.

import * as THREE from 'three';
import { S } from './state.js';
import { ROAD_LINES, ROAD_WIDTH, CITY_EDGE, SAND_END, COLORS, PLACES } from './config.js';
import { makeRng, range, rangeInt, pick } from './rng.js';
import { spawnCar } from './vehicles.js';

export const SOL_POS = { x: -214.5, z: -148 }; // Sol waits outside her garage

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// A tower facade: a grid of windows, some lit warm, over a plain wall the
// material tint colours per building.
function facadeTexture(rng) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = '#f5efe4';
    g.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 5; col++) {
        const lit = rng() < 0.34;
        g.fillStyle = lit ? '#ffd98a' : '#33505e';
        g.fillRect(10 + col * 24, 12 + row * 20, 15, 12);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(0, 246, 128, 10);
  });
}

function roadTexture() {
  return canvasTexture(128, 512, (g) => {
    g.fillStyle = '#33373d';
    g.fillRect(0, 0, 128, 512);
    g.fillStyle = '#e8e6df';
    g.fillRect(2, 0, 4, 512);
    g.fillRect(122, 0, 4, 512);
    g.fillStyle = '#e8c832';
    for (let y = 8; y < 512; y += 64) g.fillRect(61, y, 6, 34);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 260; i++) g.fillRect(Math.random() * 128, Math.random() * 512, 2, 2);
  });
}

function signMesh(text, color) {
  const tex = canvasTexture(512, 96, (g) => {
    g.fillStyle = '#20242a';
    g.fillRect(0, 0, 512, 96);
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.strokeRect(5, 5, 502, 86);
    g.fillStyle = '#ffffff';
    g.font = 'bold 40px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text.toUpperCase(), 256, 52);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.1),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  return mesh;
}

function addCollider(x, z, w, d) {
  S.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

function addBuilding(x, z, w, d, h, tint, facade) {
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4c4640 });
  const sideMat = new THREE.MeshLambertMaterial({ map: facade, color: tint });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat]);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  S.scene.add(mesh);
  addCollider(x, z, w, d);
  return mesh;
}

function addPalm(x, z, rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6), trunkMat);
  trunk.position.y = 2.7;
  trunk.rotation.z = range(rng, -0.09, 0.09);
  trunk.castShadow = true;
  group.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4), frondMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.sin(a) * 1.15, 5.6, Math.cos(a) * 1.15);
    frond.rotation.set(Math.cos(a) * 1.15, 0, -Math.sin(a) * 1.15);
    frond.scale.set(0.28, 1, 1);
    group.add(frond);
  }
  group.position.set(x, 0, z);
  S.scene.add(group);
}

function addLamp(x, z) {
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 5.6, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x3a3f45 }),
  );
  pole.position.set(x, 2.8, z);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x554d33, emissive: 0x665522 }),
  );
  head.position.set(x, 5.65, z);
  S.scene.add(pole, head);
}

function groundPlane(w, d, color, x, z, y = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  S.scene.add(mesh);
  return mesh;
}

// One named place: a ground ring in its colour, a sign on two posts, and a
// distinctive structure per kind of place.
function buildPlace(place, rng, facade) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.2, 6.1, 28),
    new THREE.MeshBasicMaterial({ color: place.color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(place.x, 0.06, place.z);
  S.scene.add(ring);

  const sign = signMesh(place.name, '#ffc21f');
  sign.position.set(place.x, 4.4, place.z - 7);
  S.scene.add(sign);
  for (const sx of [-5, 5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.4, 0.22), new THREE.MeshLambertMaterial({ color: 0x2c2f33 }));
    post.position.set(place.x + sx, 2.2, place.z - 7);
    S.scene.add(post);
  }

  const wall = new THREE.MeshLambertMaterial({ color: place.color });
  if (place.id === 'garage') {
    addBuilding(place.x - 12, place.z, 20, 16, 7, 0xd8cfc0, facade);
    const door = new THREE.Mesh(new THREE.BoxGeometry(9, 4.6, 0.4), new THREE.MeshLambertMaterial({ color: 0x394048 }));
    door.position.set(place.x - 12, 2.3, place.z + 8.2);
    S.scene.add(door);
  } else if (place.id === 'pd' || place.id === 'hospital') {
    addBuilding(place.x, place.z - 4, 24, 18, place.id === 'pd' ? 13 : 16, place.id === 'pd' ? 0xcfd8ea : 0xf4f4f4, facade);
    if (place.id === 'hospital') {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 0.3), new THREE.MeshBasicMaterial({ color: 0xd92b20 }));
      cross.position.set(place.x, 12, place.z + 5.2);
      S.scene.add(cross);
    }
  } else if (place.id === 'warehouse') {
    addBuilding(place.x, place.z, 30, 20, 10, 0xa08b6d, facade);
  } else if (place.id === 'safehouse') {
    addBuilding(place.x, place.z - 3, 13, 11, 6, 0xe8d9b0, facade);
  } else if (place.id === 'marina') {
    // dock planks reaching into the water, with three moored boats
    const plankMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
    const dock = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 7), plankMat);
    dock.position.set(SAND_END + 18, 0.45, place.z);
    S.scene.add(dock);
    for (let i = 0; i < 3; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 8), new THREE.MeshLambertMaterial({ color: pick(rng, COLORS.carPaints) }));
      hull.position.y = 0.4;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
      cab.position.y = 1.3;
      boat.add(hull, cab);
      boat.position.set(SAND_END + 8 + i * 13, 0.15, place.z + 7.5);
      S.scene.add(boat);
    }
  } else if (place.id === 'range') {
    // five bullseye targets on posts, facing the firing line to the west
    const postMat = new THREE.MeshLambertMaterial({ color: 0x6b4f2e });
    for (let i = 0; i < 5; i++) {
      const tx = place.x + 16;
      const tz = place.z - 16 + i * 8;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.6, 0.24), postMat);
      post.position.set(tx, 0.8, tz);
      S.scene.add(post);
      const disc = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 18), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 14), new THREE.MeshLambertMaterial({ color: 0xd92b20 }));
      outer.rotation.z = Math.PI / 2;
      inner.rotation.z = Math.PI / 2;
      inner.position.x = -0.03;
      disc.add(outer, inner);
      disc.position.set(tx, 1.9, tz);
      S.scene.add(disc);
      S.rangeTargets.push({ group: disc, x: tx, z: tz, alive: true, respawnAt: 0 });
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 4), wall);
    hut.position.set(place.x - 4, 1.3, place.z + 14);
    S.scene.add(hut);
  }
  // boardwalk: the lot itself is laid out with the parked cars below
}

export function buildCity() {
  const rng = makeRng(20261117);
  const facade = facadeTexture(rng);

  // base ground: city pavement, then sand, then water
  groundPlane(CITY_EDGE * 2 + 8, CITY_EDGE * 2 + 8, 0xa9a294, 0, 0, 0);
  groundPlane(SAND_END - CITY_EDGE + 130, CITY_EDGE * 2 + 160, COLORS.sand, (CITY_EDGE + SAND_END) / 2 + 60, 0, -0.01);
  const waterTex = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#2e7f96';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.20)';
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      const y = Math.random() * 256;
      g.moveTo(Math.random() * 200, y);
      g.lineTo(60 + Math.random() * 196, y);
      g.stroke();
    }
  });
  waterTex.repeat.set(10, 10);
  S.waterTex = waterTex;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(420, CITY_EDGE * 2 + 220),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.94 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(SAND_END + 205, 0.12, 0);
  S.scene.add(water);

  // the boardwalk: a wooden strip between the city and the sand
  const walkTex = canvasTexture(64, 256, (g) => {
    g.fillStyle = '#a87f4e';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 3);
  });
  walkTex.repeat.set(1, 24);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.24, CITY_EDGE * 2), new THREE.MeshLambertMaterial({ map: walkTex }));
  walk.position.set(CITY_EDGE + 4, 0.12, 0);
  walk.receiveShadow = true;
  S.scene.add(walk);

  // roads: one textured strip per line, both directions
  const roadTexBase = roadTexture();
  for (const line of ROAD_LINES) {
    for (const vertical of [true, false]) {
      const tex = roadTexBase.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, 10);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_WIDTH, CITY_EDGE * 2 + 6),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      strip.rotation.x = -Math.PI / 2;
      if (!vertical) strip.rotation.z = Math.PI / 2;
      strip.position.set(vertical ? line : 0, 0.03, vertical ? 0 : line);
      strip.receiveShadow = true;
      S.scene.add(strip);
    }
  }

  // blocks: buildings, parks and parking lots in each cell
  const placeCells = new Set(['5,3', '1,5', '3,8', '8,0']);
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const x0 = ROAD_LINES[i] + ROAD_WIDTH / 2;
      const x1 = ROAD_LINES[i + 1] - ROAD_WIDTH / 2;
      const z0 = ROAD_LINES[j] + ROAD_WIDTH / 2;
      const z1 = ROAD_LINES[j + 1] - ROAD_WIDTH / 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (placeCells.has(`${i},${j}`)) continue;
      const roll = rng();
      if (roll < 0.13) {
        // a small park: grass, palms, benches
        groundPlane(x1 - x0, z1 - z0, COLORS.grass, cx, cz, 0.045);
        for (let k = 0; k < 3; k++) addPalm(range(rng, x0 + 4, x1 - 4), range(rng, z0 + 4, z1 - 4), rng);
      } else if (roll < 0.24) {
        // an open parking lot: asphalt and a few parked cars
        groundPlane(x1 - x0, z1 - z0, 0x555a60, cx, cz, 0.045);
        const n = rangeInt(rng, 1, 3);
        for (let k = 0; k < n; k++) {
          spawnCar(range(rng, x0 + 5, x1 - 5), range(rng, z0 + 5, z1 - 5), pick(rng, [0, Math.PI]), 'parked', pick(rng, COLORS.carPaints));
        }
      } else {
        // one tower or a cluster of smaller buildings
        const big = rng() < 0.45;
        const centreBoost = 1 - Math.min(1, Math.hypot(cx, cz) / 320);
        if (big) {
          addBuilding(cx, cz, range(rng, 20, 26), range(rng, 20, 26), range(rng, 16, 30) + centreBoost * 30, pick(rng, COLORS.buildingTints), facade);
        } else {
          for (const [ox, oz] of [[-8.2, -8.2], [8.2, -8.2], [-8.2, 8.2], [8.2, 8.2]]) {
            if (rng() < 0.22) continue;
            addBuilding(cx + ox, cz + oz, range(rng, 11, 14.5), range(rng, 11, 14.5), range(rng, 8, 20) + centreBoost * 16, pick(rng, COLORS.buildingTints), facade);
          }
        }
      }
    }
  }

  // named places and their structures
  for (const place of PLACES) buildPlace(place, rng, facade);

  // palms along the beach and lamps along the streets
  for (let z = -220; z <= 220; z += 26) {
    addPalm(CITY_EDGE + 12 + range(rng, 0, 6), z + range(rng, -5, 5), rng);
    if (z % 52 === 0) addPalm(range(rng, 246, 262), z + 13, rng);
  }
  for (const line of ROAD_LINES) {
    for (let t = -200; t <= 200; t += 50) {
      addLamp(line + ROAD_WIDTH / 2 + 0.8, t);
      addLamp(t, line - ROAD_WIDTH / 2 - 0.8);
    }
  }

  // parked cars on the streets, clear of intersections
  let streetParked = 0;
  while (streetParked < 14) {
    const vertical = rng() < 0.5;
    const line = pick(rng, ROAD_LINES);
    const along = range(rng, -215, 215);
    const nearCrossing = ROAD_LINES.some((l) => Math.abs(l - along) < 13);
    if (nearCrossing) continue;
    const side = rng() < 0.5 ? 1 : -1;
    const off = side * (ROAD_WIDTH / 2 - 1.7);
    const x = vertical ? line + off : along;
    const z = vertical ? along : line + off;
    if (S.cars.some((c) => Math.hypot(c.group.position.x - x, c.group.position.z - z) < 7)) continue;
    spawnCar(x, z, vertical ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2, 'parked', pick(rng, COLORS.carPaints));
    streetParked++;
  }

  // the story cars: Sol's delivery sedan at the garage, the gold Cielo GT
  // waiting at the Boardwalk Lot, and a few cars near the marina
  spawnCar(-211.8, -168, Math.PI / 2, 'parked', 0xe8e4da, { missionTag: 'delivery' });
  spawnCar(224, 12, -Math.PI / 2, 'parked', COLORS.cieloGold, { cielo: true, missionTag: 'cielo' });
  spawnCar(228, 28, -Math.PI / 2, 'parked', pick(rng, COLORS.carPaints));
  spawnCar(252, 104, Math.PI, 'parked', pick(rng, COLORS.carPaints));
  spawnCar(252, 138, Math.PI, 'parked', pick(rng, COLORS.carPaints));
}
