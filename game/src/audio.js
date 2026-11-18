// All sound is synthesized with WebAudio; the game ships no audio files.
// An engine hum that follows the driven car's speed, a two-tone siren while
// cruisers are close, and one-shot noises for gunfire, crashes, pickups and
// mission stings. Everything is guarded so a browser that has not unlocked
// audio yet simply stays silent.

import { S } from './state.js';
import { clamp } from './rng.js';

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenFlip = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
  } catch {
    ctx = null;
  }
}

export function unlockAudio() {
  initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function noiseBurst(duration, filterFreq, gainValue) {
  if (!ctx || S.muted) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(filter).connect(gain).connect(master);
  source.start();
}

function blip(freq, at, duration, type = 'sine', gainValue = 0.18) {
  if (!ctx || S.muted) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, ctx.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + duration);
  osc.connect(gain).connect(master);
  osc.start(ctx.currentTime + at);
  osc.stop(ctx.currentTime + at + duration + 0.02);
}

export function playGunshot() {
  noiseBurst(0.14, 2600, 0.5);
}

export function playCrash(strength) {
  noiseBurst(0.22, 300 + strength * 60, clamp(0.2 + strength * 0.08, 0.2, 0.65));
}

export function playPickup() {
  blip(880, 0, 0.12);
  blip(1320, 0.09, 0.16);
}

export function playMissionSting() {
  blip(523, 0, 0.16, 'triangle', 0.22);
  blip(659, 0.12, 0.16, 'triangle', 0.22);
  blip(784, 0.24, 0.3, 'triangle', 0.24);
}

export function playBusted() {
  blip(392, 0, 0.2, 'square', 0.12);
  blip(330, 0.18, 0.2, 'square', 0.12);
  blip(262, 0.36, 0.4, 'square', 0.12);
}

// Called every frame: the engine follows the car the player drives, and the
// siren fades in with the nearest cruiser.
export function updateAudio(dt, drivenSpeed, nearestPoliceDist) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const engineTarget = S.muted || !S.player.inCar ? 0 : 0.05 + Math.abs(drivenSpeed) * 0.0035;
  engineGain.gain.setTargetAtTime(engineTarget, t, 0.08);
  engineOsc.frequency.setTargetAtTime(55 + Math.abs(drivenSpeed) * 4.5, t, 0.08);

  sirenFlip += dt;
  if (sirenOsc && sirenFlip > 0.36) {
    sirenFlip = 0;
    sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 690 : 950;
  }
  const sirenTarget =
    S.muted || nearestPoliceDist === Infinity ? 0 : clamp(0.11 - nearestPoliceDist * 0.0012, 0, 0.09);
  sirenGain.gain.setTargetAtTime(sirenTarget, t, 0.15);
}
