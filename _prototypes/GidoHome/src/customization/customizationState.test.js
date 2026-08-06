import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomizationState, findGridNeighbor } from './customizationState.js';

const skins = {
  alpha: [
    { id: 'base', unlocked: true },
    { id: 'alt', unlocked: true },
    { id: 'locked', unlocked: false, progress: 40 },
  ],
  beta: [
    { id: 'default', unlocked: true },
    { id: 'locked-beta', unlocked: false, progress: 10 },
  ],
};

const accessories = [
  { id: 'none', selectable: true, clearsAccessory: true },
  { id: 'top-hat', selectable: true },
  { id: 'locked-accessory', selectable: true, unlocked: false, progress: 25 },
  { id: 'later', selectable: false, comingSoon: true },
];

test('starts on the first character and its first unlocked skin', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins);

  assert.equal(state.getSelectedCharacterId(), 'alpha');
  assert.equal(state.getInspectedSkinId(), 'base');
  assert.equal(state.getEquippedSkinId('alpha'), 'base');
});

test('equips unlocked skins immediately', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins);
  const selection = state.inspectSkin('alt');

  assert.equal(selection.equipped, true);
  assert.equal(state.getInspectedSkinId(), 'alt');
  assert.equal(state.getEquippedSkinId('alpha'), 'alt');
});

test('inspects locked skins without equipping them', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins);
  const selection = state.inspectSkin('locked');

  assert.equal(selection.equipped, false);
  assert.equal(selection.skin.progress, 40);
  assert.equal(state.getInspectedSkinId(), 'locked');
  assert.equal(state.getEquippedSkinId('alpha'), 'base');
});

test('keeps equipped skins per character while switching characters', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins);
  state.inspectSkin('alt');
  state.selectCharacter('beta');

  assert.equal(state.getInspectedSkinId(), 'default');
  assert.equal(state.getEquippedSkinId('alpha'), 'alt');

  state.selectCharacter('alpha');
  assert.equal(state.getInspectedSkinId(), 'alt');
});

test('can replace a locked selection with a random allowed character', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins);
  state.selectCharacter('beta');

  assert.equal(state.selectRandomCharacter(['alpha'], () => 0.75), 'alpha');
  assert.equal(state.getSelectedCharacterId(), 'alpha');
  assert.equal(state.getInspectedSkinId(), 'base');
});

test('random character selection only considers valid candidate ids', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins);

  assert.equal(state.selectRandomCharacter(['missing', 'beta'], () => 0), 'beta');
  assert.equal(state.selectRandomCharacter([], () => 0), null);
  assert.equal(state.getSelectedCharacterId(), 'beta');
});

test('cycles through unlocked and locked skin entries with wraparound', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins);

  assert.equal(state.stepSkin(-1).skin.id, 'locked');
  assert.equal(state.stepSkin(1).skin.id, 'base');
});

test('equips accessories per character and rejects unavailable entries', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins, accessories);

  assert.equal(state.getEquippedAccessoryId(), 'none');
  assert.equal(state.equipAccessory('top-hat').id, 'top-hat');
  assert.equal(state.equipAccessory('later'), null);
  state.selectCharacter('beta');
  assert.equal(state.getEquippedAccessoryId(), 'none');
  state.selectCharacter('alpha');
  assert.equal(state.getEquippedAccessoryId(), 'top-hat');
  assert.equal(state.equipAccessory('none').clearsAccessory, true);
  assert.equal(state.getEquippedAccessoryId(), 'none');
});

test('inspects locked accessories without replacing the equipped accessory', () => {
  const state = createCustomizationState(['alpha', 'beta'], skins, accessories);
  state.equipAccessory('top-hat');
  const selection = state.inspectAccessory('locked-accessory');

  assert.equal(selection.equipped, false);
  assert.equal(selection.accessory.progress, 25);
  assert.equal(state.getInspectedAccessoryId(), 'locked-accessory');
  assert.equal(state.getEquippedAccessoryId(), 'top-hat');
});

test('navigates available character cards by their visual grid positions', () => {
  const available = [0, 1, 2, 3, 4, 5];

  assert.equal(findGridNeighbor(0, available, 'right'), 1);
  assert.equal(findGridNeighbor(1, available, 'right'), 2);
  assert.equal(findGridNeighbor(2, available, 'left'), 1);
  assert.equal(findGridNeighbor(0, available, 'down'), 3);
  assert.equal(findGridNeighbor(1, available, 'down'), 4);
  assert.equal(findGridNeighbor(2, available, 'down'), 5);
  assert.equal(findGridNeighbor(3, available, 'up'), 0);
  assert.equal(findGridNeighbor(4, available, 'left'), 3);
  assert.equal(findGridNeighbor(4, available, 'right'), 5);
  assert.equal(findGridNeighbor(5, available, 'down'), 5);
});
