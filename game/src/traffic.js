// Traffic: eleven cars that live in the city, driving the grid from
// intersection to intersection on the right-hand side, braking for whatever
// is in front of them — another car, a pedestrian, or the player making a
// scene.

import { S } from './state.js';
import { ROAD_LINES, COLORS } from './config.js';
import { makeRng, range, pick, clamp } from './rng.js';
import { spawnCar, steerToward, collideCircle } from './vehicles.js';

const LANE = 2.35;

function rightOf(dx, dz) {
  // right-hand side of a unit direction of travel: forward cross up
  return { x: -dz, z: dx };
}

function nextTarget(rng, car) {
  // from the intersection the car is heading to, pick the next one: mostly
  // straight on, sometimes a turn, never a U-turn unless the road ends
  const t = car.route;
  const options = [];
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    if (dx === -t.dx && dz === -t.dz) continue;
    const nx = t.ix + dx;
    const nz = t.iz + dz;
    if (nx < 0 || nx > 9 || nz < 0 || nz > 9) continue;
    options.push({ dx, dz, nx, nz, straight: dx === t.dx && dz === t.dz });
  }
  if (options.length === 0) {
    t.dx = -t.dx;
    t.dz = -t.dz;
    return;
  }
  const straight = options.find((o) => o.straight);
  const chosen = straight && rng() < 0.62 ? straight : pick(rng, options);
  t.dx = chosen.dx;
  t.dz = chosen.dz;
  t.ix = chosen.nx;
  t.iz = chosen.nz;
}

function targetPoint(car) {
  const t = car.route;
  const right = rightOf(t.dx, t.dz);
  return {
    x: ROAD_LINES[t.ix] + right.x * LANE,
    z: ROAD_LINES[t.iz] + right.z * LANE,
  };
}

export function spawnTraffic() {
  const rng = makeRng(4242);
  for (let n = 0; n < 11; n++) {
    const ix = 1 + Math.floor(rng() * 8);
    const iz = 1 + Math.floor(rng() * 8);
    const [dx, dz] = pick(rng, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
    const car = spawnCar(ROAD_LINES[ix], ROAD_LINES[iz], Math.atan2(dx, dz), 'traffic', pick(rng, COLORS.carPaints));
    car.route = { ix, iz, dx, dz, cruise: range(rng, 9, 13.5), rng: makeRng(1000 + n * 77) };
    nextTarget(car.route.rng, car);
    const p = targetPoint(car);
    car.group.position.x = (ROAD_LINES[ix] + p.x) / 2 + (rng() - 0.5) * 8;
    car.group.position.z = (ROAD_LINES[iz] + p.z) / 2 + (rng() - 0.5) * 8;
    car.heading = Math.atan2(car.route.dx, car.route.dz);
    car.group.rotation.y = car.heading;
  }
}

function obstacleAhead(car) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const px = car.group.position.x;
  const pz = car.group.position.z;
  const check = (ox, oz, dist, lat) => {
    const rx = ox - px;
    const rz = oz - pz;
    const along = rx * fx + rz * fz;
    if (along < 1 || along > dist) return false;
    return Math.abs(rx * fz - rz * fx) < lat;
  };
  for (const other of S.cars) {
    if (other === car) continue;
    if (check(other.group.position.x, other.group.position.z, 10.5, 2.1)) return true;
  }
  for (const ped of S.peds) {
    if (check(ped.group.position.x, ped.group.position.z, 8, 1.6)) return true;
  }
  if (!S.player.inCar && check(S.player.group.position.x, S.player.group.position.z, 8, 1.6)) return true;
  return false;
}

export function updateTraffic(dt) {
  for (const car of S.cars) {
    if (car.kind !== 'traffic') continue;
    const target = targetPoint(car);
    const distToTarget = Math.hypot(target.x - car.group.position.x, target.z - car.group.position.z);
    if (distToTarget < 5) nextTarget(car.route.rng, car);

    steerToward(car, target.x, target.z, dt, 2.1);
    const braking = obstacleAhead(car);
    const targetSpeed = braking ? 0 : car.route.cruise;
    car.speed += clamp(targetSpeed - car.speed, -26 * dt, 7 * dt);
    car.group.userData.brakeMat.emissive.setHex(braking ? 0xff1a08 : 0x2a0503);

    car.group.position.x += Math.sin(car.heading) * car.speed * dt;
    car.group.position.z += Math.cos(car.heading) * car.speed * dt;
    collideCircle(car.group.position, car.radius);
    car.group.rotation.y = car.heading;
  }
}
