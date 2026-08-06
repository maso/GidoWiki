/* ═══════════════════════════════════════
   BACKGROUND PICKER MODULE
═══════════════════════════════════════ */

export const BG_THEMES = [
  {
    id: 'default',
    label: '🌿 Lime',
    gradient: 'linear-gradient(135deg, #e4f77c 0%, #caed71 50%, #adfb6e 100%)',
    halftone: 'rgba(0, 180, 80, 0.14)',
    capsule1: 'rgba(180, 245, 248, 0.72)',
    capsule3: 'rgba(255, 214, 235, 0.65)',
  },
  {
    id: 'bubblegum',
    label: '🩷 Bubblegum',
    gradient: 'linear-gradient(135deg, #ffd6f0 0%, #ffb3e6 50%, #ff8ed6 100%)',
    halftone: 'rgba(220, 60, 150, 0.10)',
    capsule1: 'rgba(255, 200, 240, 0.75)',
    capsule3: 'rgba(180, 220, 255, 0.65)',
  },
  {
    id: 'sky',
    label: '🩵 Sky',
    gradient: 'linear-gradient(135deg, #b8f0ff 0%, #7dd8f8 50%, #4cc0f0 100%)',
    halftone: 'rgba(0, 130, 200, 0.10)',
    capsule1: 'rgba(255, 240, 180, 0.75)',
    capsule3: 'rgba(200, 255, 210, 0.65)',
  },
  {
    id: 'sunset',
    label: '🌅 Sunset',
    gradient: 'linear-gradient(135deg, #ffe8a0 0%, #ffbe6a 50%, #ff8c55 100%)',
    halftone: 'rgba(200, 80, 20, 0.10)',
    capsule1: 'rgba(255, 210, 180, 0.75)',
    capsule3: 'rgba(255, 240, 150, 0.65)',
  },
  {
    id: 'lavender',
    label: '💜 Lavender',
    gradient: 'linear-gradient(135deg, #e8d5ff 0%, #d0b0ff 50%, #b88aff 100%)',
    halftone: 'rgba(120, 40, 200, 0.10)',
    capsule1: 'rgba(240, 220, 255, 0.75)',
    capsule3: 'rgba(200, 240, 255, 0.65)',
  },
  {
    id: 'mint',
    label: '🌊 Mint',
    gradient: 'linear-gradient(135deg, #c8fff0 0%, #96f5e0 50%, #5eebc8 100%)',
    halftone: 'rgba(0, 160, 120, 0.12)',
    capsule1: 'rgba(200, 255, 240, 0.75)',
    capsule3: 'rgba(255, 220, 200, 0.65)',
  },
];

let isOpen = false;
let selectedId = 'default';
let cardFocusIdx = 0;
let lastCardNav = 0;
const CARD_NAV_COOLDOWN = 180;

// Held state for each button (prevent repeat-fire without cooldown)
let btnBWas = false;
let btnAWas = false;

