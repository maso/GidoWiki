import { setupScene } from './scene.js';

import { createCharacters } from './character.js';
import { createPedestrians } from './pedestrian.js';
import { initControls } from './controls.js';
import { initBgPicker } from './bgPicker.js';
import { initSkinPicker } from './customization/skinPicker.js';
import { initPeoplePicker } from './people.js';
import { initInputMode } from './input/inputMode.js';
import { initEmoteWheel } from './emote/emoteWheel.js';
import { APP_VERSION } from './version.js';

const gs = document.getElementById('gs');
const wrap = document.getElementById('canvas-wrap');
const versionBadge = document.getElementById('version-badge');
if (versionBadge) versionBadge.textContent = APP_VERSION;

// 1. Setup 3D Scene
const { scene, camera, renderer } = setupScene(wrap, gs);

// 2. Setup 3D Characters & Pedestrians
const characterSystem = createCharacters(scene, camera, renderer, gs);
const pedestrianSystem = createPedestrians(scene);

// 3. Setup Controls (Keyboard & Gamepad) + active input device detection
const controls = initControls();
const inputModeControl = initInputMode();

// 4. Setup Background Picker
const bgPicker = initBgPicker(gs, {
  onOpen:  () => controls.setBlocked(true),
  onClose: () => controls.setBlocked(false),
});

// 5. Setup Character Skin Picker
const skinPicker = initSkinPicker(characterSystem, {
  onOpen:  () => controls.setBlocked(true),
  onClose: () => controls.setBlocked(false),
});

// 6. Setup Human Encyclopedia Picker
const peoplePicker = initPeoplePicker({
  onOpen:  () => controls.setBlocked(true),
  onClose: () => controls.setBlocked(false),
});

// 7. Setup Emote Wheel (home screen only — suppressed while a panel is open)
const emoteWheel = initEmoteWheel({
  isSuppressed: () => bgPicker.isOpen?.() || skinPicker.isOpen() || peoplePicker.isOpen(),
  onSelect: emote => characterSystem.showEmote(emote.emoji),
  onOpen: () => {
    controls.setBlocked(true);
    characterSystem.setInteractionBlocked(true);
  },
  onClose: () => {
    controls.setBlocked(false);
    characterSystem.setInteractionBlocked(false);
  },
});

// 8. Main Animation Loop
let clock = 0;
let lastTime = performance.now();

function animate(currentTime = performance.now()) {
  requestAnimationFrame(animate);

  const delta = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // Cap dt to max 0.1s to prevent animation jumps when returning from background tabs
  const dt = Math.min(Math.max(delta, 0), 0.1);
  clock += dt;

  characterSystem.update(clock);
  pedestrianSystem.update(dt, characterSystem.chars);

  // Must run before the panel polls so hint labels reflect this frame's device
  inputModeControl.pollGamepad();

  controls.pollGamepad();
  bgPicker.pollGamepad();
  skinPicker.pollGamepad();
  peoplePicker.pollGamepad();
  emoteWheel.poll();

  renderer.render(scene, camera);
}

animate();

