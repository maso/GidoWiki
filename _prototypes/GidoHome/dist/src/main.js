import { setupScene } from './scene.js';
import { createCharacters } from './character.js';
import { initControls } from './controls.js';
import { initBgPicker } from './bgPicker.js';
import { initSkinPicker } from './customization/skinPicker.js';

const gs = document.getElementById('gs');
const wrap = document.getElementById('canvas-wrap');

// 1. Setup 3D Scene
const { scene, camera, renderer } = setupScene(wrap, gs);

// 2. Setup 3D Characters & Raycasting
const characterSystem = createCharacters(scene, camera, renderer, gs);

// 3. Setup Controls (Keyboard & Gamepad)
const controls = initControls();

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

// 6. Main Animation Loop
let clock = 0;
function animate() {
  requestAnimationFrame(animate);
  clock += 0.016;

  characterSystem.update(clock);
  controls.pollGamepad();
  bgPicker.pollGamepad();
  skinPicker.pollGamepad();

  renderer.render(scene, camera);
}

animate();
