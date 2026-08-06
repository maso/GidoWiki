import { HUMAN_CATEGORIES, HUMAN_ITEMS } from './peopleData.js';

export function createPeopleState(categories = HUMAN_CATEGORIES, items = HUMAN_ITEMS) {
  let activeCategoryIndex = 0;
  const categoryFocusIndices = new Array(categories.length).fill(0);

  function getActiveCategory() {
    return categories[activeCategoryIndex] || categories[0];
  }

  function getActiveCategoryIndex() {
    return activeCategoryIndex;
  }

  function setCategoryIndex(index) {
    if (index < 0 || index >= categories.length) return false;
    activeCategoryIndex = index;
    return true;
  }

  function stepCategory(direction) {
    const nextIndex = (activeCategoryIndex + direction + categories.length) % categories.length;
    activeCategoryIndex = nextIndex;
    return getActiveCategory();
  }

  function getItemsForCategory(categoryId = getActiveCategory()?.id) {
    return items.filter(item => item.categoryId === categoryId);
  }

  function getSelectedItemIndex() {
    return categoryFocusIndices[activeCategoryIndex] || 0;
  }

  function setSelectedItemIndex(index) {
    const categoryItems = getItemsForCategory();
    if (index < 0 || index >= categoryItems.length) return false;
    categoryFocusIndices[activeCategoryIndex] = index;
    return true;
  }

  function getSelectedItem() {
    const categoryItems = getItemsForCategory();
    const idx = getSelectedItemIndex();
    return categoryItems[idx] || categoryItems[0];
  }

  function getTotalAbsorbedCount() {
    return items.reduce((sum, item) => sum + (item.unlocked ? item.count : 0), 0);
  }

  function getUnlockedTypeCount() {
    return items.filter(item => item.unlocked && item.count > 0).length;
  }

  return {
    getCategories: () => categories,
    getActiveCategory,
    getActiveCategoryIndex,
    setCategoryIndex,
    stepCategory,
    getItemsForCategory,
    getSelectedItemIndex,
    setSelectedItemIndex,
    getSelectedItem,
    getTotalAbsorbedCount,
    getUnlockedTypeCount,
    getTotalTypesCount: () => items.length,
  };
}
