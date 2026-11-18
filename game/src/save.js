// The localStorage save: cash, story progress and lifetime earnings under one
// key, written on mission completion, every 15 seconds of play, and whenever
// something worth keeping changes.

import { SAVE_KEY, START_CASH } from './config.js';
import { S } from './state.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    S.cash = Number.isFinite(data.cash) ? data.cash : START_CASH;
    S.totalEarned = Number.isFinite(data.totalEarned) ? data.totalEarned : 0;
    S.storyStep = Number.isFinite(data.storyStep) ? data.storyStep : 0;
    S.boostCount = Number.isFinite(data.boostCount) ? data.boostCount : 0;
    return true;
  } catch {
    return false;
  }
}

export function writeSave() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: S.cash,
        totalEarned: S.totalEarned,
        storyStep: S.storyStep,
        boostCount: S.boostCount,
      }),
    );
  } catch {
    // storage full or blocked: the game goes on unsaved
  }
}

export function freshSave() {
  S.cash = START_CASH;
  S.totalEarned = 0;
  S.storyStep = 0;
  S.boostCount = 0;
  writeSave();
}
