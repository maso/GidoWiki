import * as THREE from 'three';
import { mkPedestrian } from './pedestrianFactory.js';

/* ═══════════════════════════════════════
   3D PEDESTRIAN (路人) MANAGER & AI
   - Manages crowd of 10 randomized pedestrians
   - Panic run animation & flee AI near Gido monsters (excluding eggs)
═══════════════════════════════════════ */

const PEDESTRIAN_ROAM = {
  xMin: -6.5,
  xMax: 6.5,
  zMin: -4.2,
  zMax: 4.5,
};

const PANIC_DISTANCE = 2.2; // Trigger distance to flee
const CALM_DISTANCE = 3.4;  // Distance to calm down

const PALETTES = {
  skins:  [0xffd11a, 0xffd1a4, 0xe5b88f, 0x9e6843, 0xffc3a0],
  shirts: [0x3b5998, 0xee5253, 0x10ac84, 0xff6b6b, 0xff9f43, 0x0abde3, 0x5f27cd, 0x341f97],
  pants:  [0x2f3542, 0xd4a373, 0x222f3e, 0x1e1e24, 0x576574],
  hairs:  [0x3d2314, 0x1e1e24, 0xf6e58d, 0x833471, 0x574b90],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createPedestrians(scene) {
  const pedestrians = [];

  function pickRandomDestination(currentPos) {
    let nx, nz;
    let attempts = 0;
    do {
      nx = PEDESTRIAN_ROAM.xMin + Math.random() * (PEDESTRIAN_ROAM.xMax - PEDESTRIAN_ROAM.xMin);
      nz = PEDESTRIAN_ROAM.zMin + Math.random() * (PEDESTRIAN_ROAM.zMax - PEDESTRIAN_ROAM.zMin);
      attempts++;
    } while (currentPos && Math.hypot(nx - currentPos.x, nz - currentPos.z) < 1.8 && attempts < 10);

    return new THREE.Vector3(nx, 0, nz);
  }

  function spawnPedestrian(options = {}) {
    const {
      x = 0,
      z = 0.5,
      skinColor = pickRandom(PALETTES.skins),
      shirtColor = pickRandom(PALETTES.shirts),
      pantsColor = pickRandom(PALETTES.pants),
      hairColor = pickRandom(PALETTES.hairs),
      moveSpeed = 0.85 + Math.random() * 0.3,
      runSpeed = 2.3 + Math.random() * 0.4,
    } = options;

    const ped = mkPedestrian({ skinColor, shirtColor, pantsColor, hairColor });
    ped.grp.position.set(x, 0, z);
    scene.add(ped.grp);

    const pedObj = {
      ...ped,
      moveSpeed,
      runSpeed,
      walkState: 'idle', // 'idle' | 'walking' | 'panicked'
      walkTarget: pickRandomDestination(ped.grp.position),
      idleTimer: 0.5 + Math.random() * 2.5,
      walkPhase: Math.random() * Math.PI * 2,
      currentFacing: Math.random() * Math.PI * 2,
    };

    pedestrians.push(pedObj);
    return pedObj;
  }

  // Spawn 10 diverse pedestrians staggered across the scene
  const initialPositions = [
    { x:  0.0, z:  1.2 },
    { x: -2.8, z: -1.5 },
    { x:  3.2, z: -0.8 },
    { x: -4.5, z:  2.1 },
    { x:  4.8, z:  1.8 },
    { x: -1.5, z:  3.5 },
    { x:  2.1, z:  3.8 },
    { x: -5.2, z: -2.8 },
    { x:  5.4, z: -2.4 },
    { x: -3.8, z:  0.4 },
  ];

  initialPositions.forEach(pos => spawnPedestrian({ x: pos.x, z: pos.z }));

  function update(dt, characters = []) {
    // Filter active non-egg Gido monsters
    const monsters = characters.filter(c => c && c.characterType !== 'egg' && c.grp);

    pedestrians.forEach((p) => {
      const pos = p.grp.position;

      // ── Find nearest Gido monster ──
      let nearestMonster = null;
      let nearestDist = Infinity;

      monsters.forEach((m) => {
        const mPos = m.grp.position;
        const d = Math.hypot(pos.x - mPos.x, pos.z - mPos.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestMonster = m;
        }
      });

      // ── Panic AI State Transition ──
      if (nearestMonster && nearestDist < PANIC_DISTANCE) {
        p.walkState = 'panicked';
        // Calculate flee direction away from monster
        const mPos = nearestMonster.grp.position;
        const angleAway = Math.atan2(pos.x - mPos.x, pos.z - mPos.z);
        const escapeX = Math.max(PEDESTRIAN_ROAM.xMin, Math.min(PEDESTRIAN_ROAM.xMax, pos.x + Math.sin(angleAway) * 4.5));
        const escapeZ = Math.max(PEDESTRIAN_ROAM.zMin, Math.min(PEDESTRIAN_ROAM.zMax, pos.z + Math.cos(angleAway) * 4.5));
        p.walkTarget.set(escapeX, 0, escapeZ);
      } else if (p.walkState === 'panicked' && nearestDist > CALM_DISTANCE) {
        // Safe distance reached -> calm down
        p.walkState = 'walking';
        p.walkTarget = pickRandomDestination(pos);
      }

      // ── Motion & Animation Loop ──
      if (p.walkState === 'panicked') {
        p.walkPhase += dt * 22; // High-speed panicked animation

        const dx = p.walkTarget.x - pos.x;
        const dz = p.walkTarget.z - pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.08) {
          const targetAngle = Math.atan2(dx, dz);
          let diff = targetAngle - p.currentFacing;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          p.currentFacing += diff * Math.min(1, dt * 12.0);
          p.grp.rotation.y = p.currentFacing;

          const step = Math.min(dist, p.runSpeed * dt);
          pos.x += Math.sin(p.currentFacing) * step;
          pos.z += Math.cos(p.currentFacing) * step;
        }

        // Panicked Running Animation (legs wide swing, arms flailing, body leaning forward)
        p.legGrpL.rotation.x = Math.sin(p.walkPhase) * 1.15;
        p.legGrpR.rotation.x = -Math.sin(p.walkPhase) * 1.15;

        // Arm flailing
        p.armGrpL.rotation.x = Math.sin(p.walkPhase * 1.3) * 1.1 - 0.4;
        p.armGrpR.rotation.x = -Math.sin(p.walkPhase * 1.3) * 1.1 - 0.4;
        p.armGrpL.rotation.z = -0.3 + Math.sin(p.walkPhase * 1.8) * 0.25;
        p.armGrpR.rotation.z = 0.3 - Math.sin(p.walkPhase * 1.8) * 0.25;

        // Leaning forward while sprinting & high bounce
        p.upperGrp.rotation.x = 0.28;
        p.upperGrp.position.y = Math.abs(Math.sin(p.walkPhase * 2)) * 0.08;

      } else if (p.walkState === 'walking') {
        p.walkPhase += dt * 10;
        p.upperGrp.rotation.x *= 0.82; // Return to upright posture

        const dx = p.walkTarget.x - pos.x;
        const dz = p.walkTarget.z - pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.12) {
          p.walkState = 'idle';
          p.idleTimer = 1.2 + Math.random() * 2.5;
        } else {
          const targetAngle = Math.atan2(dx, dz);
          let diff = targetAngle - p.currentFacing;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          p.currentFacing += diff * Math.min(1, dt * 7.5);
          p.grp.rotation.y = p.currentFacing;

          const step = Math.min(dist, p.moveSpeed * dt);
          pos.x += Math.sin(p.currentFacing) * step;
          pos.z += Math.cos(p.currentFacing) * step;

          // Normal walking limb animation
          p.legGrpL.rotation.x = Math.sin(p.walkPhase) * 0.62;
          p.legGrpR.rotation.x = -Math.sin(p.walkPhase) * 0.62;
          p.armGrpL.rotation.x = -Math.sin(p.walkPhase) * 0.52;
          p.armGrpR.rotation.x = Math.sin(p.walkPhase * 0.52);
          p.armGrpL.rotation.z = -0.14;
          p.armGrpR.rotation.z = 0.14;
          p.upperGrp.position.y = Math.abs(Math.sin(p.walkPhase * 2)) * 0.035;
        }
      } else {
        // Idle state -> decay rotations and count down idle timer
        p.upperGrp.rotation.x *= 0.82;
        p.legGrpL.rotation.x *= 0.84;
        p.legGrpR.rotation.x *= 0.84;
        p.armGrpL.rotation.x *= 0.84;
        p.armGrpR.rotation.x *= 0.84;
        p.armGrpL.rotation.z = -0.14;
        p.armGrpR.rotation.z = 0.14;
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
