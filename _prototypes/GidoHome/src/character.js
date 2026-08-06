import * as THREE from 'three';
import { toon, solid } from './materials.js';
import { CHARACTER_DEFS, ANIMATION_CONFIG } from './config.js';
import { setupRaycaster } from './raycaster.js';

const FOOT_BASE_Y = 0.085;
const FOOT_BASE_Z = 0.05;

/* ═══════════════════════════════════════
   3D CHARACTER FACTORY & ANIMATION
═══════════════════════════════════════ */

export function mkCharacter(bodyCol, accentCol, eyeStyle = 'normal', pupilSize = 0.075) {
  const g = new THREE.Group();

  // Upper-body pivot: head/body/arms live here so idle "look around" turns
  // (and the walk-facing rotation stays on `g`, feet included) can rotate
  // the torso independently — the feet stay planted, only children of `g`.
  const upperGrp = new THREE.Group();
  g.add(upperGrp);

  const bodyMat   = toon(bodyCol);
  const accentMat = toon(accentCol);
  const whiteMat  = solid(0xffffff);
  const eyeMat    = solid(0x221133);
  const browMat   = solid(0x221133);

  // ── BODY ──
  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), bodyMat);
  bodyMesh.position.y = 0.48;
  bodyMesh.castShadow = true;
  upperGrp.add(bodyMesh);

  // Accessories are children of the body so they naturally follow breathing,
  // squash/stretch, walking, and the customization look-around animation.
  const accessoryGroups = {};
  function registerAccessory(id, group) {
    group.visible = false;
    group.traverse((part) => {
      if (part.isMesh) part.castShadow = true;
    });
    bodyMesh.add(group);
    accessoryGroups[id] = group;
    return group;
  }

  // Classic top hat — seated slightly into the head so it feels worn rather
  // than balanced on top.
  const topHat = new THREE.Group();
  const topHatMat = toon(0x34245f);
  const topHatBandMat = toon(0xffcf3f);
  const topHatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.055, 28),
    topHatMat,
  );
  topHatBrim.scale.set(1.12, 1, 0.86);
  topHat.add(topHatBrim);
  const topHatCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.25, 0.31, 28),
    topHatMat,
  );
  topHatCrown.position.y = 0.18;
  topHat.add(topHatCrown);
  const topHatBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.256, 0.256, 0.065, 28),
    topHatBandMat,
  );
  topHatBand.position.y = 0.07;
  topHat.add(topHatBand);
  topHat.position.set(0, 0.39, -0.015);
  topHat.rotation.z = -0.07;
  registerAccessory('top-hat', topHat);

  // Red baseball cap with a curved dome, front visor, and top button.
  const baseballCap = new THREE.Group();
  const capBlueMat = toon(0x378be8);
  const capDarkMat = toon(0x205eb8);
  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    capBlueMat,
  );
  capDome.scale.z = 0.92;
  baseballCap.add(capDome);
  const capVisor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.045, 24),
    capDarkMat,
  );
  capVisor.position.set(0, -0.012, 0.22);
  capVisor.scale.set(1.12, 1, 0.7);
  baseballCap.add(capVisor);
  const capButton = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 8), capDarkMat);
  capButton.position.y = 0.31;
  baseballCap.add(capButton);
  baseballCap.position.set(0, 0.34, -0.01);
  baseballCap.rotation.z = -0.045;
  baseballCap.scale.setScalar(1.15);
  registerAccessory('baseball-cap', baseballCap);

  // Warm ivory horns with dark bases, angled away from the head.
  const horns = new THREE.Group();
  const hornMat = toon(0xffe2a1);
  const hornBaseMat = toon(0x75503e);
  [-1, 1].forEach((side) => {
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), hornBaseMat);
    base.position.set(side * 0.27, 0.015, -0.01);
    base.scale.set(1, 0.58, 0.82);
    horns.add(base);
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.27, 0.035, -0.01),
      new THREE.Vector3(side * 0.39, 0.08, -0.01),
      new THREE.Vector3(side * 0.48, 0.19, -0.005),
      new THREE.Vector3(side * 0.45, 0.30, 0),
    ]);
    const hornBody = new THREE.Mesh(
      new THREE.TubeGeometry(hornCurve, 20, 0.067, 12, false),
      hornMat,
    );
    horns.add(hornBody);
    const tipDirection = hornCurve.getTangent(1).normalize();
    const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.067, 0.15, 14), hornMat);
    hornTip.position.copy(hornCurve.getPoint(1)).addScaledVector(tipDirection, 0.07);
    hornTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDirection);
    horns.add(hornTip);
  });
  horns.position.set(0, 0.31, -0.015);
  registerAccessory('bull-horns', horns);

  // Soft rabbit ears with inset pink inner-ear pieces.
  const rabbitEars = new THREE.Group();
  const earMat = toon(0xf4eaff);
  const innerEarMat = toon(0xff8fc8);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), earMat);
    ear.position.set(side * 0.17, 0.28, -0.015);
    ear.scale.set(0.7, 2.15, 0.5);
    ear.rotation.z = side * -0.17;
    rabbitEars.add(ear);
    const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), innerEarMat);
    innerEar.position.set(side * 0.17, 0.29, 0.075);
    innerEar.scale.set(0.5, 2.1, 0.2);
    innerEar.rotation.z = side * -0.17;
    rabbitEars.add(innerEar);
  });
  rabbitEars.position.set(0, 0.39, -0.02);
  registerAccessory('rabbit-ears', rabbitEars);

  // A compact upturned moustache placed on the front surface of the face.
  const mustache = new THREE.Group();
  const mustacheMat = toon(0x38243e);
  [-1, 1].forEach((side) => {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), mustacheMat);
    lobe.position.set(side * 0.105, 0, 0);
    lobe.scale.set(1.16, 0.5, 0.28);
    lobe.rotation.z = side * 0.25;
    mustache.add(lobe);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 14), mustacheMat);
    tip.position.set(side * 0.205, 0.035, 0);
    tip.rotation.z = side * -1.18;
    mustache.add(tip);
  });
  mustache.position.set(0, -0.105, 0.455);
  registerAccessory('curled-mustache', mustache);

  // A sheathed ninja sword worn diagonally across the back. Most of the
  // scabbard stays behind the body while the handle and tip remain visible.
  const ninjaSword = new THREE.Group();
  const sheathMat = toon(0x211a35);
  const handleMat = toon(0x354c86);
  const wrapMat = toon(0xb74a68);
  const guardMat = toon(0xd9ad43);
  const sheath = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.057, 0.82, 14),
    sheathMat,
  );
  sheath.position.y = -0.06;
  ninjaSword.add(sheath);
  const sheathTip = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 8), guardMat);
  sheathTip.position.y = -0.47;
  sheathTip.scale.y = 0.62;
  ninjaSword.add(sheathTip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.038, 0.085), guardMat);
  guard.position.y = 0.37;
  ninjaSword.add(guard);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.25, 14),
    handleMat,
  );
  handle.position.y = 0.51;
  ninjaSword.add(handle);
  [0.42, 0.48, 0.54, 0.6].forEach((y) => {
    const wrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.057, 0.057, 0.025, 14),
      wrapMat,
    );
    wrap.position.y = y;
    ninjaSword.add(wrap);
  });
  const pommel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.061, 0.055, 0.045, 14),
    guardMat,
  );
  pommel.position.y = 0.655;
  ninjaSword.add(pommel);
  ninjaSword.position.set(-0.025, 0.015, -0.32);
  ninjaSword.rotation.z = -0.68;
  ninjaSword.scale.setScalar(1.22);
  registerAccessory('ninja-sword', ninjaSword);

  // Dark sunglasses with a warm frame. The lenses sit just in front of the
  // existing eyes, while the bridge and short arms make them read as eyewear.
  const starShades = new THREE.Group();
  const shadesLensMat = toon(0x211a35);
  const shadesFrameMat = toon(0xffc83d);
  [-1, 1].forEach((side) => {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), shadesLensMat);
    lens.position.set(side * 0.15, 0, 0);
    lens.scale.set(1.08, 0.76, 1);
    starShades.add(lens);
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.018, 8, 24),
      shadesFrameMat,
    );
    frame.position.set(side * 0.15, 0, 0.012);
    frame.scale.set(1.08, 0.76, 1);
    starShades.add(frame);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.026), shadesFrameMat);
    arm.position.set(side * 0.305, 0.015, -0.015);
    arm.rotation.z = side * -0.08;
    starShades.add(arm);
  });
  const shadesBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.024, 0.028),
    shadesFrameMat,
  );
  shadesBridge.position.z = 0.012;
  starShades.add(shadesBridge);
  starShades.position.set(0, 0.075, 0.478);
  registerAccessory('star-shades', starShades);

  // Layered feather shapes form a pair of soft wings behind the body. Their
  // outer feathers remain visible from the front customization camera.
  const angelWings = new THREE.Group();
  const wingMat = toon(0xf7f3ff);
  const wingShadeMat = toon(0xcfe4ff);
  [-1, 1].forEach((side) => {
    const featherSpecs = [
      { x: 0.39, y: 0.08, scaleX: 0.66, scaleY: 1.55, angle: 0.55 },
      { x: 0.5, y: -0.01, scaleX: 0.58, scaleY: 1.35, angle: 0.78 },
      { x: 0.47, y: -0.15, scaleX: 0.52, scaleY: 1.15, angle: 1.02 },
    ];
    featherSpecs.forEach((spec, index) => {
      const feather = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 18, 12),
        index % 2 === 0 ? wingMat : wingShadeMat,
      );
      feather.position.set(side * spec.x, spec.y, 0);
      feather.scale.set(spec.scaleX, spec.scaleY, 0.32);
      feather.rotation.z = side * -spec.angle;
      angelWings.add(feather);
    });
  });
  angelWings.position.set(0, 0.015, -0.29);
  registerAccessory('angel-wings', angelWings);

  // ── EYES (flat disc "decal" eyes, pasted tangent to the head surface) ──
  const eyeGrp = new THREE.Group();
  eyeGrp.position.set(0, 0.08, 0.41);

  const HEAD_R = 0.46;
  const EYE_SURFACE_PAD = 0.006; // lifts the disc just clear of the sphere to avoid z-fighting

  // Sleepy eyes (Slobu): instead of a separate eyelid panel floating in
  // front of the eye (which broke at side angles since it didn't share the
  // eye's surface-normal orientation), the eye disc itself is only drawn as
  // its lower half. The hidden upper half simply reveals the head's own
  // colour, so the "closed eyelid" look is baked into the same
  // surface-aligned anchor as the eye and always turns correctly with it.
  const isSleepy = eyeStyle === 'sleepy';

  function mkFlatEye(sideSign) {
    // Same base placement as before; projected flat onto the head sphere's surface.
    const raw = new THREE.Vector3(sideSign * 0.15, 0.08, 0.41);
    const normal = raw.clone().normalize();
    const surfaceLocal = normal.clone().multiplyScalar(HEAD_R + EYE_SURFACE_PAD).sub(eyeGrp.position);

    const anchor = new THREE.Group();
    anchor.position.copy(surfaceLocal);
    anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    const thetaStart  = isSleepy ? Math.PI : 0;
    const thetaLength = isSleepy ? Math.PI : Math.PI * 2;
    const white = new THREE.Mesh(new THREE.CircleGeometry(0.125, 24, thetaStart, thetaLength), whiteMat);
    anchor.add(white);

    // Cut the pupil with the exact same theta range as the white disc, so its
    // flat top edge lines up perfectly with the eyelid line — it can never
    // poke out above the "closed" half, and there's only ever one edge
    // (no separate offset circle reads as a second, mismatched pupil).
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(pupilSize, 18, thetaStart, thetaLength), eyeMat);
    pupil.position.z = 0.004; // sits just in front of the white disc, no z-fighting
    anchor.add(pupil);

    eyeGrp.add(anchor);
    return { anchor, pupil };
  }

  const { anchor: eyeAnchorL, pupil: eyeL } = mkFlatEye(-1);
  const { anchor: eyeAnchorR, pupil: eyeR } = mkFlatEye(1);

  bodyMesh.add(eyeGrp);

  // ── ANGRY BROWS (Rolzo) ──
  let browL = null, browR = null;
  if (eyeStyle === 'angry') {
    const browGeo = new THREE.BoxGeometry(0.13, 0.028, 0.025);
    browL = new THREE.Mesh(browGeo, browMat);
    browL.position.set(-0.15, 0.13, 0.03);
    browL.rotation.z = -0.45;
    eyeGrp.add(browL);
    browR = new THREE.Mesh(browGeo, browMat);
    browR.position.set(0.15, 0.13, 0.03);
    browR.rotation.z =  0.45;
    eyeGrp.add(browR);
  }

  // ── HANDS ── (on the upper-body pivot: they swing with the torso when it turns)
  const handGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const handL = new THREE.Mesh(handGeo, accentMat);
  handL.position.set(-0.52, 0.38, 0.1);
  handL.castShadow = true;
  upperGrp.add(handL);
  const handR = new THREE.Mesh(handGeo, accentMat);
  handR.position.set(0.52, 0.38, 0.1);
  handR.castShadow = true;
  upperGrp.add(handR);

  // ── FEET ── (stay directly on `g` — planted; not part of the upper-body turn)
  const footGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const footL = new THREE.Mesh(footGeo, accentMat);
  footL.scale.set(0.92, 0.54, 1.45);
  footL.position.set(-0.21, FOOT_BASE_Y, FOOT_BASE_Z);
  footL.castShadow = true;
  g.add(footL);
  const footR = new THREE.Mesh(footGeo, accentMat);
  footR.scale.set(0.92, 0.54, 1.45);
  footR.position.set(0.21, FOOT_BASE_Y, FOOT_BASE_Z);
  footR.castShadow = true;
  g.add(footR);

  return { grp: g, upperGrp, bodyMesh, bodyMat, accentMat, accessoryGroups, eyeGrp, eyeL, eyeR, browL, browR, handL, handR, footL, footR, baseBodyY: 0.48, baseBodyScale: new THREE.Vector3(1, 1, 1) };
}

