// The minimap: a 2D canvas over the HUD's corner. North-up and fixed to the
// whole city — streets, sand and water first, then the named places, the
// traffic, the police as flashing red and blue dots, the gold mission
// marker, and the player as a white arrow turned to their heading.

import { S, playerPos } from './state.js';
import { ROAD_LINES, ROAD_WIDTH, CITY_EDGE, SAND_END, PLACES } from './config.js';

const MIN_X = -248;
const MIN_Z = -300;
const SPAN = 600; // world units across the map, east edge covers the marina

let ctx = null;
let size = 0;

export function initMinimap(canvas) {
  ctx = canvas.getContext('2d');
  size = canvas.width;
}

function toMap(x, z) {
  const s = size / SPAN;
  return { x: (x - MIN_X) * s, y: (z - MIN_Z) * s };
}

export function drawMinimap() {
  if (!ctx) return;
  const s = size / SPAN;
  ctx.fillStyle = '#131c26';
  ctx.fillRect(0, 0, size, size);

  // water and sand on the east edge
  const sandAt = toMap(CITY_EDGE, 0);
  const waterAt = toMap(SAND_END, 0);
  ctx.fillStyle = '#c9ae76';
  ctx.fillRect(sandAt.x, 0, waterAt.x - sandAt.x, size);
  ctx.fillStyle = '#1d5f78';
  ctx.fillRect(waterAt.x, 0, size - waterAt.x, size);

  // streets
  ctx.strokeStyle = '#46505a';
  ctx.lineWidth = Math.max(1.5, ROAD_WIDTH * s);
  for (const line of ROAD_LINES) {
    const a = toMap(line, MIN_Z);
    const b = toMap(line, -MIN_Z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const c = toMap(MIN_X, line);
    const d = toMap(CITY_EDGE, line);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  // named places
  for (const place of PLACES) {
    const p = toMap(place.x, place.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // traffic
  ctx.fillStyle = '#9aa3ab';
  for (const car of S.cars) {
    if (car.kind !== 'traffic') continue;
    const p = toMap(car.group.position.x, car.group.position.z);
    ctx.fillRect(p.x - 1.3, p.y - 1.3, 2.6, 2.6);
  }

  // police, flashing
  const flashBlue = Math.floor(S.time * 2.4) % 2 === 0;
  for (const cop of S.police) {
    const p = toMap(cop.group.position.x, cop.group.position.z);
    ctx.fillStyle = flashBlue ? '#3d7bff' : '#ff4038';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // the mission marker, gold and pulsing
  if (S.mission && S.mission.target) {
    const p = toMap(S.mission.target.x, S.mission.target.z);
    ctx.fillStyle = '#ffc21f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.6 + Math.sin(S.time * 4) * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // the player arrow
  const pp = playerPos();
  const p = toMap(pp.x, pp.z);
  const heading = S.player.inCar ? S.player.inCar.heading : S.player.heading;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.PI - heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -5.5);
  ctx.lineTo(3.6, 4.4);
  ctx.lineTo(0, 2.4);
  ctx.lineTo(-3.6, 4.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
