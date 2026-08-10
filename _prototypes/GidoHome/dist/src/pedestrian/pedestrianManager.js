import * as THREE from 'three';
import { mkPedestrian } from './pedestrianFactory.js';

/* ═══════════════════════════════════════
   3D PEDESTRIAN (路人) MANAGER & ROAMING AI
═══════════════════════════════════════ */

const PEDESTRIAN_ROAM = {
  xMin: -3.2,
  xMax: 3.2,
  zMin: -2.2,
  zMax: 2.2,
};

export function createPedestrians(scene) {
  const pedestrians = [];

  function pickRandomDestination(currentPos) {
    let nx, nz;
    let attempts = 0;
    do {
      nx = PEDESTRIAN_ROAM.xMin + Math.random() * (PEDESTRIAN_ROAM.xMax - PEDESTRIAN_ROAM.xMin);
      nz = PEDESTRIAN_ROAM.zMin + Math.random() * (PEDESTRIAN_ROAM.zMax - PEDESTRIAN_ROAM.zMin);
      attempts++;
    } while (currentPos && Math.hypot(nx - currentPos.x, nz - currentPos.z) < 1.2 && attempts < 10);

    return new THREE.Vector3(nx, 0, nz);
  }

  function spawnPedestrian(options = {}) {
    const {
      x = 0,
      z = 0.5,
      shirtColor = 0x3b5998,
      pantsColor = 0x2f3542,
      hairColor = 0x3d2314,
      moveSpeed = 0.95,
    } = options;

    const ped = mkPedestrian({ shirtColor, pantsColor, hairColor });
    ped.grp.position.set(x, 0, z);
    scene.add(ped.grp);

    const pedObj = {
      ...ped,
      moveSpeed,
      walkState: 'idle', // 'idle' | 'walking'
      walkTarget: pickRandomDestination(ped.grp.position),
      idleTimer: 1.0 + Math.random() * 2.0,
      walkPhase: Math.random() * Math.PI * 2,
      currentFacing: 0,
    };

    pedestrians.push(pedObj);
    return pedObj;
  }

  // Initial single pedestrian spawn as requested by user
  spawnPedestrian({
    x: 0,
    z: 0.8,
    shirtColor: 0x3b5998, // Navy Blue shirt
    pantsColor: 0x2f3542, // Dark Slate pants
    hairColor: 0x3d2314,  // Dark Brown hair
  });

  function update(dt) {
    pedestrians.forEach((p) => {
      const pos = p.grp.position;

      if (p.walkState === 'walking') {
        p.walkPhase += dt * 10;

        const dx = p.walkTarget.x - pos.x;
        const dz = p.walkTarget.z - pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.12) {
          // Reached destination -> switch to idle
          p.walkState = 'idle';
          p.idleTimer = 1.2 + Math.random() * 2.5;
        } else {
          // Move towards target
          const targetAngle = Math.atan2(dx, dz);
          // Smooth rotation lerp
          let diff = targetAngle - p.currentFacing;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          p.currentFacing += diff * Math.min(1, dt * 7.5);
          p.grp.rotation.y = p.currentFacing;

          const step = Math.min(dist, p.moveSpeed * dt);
          pos.x += Math.sin(p.currentFacing) * step;
          pos.z += Math.cos(p.currentFacing) * step;

          // Walking limb animation
          p.legGrpL.rotation.x = Math.sin(p.walkPhase) * 0.62;
          p.legGrpR.rotation.x = -Math.sin(p.walkPhase) * 0.62;
          p.armGrpL.rotation.x = -Math.sin(p.walkPhase) * 0.52;
          p.armGrpR.rotation.x = Math.sin(p.walkPhase) * 0.52;
          p.upperGrp.position.y = Math.abs(Math.sin(p.walkPhase * 2)) * 0.035;
        }
      } else {
        // Idle state -> decay leg/arm rotations and count down idle timer
        p.legGrpL.rotation.x *= 0.84;
        p.legGrpR.rotation.x *= 0.84;
        p.armGrpL.rotation.x *= 0.84;
        p.armGrpR.rotation.x *= 0.84;
        p.upperGrp.position.y *= 0.84;

        p.idleTimer -= dt;
        if (p.idleTimer <= 0) {
          p.walkTarget = pickRandomDestination(pos);
          p.walkState = 'walking';
        }
      }
    });
  }

  return {
    pedestrians,
    spawnPedestrian,
    update,
  };
}