export function initBgPicker(gs, callbacks = {}) {
  const leftPanel = document.getElementById('left-panel');
  const bottomBar = document.getElementById('bottom-bar');
  const picker    = document.getElementById('bg-picker');
  const brushBtn  = document.getElementById('btn-brush');
  const backBtn   = document.getElementById('btn-bg-back');
  const cardWrap  = document.getElementById('bg-card-wrap');

  const cards = []; // ordered list of card DOM elements

  // ── Build cards ──
  BG_THEMES.forEach((theme, i) => {
    const card = document.createElement('button');
    card.className = 'bg-card' + (theme.id === selectedId ? ' selected' : '');
    card.id = `bgcard-${theme.id}`;
    card.setAttribute('aria-label', theme.label);

    const swatch = document.createElement('div');
    swatch.className = 'bg-card-swatch';
    swatch.style.background = theme.gradient;

    const lbl = document.createElement('span');
    lbl.className = 'bg-card-label';
    lbl.textContent = theme.label;

    card.append(swatch, lbl);
    card.addEventListener('mouseenter', () => updateCardFocus(i));
    card.addEventListener('focus', () => updateCardFocus(i));
    card.addEventListener('click', () => {
      updateCardFocus(i);
      applyTheme(theme.id);
    });
    cardWrap.appendChild(card);
    cards.push(card);
  });

  // ── Card gamepad focus & selection ──
  function selectCard(newIdx) {
    newIdx = Math.max(0, Math.min(newIdx, cards.length - 1));
    cardFocusIdx = newIdx;
    cards[cardFocusIdx]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    applyTheme(BG_THEMES[cardFocusIdx]?.id);
  }

  function updateCardFocus(newIdx) {
    newIdx = Math.max(0, Math.min(newIdx, cards.length - 1));
    cardFocusIdx = newIdx;
    cards[cardFocusIdx]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function clearCardFocus() {
    cards.forEach(c => c.classList.remove('gp-focused'));
  }

  // ── Open / Close ──
  function open() {
    if (isOpen) return;
    isOpen = true;
    leftPanel.classList.add('slide-left');
    bottomBar.classList.add('slide-right');
    picker.classList.add('open');
    // Start gamepad focus on the currently selected card
    const startIdx = BG_THEMES.findIndex(t => t.id === selectedId);
    updateCardFocus(startIdx >= 0 ? startIdx : 0);
    callbacks.onOpen?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    leftPanel.classList.remove('slide-left');
    bottomBar.classList.remove('slide-right');
    picker.classList.remove('open');
    clearCardFocus();
    callbacks.onClose?.();
  }

  // ── Apply theme ──
  function applyTheme(id) {
    const theme = BG_THEMES.find(t => t.id === id);
    if (!theme) return;
    selectedId = id;

    gs.style.background = theme.gradient;

    const halftone = gs.querySelector('.bg-halftone');
    if (halftone) {
      halftone.style.backgroundImage =
        `radial-gradient(circle, ${theme.halftone} 1.8px, transparent 1.8px)`;
    }

    const caps = gs.querySelectorAll('.capsule');
    if (caps[0]) caps[0].style.background = theme.capsule1;
    if (caps[1]) caps[1].style.background = theme.capsule1;
    if (caps[2]) caps[2].style.background = theme.capsule3;
    if (caps[3]) caps[3].style.background = theme.capsule1;

    // Update selected highlight
    cards.forEach(c => c.classList.remove('selected'));
    document.getElementById(`bgcard-${id}`)?.classList.add('selected');
  }

  // ── Wire mouse / keyboard buttons ──
  brushBtn.addEventListener('click', () => { brushBtn.blur(); open(); });
  backBtn.addEventListener('click',  () => { backBtn.blur();  close(); });

  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); selectCard(cardFocusIdx - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); selectCard(cardFocusIdx + 1); }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      applyTheme(BG_THEMES[cardFocusIdx]?.id);
    }
  });

  // ── Gamepad polling (called from main loop) ──
  return {
    pollGamepad: () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;

        // ── B button: close picker (works whether open or not, safe) ──
        const btnB = gp.buttons[1]?.pressed;
        if (btnB && !btnBWas) {
          btnBWas = true;
          if (isOpen) close();
        } else if (!btnB) {
          btnBWas = false;
        }

        if (!isOpen) continue; // rest only applies when picker is open

        const now = performance.now();

        // ── Left / Right: navigate cards ──
        const btnLeft  = gp.buttons[14]?.pressed;
        const btnRight = gp.buttons[15]?.pressed;
        const stickX   = gp.axes[0] || 0;

        if (now - lastCardNav >= CARD_NAV_COOLDOWN) {
          if (btnLeft || stickX < -0.5) {
            lastCardNav = now;
            selectCard(cardFocusIdx - 1);
          } else if (btnRight || stickX > 0.5) {
            lastCardNav = now;
            selectCard(cardFocusIdx + 1);
          }
        }

        // ── A button: apply focused card's theme ──
        const btnA = gp.buttons[0]?.pressed;
        if (btnA && !btnAWas) {
          btnAWas = true;
          applyTheme(BG_THEMES[cardFocusIdx]?.id);
        } else if (!btnA) {
          btnAWas = false;
        }
      }
    },

    isOpen: () => isOpen,
  };
}
