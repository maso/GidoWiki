import { createPeopleState } from './peopleState.js';
import { createPeopleGamepadNavigation } from './gamepadNavigation.js';
import { findGridNeighbor } from '../customization/customizationState.js';
import { inputMode } from '../input/inputMode.js';

export function initPeoplePicker(callbacks = {}) {
  const elements = {
    picker: document.getElementById('people-picker'),
    openButton: document.getElementById('btn-people'),
    tabWrap: document.getElementById('people-tab-wrap'),
    cardWrap: document.getElementById('people-card-wrap'),
    backButton: document.getElementById('btn-people-back'),
    totalAbsorbedText: document.getElementById('people-total-absorbed'),
    typeStatsText: document.getElementById('people-type-stats'),
    leftPanel: document.getElementById('left-panel'),
    bottomBar: document.getElementById('bottom-bar'),
  };

  const state = createPeopleState();
  const humanCards = []; // { item, card, index }
  let isOpen = false;

  function applyBadgeLabel(badge, label) {
    if (!badge) return;
    badge.textContent = label;
    badge.classList.toggle('wide-label', label.length > 1);
  }

  function renderCategoryTabs() {
    if (!elements.tabWrap) return;
    elements.tabWrap.replaceChildren();

    // Left shoulder badge — label follows the active input device (Q vs LB)
    const badgeL = document.createElement('span');
    badgeL.className = 'people-tab-badge';
    applyBadgeLabel(badgeL, inputMode.getShoulderLabels().left);
    elements.tabWrap.appendChild(badgeL);

    state.getCategories().forEach((cat, index) => {
      const tab = document.createElement('button');
      const isActive = index === state.getActiveCategoryIndex();
      tab.type = 'button';
      tab.className = `people-tab${isActive ? ' active' : ''}`;
      tab.innerHTML = `<span>${cat.icon}</span><strong>${cat.name}</strong>`;
      tab.addEventListener('click', () => switchCategory(index));
      elements.tabWrap.appendChild(tab);
    });

    // Right shoulder badge — label follows the active input device (E vs RB)
    const badgeR = document.createElement('span');
    badgeR.className = 'people-tab-badge';
    applyBadgeLabel(badgeR, inputMode.getShoulderLabels().right);
    elements.tabWrap.appendChild(badgeR);

  }

  // Re-label the badges in place when the player switches device mid-panel
  inputMode.subscribe(() => {
    if (!elements.tabWrap) return;
    const badges = elements.tabWrap.querySelectorAll('.people-tab-badge');
    if (badges.length < 2) return;
    const labels = inputMode.getShoulderLabels();
    applyBadgeLabel(badges[0], labels.left);
    applyBadgeLabel(badges[badges.length - 1], labels.right);
  });

  function renderGridCards() {
    if (!elements.cardWrap) return;
    elements.cardWrap.replaceChildren();
    humanCards.length = 0;

    const items = state.getItemsForCategory();
    const selectedIdx = state.getSelectedItemIndex();

    items.forEach((item, index) => {
      const card = document.createElement('button');
      const isSelected = index === selectedIdx;
      card.type = 'button';
      card.className = `human-card${item.unlocked ? '' : ' locked'}${isSelected ? ' selected' : ''}`;
      card.setAttribute('aria-label', item.unlocked ? `${item.name} 吸收數 ${item.count}` : `${item.name} 未解鎖`);

      if (item.unlocked) {
        card.innerHTML = `
          <div class="human-avatar">${item.icon}</div>
          <strong class="human-title">${item.name}</strong>
          <div class="human-count-badge">${item.count}</div>
        `;
      } else {
        card.innerHTML = `
          <div class="human-avatar locked-avatar">?</div>
          <strong class="human-title">???</strong>
          <div class="human-count-badge locked-badge">0</div>
        `;
      }


      card.addEventListener('click', () => updateFocusIndex(index));
      elements.cardWrap.appendChild(card);

      humanCards.push({ item, card, index });
    });

    updateStatsDisplay();
  }

  function updateFocusIndex(index) {
    if (!state.setSelectedItemIndex(index)) return;
    const selectedIdx = state.getSelectedItemIndex();
    humanCards.forEach(({ card }, idx) => {
      card.classList.toggle('selected', idx === selectedIdx);
    });
    humanCards[selectedIdx]?.card.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }

  function switchCategory(index) {
    if (!state.setCategoryIndex(index)) return;
    renderCategoryTabs();
    renderGridCards();
  }

  function stepCategory(direction) {
    state.stepCategory(direction);
    renderCategoryTabs();
    renderGridCards();
  }

  function navigateGrid(direction) {
    const categoryItems = state.getItemsForCategory();
    const currentIdx = state.getSelectedItemIndex();
    const availableIndices = categoryItems.map((_, idx) => idx);
    const nextIdx = findGridNeighbor(currentIdx, availableIndices, direction, 4); // 4 columns
    if (nextIdx !== currentIdx) {
      updateFocusIndex(nextIdx);
    }
  }

  function updateStatsDisplay() {
    if (elements.totalAbsorbedText) {
      elements.totalAbsorbedText.textContent = `${state.getTotalAbsorbedCount().toLocaleString()}人`;
    }
    if (elements.typeStatsText) {
      elements.typeStatsText.textContent = `${state.getUnlockedTypeCount()} / ${state.getTotalTypesCount()} 款`;
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    elements.picker?.classList.add('open');
    elements.picker?.setAttribute('aria-hidden', 'false');
    elements.leftPanel?.classList.add('slide-left');
    elements.bottomBar?.classList.add('slide-right');

    renderCategoryTabs();
    renderGridCards();
    updateFocusIndex(state.getSelectedItemIndex());
    callbacks.onOpen?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    elements.picker?.classList.remove('open');
    elements.picker?.setAttribute('aria-hidden', 'true');
    elements.leftPanel?.classList.remove('slide-left');
    elements.bottomBar?.classList.remove('slide-right');
    callbacks.onClose?.();
  }

  if (elements.openButton) {
    elements.openButton.addEventListener('click', () => {
      elements.openButton.blur();
      open();
    });
  }

  if (elements.backButton) {
    elements.backButton.addEventListener('click', close);
  }

  window.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'q' || event.key === 'Q' || event.key === '[') {
      event.preventDefault();
      stepCategory(-1);
      return;
    }
    if (event.key === 'e' || event.key === 'E' || event.key === ']') {
      event.preventDefault();
      stepCategory(1);
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const dirMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      navigateGrid(dirMap[event.key]);
    }
  });

  const gamepadNavigation = createPeopleGamepadNavigation({
    isOpen: () => isOpen,
    onBack: close,
    onStepCategory: stepCategory,
    onNavigateGrid: navigateGrid,
    onConfirm: () => updateFocusIndex(state.getSelectedItemIndex()),
  });


  return {
    isOpen: () => isOpen,
    open,
    close,
    pollGamepad: () => gamepadNavigation.poll(),
  };
}
