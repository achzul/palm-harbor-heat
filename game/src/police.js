// The Palm Harbor PD: cruisers that answer the wanted level. More stars,
// more cruisers, spawned on the roads around the player. Each one picks a
// slot around the player — ahead, beside, behind — and steers for it, which
// is how they box a runner in. When the heat dies they peel off and leave.

import { S } from './state.js';
import { ROAD_LINES, COLORS } from './config.js';
import { makeRng, clamp } from './rng.js';
import { spawnCar, removeCar, steerToward, collideCircle } from './vehicles.js';

const rng = makeRng(9001);

function nearestRoadPoint(x, z, minDist, maxDist) {
  // a point on a street, roughly minDist..maxDist from (x, z)
  for (let tries = 0; tries < 24; tries++) {
    const vertical = rng() < 0.5;
    const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = (rng() * 2 - 1) * 215;
    const px = vertical ? line : along;
    const pz = vertical ? along : line;
    const d = Math.hypot(px - x, pz - z);
    if (d >= minDist && d <= maxDist) return { x: px, z: pz };
  }
  return { x: ROAD_LINES[0], z };
}

export function cruisersWanted() {
  const stars = S.wanted.stars;
  return stars === 0 ? 0 : Math.min(2 + stars, 5);
}

export function updatePolice(dt) {
  const target = S.player.inCar ? S.player.inCar.group.position : S.player.group.position;
  const want = cruisersWanted();

  if (S.police.length < want) {
    const spot = nearestRoadPoint(target.x, target.z, 52, 88);
    const slot = S.police.length * ((Math.PI * 2) / Math.max(3, want));
    spawnCar(spot.x, spot.z, Math.atan2(target.x - spot.x, target.z - spot.z), 'police', COLORS.policeBody, { police: true, slotAngle: slot });
  }

  const heading = S.player.inCar ? S.player.inCar.heading : S.player.heading;
  const fwd = { x: Math.sin(heading), z: Math.cos(heading) };
  const flash = Math.floor(S.time * 2.4) % 2 === 0;

  for (const cop of [...S.police]) {
    const distToPlayer = Math.hypot(cop.group.position.x - target.x, cop.group.position.z - target.z);
    if (want === 0) {
      // heat is gone: peel away and despawn once clear
      steerToward(cop, cop.group.position.x + fwd.x * -60, cop.group.position.z + fwd.z * -60, dt, 1.6);
      cop.speed += clamp(12 - cop.speed, -10 * dt, 5 * dt);
      if (distToPlayer > 130) removeCar(cop);
    } else {
      // this cruiser's slot around the player: its corner of the box
      const a = cop.slotAngle + Math.PI * 0.25;
      const slotDist = distToPlayer > 26 ? 4 : 7.5;
      const tx = target.x + (fwd.x * Math.cos(a) + fwd.z * Math.sin(a)) * slotDist + Math.sin(a) * 2;
      const tz = target.z + (fwd.z * Math.cos(a) - fwd.x * Math.sin(a)) * slotDist + Math.cos(a) * 2;
      steerToward(cop, tx, tz, dt, 2.7);
      const dSlot = Math.hypot(tx - cop.group.position.x, tz - cop.group.position.z);
      const cruise = distToPlayer > 30 ? 27 : distToPlayer > 12 ? 19 : 10;
      const targetSpeed = dSlot < 2.2 ? Math.min(S.player.speed, 6) : cruise;
      cop.speed += clamp(targetSpeed - cop.speed, -24 * dt, 9 * dt);
    }
    cop.group.position.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.group.position.z += Math.cos(cop.heading) * cop.speed * dt;
    collideCircle(cop.group.position, cop.radius);
    cop.group.rotation.y = cop.heading;

    const { barRed, barBlue } = cop.group.userData;
    if (barRed && barBlue) {
      barRed.emissive.setHex(flash ? 0xff2a20 : 0x400a08);
      barBlue.emissive.setHex(flash ? 0x0a1a66 : 0x2255ff);
    }
  }
}
