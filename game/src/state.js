// The one shared game state. Every system module imports this object and
// reads or writes its slice of the world; main.js fills in the three.js
// objects at boot. Keeping it in one place means no module needs to import
// another just to see the world.

export const S = {
  // three.js anchors, set by main.js
  scene: null,
  camera: null,
  renderer: null,
  sun: null,
  waterTex: null,
  time: 0,

  started: false,
  paused: false,
  muted: false,
  over: false, // busted or wasted banner is showing

  // the player on foot
  player: {
    group: null,
    heading: 0,
    speed: 0,
    health: 100,
    inCar: null,
    walkPhase: 0,
    radius: 0.55,
  },

  cameraYaw: Math.PI, // behind the player, looking north at boot
  cameraPitch: 0.32,

  cars: [], // every vehicle: parked, traffic, mission and police alike
  peds: [],
  police: [],
  colliders: [], // building AABBs: {minX, maxX, minZ, maxZ}
  effects: [], // live tracers and spark bursts, updated by combat.js
  rangeTargets: [],
  beacons: [], // pulsing mission/place markers, animated by missions.js
  solNpc: null,

  wanted: {
    heat: 0,
    stars: 0,
    unseenFor: 0, // seconds since a cruiser last had eyes on the player
    bustedMeter: 0,
  },

  // wallet and story progress (persisted by save.js)
  cash: 0,
  totalEarned: 0,
  storyStep: 0, // 0: First Run next, 1: Hot Metal, 2: The Getaway, 3: story done
  boostCount: 0,
  mission: null, // the active mission object built by missions.js

  prompt: '', // the context prompt the HUD shows ("E — enter car")
  saveTimer: 0,
};

export function playerPos() {
  const p = S.player.inCar ? S.player.inCar.group.position : S.player.group.position;
  return p;
}

export function addCash(amount) {
  S.cash += amount;
  if (amount > 0) S.totalEarned += amount;
}
