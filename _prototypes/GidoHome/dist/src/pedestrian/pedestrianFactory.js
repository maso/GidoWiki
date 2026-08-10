import * as THREE from 'three';
import { toon, solid } from '../materials.js';

/* ═══════════════════════════════════════
   3D PEDESTRIAN (路人) OPTIMIZED MESH FACTORY
═══════════════════════════════════════ */

// Pre-created static shared geometries (reused across all pedestrian instances)
const SHARED_GEOMETRIES = {
  head: new THREE.CylinderGeometry(0.145, 0.145, 0.22, 12),
  hair: new THREE.SphereGeometry(0.168, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.44),
  eye: new THREE.SphereGeometry(0.035, 10, 8),
  torso: (() => {
    const geo = new THREE.CylinderGeometry(0.20, 0.28, 0.28, 4);
    geo.rotateY(Math.PI / 4);
    return geo;
  })(),
  arm: (() => {
    const geo = new THREE.CylinderGeometry(0.042, 0.038, 0.22, 8);
    geo.translate(0, -0.09, 0);
    return geo;
  })(),
  hand: new THREE.SphereGeometry(0.04, 8, 6),
  hips: new THREE.BoxGeometry(0.27, 0.06, 0.13),
  leg: (() => {
    const geo = new THREE.BoxGeometry(0.12, 0.21, 0.13);
    geo.translate(0, -0.09, 0);
    return geo;
  })(),
  shoe: new THREE.BoxGeometry(0.12, 0.05, 0.16),
};

export function mkPedestrian(options = {}) {
  const {
    skinColor = 0xffd11a, // Classic Lego Yellow
    shirtColor = 0x3b5998,
    pantsColor = 0x2f3542,
    hairColor = 0x3d2314,
    shoeColor = 0x1e1e24,
  } = options;

  const g = new THREE.Group();
  const upperGrp = new THREE.Group();
  g.add(upperGrp);

  const skinMat = toon(skinColor);
  const shirtMat = toon(shirtColor);
  const pantsMat = toon(pantsColor);
  const hairMat = toon(hairColor);
  const shoeMat = solid(shoeColor);
  const eyeMat = solid(0x221133);

  // ── HEAD & HAIR ──
  const headGrp = new THREE.Group();
  headGrp.position.y = 0.72;

  const headMesh = new THREE.Mesh(SHARED_GEOMETRIES.head, skinMat);
  headMesh.castShadow = true;
  headGrp.add(headMesh);

  const hairMesh = new THREE.Mesh(SHARED_GEOMETRIES.hair, hairMat);
  hairMesh.position.set(0, 0.055, -0.012);
  hairMesh.scale.set(1.02, 0.88, 1.05);
  hairMesh.castShadow = true;
  headGrp.add(hairMesh);

  // ── VERTICAL OVAL EYES ──
  const eyeL = new THREE.Mesh(SHARED_GEOMETRIES.eye, eyeMat);
  eyeL.scale.set(0.72, 1.45, 0.4);
  eyeL.position.set(-0.062, 0.008, 0.138);
  headGrp.add(eyeL);

  const eyeR = new THREE.Mesh(SHARED_GEOMETRIES.eye, eyeMat);
  eyeR.scale.set(0.72, 1.45, 0.4);
  eyeR.position.set(0.062, 0.008, 0.138);
  headGrp.add(eyeR);

  upperGrp.add(headGrp);

  // ── TRAPEZOIDAL TORSO ──
  const torsoMesh = new THREE.Mesh(SHARED_GEOMETRIES.torso, shirtMat);
  torsoMesh.scale.set(0.9, 1, 0.52);
  torsoMesh.position.y = 0.44;
  torsoMesh.castShadow = true;
  upperGrp.add(torsoMesh);

  // ── ARMS & SPHERE HANDS ──
  // Left Arm
  const armGrpL = new THREE.Group();
  armGrpL.position.set(-0.19, 0.53, 0.02);
  armGrpL.rotation.z = -0.14;
  const armL = new THREE.Mesh(SHARED_GEOMETRIES.arm, shirtMat);
  armL.castShadow = true;
  armGrpL.add(armL);

  const handL = new THREE.Mesh(SHARED_GEOMETRIES.hand, skinMat);
  handL.position.set(0, -0.21, 0.01);
  armGrpL.add(handL);
  upperGrp.add(armGrpL);

  // Right Arm
  const armGrpR = new THREE.Group();
  armGrpR.position.set(0.19, 0.53, 0.02);
  armGrpR.rotation.z = 0.14;
  const armR = new THREE.Mesh(SHARED_GEOMETRIES.arm, shirtMat);
  armR.castShadow = true;
  armGrpR.add(armR);

  const handR = new THREE.Mesh(SHARED_GEOMETRIES.hand, skinMat);
  handR.position.set(0, -0.21, 0.01);
  armGrpR.add(handR);
  upperGrp.add(armGrpR);

  // ── HIPS ──
  const hipsMesh = new THREE.Mesh(SHARED_GEOMETRIES.hips, pantsMat);
  hipsMesh.position.y = 0.26;
  g.add(hipsMesh);

  // ── BLOCKY LEGS & FEET ──
  // Left Leg
  const legGrpL = new THREE.Group();
  legGrpL.position.set(-0.07, 0.24, 0);
  const legL = new THREE.Mesh(SHARED_GEOMETRIES.leg, pantsMat);
  legL.castShadow = true;
  legGrpL.add(legL);

  const shoeL = new THREE.Mesh(SHARED_GEOMETRIES.shoe, shoeMat);
  shoeL.position.set(0, -0.205, 0.015);
  legGrpL.add(shoeL);
  g.add(legGrpL);

  // Right Leg
  const legGrpR = new THREE.Group();
  legGrpR.position.set(0.07, 0.24, 0);
  const legR = new THREE.Mesh(SHARED_GEOMETRIES.leg, pantsMat);
  legR.castShadow = true;
  legGrpR.add(legR);

  const shoeR = new THREE.Mesh(SHARED_GEOMETRIES.shoe, shoeMat);
  shoeR.position.set(0, -0.205, 0.015);
  legGrpR.add(shoeR);
  g.add(legGrpR);

  return {
    grp: g,
    upperGrp,
    headMesh,
    torsoMesh,
    armGrpL,
    armGrpR,
    legGrpL,
    legGrpR,
  };
}
