// The story: three jobs for Sol Duarte of Harborlight Garage, then her
// repeatable Boost List. Each mission is a short chain of steps — take a car,
// be somewhere, lose the law — watched every frame against the world, with a
// gold beacon in the world and a gold dot on the minimap at the current step.
// Finishing pays exactly the promised amount and writes the save.

import * as THREE from 'three';
import { S, addCash, playerPos } from './state.js';
import { PAY, placeById } from './config.js';
import { SOL_POS } from './city.js';
import * as input from './input.js';
import { writeSave } from './save.js';
import { playMissionSting, playPickup } from './audio.js';
import { showToast } from './hud.js';

const STORY = [
  {
    id: 'firstRun',
    title: 'First Run',
    pay: PAY.firstRun,
    intro: 'Sol: "Take my sedan to the marina. Carefully, Nico."',
    steps: [
      { type: 'enterCar', carTag: 'delivery', text: "Get into Sol's delivery sedan" },
      { type: 'arrive', place: 'marina', carTag: 'delivery', text: 'Drive the sedan to Palm Harbor Marina' },
    ],
  },
  {
    id: 'hotMetal',
    title: 'Hot Metal',
    pay: PAY.hotMetal,
    intro: 'Sol: "A gold Cielo GT sits at Boardwalk Lot. It belongs in my garage."',
    steps: [
      { type: 'enterCar', carTag: 'cielo', text: 'Steal the gold Cielo GT at Boardwalk Lot' },
      { type: 'arrive', place: 'garage', carTag: 'cielo', text: 'Bring the Cielo GT to Harborlight Garage' },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    pay: PAY.getaway,
    intro: 'Sol: "Pick up a package at the Dock Warehouse. It may get loud."',
    steps: [
      { type: 'arrive', place: 'warehouse', text: 'Pick up the package at Dock Warehouse', pickup: true },
      { type: 'escape', text: 'Lose the police' },
      { type: 'arrive', place: 'safehouse', text: 'Reach Harborlight Safehouse' },
    ],
  },
];

let beacon = null;

function ensureBeacon() {
  if (beacon) return beacon;
  const geo = new THREE.CylinderGeometry(1.7, 1.7, 30, 20, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffc21f, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  beacon = new THREE.Mesh(geo, mat);
  beacon.position.y = 15;
  beacon.visible = false;
  S.scene.add(beacon);
  return beacon;
}

function carByTag(tag) {
  return S.cars.find((c) => c.missionTag === tag) || null;
}

function stepTarget(step) {
  if (step.type === 'enterCar') {
    const car = carByTag(step.carTag);
    return car ? { x: car.group.position.x, z: car.group.position.z } : null;
  }
  if (step.type === 'arrive') {
    const place = placeById(step.place);
    return { x: place.x, z: place.z };
  }
  return null; // escape has no place to go, only heat to lose
}

export function nextJobOffer() {
  if (S.mission) return null;
  if (S.storyStep < STORY.length) return STORY[S.storyStep];
  return { id: 'boost', title: 'Boost List', pay: PAY.boost, intro: 'Sol: "Another name on the list. Bring it to the garage."' };
}

export function startMission(def) {
  let steps = def.steps;
  if (def.id === 'boost') {
    const candidates = S.cars.filter((c) => c.kind === 'parked' && !c.missionTag);
    if (candidates.length === 0) return;
    const car = candidates[Math.floor(Math.random() * candidates.length)];
    car.missionTag = 'boost';
    steps = [
      { type: 'enterCar', carTag: 'boost', text: 'Steal the car Sol marked' },
      { type: 'arrive', place: 'garage', carTag: 'boost', text: 'Deliver it to Harborlight Garage' },
    ];
  }
  S.mission = { def, steps, stepIndex: 0, target: null };
  showToast(def.intro);
  ensureBeacon();
}

function completeMission() {
  const { def } = S.mission;
  addCash(def.pay);
  playMissionSting();
  showToast(`${def.title} complete — $${def.pay}`);
  if (def.id === 'boost') {
    S.boostCount++;
    const car = carByTag('boost');
    if (car) car.missionTag = null;
  } else {
    S.storyStep++;
  }
  S.mission = null;
  if (beacon) beacon.visible = false;
  writeSave();
}

function stepDone(step) {
  const p = playerPos();
  if (step.type === 'enterCar') {
    return !!(S.player.inCar && S.player.inCar.missionTag === step.carTag);
  }
  if (step.type === 'arrive') {
    if (step.carTag && !(S.player.inCar && S.player.inCar.missionTag === step.carTag)) return false;
    const t = stepTarget(step);
    return t && Math.hypot(p.x - t.x, p.z - t.z) < 11;
  }
  if (step.type === 'escape') {
    return S.wanted.stars === 0;
  }
  return false;
}

export function updateMissions(dt) {
  const offer = nextJobOffer();
  const p = S.player.group.position;
  const nearSol = Math.hypot(p.x - SOL_POS.x, p.z - SOL_POS.z) < 4.2;

  if (!S.mission && offer && nearSol && !S.player.inCar) {
    S.prompt = `E — Talk to Sol: ${offer.title} ($${offer.pay})`;
    if (input.wasPressed('KeyE')) startMission(offer);
  }

  const m = S.mission;
  if (!m) {
    if (beacon) beacon.visible = false;
    return;
  }
  const step = m.steps[m.stepIndex];
  m.target = stepTarget(step);
  if (m.target && beacon) {
    beacon.visible = true;
    beacon.position.x = m.target.x;
    beacon.position.z = m.target.z;
    beacon.material.opacity = 0.26 + Math.sin(S.time * 3) * 0.1;
  } else if (beacon) {
    beacon.visible = false;
  }

  if (stepDone(step)) {
    if (step.pickup) {
      // the warehouse alarm: the whole PD rolls out
      S.wanted.heat = Math.max(S.wanted.heat, 62);
      playPickup();
      showToast('Got it — but the alarm tripped. Lose them!');
    }
    m.stepIndex++;
    if (m.stepIndex >= m.steps.length) completeMission();
  }
}

export function currentObjective() {
  const m = S.mission;
  if (!m) return null;
  const step = m.steps[m.stepIndex];
  const p = playerPos();
  const dist = m.target ? Math.round(Math.hypot(p.x - m.target.x, p.z - m.target.z)) : null;
  return { title: m.def.title, text: step.text, dist, target: m.target };
}
