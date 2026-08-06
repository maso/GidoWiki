import * as THREE from 'three';

/* ═══════════════════════════════════════
   3D RAYCASTER & INTERACTION MODULE
═══════════════════════════════════════ */

export function setupRaycaster(camera, renderer, gsElement, getTargets, onHit) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function getNDC(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  // Mouse move hover feedback (cursor: pointer)
  window.addEventListener('mousemove', (e) => {
    const m = getNDC(e);
    mouse.x = m.x;
    mouse.y = m.y;
    raycaster.setFromCamera(mouse, camera);

    const targets = getTargets();
    let hovered = false;
    for (const target of targets) {
      if (raycaster.intersectObjects(target.group.children, true).length > 0) {
        hovered = true;
        break;
      }
    }
    gsElement.style.cursor = hovered ? 'pointer' : '';
  });

  // Click handler
  window.addEventListener('click', (e) => {
    const m = getNDC(e);
    mouse.x = m.x;
    mouse.y = m.y;
    raycaster.setFromCamera(mouse, camera);

    const targets = getTargets();
    for (const target of targets) {
      const hits = raycaster.intersectObjects(target.group.children, true);
      if (hits.length > 0) {
        onHit(target);
        break;
      }
    }
  });
}
