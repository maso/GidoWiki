import * as THREE from 'three';

/* ═══════════════════════════════════════
   THREE.JS MATERIALS & TOON SHADERS
═══════════════════════════════════════ */

/**
 * Creates a clean, vibrant Toon material without color-darkening texture ramps
 * @param {number} hex - Color hex value
 */
export function toon(hex) {
  return new THREE.MeshToonMaterial({
    color: hex
  });
}

/**
 * Creates a solid unlit Basic material
 * @param {number} hex - Color hex value
 */
export function solid(hex) {
  return new THREE.MeshBasicMaterial({ color: hex });
}
