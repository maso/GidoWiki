import * as THREE from 'three';
import { CHARACTER_DEFS, ANIMATION_CONFIG } from './config.js';
import { setupRaycaster } from './raycaster.js';
import { mkCharacter, mkDinosaurEgg } from './character/factories.js';
import { STUNTS, FOOT_BASE_Y, FOOT_BASE_Z } from './character/stunts.js';

export { mkCharacter, mkDinosaurEgg };

// ── Shared helper: Pewpew wandering pupils ──
function getWanderingTargets() {
  const rOff = (min, max) => min + Math.random() * (max - min);
  const lX = -rOff(0.022, 0.058);
  const rX =  rOff(0.022, 0.058);
  const yMag = rOff(0.015, 0.042);
  const lY = (Math.random() < 0.5 ? 1 : -1) * yMag;
  const rY = -lY * (0.7 + Math.random() * 0.6);
  return { l: new THREE.Vector2(lX, lY), r: new THREE.Vector2(rX, rY) };
}

// ── Shared helper: occasional glance for non-wandering characters ──
function getGlanceTargets(eyeStyle) {
  const rOff = (min, max) => min + Math.random() * (max - min);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const dx = dir * rOff(0.02, 0.045);
  const dy = (eyeStyle === 'sleepy') ? 0 : (Math.random() < 0.5 ? 1 : -1) * rOff(0, 0.018);
  const t = new THREE.Vector2(dx, dy);
  return { l: t, r: t.clone() };
}

// ── Roam bounds (safe visible area: camera at 0.5,5.5,11.5 FOV42) ──
const ROAM    = { xMin: -3.2, xMax: 4.0, zMin: -2.5, zMax: 2.8 };
const SEP_DIST = 1.05; // minimum centre-to-centre separation