export function mkDinosaurEgg(bodyCol, accentCol, spotDefinitions = []) {
  const grp = new THREE.Group();
  const upperGrp = new THREE.Group();
  grp.add(upperGrp);

  const bodyMat = toon(bodyCol);
  const accentMat = solid(accentCol);
  const profile = [
    [0.00, 0.00],
    [0.36, 0.04],
    [0.55, 0.20],
    [0.62, 0.46],
    [0.59, 0.72],
    [0.48, 0.98],
    [0.29, 1.20],
    [0.00, 1.34],
  ];
  const smoothProfile = new THREE.SplineCurve(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
  ).getPoints(28).map(point => new THREE.Vector2(Math.max(0, point.x), point.y));
  const eggGeometry = new THREE.LatheGeometry(smoothProfile, 36);
  eggGeometry.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(eggGeometry, bodyMat);
  const baseBodyScale = new THREE.Vector3(0.84, 0.92, 0.84);
  bodyMesh.scale.copy(baseBodyScale);
  bodyMesh.position.y = 0;
  bodyMesh.castShadow = true;
  upperGrp.add(bodyMesh);

  function radiusAt(height) {
    for (let i = 1; i < profile.length; i++) {
      const [r0, y0] = profile[i - 1];
      const [r1, y1] = profile[i];
      if (height <= y1) {
        const t = Math.max(0, Math.min(1, (height - y0) / (y1 - y0)));
        return r0 + (r1 - r0) * t;
      }
    }
    return 0;
  }

  spotDefinitions.forEach(({ x, y, size, scaleX = 1, scaleY = 1, rotation = 0 }) => {
    const surfaceRadius = radiusAt(y);
    const z = Math.sqrt(Math.max(0, surfaceRadius ** 2 - x ** 2));
    const normal = new THREE.Vector3(x, 0, z).normalize();
    const spot = new THREE.Mesh(new THREE.CircleGeometry(size, 24), accentMat);
    spot.position.set(x, y, z + 0.008);
    spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    spot.rotateZ(rotation);
    spot.scale.set(scaleX, scaleY, 1);
    bodyMesh.add(spot);
  });

  return {
    grp,
    upperGrp,
    bodyMesh,
    bodyMat,
    accentMat,
    accessoryGroups: null,
    baseBodyY: 0,
    baseBodyScale,
    eyeGrp: null,
    eyeL: null,
    eyeR: null,
    handL: null,
    handR: null,
    footL: null,
    footR: null,
  };
}

