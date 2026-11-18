// The HUD is plain DOM over the canvas: cash and health top-left, wanted
// stars and the minimap top-right, the mission objective across the top, a
// context prompt and the speedometer along the bottom, and the start, pause
// and busted/wasted screens above everything.

import { S } from './state.js';
import { currentObjective } from './missions.js';

const el = {};
let toastBox = null;

export function initHud(hooks) {
  for (const id of ['cash', 'health-fill', 'stars', 'objective', 'objective-title', 'objective-text', 'prompt', 'speedo', 'busted-wrap', 'busted-fill', 'crosshair', 'start-screen', 'pause-screen', 'over-screen', 'over-title', 'over-text', 'toasts', 'start-button', 'resume-button', 'continue-note']) {
    el[id] = document.getElementById(id);
  }
  toastBox = el.toasts;
  el['start-button'].addEventListener('click', () => hooks.onStart());
  el['resume-button'].addEventListener('click', () => hooks.onResume());
  document.getElementById('start-screen').classList.toggle('has-save', hooks.hasSave());
  if (hooks.hasSave()) el['continue-note'].textContent = 'Your Palm Harbor save was found — starting keeps your cash and story progress.';
}

export function showToast(text) {
  if (!toastBox) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = text;
  toastBox.appendChild(div);
  while (toastBox.children.length > 3) toastBox.removeChild(toastBox.firstChild);
  setTimeout(() => div.classList.add('fade'), 3600);
  setTimeout(() => div.remove(), 4300);
}

export function setStartVisible(visible) {
  el['start-screen'].style.display = visible ? 'flex' : 'none';
}

export function setPauseVisible(visible) {
  el['pause-screen'].style.display = visible ? 'flex' : 'none';
}

export function showOver(kind, fine) {
  el['over-title'].textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  el['over-text'].textContent =
    kind === 'busted'
      ? `The Palm Harbor PD got you. Fine: $${fine}. Released outside the station.`
      : `You wake up at St. Aurelia Hospital. Bill: $${fine}.`;
  el['over-screen'].style.display = 'flex';
}

export function hideOver() {
  el['over-screen'].style.display = 'none';
}

export function updateHud() {
  el.cash.textContent = `$${S.cash}`;
  el['health-fill'].style.width = `${Math.max(0, S.player.health)}%`;
  const stars = S.wanted.stars;
  el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  el.stars.style.color = stars >= 4 ? '#ff5a3c' : '#ffc21f';

  const objective = currentObjective();
  if (objective) {
    el.objective.style.display = 'block';
    el['objective-title'].textContent = objective.title;
    el['objective-text'].textContent = objective.dist !== null ? `${objective.text} — ${objective.dist}m` : objective.text;
  } else {
    el.objective.style.display = 'none';
  }

  el.prompt.textContent = S.started && !S.paused ? S.prompt : '';
  el.speedo.style.display = S.player.inCar ? 'block' : 'none';
  if (S.player.inCar) el.speedo.textContent = `${Math.round(Math.abs(S.player.inCar.speed) * 3.6)} km/h`;
  el.crosshair.style.display = S.started && !S.player.inCar && !S.paused ? 'block' : 'none';

  const meter = S.wanted.bustedMeter;
  el['busted-wrap'].style.display = meter > 0.02 ? 'block' : 'none';
  el['busted-fill'].style.width = `${Math.min(100, meter * 100)}%`;
}
