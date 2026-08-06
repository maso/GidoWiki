import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeopleState } from './peopleState.js';

test('initializes with first category active', () => {
  const state = createPeopleState();
  assert.equal(state.getActiveCategoryIndex(), 0);
  assert.equal(state.getActiveCategory().id, 'citizens');
  assert.equal(state.getItemsForCategory().length, 8);
});

test('steps categories with wraparound', () => {
  const state = createPeopleState();
  state.stepCategory(1);
  assert.equal(state.getActiveCategory().id, 'workers');
  state.stepCategory(1);
  assert.equal(state.getActiveCategory().id, 'subculture');
  state.stepCategory(1);
  assert.equal(state.getActiveCategory().id, 'rare');
  state.stepCategory(1);
  assert.equal(state.getActiveCategory().id, 'citizens');

  state.stepCategory(-1);
  assert.equal(state.getActiveCategory().id, 'rare');
});

test('tracks selected item index per category', () => {
  const state = createPeopleState();
  state.setSelectedItemIndex(3);
  assert.equal(state.getSelectedItem().name, '運動跑者');

  // Switch to category 2, should start at 0
  state.setCategoryIndex(1);
  assert.equal(state.getSelectedItemIndex(), 0);
  assert.equal(state.getSelectedItem().name, '美食外送員');

  // Switch back to category 1, should remember index 3
  state.setCategoryIndex(0);
  assert.equal(state.getSelectedItemIndex(), 3);
});

test('calculates total absorbed count and type statistics', () => {
  const state = createPeopleState();
  const totalAbsorbed = state.getTotalAbsorbedCount();
  assert.ok(totalAbsorbed > 4000);
  assert.equal(state.getUnlockedTypeCount(), 22);
  assert.equal(state.getTotalTypesCount(), 24);
});