export function createCharacters(scene, camera, renderer, gs) {

  const homeCameraPosition = camera.position.clone();
  const homeCameraTarget = new THREE.Vector3(0.5, 0.5, 0);
  const cameraTarget = homeCameraTarget.clone();
  const customizationCameraPosition = new THREE.Vector3(0.5, 2.1, 4.0);
  const customizationCameraTarget = new THREE.Vector3(0.5, 0.55, 0);
  let customization = { active: false, selectedId: null, snapshots: null };
  let currentClock = 0;

  /* ── Build character objects ── */
  const chars = CHARACTER_DEFS.map((def, i) => {
    const c = def.characterType === 'egg'
      ? mkDinosaurEgg(def.bodyCol, def.accentCol, def.eggSpots)
      : mkCharacter(def.bodyCol, def.accentCol, def.eyeStyle || 'normal', def.pupilSize || 0.075);
    c.grp.position.set(def.x, 0, def.z);
    scene.add(c.grp);

    const initWander = (def.characterType !== 'egg' && def.eyeStyle === 'wandering') ? getWanderingTargets() : null;
    if (initWander) {
      c.eyeL.position.x = initWander.l.x; c.eyeL.position.y = initWander.l.y;
      c.eyeR.position.x = initWander.r.x; c.eyeR.position.y = initWander.r.y;
    }

    return {
      ...c,
      id: def.id, name: def.name,
      characterType: def.characterType || 'blob',
      locked: Boolean(def.locked),
      unlockText: def.unlockText || '',
      unlockProgress: def.unlockProgress ?? 0,
      eyeStyle: def.eyeStyle || 'normal',
      baseX: def.x, baseZ: def.z,
      lbl:   document.getElementById(def.lblId),
      speed: def.speed, phase: def.phase, breathAmp: def.breathAmp ?? 0.045,
      moveSpeedMin: def.moveSpeedMin ?? 1.4, moveSpeedMax: def.moveSpeedMax ?? 1.4,
      nextBlink:    1.5 + Math.random() * 3.0,
      isFalling:    false, fallTime: 0,
      // Eye wander (Pewpew) / occasional glance (everyone else)
      eyeLTarget:   initWander ? initWander.l : new THREE.Vector2(0, 0),
      eyeRTarget:   initWander ? initWander.r : new THREE.Vector2(0, 0),
      nextEyeWander: 1.0 + Math.random() * 2.5,
      glanceState:  'idle',
      glanceUntil:  0,
      // Idle "look around" turn (torso pivot only, feet stay planted)
      lookPhase:  'idle',
      lookOffset: 0,
      nextLook:   5 + Math.random() * 9,
      lookUntil:  0,
      // Idle happy-hop flourish
      hopState:     'idle',
      hopStartTime: 0,
      nextHop:      6 + Math.random() * 12,
      // Idle stunt performance (random pick from the STUNTS library)
      stuntState:     'idle',
      stunt:          null,
      stuntStartTime: 0,
      nextStunt:      (i * 1.2) + 1 + Math.random() * 9, // staggered so no group synchro
      lastStuntId:    null,
      stuntBaseX:     null,
      // Roaming walk state
      walkState:    'idle',
      walkFrom:     { x: def.x, z: def.z },
      walkTarget:   { x: def.x, z: def.z },
      walkFacing:   0,
      walkStartTime: 0,
      walkDuration:  1,
      nextWalk:      (i * 3.2) + 4 + Math.random() * 6, // staggered first walk
      // Collision avoidance offset (added on top of lerp, decays toward 0)
      sepOffsetX: 0,
      sepOffsetZ: 0,
      shakeStartTime: -Infinity,
      nextShake: 4 + Math.random() * 8,
    };
  });

  /* ── Raycaster ── */
  setupRaycaster(
    camera, renderer, gs,
    () => customization.active ? [] : chars.map(c => ({ group: c.grp, char: c })),
    (hitTarget) => {
      const c = hitTarget.char;
      if (c.characterType === 'egg') {
        c.shakeStartTime = currentClock;
        c.nextShake = currentClock + 7 + Math.random() * 10;
        return;
      }
      if (!c.isFalling) {
        c.isFalling   = true;
        c.fallTime    = -1;
        c.walkState   = 'idle'; // cancel any active walk
        c.sepOffsetX  = 0;
        c.sepOffsetZ  = 0;
        // Cancel any in-progress idle flourish so it doesn't linger through the fall
        cancelStunt(c, currentClock);
        c.upperGrp.rotation.y = 0;
        c.lookPhase  = 'idle';
        c.lookOffset = 0;
        c.hopState   = 'idle';
        c.bodyMesh.scale.set(1, 1, 1);
      }
    }
  );

  /* ── Helpers ── */
  const tmpV = new THREE.Vector3();
  function worldToScreen(wx, wy, wz) {
    const W = gs.offsetWidth, H = gs.offsetHeight;
    tmpV.set(wx, wy, wz).project(camera);
    return { x: (tmpV.x * 0.5 + 0.5) * W, y: (-tmpV.y * 0.5 + 0.5) * H };
  }

  function tickBlink(c, clock) {
    if (clock >= c.nextBlink) {
      const e = clock - c.nextBlink;
      if (e < ANIMATION_CONFIG.blinkDuration) {
        c.eyeGrp.scale.y = Math.max(0.08, Math.abs(Math.cos(e / ANIMATION_CONFIG.blinkDuration * Math.PI)));
      } else {
        c.eyeGrp.scale.y = 1.0;
        c.nextBlink = clock + 2.0 + Math.random() * 4.0;
      }
    } else {
      c.eyeGrp.scale.y = 1.0;
    }
  }

  function tickEyes(c, clock) {
    if (c.eyeStyle === 'wandering') {
      if (clock >= c.nextEyeWander) {
        const t = getWanderingTargets();
        c.eyeLTarget.copy(t.l); c.eyeRTarget.copy(t.r);
        c.nextEyeWander = clock + 1.3 + Math.random() * 1.0;
      }
    } else {
      if (c.glanceState === 'idle' && clock >= c.nextEyeWander) {
        const t = getGlanceTargets(c.eyeStyle);
        c.eyeLTarget.copy(t.l); c.eyeRTarget.copy(t.r);
        c.glanceState = 'looking';
        c.glanceUntil = clock + 2.0 + Math.random() * 2.0;
      } else if (c.glanceState === 'looking' && clock >= c.glanceUntil) {
        c.eyeLTarget.set(0, 0);
        c.eyeRTarget.set(0, 0);
        c.glanceState = 'idle';
        c.nextEyeWander = clock + 6 + Math.random() * 8;
      }
    }
    c.eyeL.position.x += (c.eyeLTarget.x - c.eyeL.position.x) * 0.06;
    c.eyeL.position.y += (c.eyeLTarget.y - c.eyeL.position.y) * 0.06;
    c.eyeR.position.x += (c.eyeRTarget.x - c.eyeR.position.x) * 0.06;
    c.eyeR.position.y += (c.eyeRTarget.y - c.eyeR.position.y) * 0.06;
  }

  function tickLookAround(c, t, clock) {
    const swayTarget = Math.sin(t * 0.7) * 0.08;

    if (c.lookPhase === 'idle' && clock >= c.nextLook) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      c.lookOffset = dir * (0.3 + Math.random() * 0.25);
      c.lookPhase  = 'looking';
      c.lookUntil  = clock + 0.9 + Math.random() * 0.9;
    } else if (c.lookPhase === 'looking' && clock >= c.lookUntil) {
      c.lookPhase  = 'idle';
      c.lookOffset = 0;
      c.nextLook   = clock + 9 + Math.random() * 12;
    }

    const upperTarget = swayTarget + c.lookOffset;
    c.upperGrp.rotation.y += (upperTarget - c.upperGrp.rotation.y) * 0.04;
  }

  function tickHop(c, clock) {
    if (c.hopState === 'idle' && clock >= c.nextHop) {
      c.hopState     = 'hopping';
      c.hopStartTime = clock;
    } else if (c.hopState === 'hopping') {
      const e   = clock - c.hopStartTime;
      const dur = 0.42;
      if (e < dur) {
        const p   = e / dur;
        const hop = Math.sin(p * Math.PI) * 0.16;
        c.grp.position.y = hop;
        const stretch = 1 + hop * 0.9;
        const squash  = 1 - hop * 0.35;
        c.bodyMesh.scale.set(squash, stretch, squash);
      } else {
        c.grp.position.y = 0;
        c.bodyMesh.scale.set(1, 1, 1);
        c.hopState = 'idle';
        c.nextHop  = clock + 9 + Math.random() * 14;
      }
    }
  }

  function restoreStuntPose(c) {
    if (c.stuntBaseX != null) { c.grp.position.x = c.stuntBaseX; c.stuntBaseX = null; }
    c.grp.position.y = 0;
    c.grp.rotation.x = 0;
    c.grp.rotation.z = 0;
    c.grp.rotation.y = 0;
    c.upperGrp.rotation.set(0, 0, 0);
    c.bodyMesh.position.y = c.baseBodyY;
    c.bodyMesh.scale.copy(c.baseBodyScale);
    c.handL.position.set(-0.52, 0.38, 0.1);
    c.handR.position.set(0.52, 0.38, 0.1);
    c.footL.position.set(-0.21, FOOT_BASE_Y, FOOT_BASE_Z);
    c.footR.position.set(0.21, FOOT_BASE_Y, FOOT_BASE_Z);
  }

  function cancelStunt(c, clock) {
    if (c.stuntState !== 'performing') return;
    restoreStuntPose(c);
    c.stuntState = 'idle';
    c.stunt = null;
    c.nextStunt = clock + 1 + Math.random() * 9;
  }

  function tickStunt(c, clock) {
    if (c.stuntState === 'idle') {
      if (clock < c.nextStunt || c.hopState === 'hopping') return false;
      let pick;
      do {
        pick = STUNTS[Math.floor(Math.random() * STUNTS.length)];
      } while (STUNTS.length > 1 && pick.id === c.lastStuntId);
      c.stunt          = pick;
      c.lastStuntId    = pick.id;
      c.stuntState     = 'performing';
      c.stuntStartTime = clock;
      c.lookPhase  = 'idle';
      c.lookOffset = 0;
      restoreStuntPose(c);
      c.stuntBaseX = c.grp.position.x;
    }

    const p = (clock - c.stuntStartTime) / c.stunt.dur;
    if (p >= 1) {
      restoreStuntPose(c);
      c.stuntState = 'idle';
      c.stunt = null;
      c.nextStunt = clock + 1 + Math.random() * 9;
      return false;
    }
    c.stunt.tick(c, p);
    return true;
  }

  function resetPose(c) {
    c.isFalling = false;
    c.fallTime = 0;
    c.walkState = 'idle';
    c.sepOffsetX = 0;
    c.sepOffsetZ = 0;
    c.hopState = 'idle';
    c.stuntState = 'idle';
    c.stunt = null;
    c.grp.position.y = 0;
    c.grp.rotation.x = 0;
    c.grp.rotation.z = 0;
    c.bodyMesh.position.y = c.baseBodyY;
    c.bodyMesh.scale.copy(c.baseBodyScale);
    if (c.characterType === 'egg') return;
    c.upperGrp.rotation.y = 0;
    c.handL.position.set(-0.52, 0.38, 0.1);
    c.handR.position.set(0.52, 0.38, 0.1);
    c.footL.position.set(-0.21, FOOT_BASE_Y, FOOT_BASE_Z);
    c.footR.position.set(0.21, FOOT_BASE_Y, FOOT_BASE_Z);
  }

  function tickEggShake(c, clock) {
    if (clock >= c.nextShake) {
      c.shakeStartTime = clock;
      c.nextShake = clock + 7 + Math.random() * 11;
    }
    const elapsed = clock - c.shakeStartTime;
    if (elapsed >= 0 && elapsed < 0.48) {
      const strength = 1 - elapsed / 0.48;
      c.grp.rotation.z = Math.sin(elapsed * 58) * 0.055 * strength;
    } else {
      c.grp.rotation.z *= 0.75;
    }
  }

  function setCustomizationMode(active, selectedId = chars[0]?.id) {
    if (active && !customization.active) {
      customization.snapshots = chars.map(c => ({
        position: c.grp.position.clone(),
        rotation: c.grp.rotation.clone(),
        walkState: c.walkState,
        walkFrom: { ...c.walkFrom },
        walkTarget: { ...c.walkTarget },
        walkFacing: c.walkFacing,
        walkStartTime: c.walkStartTime,
        walkDuration: c.walkDuration,
        nextWalk: c.nextWalk,
      }));
      customization.active = true;
      customization.selectedId = selectedId;
      chars.forEach(c => resetPose(c));
    } else if (!active && customization.active) {
      chars.forEach((c, i) => {
        const snapshot = customization.snapshots[i];
        c.grp.visible = true;
        c.lbl.style.visibility = '';
        c.grp.position.copy(snapshot.position);
        c.grp.rotation.copy(snapshot.rotation);
        c.walkState = snapshot.walkState;
        c.walkFrom = { ...snapshot.walkFrom };
        c.walkTarget = { ...snapshot.walkTarget };
        c.walkFacing = snapshot.walkFacing;
        c.walkStartTime = snapshot.walkStartTime;
        c.walkDuration = snapshot.walkDuration;
        c.nextWalk = Math.max(snapshot.nextWalk, currentClock + 1);
      });
      customization.active = false;
      customization.selectedId = null;
      customization.snapshots = null;
    }
  }

  function selectCustomizationCharacter(id) {
    if (!chars.some(c => c.id === id)) return;
    customization.selectedId = id;
    chars.forEach((c, i) => {
      const selected = c.id === id;
      c.grp.visible = selected;
      c.lbl.style.visibility = 'hidden';
      if (selected) {
        resetPose(c);
        const snapshot = customization.snapshots?.[i];
        if (snapshot) c.grp.position.copy(snapshot.position);
      }
    });
  }

  function setCharacterColor(id, hex) {
    const c = chars.find(char => char.id === id);
    if (!c) return;
    c.bodyMat.color.setHex(hex);
    const accent = new THREE.Color(hex).multiplyScalar(0.82);
    c.accentMat.color.copy(accent);
  }

  function setCharacterAccessory(id, accessoryId) {
    const c = chars.find(char => char.id === id);
    if (!c?.accessoryGroups) return false;
    if (accessoryId !== 'none' && !c.accessoryGroups[accessoryId]) return false;
    Object.entries(c.accessoryGroups).forEach(([candidateId, group]) => {
      group.visible = candidateId === accessoryId;
    });
    return true;
  }

  function getCharacterColors() {
    return Object.fromEntries(chars.map(c => [c.id, c.bodyMat.color.getHex()]));
  }

  function tickCustomization(clock) {
    const cameraDestination = customization.active ? customizationCameraPosition : homeCameraPosition;
    const targetDestination = customization.active ? customizationCameraTarget : homeCameraTarget;
    camera.position.lerp(cameraDestination, customization.active ? 0.14 : 0.09);
    cameraTarget.lerp(targetDestination, customization.active ? 0.14 : 0.09);
    camera.lookAt(cameraTarget);

    if (!customization.active) return false;
    chars.forEach(c => {
      const selected = c.id === customization.selectedId;
      c.grp.visible = selected;
      c.lbl.style.visibility = 'hidden';
      if (!selected) return;

      const t = clock * c.speed + c.phase;
      c.grp.position.x += (1.4 - c.grp.position.x) * 0.16;
      c.grp.position.z += (0 - c.grp.position.z) * 0.16;
      c.grp.position.y = 0;
      let faceFront = -c.grp.rotation.y;
      while (faceFront > Math.PI) faceFront -= Math.PI * 2;
      while (faceFront < -Math.PI) faceFront += Math.PI * 2;
      c.grp.rotation.y += faceFront * 0.12;

      if (c.characterType === 'egg') {
        tickEggShake(c, clock);
        return;
      }

      const bodyY = 0.48 + Math.sin(t * 1.5) * c.breathAmp;
      c.bodyMesh.position.y = bodyY;
      c.handL.position.y = bodyY - 0.1 + Math.sin(t * 1.8) * 0.025;
      c.handR.position.y = bodyY - 0.1 + Math.sin(t * 1.8 + Math.PI) * 0.025;
      tickBlink(c, clock);
      tickEyes(c, clock);
      tickLookAround(c, t, clock);
    });
    return true;
  }

  function pickRoamTarget(selfIdx) {
    const c = chars[selfIdx];
    const MIN_TRAVEL = 1.0;
    const MIN_CHAR   = SEP_DIST + 0.15;
    let tx, tz, attempts = 0;

    do {
      tx = ROAM.xMin + Math.random() * (ROAM.xMax - ROAM.xMin);
      tz = ROAM.zMin + Math.random() * (ROAM.zMax - ROAM.zMin);

      const travelDist = Math.hypot(tx - c.grp.position.x, tz - c.grp.position.z);
      if (travelDist < MIN_TRAVEL) { attempts++; continue; }

      const clash = chars.some((other, j) => {
        if (j === selfIdx) return false;
        if (Math.hypot(tx - other.grp.position.x, tz - other.grp.position.z) < MIN_CHAR) return true;
        if (other.walkState === 'walking' &&
            Math.hypot(tx - other.walkTarget.x, tz - other.walkTarget.z) < MIN_CHAR) return true;
        return false;
      });

      if (!clash) break;
      attempts++;
    } while (attempts < 40);

    const dist = Math.max(MIN_TRAVEL, Math.hypot(tx - c.grp.position.x, tz - c.grp.position.z));
    return { tx, tz, dist };
  }

  /* ════════════════════════════════════════════════════
     MAIN UPDATE LOOP
  ════════════════════════════════════════════════════ */
  return {
    chars,
    setCustomizationMode,
    selectCustomizationCharacter,
    setCharacterColor,
    setCharacterAccessory,
    getCharacterColors,
    update: (clock) => {

      currentClock = clock;

      if (tickCustomization(clock)) return;

      /* ── PASS 1: per-character animation ── */
      chars.forEach((c, selfIdx) => {
        const t = clock * c.speed + c.phase;

        if (c.characterType === 'egg') {
          tickEggShake(c, clock);
          const sp = worldToScreen(c.grp.position.x, 1.45, c.grp.position.z);
          c.lbl.style.left = sp.x + 'px';
          c.lbl.style.top = sp.y + 'px';
          return;
        }

        /* ─── PRIORITY 1: FALL / JUMP ─── */
        if (c.isFalling) {
          if (c.fallTime < 0) c.fallTime = clock;
          const elapsed      = Math.max(0, clock - c.fallTime);
          const totalDuration = ANIMATION_CONFIG.fallDuration;

          if (elapsed < totalDuration) {
            const airTime       = 0.20;
            const landRecoilTime = 0.05;
            const springTime    = 0.13;

            if (elapsed < airTime) {
              const p = elapsed / airTime;
              c.grp.position.y  = 4 * 0.32 * p * (1 - p);
              c.grp.rotation.x  = -(Math.PI / 2) * Math.pow(p, 1.2);
              const flail = elapsed * 65;
              c.handL.position.x = -0.52 + Math.sin(flail) * 0.10;
              c.handR.position.x =  0.52 + Math.cos(flail) * 0.10;
              c.footL.position.z = FOOT_BASE_Z + Math.sin(flail * 1.2) * 0.06;
              c.footR.position.z = FOOT_BASE_Z + Math.cos(flail * 1.2) * 0.06;
            } else if (elapsed < airTime + landRecoilTime) {
              c.grp.position.y = 0; c.grp.rotation.x = -(Math.PI / 2);
              c.bodyMesh.position.y = 0.48;
              c.handL.position.set(-0.52, 0.38, 0.1); c.handR.position.set(0.52, 0.38, 0.1);
              c.footL.position.set(-0.21, FOOT_BASE_Y, FOOT_BASE_Z); c.footR.position.set(0.21, FOOT_BASE_Y, FOOT_BASE_Z);
            } else {
              const p    = (elapsed - airTime - landRecoilTime) / springTime;
              const ease = 1 - Math.pow(1 - p, 3);
              c.grp.position.y = 0; c.grp.rotation.x = -(Math.PI / 2) * (1 - ease);
              c.bodyMesh.position.y = 0.48;
              c.handL.position.set(-0.52, 0.38, 0.1); c.handR.position.set(0.52, 0.38, 0.1);
              c.footL.position.set(-0.21, FOOT_BASE_Y, FOOT_BASE_Z); c.footR.position.set(0.21, FOOT_BASE_Y, FOOT_BASE_Z);
            }

            const sp = worldToScreen(c.grp.position.x, 0.48 + c.grp.position.y + 0.55, c.grp.position.z);
            c.lbl.style.left = sp.x + 'px'; c.lbl.style.top = sp.y + 'px';
            return;

          } else {
            c.isFalling = false;
            c.grp.position.y = 0; c.grp.rotation.x = 0;
            c.bodyMesh.position.y = 0.48;
            c.handL.position.set(-0.52, 0.38, 0.1); c.handR.position.set(0.52, 0.38, 0.1);
            c.footL.position.set(-0.21, FOOT_BASE_Y, FOOT_BASE_Z); c.footR.position.set(0.21, FOOT_BASE_Y, FOOT_BASE_Z);
            c.nextWalk = clock + 2.0 + Math.random() * 3.0;
          }
        }

        /* ─── PRIORITY 2: ROAMING WALK ─── */
        c.sepOffsetX *= 0.88;
        c.sepOffsetZ *= 0.88;

        if (c.walkState === 'idle' && clock >= c.nextWalk && c.stuntState !== 'performing') {
          const { tx, tz, dist } = pickRoamTarget(selfIdx);
          c.walkFrom      = { x: c.grp.position.x, z: c.grp.position.z };
          c.walkTarget    = { x: tx, z: tz };
          c.walkFacing    = Math.atan2(tx - c.grp.position.x, tz - c.grp.position.z);
          const walkSpeed = c.moveSpeedMin + Math.random() * (c.moveSpeedMax - c.moveSpeedMin);
          c.walkDuration  = Math.max(0.9, dist / walkSpeed);
          c.walkStartTime = clock;
          c.walkState     = 'walking';
        }

        if (c.walkState === 'walking') {
          c.upperGrp.rotation.y = 0;
          c.grp.position.y = 0;
          c.bodyMesh.scale.set(1, 1, 1);
          c.hopState  = 'idle';
          c.lookPhase = 'idle';
          c.lookOffset = 0;

          const elapsed  = clock - c.walkStartTime;
          const progress = Math.min(elapsed / c.walkDuration, 1.0);
          const ease     = 0.5 - Math.cos(progress * Math.PI) / 2;

          const offsetFade = 1 - Math.max(0, (progress - 0.85) / 0.15);
          c.grp.position.x = c.walkFrom.x + (c.walkTarget.x - c.walkFrom.x) * ease + c.sepOffsetX * offsetFade;
          c.grp.position.z = c.walkFrom.z + (c.walkTarget.z - c.walkFrom.z) * ease + c.sepOffsetZ * offsetFade;

          let rd = c.walkFacing - c.grp.rotation.y;
          while (rd >  Math.PI) rd -= Math.PI * 2;
          while (rd < -Math.PI) rd += Math.PI * 2;
          c.grp.rotation.y += rd * 0.10;

          const step      = elapsed * 8.5;
          const walkBodyY = 0.48 + Math.abs(Math.sin(step)) * 0.09;
          c.bodyMesh.position.y = walkBodyY;

          c.handL.position.x = -0.52;
          c.handR.position.x =  0.52;
          c.handL.position.y = walkBodyY - 0.1 + Math.sin(step) * 0.04;
          c.handR.position.y = walkBodyY - 0.1 + Math.sin(step + Math.PI) * 0.04;
          c.handL.position.z = 0.1 + Math.sin(step) * 0.14;
          c.handR.position.z = 0.1 + Math.sin(step + Math.PI) * 0.14;

          c.footL.position.z = FOOT_BASE_Z + Math.sin(step + Math.PI) * 0.04;
          c.footR.position.z = FOOT_BASE_Z + Math.sin(step) * 0.04;
          c.footL.position.y = FOOT_BASE_Y + Math.max(0, Math.sin(step + Math.PI)) * 0.09;
          c.footR.position.y = FOOT_BASE_Y + Math.max(0, Math.sin(step)) * 0.09;

          tickBlink(c, clock);
          tickEyes(c, clock);

          const sp = worldToScreen(c.grp.position.x, walkBodyY + 0.55, c.grp.position.z);
          c.lbl.style.left = sp.x + 'px'; c.lbl.style.top = sp.y + 'px';

          if (progress >= 1.0) {
            c.grp.position.x = c.walkTarget.x;
            c.grp.position.z = c.walkTarget.z;
            c.sepOffsetX = 0; c.sepOffsetZ = 0;
            c.walkState  = 'idle';
            c.nextWalk   = clock + 5 + Math.random() * 11;
            c.footL.position.z = FOOT_BASE_Z; c.footR.position.z = FOOT_BASE_Z;
            c.footL.position.y = FOOT_BASE_Y; c.footR.position.y = FOOT_BASE_Y;
            c.handL.position.z = 0.1; c.handR.position.z = 0.1;
          }
          return;
        }

        /* ─── PRIORITY 3: IDLE ─── */
        tickBlink(c, clock);
        tickEyes(c, clock);

        if (tickStunt(c, clock)) {
          const sp = worldToScreen(
            c.grp.position.x,
            c.bodyMesh.position.y + c.grp.position.y + 0.55,
            c.grp.position.z,
          );
          c.lbl.style.left = sp.x + 'px'; c.lbl.style.top = sp.y + 'px';
          return;
        }

        const bodyY = 0.48 + Math.sin(t * 1.5) * c.breathAmp;
        c.bodyMesh.position.y = bodyY;

        let faceBack = -c.grp.rotation.y;
        while (faceBack >  Math.PI) faceBack -= Math.PI * 2;
        while (faceBack < -Math.PI) faceBack += Math.PI * 2;
        c.grp.rotation.y += faceBack * 0.025;

        c.handL.position.y = bodyY - 0.1 + Math.sin(t * 1.8) * 0.035;
        c.handR.position.y = bodyY - 0.1 + Math.sin(t * 1.8 + Math.PI) * 0.035;
        c.handL.position.x = -0.52 + Math.sin(t * 1.2) * 0.025;
        c.handR.position.x =  0.52 + Math.sin(t * 1.2 + Math.PI) * 0.025;

        tickLookAround(c, t, clock);
        tickHop(c, clock);

        const sp = worldToScreen(c.grp.position.x, bodyY + c.grp.position.y + 0.55, c.grp.position.z);
        c.lbl.style.left = sp.x + 'px'; c.lbl.style.top = sp.y + 'px';
      });

      /* ── PASS 2: pairwise separation ── */
      const SEP2 = SEP_DIST * SEP_DIST;
      for (let i = 0; i < chars.length; i++) {
        for (let j = i + 1; j < chars.length; j++) {
          const a = chars[i], b = chars[j];
          if (a.characterType === 'egg' || b.characterType === 'egg' || a.isFalling || b.isFalling) continue;

          const dx = a.grp.position.x - b.grp.position.x;
          const dz = a.grp.position.z - b.grp.position.z;
          const d2 = dx * dx + dz * dz;
          if (d2 >= SEP2 || d2 < 0.0001) continue;

          const d    = Math.sqrt(d2);
          const nx   = dx / d;
          const nz   = dz / d;
          const half = (SEP_DIST - d) * 0.5;

          if (a.walkState === 'walking') {
            a.sepOffsetX += nx * half;
            a.sepOffsetZ += nz * half;
          } else {
            a.grp.position.x += nx * half;
            a.grp.position.z += nz * half;
          }

          if (b.walkState === 'walking') {
            b.sepOffsetX -= nx * half;
            b.sepOffsetZ -= nz * half;
          } else {
            b.grp.position.x -= nx * half;
            b.grp.position.z -= nz * half;
          }
        }
      }
    }
  };
}
