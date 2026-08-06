/**
 * Owns customization selections without knowing about DOM, Three.js, or input devices.
 * Locked skins may be inspected, but only unlocked skins become equipped.
 */
export function createCustomizationState(characterIds, skinsByCharacter, accessoryItems = []) {
  if (!characterIds.length) throw new Error('Customization requires at least one character.');

  const equippedSkins = Object.fromEntries(characterIds.map((characterId) => {
    const defaultSkin = skinsByCharacter[characterId]?.find(skin => skin.unlocked);
    if (!defaultSkin) throw new Error(`Character "${characterId}" needs an unlocked default skin.`);
    return [characterId, defaultSkin.id];
  }));
  const defaultAccessory = accessoryItems.find(accessory => (
    accessory.selectable && accessory.clearsAccessory
  ));
  const equippedAccessories = Object.fromEntries(
    characterIds.map(characterId => [characterId, defaultAccessory?.id ?? null]),
  );

  let selectedCharacterId = characterIds[0];
  let inspectedSkinId = equippedSkins[selectedCharacterId];
  let inspectedAccessoryId = equippedAccessories[selectedCharacterId];

  function getSkins(characterId = selectedCharacterId) {
    return skinsByCharacter[characterId] || [];
  }

  function selectCharacter(characterId) {
    if (!characterIds.includes(characterId)) return false;
    selectedCharacterId = characterId;
    inspectedSkinId = equippedSkins[characterId];
    inspectedAccessoryId = equippedAccessories[characterId];
    return true;
  }

  function inspectSkin(skinId) {
    const skin = getSkins().find(candidate => candidate.id === skinId);
    if (!skin) return null;
    inspectedSkinId = skin.id;
    if (skin.unlocked) equippedSkins[selectedCharacterId] = skin.id;
    return { skin, equipped: skin.unlocked };
  }

  function stepSkin(direction) {
    const skins = getSkins();
    if (!skins.length) return null;
    const currentIndex = Math.max(0, skins.findIndex(skin => skin.id === inspectedSkinId));
    const nextIndex = (currentIndex + direction + skins.length) % skins.length;
    return inspectSkin(skins[nextIndex].id);
  }

  function stepCharacter(direction) {
    const currentIndex = Math.max(0, characterIds.indexOf(selectedCharacterId));
    const nextIndex = (currentIndex + direction + characterIds.length) % characterIds.length;
    selectCharacter(characterIds[nextIndex]);
    return selectedCharacterId;
  }

  function selectRandomCharacter(candidateIds, random = Math.random) {
    const availableIds = candidateIds.filter(characterId => characterIds.includes(characterId));
    if (!availableIds.length) return null;
    const randomIndex = Math.min(
      availableIds.length - 1,
      Math.floor(Math.max(0, random()) * availableIds.length),
    );
    selectCharacter(availableIds[randomIndex]);
    return selectedCharacterId;
  }

  function inspectAccessory(accessoryId) {
    const accessory = accessoryItems.find(candidate => candidate.id === accessoryId);
    if (!accessory?.selectable) return null;
    inspectedAccessoryId = accessory.id;
    const equipped = accessory.unlocked !== false;
    if (equipped) equippedAccessories[selectedCharacterId] = accessory.id;
    return { accessory, equipped };
  }

  function equipAccessory(accessoryId) {
    const selection = inspectAccessory(accessoryId);
    return selection?.equipped ? selection.accessory : null;
  }

  return {
    getSelectedCharacterId: () => selectedCharacterId,
    getInspectedSkinId: () => inspectedSkinId,
    getInspectedAccessoryId: () => inspectedAccessoryId,
    getEquippedSkinId: characterId => equippedSkins[characterId],
    getEquippedAccessoryId: (characterId = selectedCharacterId) => equippedAccessories[characterId],
    getSkins,
    selectCharacter,
    inspectSkin,
    stepSkin,
    stepCharacter,
    selectRandomCharacter,
    inspectAccessory,
    equipAccessory,
  };
}

/** Finds the nearest available card in a visual grid without selecting locked slots. */
export function findGridNeighbor(currentIndex, availableIndices, direction, columns = 3) {
  const currentRow = Math.floor(currentIndex / columns);
  const currentColumn = currentIndex % columns;
  const candidates = availableIndices.filter((index) => {
    if (index === currentIndex) return false;
    const row = Math.floor(index / columns);
    const column = index % columns;
    if (direction === 'left') return row === currentRow && column < currentColumn;
    if (direction === 'right') return row === currentRow && column > currentColumn;
    if (direction === 'up') return row < currentRow;
    if (direction === 'down') return row > currentRow;
    return false;
  });

  candidates.sort((a, b) => {
    const aRow = Math.floor(a / columns);
    const bRow = Math.floor(b / columns);
    const aColumn = a % columns;
    const bColumn = b % columns;
    if (direction === 'left' || direction === 'right') {
      return Math.abs(aColumn - currentColumn) - Math.abs(bColumn - currentColumn);
    }
    const rowDistance = Math.abs(aRow - currentRow) - Math.abs(bRow - currentRow);
    return rowDistance || Math.abs(aColumn - currentColumn) - Math.abs(bColumn - currentColumn);
  });

  return candidates[0] ?? currentIndex;
}