// ── Shared helper: Pewpew wandering pupils ──
// Pupils now live inside a per-eye flat anchor, so targets are small deltas
// from the eye's own center (0,0) rather than absolute head-relative offsets.
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
// Both pupils move together toward the same small offset (a real "look over
// there" glance, unlike Pewpew's independently-drifting wandering eyes).
function getGlanceTargets(eyeStyle) {
  const rOff = (min, max) => min + Math.random() * (max - min);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const dx = dir * rOff(0.02, 0.045);
  // Slobu's sleepy eye is a half-disc clipped flush at y=0; any vertical
  // move risks poking the pupil out past that line, so it only looks left/right.
  const dy = (eyeStyle === 'sleepy') ? 0 : (Math.random() < 0.5 ? 1 : -1) * rOff(0, 0.018);
  const t = new THREE.Vector2(dx, dy);
  return { l: t, r: t.clone() };
}

/* ═══════════════════════════════════════
   IDLE STUNT LIBRARY
   Each stunt is a pure function of progress p (0→1): every frame it sets
   transforms directly from p, so there is no per-frame accumulated state and
   the end-of-stunt restore is always exact. All stunts start AND end at the
   neutral pose (grp at y=0 / rotations ≡ 0 mod 2π, body/hands/feet at base),
   which is what makes fair random pairing safe.
═══════════════════════════════════════ */
const easeInOut = p => 0.5 - Math.cos(p * Math.PI) / 2;

