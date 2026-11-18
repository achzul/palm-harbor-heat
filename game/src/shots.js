// Screenshot staging and the test window. The game reads ?shot=<name> and,
// for that name, puts its own systems into the moment the screenshot needs:
// a real chase with real cruisers, a real delivery about to complete. The
// same window (window.PHH) is what the headless verification harness drives:
// it reads state and teleports the player, everything else happens through
// the game's own systems.

import { S, playerPos } from './state.js';
import { PLACES, SAVE_KEY } from './config.js';
import { spawnCar } from './vehicles.js';
import { startMission, nextJobOffer, currentObjective } from './missions.js';
import { SOL_POS } from './city.js';

export function shotName() {
  return new URLSearchParams(window.location.search).get('shot');
}

function putPlayerInCar(car, x, z, heading) {
  car.group.position.set(x, 0, z);
  car.heading = heading;
  car.group.rotation.y = heading;
  car.speed = 0;
  if (car.kind === 'parked') car.kind = 'driven';
  S.player.inCar = car;
  S.player.group.visible = false;
}

function nearestParkedTo(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const car of S.cars) {
    if (car.kind !== 'parked') continue;
    const d = Math.hypot(car.group.position.x - x, car.group.position.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function cruiserFormation(x, z, heading, count) {
  for (let i = 0; i < count; i++) {
    const back = 10 + i * 7;
    const side = (i - (count - 1) / 2) * 4.5;
    const cx = x - Math.sin(heading) * back + Math.cos(heading) * side;
    const cz = z - Math.cos(heading) * back - Math.sin(heading) * side;
    spawnCar(cx, cz, heading, 'police', 0xf2f3f5, { police: true, slotAngle: (i * Math.PI * 2) / count });
  }
}

const STAGES = {
  // cover: a chase in the city — three stars, cruisers behind, a live mission
  chase() {
    const car = S.cars.find((c) => c.missionTag === 'delivery');
    putPlayerInCar(car, 23, 30, Math.PI);
    // a slow roll keeps the camera where staging puts it (the follow cam only
    // auto-eases behind a car doing over 3 m/s): a front three-quarter view,
    // so the cruisers boxing the sedan in are in the frame behind it
    S.cameraYaw = Math.PI + 2.5;
    startMission(nextJobOffer());
    S.wanted.heat = 62; // three stars
    cruiserFormation(23, 30, Math.PI, 3);
    car.speed = 2.8;
  },
  // driving through traffic with a pedestrian crossing ahead
  drive() {
    const car = nearestParkedTo(-69, 60);
    putPlayerInCar(car, -69, 44, Math.PI);
    S.cameraYaw = Math.PI;
    car.speed = 11;
    const ped = S.peds.find((p) => !p.isSol);
    if (ped) {
      ped.group.position.set(-66.5, 0, 18);
      ped.heading = -Math.PI / 2;
    }
  },
  // on foot on the boardwalk, looking north along it: sea to the right,
  // palms ahead, the city behind the camera, people strolling past
  boardwalk() {
    S.player.group.position.set(237, 0, 30);
    S.player.heading = Math.PI;
    S.cameraYaw = Math.PI;
    let placed = 0;
    for (const ped of S.peds) {
      if (ped.isSol || placed >= 4) continue;
      ped.group.position.set(235.5 + (placed % 2) * 3, 0, 20 - placed * 5);
      ped.heading = Math.PI;
      placed++;
    }
  },
  // the gold Cielo GT rolling into Harborlight Garage, beacon up, two stars
  mission() {
    S.storyStep = 1;
    startMission(nextJobOffer());
    const cielo = S.cars.find((c) => c.missionTag === 'cielo');
    putPlayerInCar(cielo, -188, -160, -Math.PI / 2);
    S.cameraYaw = -Math.PI / 2;
    S.wanted.heat = 30; // two stars
    cruiserFormation(-188, -160, -Math.PI / 2, 1);
    cielo.speed = 8;
  },
};

export function stageShot(name) {
  const stage = STAGES[name];
  if (stage) stage();
}

// The harness window: state out, a few stage-setting actions in.
export function exposeTestWindow(startGame) {
  window.PHH = {
    state() {
      const p = playerPos();
      return {
        started: S.started,
        cash: S.cash,
        stars: S.wanted.stars,
        heat: Math.round(S.wanted.heat),
        health: S.player.health,
        player: { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 },
        inCar: !!S.player.inCar,
        carSpeed: S.player.inCar ? Math.round(S.player.inCar.speed * 10) / 10 : 0,
        police: S.police.length,
        peds: S.peds.length,
        cars: S.cars.length,
        trafficMoving: S.cars.filter((c) => c.kind === 'traffic' && Math.abs(c.speed) > 1).length,
        objective: currentObjective(),
        saved: window.localStorage.getItem(SAVE_KEY) !== null,
        sol: SOL_POS,
        places: PLACES,
        trafficSample: S.cars
          .filter((c) => c.kind === 'traffic')
          .slice(0, 3)
          .map((c) => ({ x: Math.round(c.group.position.x), z: Math.round(c.group.position.z) })),
        pedSample: S.peds
          .filter((p) => !p.isSol)
          .slice(0, 3)
          .map((p) => ({ x: Math.round(p.group.position.x * 10) / 10, z: Math.round(p.group.position.z * 10) / 10 })),
      };
    },
    start: () => startGame(),
    teleport(x, z) {
      if (S.player.inCar) S.player.inCar.group.position.set(x, 0, z);
      else S.player.group.position.set(x, 0, z);
    },
    carByTag(tag) {
      const car = S.cars.find((c) => c.missionTag === tag);
      return car ? { x: car.group.position.x, z: car.group.position.z } : null;
    },
    nearestPolice() {
      const p = playerPos();
      let best = Infinity;
      for (const cop of S.police) {
        best = Math.min(best, Math.hypot(cop.group.position.x - p.x, cop.group.position.z - p.z));
      }
      return best;
    },
    setCamera(yaw, pitch) {
      S.cameraYaw = yaw;
      if (pitch !== undefined) S.cameraPitch = pitch;
    },
  };
}
