/* ═══════════════════════════════════════
   EMOTE WHEEL DATA (表情輪盤)

   Six emotes laid out clockwise starting at 12 o'clock. Reorder or swap
   freely — the wheel derives its geometry from this array's length.

   `name` is shown under the glyph and used as the accessible label, so keep
   it short: the slot is 7em wide and longer strings wrap onto a second line.
═══════════════════════════════════════ */

export const EMOTES = [
  { id: 'attack', emoji: '⚔️', name: 'ATTACK' }, // 進攻
  { id: 'evade',  emoji: '🏃', name: 'EVADE' },  // 迴避
  { id: 'smash',  emoji: '🏚️', name: 'SMASH' },  // 打房子
  { id: 'item',   emoji: '🎁', name: 'ITEM' },   // 道具
  { id: 'angry',  emoji: '😡', name: 'ANGRY' },  // 生氣
  { id: 'happy',  emoji: '😄', name: 'HAPPY' },  // 開心
];