const STUNTS = [
  {
    // 大跳：預備下蹲 → 高高躍起（伸展＋收腳＋舉手）→ 落地擠壓回彈
    id: 'big-jump', dur: 1.0,
    tick(c, p) {
      if (p < 0.25) {
        const q = p / 0.25;
        c.bodyMesh.scale.set(1 + 0.13 * q, 1 - 0.24 * q, 1 + 0.13 * q);
        c.bodyMesh.position.y = 0.48 - 0.11 * q;
      } else if (p < 0.78) {
        const q = (p - 0.25) / 0.53;
        const h = Math.sin(q * Math.PI);
        c.grp.position.y = h * 0.62;
        c.bodyMesh.position.y = 0.48;
        c.bodyMesh.scale.set(1 - 0.10 * h, 1 + 0.20 * h, 1 - 0.10 * h);
        c.handL.position.y = 0.38 + 0.34 * h;
        c.handR.position.y = 0.38 + 0.34 * h;
        c.footL.position.y = FOOT_BASE_Y + 0.17 * h;
        c.footR.position.y = FOOT_BASE_Y + 0.17 * h;
      } else {
        const q = (p - 0.78) / 0.22;
        const s = Math.sin((1 - q) * Math.PI * 0.5) * 0.18;
        c.grp.position.y = 0;
        c.bodyMesh.scale.set(1 + s, 1 - s, 1 + s);
        c.bodyMesh.position.y = 0.48 - s * 0.3;
        c.handL.position.y = 0.38;
        c.handR.position.y = 0.38;
        c.footL.position.y = FOOT_BASE_Y;
        c.footR.position.y = FOOT_BASE_Y;
      }
    },
  },
  {
    // 原地轉一圈（水平 360°）回到正面，途中輕輕墊一下腳
    id: 'spin-360', dur: 1.2,
    tick(c, p) {
      c.grp.rotation.y = easeInOut(p) * Math.PI * 2;
      c.grp.position.y = Math.sin(p * Math.PI) * 0.07;
    },
  },
  {
    // 好奇地一直轉、轉到背對鏡頭看一看，再繼續同方向轉回正面
    id: 'turn-look-back', dur: 2.6,
    tick(c, p) {
      let angle;
      if (p < 0.3)       angle = easeInOut(p / 0.3) * Math.PI;           // 轉到背面
      else if (p < 0.66) angle = Math.PI + Math.sin((p - 0.3) / 0.36 * Math.PI * 2) * 0.09; // 背對著左右張望
      else               angle = Math.PI + easeInOut((p - 0.66) / 0.34) * Math.PI;          // 繼續轉回正面
      c.grp.rotation.y = angle;
    },
  },
  {
    // 後空翻：跳起同時往後翻整整一圈
    id: 'backflip', dur: 1.05,
    tick(c, p) {
      c.grp.position.y = Math.sin(p * Math.PI) * 0.72;
      c.grp.rotation.x = -easeInOut(p) * Math.PI * 2;
      const h = Math.sin(p * Math.PI);
      c.handL.position.y = 0.38 + 0.26 * h;
      c.handR.position.y = 0.38 + 0.26 * h;
    },
  },
  {
    // 側翻（cartwheel）：跳起側向滾轉一圈
    id: 'cartwheel', dur: 1.1,
    tick(c, p) {
      c.grp.position.y = Math.sin(p * Math.PI) * 0.55;
      c.grp.rotation.z = easeInOut(p) * Math.PI * 2;
    },
  },
  {
    // 扭扭舞：上半身快速左右扭動、雙手高舉跟著擺
    id: 'wiggle-dance', dur: 1.7,
    tick(c, p) {
      const fade = Math.sin(p * Math.PI); // 淡入淡出，起止都平滑
      const w = Math.sin(p * Math.PI * 6);
      c.upperGrp.rotation.y = w * 0.42 * fade;
      c.bodyMesh.position.y = 0.48 + Math.abs(w) * 0.05 * fade;
      c.handL.position.y = 0.38 + (0.34 + w * 0.08) * fade;
      c.handR.position.y = 0.38 + (0.34 - w * 0.08) * fade;
    },
  },
  {
    // 伸展體操：整個身體向上拉長、雙手高舉過頭，像做早操
    id: 'stretch-up', dur: 1.5,
    tick(c, p) {
      const s = Math.sin(p * Math.PI);
      c.bodyMesh.scale.set(1 - 0.12 * s, 1 + 0.30 * s, 1 - 0.12 * s);
      c.bodyMesh.position.y = 0.48 + 0.14 * s;
      c.handL.position.y = 0.38 + 0.5 * s;
      c.handR.position.y = 0.38 + 0.5 * s;
      c.handL.position.x = -0.52 + 0.14 * s;
      c.handR.position.x =  0.52 - 0.14 * s;
    },
  },
  {
    // 向鏡頭揮手打招呼：舉起右手左右揮動
    id: 'wave-hello', dur: 1.6,
    tick(c, p) {
      const lift = Math.min(1, Math.min(p, 1 - p) / 0.18); // 快速舉起/放下
      c.handR.position.y = 0.38 + 0.5 * lift;
      c.handR.position.x = 0.52 + Math.sin(p * Math.PI * 7) * 0.1 * lift;
      c.upperGrp.rotation.y = -0.12 * lift; // 身體微微側向揮手那側
    },
  },
  {
    // 跳躍轉體：跳起的同時水平轉一整圈，體操落地
    id: 'spin-jump', dur: 1.0,
    tick(c, p) {
      const h = Math.sin(p * Math.PI);
      c.grp.position.y = h * 0.5;
      c.grp.rotation.y = easeInOut(p) * Math.PI * 2;
      c.bodyMesh.scale.set(1 - 0.08 * h, 1 + 0.14 * h, 1 - 0.08 * h);
      c.footL.position.y = FOOT_BASE_Y + 0.14 * h;
      c.footR.position.y = FOOT_BASE_Y + 0.14 * h;
    },
  },
  {
    // 不倒翁搖擺：以腳底為支點左右搖晃，幅度漸漸變小停回原位
    id: 'roly-poly', dur: 2.0,
    tick(c, p) {
      const decay = 1 - easeInOut(p);
      c.grp.rotation.z = Math.sin(p * Math.PI * 5) * 0.3 * decay;
    },
  },
  {
    // 連續兩次小彈跳：噠噠兩下的輕快節奏
    id: 'double-hop', dur: 1.0,
    tick(c, p) {
      const h = Math.abs(Math.sin(p * Math.PI * 2)) * 0.24;
      c.grp.position.y = h;
      c.bodyMesh.scale.set(1 - h * 0.5, 1 + h * 0.9, 1 - h * 0.5);
    },
  },
  {
    // 快速連轉兩圈（720°）炫技
    id: 'spin-double', dur: 1.4,
    tick(c, p) {
      c.grp.rotation.y = easeInOut(p) * Math.PI * 4;
      c.grp.position.y = Math.sin(p * Math.PI) * 0.1;
    },
  },
  {
    // 鞠躬謝幕：上半身前傾行禮、停一下再起身（腳不動）
    id: 'take-a-bow', dur: 1.8,
    tick(c, p) {
      let bow;
      if (p < 0.3)       bow = easeInOut(p / 0.3);
      else if (p < 0.65) bow = 1;
      else               bow = 1 - easeInOut((p - 0.65) / 0.35);
      c.upperGrp.rotation.x = bow * 0.5;
      c.handL.position.y = 0.38 - bow * 0.1;
      c.handR.position.y = 0.38 - bow * 0.1;
    },
  },
  {
    // 左右滑步：向右滑一步再向左滑回來，帶小碎跳與側傾
    id: 'side-shuffle', dur: 1.3,
    tick(c, p) {
      const slide = Math.sin(p * Math.PI * 2);
      c.grp.position.x = c.stuntBaseX + slide * 0.32;
      c.grp.position.y = Math.abs(Math.sin(p * Math.PI * 4)) * 0.06;
      c.grp.rotation.z = -slide * 0.1;
    },
  },
  {
    // 點點頭：上半身小幅前後點動，像在說「對對對」
    id: 'nod-nod', dur: 1.2,
    tick(c, p) {
      const fade = Math.sin(p * Math.PI);
      c.upperGrp.rotation.x = Math.max(0, Math.sin(p * Math.PI * 4)) * 0.2 * fade;
    },
  },
  {
    // 跳躍拍手：躍起時雙手在頭頂合掌拍一下
    id: 'jump-clap', dur: 0.95,
    tick(c, p) {
      const h = Math.sin(p * Math.PI);
      c.grp.position.y = h * 0.55;
      c.handL.position.x = -0.52 + 0.46 * h;
      c.handR.position.x =  0.52 - 0.46 * h;
      c.handL.position.y = 0.38 + 0.45 * h;
      c.handR.position.y = 0.38 + 0.45 * h;
    },
  },
  {
    // 踢腿：單腳向前高踢，身體微微後仰保持平衡
    id: 'high-kick', dur: 1.1,
    tick(c, p) {
      const k = Math.sin(p * Math.PI);
      c.footL.position.z = FOOT_BASE_Z + k * 0.42;
      c.footL.position.y = FOOT_BASE_Y + k * 0.3;
      c.upperGrp.rotation.x = -k * 0.16;
      c.handL.position.y = 0.38 + k * 0.18;
      c.handR.position.y = 0.38 + k * 0.18;
    },
  },
  {
    // 萬歲慶祝：小跳一下後雙手高舉成 V 字定格，再放下
    id: 'tada', dur: 1.6,
    tick(c, p) {
      const jump = p < 0.3 ? Math.sin(p / 0.3 * Math.PI) * 0.3 : 0;
      const arms = Math.min(1, Math.min(p / 0.25, (1 - p) / 0.15));
      c.grp.position.y = jump;
      c.handL.position.y = 0.38 + 0.42 * arms;
      c.handR.position.y = 0.38 + 0.42 * arms;
      c.handL.position.x = -0.52 - 0.13 * arms;
      c.handR.position.x =  0.52 + 0.13 * arms;
    },
  },
  {
    // 抬頭看天：上半身後仰望向天空發呆一會兒，再回神
    id: 'sky-gaze', dur: 2.2,
    tick(c, p) {
      const tilt = Math.min(1, Math.min(p / 0.25, (1 - p) / 0.25));
      c.upperGrp.rotation.x = -0.34 * tilt;
    },
  },
  {
    // 倒立：向前翻起倒立、微微晃動撐住，再翻回來站好
    id: 'handstand', dur: 1.9,
    tick(c, p) {
      let angle, wobble = 0;
      if (p < 0.35)      angle = easeInOut(p / 0.35) * Math.PI;
      else if (p < 0.65) { angle = Math.PI; wobble = Math.sin((p - 0.35) / 0.3 * Math.PI * 3) * 0.05; }
      else               angle = Math.PI * (1 - easeInOut((p - 0.65) / 0.35));
      c.grp.rotation.x = angle;
      c.grp.rotation.z = wobble;
      c.grp.position.y = Math.sin(angle / 2) * 1.05;
      const up = Math.sin(angle / 2);
      c.handL.position.y = 0.38 - up * 0.22; // 手往地面方向撐
      c.handR.position.y = 0.38 - up * 0.22;
    },
  },
];

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
      // Pewpew: continuously drifts to a new (independent per-eye) target.
      if (clock >= c.nextEyeWander) {
        const t = getWanderingTargets();
        c.eyeLTarget.copy(t.l); c.eyeRTarget.copy(t.r);
        c.nextEyeWander = clock + 1.3 + Math.random() * 1.0; // faster cadence
      }
    } else {
      // Everyone else: mostly centered, but occasionally glances off to one
      // side for a moment, then drifts back to looking straight ahead.
      if (c.glanceState === 'idle' && clock >= c.nextEyeWander) {
        const t = getGlanceTargets(c.eyeStyle);
        c.eyeLTarget.copy(t.l); c.eyeRTarget.copy(t.r);
        c.glanceState = 'looking';
        c.glanceUntil = clock + 2.0 + Math.random() * 2.0;
      } else if (c.glanceState === 'looking' && clock >= c.glanceUntil) {
        c.eyeLTarget.set(0, 0);
        c.eyeRTarget.set(0, 0);
        c.glanceState = 'idle';
        c.nextEyeWander = clock + 6 + Math.random() * 8; // long rest before next glance
      }
    }
    c.eyeL.position.x += (c.eyeLTarget.x - c.eyeL.position.x) * 0.06;
    c.eyeL.position.y += (c.eyeLTarget.y - c.eyeL.position.y) * 0.06;
    c.eyeR.position.x += (c.eyeRTarget.x - c.eyeR.position.x) * 0.06;
    c.eyeR.position.y += (c.eyeRTarget.y - c.eyeR.position.y) * 0.06;
  }

  // Gentle continuous idle sway (unchanged baseline motion), occasionally
  // overridden by a deliberate "look left/right" turn of the upper-body
  // pivot only — the feet (children of `grp`, not `upperGrp`) never move.
  function tickLookAround(c, t, clock) {
    const swayTarget = Math.sin(t * 0.7) * 0.08;

    if (c.lookPhase === 'idle' && clock >= c.nextLook) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      c.lookOffset = dir * (0.3 + Math.random() * 0.25); // ~17–31°
      c.lookPhase  = 'looking';
      c.lookUntil  = clock + 0.9 + Math.random() * 0.9;
    } else if (c.lookPhase === 'looking' && clock >= c.lookUntil) {
      c.lookPhase  = 'idle';
      c.lookOffset = 0;
      c.nextLook   = clock + 9 + Math.random() * 12; // rest before the next glance-around
    }

    const upperTarget = swayTarget + c.lookOffset;
    c.upperGrp.rotation.y += (upperTarget - c.upperGrp.rotation.y) * 0.04;
  }

  // A little happy hop-in-place flourish — purely cosmetic idle "personality",
  // with a light squash/stretch on the body for a bouncier feel.
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

  // Restore every transform a stunt may have touched back to the neutral pose.
  function restoreStuntPose(c) {
    if (c.stuntBaseX != null) { c.grp.position.x = c.stuntBaseX; c.stuntBaseX = null; }
    c.grp.position.y = 0;
    c.grp.rotation.x = 0;
    c.grp.rotation.z = 0;
    c.grp.rotation.y = 0; // all spins end at 2π ≡ 0; snap exact
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

  // Random idle performance. Returns true while a stunt owns the body this
  // frame (idle breathing/sway/hop must then stay hands-off).
  function tickStunt(c, clock) {
    if (c.stuntState === 'idle') {
      if (clock < c.nextStunt || c.hopState === 'hopping') return false;
      // Pick a random stunt, avoiding the same one twice in a row.
      let pick;
      do {
        pick = STUNTS[Math.floor(Math.random() * STUNTS.length)];
      } while (STUNTS.length > 1 && pick.id === c.lastStuntId);
      c.stunt          = pick;
      c.lastStuntId    = pick.id;
      c.stuntState     = 'performing';
      c.stuntStartTime = clock;
      // Neutral starting point so the stunt's own p-based transforms are exact
      c.lookPhase  = 'idle';
      c.lookOffset = 0;
      restoreStuntPose(c);
      c.stuntBaseX = c.grp.position.x; // for stunts that slide sideways
    }

    const p = (clock - c.stuntStartTime) / c.stunt.dur;
    if (p >= 1) {
      restoreStuntPose(c);
      c.stuntState = 'idle';
      c.stunt = null;
      c.nextStunt = clock + 1 + Math.random() * 9; // fresh random 1–10 s rest
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
    if (c.characterType === 'egg') {
      return;
    }
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

  /**
   * Pick a roam destination for chars[selfIdx].
   * Avoids: current position (must travel ≥ MIN_TRAVEL),
   *         other chars' current positions, other chars' walk targets.
   */
  function pickRoamTarget(selfIdx) {
    const c = chars[selfIdx];
    const MIN_TRAVEL = 1.0;
    const MIN_CHAR   = SEP_DIST + 0.15; // a bit larger than runtime sep threshold
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
            c.nextWalk = clock + 2.0 + Math.random() * 3.0; // brief pause before re-roaming
          }
        }

        /* ─── PRIORITY 2: ROAMING WALK ─── */

        // Decay separation offset toward 0 each frame (~0.88 per frame ≈ returns in ~0.5s)
        c.sepOffsetX *= 0.88;
        c.sepOffsetZ *= 0.88;

        // Trigger a new walk when idle timer fires (never mid-stunt: the
        // performance owns the body until it finishes and restores the pose)
        if (c.walkState === 'idle' && clock >= c.nextWalk && c.stuntState !== 'performing') {
          const { tx, tz, dist } = pickRoamTarget(selfIdx);
          c.walkFrom      = { x: c.grp.position.x, z: c.grp.position.z };
          c.walkTarget    = { x: tx, z: tz };
          // atan2(dx, dz): dx=+1,dz=0 → PI/2 (faces +X); dx=0,dz=+1 → 0 (faces +Z/camera)
          c.walkFacing    = Math.atan2(tx - c.grp.position.x, tz - c.grp.position.z);
          const walkSpeed = c.moveSpeedMin + Math.random() * (c.moveSpeedMax - c.moveSpeedMin);
          c.walkDuration  = Math.max(0.9, dist / walkSpeed);
          c.walkStartTime = clock;
          c.walkState     = 'walking';
        }

        if (c.walkState === 'walking') {
          // Unwind any idle-only flourish so it doesn't linger while on the move
          c.upperGrp.rotation.y = 0;
          c.grp.position.y = 0;
          c.bodyMesh.scale.set(1, 1, 1);
          c.hopState  = 'idle';
          c.lookPhase = 'idle';
          c.lookOffset = 0;

          const elapsed  = clock - c.walkStartTime;
          const progress = Math.min(elapsed / c.walkDuration, 1.0);
          const ease     = 0.5 - Math.cos(progress * Math.PI) / 2; // smooth in-out

          // Fade sep offset to 0 in the last 15% of walk so arrival is clean
          const offsetFade = 1 - Math.max(0, (progress - 0.85) / 0.15);
          c.grp.position.x = c.walkFrom.x + (c.walkTarget.x - c.walkFrom.x) * ease + c.sepOffsetX * offsetFade;
          c.grp.position.z = c.walkFrom.z + (c.walkTarget.z - c.walkFrom.z) * ease + c.sepOffsetZ * offsetFade;

          // Face direction of movement (angle-wrap for shortest arc)
          let rd = c.walkFacing - c.grp.rotation.y;
          while (rd >  Math.PI) rd -= Math.PI * 2;
          while (rd < -Math.PI) rd += Math.PI * 2;
          c.grp.rotation.y += rd * 0.10;

          // Body bob
          const step      = elapsed * 8.5;
          const walkBodyY = 0.48 + Math.abs(Math.sin(step)) * 0.09;
          c.bodyMesh.position.y = walkBodyY;

          // Arm swing (gait) — contralateral: each arm swings with the
          // OPPOSITE foot (left arm forward as the right foot steps), and the
          // swing is forward/back (z) like a real gait, not sideways flapping.
          // footL runs on phase (step + π), so handL runs on (step).
          c.handL.position.x = -0.52;
          c.handR.position.x =  0.52;
          c.handL.position.y = walkBodyY - 0.1 + Math.sin(step) * 0.04;
          c.handR.position.y = walkBodyY - 0.1 + Math.sin(step + Math.PI) * 0.04;
          c.handL.position.z = 0.1 + Math.sin(step) * 0.14;
          c.handR.position.z = 0.1 + Math.sin(step + Math.PI) * 0.14;

          // Foot shuffle + lift (each foot rises off the ground on its forward swing)
          c.footL.position.z = FOOT_BASE_Z + Math.sin(step + Math.PI) * 0.04;
          c.footR.position.z = FOOT_BASE_Z + Math.sin(step) * 0.04;
          c.footL.position.y = FOOT_BASE_Y + Math.max(0, Math.sin(step + Math.PI)) * 0.09;
          c.footR.position.y = FOOT_BASE_Y + Math.max(0, Math.sin(step)) * 0.09;

          tickBlink(c, clock);
          tickEyes(c, clock);

          const sp = worldToScreen(c.grp.position.x, walkBodyY + 0.55, c.grp.position.z);
          c.lbl.style.left = sp.x + 'px'; c.lbl.style.top = sp.y + 'px';

          if (progress >= 1.0) {
            // Snap to exact destination and clear collision offset
            c.grp.position.x = c.walkTarget.x;
            c.grp.position.z = c.walkTarget.z;
            c.sepOffsetX = 0; c.sepOffsetZ = 0;
            c.walkState  = 'idle';
            c.nextWalk   = clock + 5 + Math.random() * 11; // rest 5–16 s
            c.footL.position.z = FOOT_BASE_Z; c.footR.position.z = FOOT_BASE_Z;
            c.footL.position.y = FOOT_BASE_Y; c.footR.position.y = FOOT_BASE_Y;
            c.handL.position.z = 0.1; c.handR.position.z = 0.1; // idle never writes hand z
          }
          return;
        }

        /* ─── PRIORITY 3: IDLE ─── */
        tickBlink(c, clock);
        tickEyes(c, clock);

        // Random stunt performance takes full ownership of the body while it
        // plays; the regular idle motions below would fight its transforms.
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

        // While standing still, gently turn back to face the camera (whatever
        // direction the last walk left them facing). Shortest-arc wrap, same
        // technique as the walk-facing turn.
        let faceBack = -c.grp.rotation.y;
        while (faceBack >  Math.PI) faceBack -= Math.PI * 2;
        while (faceBack < -Math.PI) faceBack += Math.PI * 2;
        c.grp.rotation.y += faceBack * 0.025;

        c.handL.position.y = bodyY - 0.1 + Math.sin(t * 1.8) * 0.035;
        c.handR.position.y = bodyY - 0.1 + Math.sin(t * 1.8 + Math.PI) * 0.035;
        c.handL.position.x = -0.52 + Math.sin(t * 1.2) * 0.025;
        c.handR.position.x =  0.52 + Math.sin(t * 1.2 + Math.PI) * 0.025;

        // Idle personality: gentle sway + occasional look-around turn (torso
        // only), plus an occasional happy hop-in-place flourish.
        tickLookAround(c, t, clock);
        tickHop(c, clock);

        const sp = worldToScreen(c.grp.position.x, bodyY + c.grp.position.y + 0.55, c.grp.position.z);
        c.lbl.style.left = sp.x + 'px'; c.lbl.style.top = sp.y + 'px';
      });

      /* ── PASS 2: pairwise separation (runs after all positions are set) ── */
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
          const half = (SEP_DIST - d) * 0.5; // push each apart by half the overlap

          // Walking chars absorb the push as a temporary offset that decays back to path.
          // Idle chars move their position directly (they stay there until next walk).
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
