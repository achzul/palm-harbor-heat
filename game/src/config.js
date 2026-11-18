// Palm Harbor Heat — shared numbers: the city grid, the named places, the
// mission payouts and the palette everything else builds from.

export const SAVE_KEY = 'palm-harbor-heat-save-v1';

// The street grid: 9x9 blocks. Roads run along both axes at these centre
// lines; a block of buildings sits in each cell between four roads.
export const ROAD_LINES = [-207, -161, -115, -69, -23, 23, 69, 115, 161, 207];
export const ROAD_WIDTH = 13;
export const CITY_EDGE = 232; // streets end here; the beach begins
export const SAND_END = 292; // sand ends here; the water begins
export const WORLD_BOUNDS = { minX: -238, maxX: 330, minZ: -238, maxZ: 238 };

// Golden-hour palette.
export const COLORS = {
  sky: 0xffc98a,
  fog: 0xf2a56b,
  sun: 0xffb36b,
  asphalt: 0x33373d,
  sidewalk: 0x9aa0a3,
  sand: 0xe8cf9f,
  water: 0x2e7f96,
  grass: 0x6f9e57,
  buildingTints: [0xf2e3c9, 0xe8b48c, 0xd98e6a, 0xc96f4a, 0xf7f0dd, 0xb7c9d6, 0x8fb4c7, 0xe6d0b3],
  carPaints: [0xc23b2e, 0x2e6fc2, 0xe8e4da, 0x2b2b30, 0xe0a51f, 0x3f9e63, 0x7a4fc2, 0xc2c7cc, 0x8c5a2b, 0x274156],
  cieloGold: 0xffb81f,
  policeBody: 0xf2f3f5,
  beaconGold: 0xffc21f,
};

// Named places, each with a spot a player can stand or park on. The story and
// the HUD speak of them by name.
export const PLACES = [
  { id: 'garage', name: 'Harborlight Garage', x: -214, z: -160, color: 0xff8c42 },
  { id: 'marina', name: 'Palm Harbor Marina', x: 262, z: 120, color: 0x3fa7c4 },
  { id: 'range', name: 'Sandy Range', x: 258, z: -60, color: 0xd94f3d },
  { id: 'safehouse', name: 'Harborlight Safehouse', x: -56, z: 196, color: 0x7bc47f },
  { id: 'pd', name: 'Palm Harbor PD', x: 32, z: -32, color: 0x3d5ad9 },
  { id: 'hospital', name: 'St. Aurelia Hospital', x: -150, z: 56, color: 0xf2f2f2 },
  { id: 'boardwalk', name: 'Boardwalk Lot', x: 222, z: 20, color: 0xc98f4e },
  { id: 'warehouse', name: 'Dock Warehouse', x: 184, z: -196, color: 0x8a6f4d },
];

export function placeById(id) {
  return PLACES.find((p) => p.id === id);
}

// Mission payouts, exactly as the story promises them.
export const PAY = { firstRun: 250, hotMetal: 600, getaway: 1200, boost: 300 };
export const RANGE_HIT_PAY = 15;
export const START_CASH = 40;
