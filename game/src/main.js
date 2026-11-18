// Palm Harbor Heat — boot and the main loop. Builds the renderer, the
// golden-hour light and the city, spawns everyone, then runs the systems in
// order each frame: player, traffic, police, pedestrians, missions, wanted,
// combat, and finally the camera, the sound, the minimap and the HUD.

import * as THREE from 'three';
import { S } from './state.js';
import { COLORS, placeById } from './config.js';
import * as input from './input.js';
import { buildCity } from './city.js';
import { spawnPlayer, updatePlayer, respawnAt } from './player.js';
import { spawnPeds, updatePeds, knockDownPed } from './peds.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { updatePolice } from './police.js';
import { updateWanted, chargeFine, nearestPoliceDistance } from './wanted.js';
import { updateMissions } from './missions.js';
import { updateCombat } from './combat.js';
import { updateCamera } from './camera.js';
import { initHud, updateHud, setStartVisible, setPauseVisible, showOver, hideOver, showToast } from './hud.js';
import { initMinimap, drawMinimap } from './minimap.js';
import { loadSave, freshSave, writeSave } from './save.js';
import { initAudio, unlockAudio, updateAudio, playCrash, playBusted } from './audio.js';
import { separateCars } from './vehicles.js';
import { reportCrime } from './wanted.js';
import { shotName, stageShot, exposeTestWindow } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.fog, 130, 430);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-190, 6, -110);

const hemi = new THREE.HemisphereLight(0xffe3b3, 0x51606e, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(COLORS.sun, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

S.scene = scene;
S.camera = camera;
S.renderer = renderer;
S.sun = sun;

buildCity();
spawnPlayer(-202, -146, Math.PI);
spawnPeds();
spawnTraffic();

const hadSave = loadSave();
if (!hadSave) freshSave();

let overTimer = null;
function handleOver(kind) {
  S.over = kind;
  const fine = chargeFine(kind);
  if (kind === 'busted') playBusted();
  showOver(kind, fine);
  writeSave();
  overTimer = setTimeout(() => {
    const place = kind === 'busted' ? placeById('pd') : placeById('hospital');
    respawnAt(place.x, place.z + 12);
    hideOver();
    S.over = null;
    showToast(kind === 'busted' ? 'Released. Keep it clean out there.' : 'Patched up. Take it easy.');
  }, 2800);
}

function startGame() {
  if (S.started) return;
  S.started = true;
  setStartVisible(false);
  unlockAudio();
  writeSave();
  showToast('Welcome to Palm Harbor. Sol is waiting by the garage — gold marker.');
}

function togglePause() {
  if (!S.started || S.over) return;
  S.paused = !S.paused;
  setPauseVisible(S.paused);
}

initHud({
  onStart: startGame,
  onResume: togglePause,
  hasSave: () => hadSave,
});
initMinimap(document.getElementById('minimap'));
input.initInput(canvas, {
  onPause: togglePause,
  onMute: () => {
    S.muted = !S.muted;
    showToast(S.muted ? 'Sound off' : 'Sound on');
  },
  wantsPointerLock: () => S.started && !S.paused && !S.over,
});
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

exposeTestWindow(startGame);
const shot = shotName();
if (shot) {
  startGame();
  stageShot(shot);
}

let lastCarHitAt = -10;
function carContactChecks() {
  // the player's car meeting pedestrians and other cars at speed
  const mine = S.player.inCar;
  if (!mine) return;
  for (const ped of S.peds) {
    if (ped.isSol || S.time < ped.downUntil) continue;
    const d = Math.hypot(ped.group.position.x - mine.group.position.x, ped.group.position.z - mine.group.position.z);
    if (d < 2.5 && Math.abs(mine.speed) > 3.5) {
      knockDownPed(ped);
      reportCrime('hitPed', ped.group.position.x, ped.group.position.z);
      playCrash(0.4);
      mine.speed *= 0.6;
    }
  }
}

const timer = new THREE.Timer();
function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);

  if (!S.paused) {
    S.time += dt;
    if (S.waterTex) S.waterTex.offset.x = (S.time * 0.008) % 1;

    if (S.started && !S.over) {
      S.prompt = '';
      updatePlayer(dt);
      updateMissions(dt);
      const event = updateWanted(dt);
      if (event) handleOver(event);
      updateCombat(dt);
      S.saveTimer += dt;
      if (S.saveTimer > 15) {
        S.saveTimer = 0;
        writeSave();
      }
    }
    if (!S.over) {
      updateTraffic(dt);
      updatePolice(dt);
      updatePeds(dt);
      // cars keep their distance from each other
      for (let i = 0; i < S.cars.length; i++) {
        for (let j = i + 1; j < S.cars.length; j++) {
          const a = S.cars[i];
          const b = S.cars[j];
          if (Math.abs(a.speed) < 0.1 && Math.abs(b.speed) < 0.1) continue;
          if (separateCars(a, b)) {
            const driven = a === S.player.inCar ? a : b === S.player.inCar ? b : null;
            if (driven && Math.abs(driven.speed) > 8 && S.time - lastCarHitAt > 1.5) {
              lastCarHitAt = S.time;
              reportCrime('hitCar', driven.group.position.x, driven.group.position.z);
              playCrash(Math.abs(driven.speed) / 12);
              S.player.health -= Math.abs(driven.speed) * 0.12;
            }
          }
        }
      }
      carContactChecks();
    }
    if (!S.started) S.cameraYaw += dt * 0.05; // a slow drift behind the start screen
    updateCamera(dt);
    updateAudio(dt, S.player.inCar ? S.player.inCar.speed : 0, nearestPoliceDistance());
  }

  drawMinimap();
  updateHud();
  renderer.render(scene, camera);
  input.endFrame();
}
frame();
