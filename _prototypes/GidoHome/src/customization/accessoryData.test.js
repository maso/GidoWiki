import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESSORY_ITEMS } from './accessoryData.js';

test('provides nine unlocked, three locked, and 18 coming-soon accessory slots', () => {
  assert.equal(ACCESSORY_ITEMS.length, 30);
  assert.equal(new Set(ACCESSORY_ITEMS.map(item => item.id)).size, 30);
  assert.deepEqual(ACCESSORY_ITEMS.slice(0, 9).map(item => item.id), [
    'none',
    'top-hat',
    'baseball-cap',
    'bull-horns',
    'rabbit-ears',
    'curled-mustache',
    'ninja-sword',
    'star-shades',
    'angel-wings',
  ]);
  assert.equal(ACCESSORY_ITEMS[0].clearsAccessory, true);
  assert.equal(ACCESSORY_ITEMS.slice(0, 9).every(item => (
    item.selectable && item.unlocked !== false
  )), true);
  assert.deepEqual(ACCESSORY_ITEMS.slice(9, 12).map(item => item.id), [
    'royal-crown',
    'headphones',
    'magic-wand',
  ]);
  assert.equal(ACCESSORY_ITEMS.slice(9, 12).every(item => (
    item.selectable && item.unlocked === false && item.unlockText && item.progress >= 0
  )), true);
  assert.equal(ACCESSORY_ITEMS.slice(12).every(item => (
    item.comingSoon && !item.selectable && item.name === 'COMMING SOON'
  )), true);
});
