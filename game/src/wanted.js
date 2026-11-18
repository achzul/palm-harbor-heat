// Heat and stars: everything the city counts as a crime adds heat, heat
// becomes 1-5 stars, and stars bring the police. Heat only cools while no
// cruiser can see the player — six seconds out of sight and it starts to
// drain. Caught on foot with stars up, the busted meter fills; a wrecked
// body is wasted. Both end at a respawn with a fine.

import { S, addCash } from './state.js';
import { scarePeds } from './peds.js';

const HEAT_FOR_CRIME = {
  steal: 22, // taking a parked car: one star, and witnesses scatter
  hitPed: 26,
  hitCar: 10,
  hitPolice: 34,
  gunshot: 12,
  crash: 6,
};

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, 1 + Math.floor(heat / 25));
}

export function reportCrime(kind, x, z) {
  const heat = HEAT_FOR_CRIME[kind] || 0;
  if (heat > 0) S.wanted.heat = Math.min(125, S.wanted.heat + heat);
  if (kind === 'steal' || kind === 'hitPed' || kind === 'gunshot') scarePeds(x, z, 26);
}

export function nearestPoliceDistance() {
  const p = S.player.inCar ? S.player.inCar.group.position : S.player.group.position;
  let best = Infinity;
  for (const cop of S.police) {
    const d = Math.hypot(cop.group.position.x - p.x, cop.group.position.z - p.z);
    if (d < best) best = d;
  }
  return best;
}

// Returns 'busted' or 'wasted' on the frame either happens, else null; the
// main loop answers with the banner and the respawn.
export function updateWanted(dt) {
  const W = S.wanted;
  W.stars = starsForHeat(W.heat);

  const nearest = nearestPoliceDistance();
  if (nearest < 62) W.unseenFor = 0;
  else W.unseenFor += dt;
  if (W.unseenFor > 6 && W.heat > 0) {
    W.heat = Math.max(0, W.heat - 5.5 * dt);
    W.stars = starsForHeat(W.heat);
  }

  if (S.player.health <= 0 && !S.over) return 'wasted';

  if (!S.player.inCar && W.stars > 0 && nearest < 7.5 && S.player.speed < 2.5) {
    W.bustedMeter += dt / 2.2;
    if (W.bustedMeter >= 1) return 'busted';
  } else {
    W.bustedMeter = Math.max(0, W.bustedMeter - dt * 0.7);
  }
  return null;
}

export function fineFor(event) {
  return event === 'busted' ? 50 + 25 * S.wanted.stars : 75;
}

export function chargeFine(event) {
  const fine = Math.min(S.cash, fineFor(event));
  addCash(-fine);
  return fine;
}
