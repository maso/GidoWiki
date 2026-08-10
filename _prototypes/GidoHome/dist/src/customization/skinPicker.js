import { CHARACTER_SKINS, COMING_SOON_SLOT_COUNT } from './skinData.js';
import { createCustomizationState, findGridNeighbor } from './customizationState.js';
import { createCustomizationGamepadNavigation } from './gamepadNavigation.js';
import { ACCESSORY_ITEMS } from './accessoryData.js';
import { inputMode } from '../input/inputMode.js';

export function initSkinPicker(characterSystem, callbacks = {}) {
  const elements = {
    picker: document.getElementById('skin-picker'),
    openButton: document.getElementById('btn-skin'),
    characterWrap: document.getElementById('character-card-wrap'),
    accessoryWrap: document.getElementById('accessory-card-wrap'),
    menuTitle: document.getElementById('customization-menu-title'),
    skinWrap: document.getElementById('skin-card-wrap'),
    characterName: document.getElementById('skin-character-name'),
    backButton: document.getElementById('btn-skin-back'),
    accessoryButton: document.getElementById('btn-accessory'),
    toggleIcon: document.getElementById('customization-toggle-icon'),
    toggleLabel: document.getElementById('customization-toggle-label'),
    previousSkinButton: document.getElementById('btn-skin-prev'),
    nextSkinButton: document.getElementById('btn-skin-next'),
    skinTray: document.getElementById('skin-tray'),
    unlockMessage: document.getElementById('skin-unlock-message'),
    unlockMessageText: document.getElementById('unlock-message-text'),
    leftPanel: document.getElementById('left-panel'),
    bottomBar: document.getElementById('bottom-bar'),
  };
  elements.unlockProgress = elements.unlockMessage.querySelector('.skin-unlock-progress');
  elements.unlockProgressFill = elements.unlockProgress.querySelector('span');
  elements.unlockPercent = document.getElementById('skin-unlock-percent');

  const characterIds = characterSystem.chars.map(character => character.id);
  const state = createCustomizationState(characterIds, CHARACTER_SKINS, ACCESSORY_ITEMS);
  const characterCards = [];
  const accessoryCards = [];
  let isOpen = false;
  let panelMode = 'character';
  let accessoryFocusIndex = 0;

  const unreadAccessories = new Set(['star-shades', 'angel-wings']);

  function updateUnreadBadges() {
    accessoryCards.forEach(({ accessory, card }) => {
      card.classList.toggle('has-unread', unreadAccessories.has(accessory.id));
    });
    const showButtonRedDot = panelMode === 'character' && unreadAccessories.size > 0;
    elements.accessoryButton.classList.toggle('has-unread', showButtonRedDot);

    const skinButton = document.getElementById('btn-skin');
    skinButton?.classList.toggle('has-unread', unreadAccessories.size > 0);
  }


  function markAccessoryVisited(accessoryId) {
    if (unreadAccessories.has(accessoryId)) {
      unreadAccessories.delete(accessoryId);
      updateUnreadBadges();
    }
  }

  function createCharacterCards() {
    const slots = [
      ...characterSystem.chars.map(character => ({
        id: character.id,
        name: character.name,
        color: CHARACTER_SKINS[character.id][0].color,
        characterType: character.characterType,
        accentColor: character.accentMat.color.getHex(),
        unlocked: !character.locked,
        selectable: true,
      })),
      ...Array.from({ length: COMING_SOON_SLOT_COUNT }, (_, index) => ({
        id: `coming-soon-${index}`,
        name: 'COMING SOON',
        unlocked: false,
        selectable: false,
        comingSoon: true,
      })),
    ];

    slots.forEach((slot, slotIndex) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `character-card${slot.unlocked ? '' : ' locked'}${slot.selectable ? ' selectable' : ' coming-soon'}`;
      card.disabled = !slot.selectable;
      card.setAttribute('aria-label', slot.selectable ? `選擇 ${slot.name}` : 'COMING SOON');

      if (slot.unlocked) {
        const color = slot.color.toString(16).padStart(6, '0');
        card.innerHTML = `<span class="mini-character" style="--char-color:#${color}"><i></i><i></i></span><strong>${slot.name}</strong>`;
        card.addEventListener('click', () => selectCharacter(slot.id, { replayTray: true }));
      } else if (slot.selectable) {
        const color = slot.color.toString(16).padStart(6, '0');
        const accentColor = slot.accentColor.toString(16).padStart(6, '0');
        card.innerHTML = `<span class="mini-character egg" style="--char-color:#${color};--egg-accent:#${accentColor}"><i></i><i></i></span><strong>${slot.name}</strong><small>LOCKED</small>`;
        card.addEventListener('click', () => selectCharacter(slot.id, { replayTray: true }));
      } else {
        card.innerHTML = `<strong>COMING<br>SOON</strong>`;
      }

      elements.characterWrap.appendChild(card);
      characterCards.push({ slot, card, slotIndex });
    });
  }

  function createAccessoryCards() {
    ACCESSORY_ITEMS.forEach((accessory, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `accessory-card${accessory.comingSoon ? ' coming-soon' : ''}${accessory.unlocked === false ? ' locked' : ''}`;
      card.disabled = !accessory.selectable;
      card.setAttribute(
        'aria-label',
        accessory.unlocked === false ? `${accessory.name} 尚未解鎖` : accessory.name,
      );
      card.innerHTML = accessory.comingSoon
        ? '<strong>COMING<br>SOON</strong>'
        : `<span>${accessory.icon}${accessory.unlocked === false ? '<b>🔒</b>' : ''}</span>${accessory.clearsAccessory ? `<small>${accessory.name}</small>` : ''}`;
      if (accessory.selectable) {
        card.addEventListener('mouseenter', () => updateAccessoryFocus(index));
        card.addEventListener('focus', () => updateAccessoryFocus(index, { scroll: false }));
        card.addEventListener('click', () => selectAccessory(index));
      }
      elements.accessoryWrap.appendChild(card);
      accessoryCards.push({ accessory, card });
    });
    updateUnreadBadges();
  }

  function renderAccessorySelection() {
    const inspectedAccessoryId = state.getInspectedAccessoryId();
    accessoryCards.forEach(({ accessory, card }) => {
      card.classList.toggle('selected', accessory.id === inspectedAccessoryId);
    });
    if (inspectedAccessoryId) {
      markAccessoryVisited(inspectedAccessoryId);
    }
  }

  function renderSkins() {
    elements.skinWrap.replaceChildren();
    state.getSkins().forEach((skin) => {
      const card = document.createElement('button');
      const isSelected = state.getInspectedSkinId() === skin.id;
      const color = skin.color.toString(16).padStart(6, '0');
      card.type = 'button';
      card.className = `skin-card${isSelected ? ' selected' : ''}${skin.unlocked ? '' : ' locked'}`;
      card.setAttribute('aria-label', skin.unlocked ? skin.name : `${skin.name} 尚未解鎖`);
      card.innerHTML = `<span class="skin-swatch" style="--skin-color:#${color}">${skin.unlocked ? '' : '<b>🔒</b>'}</span>`;
      card.addEventListener('click', () => handleSkinSelection(state.inspectSkin(skin.id)));
      elements.skinWrap.appendChild(card);
    });
  }

  function selectCharacter(characterId, { replayTray = false } = {}) {
    const didChange = state.getSelectedCharacterId() !== characterId;
    if (!state.selectCharacter(characterId)) return;
    const character = characterSystem.chars.find(candidate => candidate.id === characterId);
    if (!character) return;
    elements.picker.classList.toggle('locked-character', character.locked);
    if (character.locked) {
      showUnlockMessage(character.unlockProgress, character.unlockText);
    } else {
      hideUnlockMessage();
    }
    elements.characterName.textContent = character?.name || characterId;
    characterCards.forEach(({ slot, card }) => {
      card.classList.toggle('selected', slot.id === characterId);
    });
    characterSystem.selectCustomizationCharacter(characterId);
    renderSkins();
    renderAccessorySelection();
    if (replayTray && didChange && !character.locked) replaySkinTrayEntrance();
  }

  function handleSkinSelection(selection) {
    if (!selection) return;
    const characterId = state.getSelectedCharacterId();
    if (characterSystem.chars.find(character => character.id === characterId)?.locked) return;
    if (selection.equipped) {
      characterSystem.setCharacterColor(characterId, selection.skin.color);
      hideUnlockMessage();
    } else {
      showUnlockMessage(selection.skin.progress ?? 0);
    }
    renderSkins();
  }

  function stepSkin(direction) {
    const character = characterSystem.chars.find(candidate => candidate.id === state.getSelectedCharacterId());
    if (character?.locked) return;
    handleSkinSelection(state.stepSkin(direction));
  }

  function navigateCharacter(direction) {
    const currentSlotIndex = characterCards.find(
      ({ slot }) => slot.id === state.getSelectedCharacterId(),
    )?.slotIndex ?? 0;
    const availableIndices = characterCards
      .filter(({ slot }) => slot.selectable)
      .map(({ slotIndex }) => slotIndex);
    const nextSlotIndex = findGridNeighbor(currentSlotIndex, availableIndices, direction, 3);
    if (nextSlotIndex === currentSlotIndex) return;
    const nextCharacterId = characterCards[nextSlotIndex]?.slot.id;
    if (nextCharacterId) selectCharacter(nextCharacterId, { replayTray: true });
  }

  function updateAccessoryFocus(index, { scroll = true } = {}) {
    accessoryFocusIndex = Math.max(0, Math.min(index, accessoryCards.length - 1));
    accessoryCards.forEach(({ card }, cardIndex) => {
      card.classList.toggle('gp-focused', cardIndex === accessoryFocusIndex);
    });
    if (scroll) {
      accessoryCards[accessoryFocusIndex]?.card.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }
  }

  function navigateAccessory(direction) {
    const indices = accessoryCards
      .map(({ accessory }, index) => accessory.selectable ? index : null)
      .filter(index => index !== null);
    const nextIndex = findGridNeighbor(accessoryFocusIndex, indices, direction, 3);
    if (nextIndex !== accessoryFocusIndex) selectAccessory(nextIndex);
  }

  function selectAccessory(index = accessoryFocusIndex) {
    const entry = accessoryCards[index];
    if (!entry?.accessory.selectable) return;
    const selection = state.inspectAccessory(entry.accessory.id);
    if (!selection) return;
    updateAccessoryFocus(index);
    if (selection.equipped) {
      characterSystem.setCharacterAccessory(
        state.getSelectedCharacterId(),
        selection.accessory.id,
      );
      hideUnlockMessage();
    } else {
      showUnlockMessage(
        selection.accessory.progress ?? 0,
        selection.accessory.unlockText,
      );
    }
    renderAccessorySelection();
  }

  function navigateCurrentMenu(direction) {
    if (panelMode === 'accessory') navigateAccessory(direction);
    else navigateCharacter(direction);
  }

  function replaySkinTrayEntrance() {
    elements.skinTray.classList.remove('reentering');
    void elements.skinTray.offsetWidth;
    elements.skinTray.classList.add('reentering');
  }

  function showUnlockMessage(progress, message = '完成100次巨獸對決以解鎖這個Skin') {
    const value = Math.max(0, Math.min(100, progress));
    elements.unlockMessage.classList.add('show');
    elements.unlockMessageText.textContent = message;
    elements.unlockProgress.setAttribute('aria-valuenow', String(value));
    elements.unlockProgressFill.style.width = `${value}%`;
    elements.unlockPercent.textContent = `${value}%`;
  }

  function hideUnlockMessage() {
    elements.unlockMessage.classList.remove('show');
  }

  function pulseAccessory() {
    elements.accessoryButton.animate(
      [{ transform: 'rotate(-2deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0)' }],
      { duration: 260 },
    );
  }

  function setPanelMode(mode) {
    if (mode === panelMode) return;
    panelMode = mode;
    const accessoryMode = panelMode === 'accessory';
    elements.picker.classList.toggle('accessory-mode', accessoryMode);
    elements.menuTitle.textContent = accessoryMode ? 'ACCESSORY' : 'CHARACTER';
    elements.toggleIcon.textContent = accessoryMode ? '👤' : '🎩';
    elements.toggleLabel.textContent = accessoryMode ? 'CHARACTER' : 'ACCESSORY';
    elements.accessoryButton.title = accessoryMode
      ? '切換至 Character 選單'
      : '切換至 Accessory 選單';

    if (accessoryMode) {
      const inspectedIndex = accessoryCards.findIndex(({ accessory }) => (
        accessory.id === state.getInspectedAccessoryId()
      ));
      updateAccessoryFocus(Math.max(0, inspectedIndex), { scroll: false });
      elements.accessoryWrap.scrollTop = 0;
      const inspectedAccessory = ACCESSORY_ITEMS.find(
        accessory => accessory.id === state.getInspectedAccessoryId(),
      );
      if (inspectedAccessory?.unlocked === false) {
        showUnlockMessage(
          inspectedAccessory.progress ?? 0,
          inspectedAccessory.unlockText,
        );
      } else {
        hideUnlockMessage();
      }
    } else {
      hideUnlockMessage();
      const inspectedSkin = state.getSkins().find(skin => skin.id === state.getInspectedSkinId());
      if (inspectedSkin && !inspectedSkin.unlocked) {
        showUnlockMessage(inspectedSkin.progress ?? 0);
      }
    }
    updateUnreadBadges();
  }

  function toggleAccessoryMenu() {
    const character = characterSystem.chars.find(candidate => candidate.id === state.getSelectedCharacterId());
    if (!isOpen || character?.locked) return;
    pulseAccessory();
    setPanelMode(panelMode === 'character' ? 'accessory' : 'character');
  }

  function open() {
    if (isOpen) return;
    if (panelMode !== 'character') setPanelMode('character');
    const previousCharacter = characterSystem.chars.find(
      character => character.id === state.getSelectedCharacterId(),
    );
    if (previousCharacter?.locked) {
      const unlockedCharacterIds = characterSystem.chars
        .filter(character => !character.locked)
        .map(character => character.id);
      state.selectRandomCharacter(unlockedCharacterIds);
    }
    isOpen = true;
    elements.picker.classList.add('open');
    elements.picker.setAttribute('aria-hidden', 'false');
    elements.leftPanel?.classList.add('slide-left');
    elements.bottomBar?.classList.add('slide-right');
    const selectedCharacterId = state.getSelectedCharacterId();
    characterSystem.setCustomizationMode(true, selectedCharacterId);
    selectCharacter(selectedCharacterId);
    callbacks.onOpen?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    elements.picker.classList.remove('open');
    elements.picker.setAttribute('aria-hidden', 'true');
    elements.leftPanel?.classList.remove('slide-left');
    elements.bottomBar?.classList.remove('slide-right');
    characterSystem.setCustomizationMode(false);
    callbacks.onClose?.();
  }

  createCharacterCards();
  createAccessoryCards();
  elements.openButton.addEventListener('click', () => {
    elements.openButton.blur();
    open();
  });
  elements.backButton.addEventListener('click', close);
  elements.previousSkinButton.addEventListener('click', () => stepSkin(-1));
  elements.nextSkinButton.addEventListener('click', () => stepSkin(1));
  elements.accessoryButton.addEventListener('click', toggleAccessoryMenu);
  elements.skinTray.addEventListener('animationend', () => {
    elements.skinTray.classList.remove('reentering');
  });
  // Shoulder-button hints follow the active input device (Q/E vs LB/RB)
  function applyShoulderLabel(button, label) {
    if (!button) return;
    button.textContent = label;
    button.classList.toggle('wide-label', label.length > 1);
  }

  inputMode.subscribe(() => {
    const labels = inputMode.getShoulderLabels();
    applyShoulderLabel(elements.previousSkinButton, labels.left);
    applyShoulderLabel(elements.nextSkinButton, labels.right);
  });

  window.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    // Q / E are the keyboard equivalents of the LB / RB shoulder buttons
    if (event.key === 'q' || event.key === 'Q') {
      event.preventDefault();
      stepSkin(-1);
      return;
    }
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      stepSkin(1);
    }
  });

  const gamepadNavigation = createCustomizationGamepadNavigation({
    isOpen: () => isOpen,
    onBack: close,
    onAccessory: toggleAccessoryMenu,
    onStepSkin: stepSkin,
    onNavigateCharacter: navigateCurrentMenu,
    onConfirm: () => {
      if (panelMode === 'accessory') selectAccessory();
    },
  });

  return {
    isOpen: () => isOpen,
    close,
    pollGamepad: () => gamepadNavigation.poll(),
  };
}
