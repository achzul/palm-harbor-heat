// Keyboard and mouse state. Systems poll this module instead of listening for
// events themselves, which keeps every control in one list: WASD and arrows to
// move, Shift to sprint, Space to brake, E to interact, P pause, M mute, and
// the mouse to look, aim and fire.

const keysDown = new Set();
const pressed = new Set(); // keys that went down since the last frame
let mouseDX = 0;
let mouseDY = 0;
let firing = false;
let pointerLocked = false;

export function initInput(canvas, hooks) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keysDown.add(e.code);
    pressed.add(e.code);
    if (e.code === 'KeyP' && hooks.onPause) hooks.onPause();
    if (e.code === 'KeyM' && hooks.onMute) hooks.onMute();
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keysDown.delete(e.code));
  window.addEventListener('blur', () => keysDown.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      firing = true;
      if (!pointerLocked && hooks.wantsPointerLock()) {
        canvas.requestPointerLock()?.catch?.(() => {});
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) firing = false;
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (pointerLocked) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  });
}

export function isDown(code) {
  return keysDown.has(code);
}

// True once, on the frame after the key went down.
export function wasPressed(code) {
  return pressed.has(code);
}

export function moveAxes() {
  let x = 0;
  let z = 0;
  if (isDown('KeyW') || isDown('ArrowUp')) z += 1;
  if (isDown('KeyS') || isDown('ArrowDown')) z -= 1;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  return { x, z };
}

export function isFiring() {
  return firing;
}

export function takeMouseDelta() {
  const d = { x: mouseDX, y: mouseDY };
  mouseDX = 0;
  mouseDY = 0;
  return d;
}

export function endFrame() {
  pressed.clear();
}
