import * as THREE from 'three';
import { toon, solid } from '../materials.js';

/* ═══════════════════════════════════════
   3D PEDESTRIAN (路人) MESH FACTORY
═══════════════════════════════════════ */

export function mkPedestrian(options = {}) {
  const {
    skinColor = 0xffd1a4,
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
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skinMat);
  headMesh.position.y = 0.88;
  headMesh.scale.set(1, 1.05, 0.95);
  headMesh.castShadow = true;
  upperGrp.add(headMesh);

  // Hair cap
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.178, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairMesh.position.set(0, 0.89, -0.01);
  hairMesh.castShadow = true;
  upperGrp.add(hairMesh);

  // ── EYES ──
  const eyeGeo = new THREE.SphereGeometry(0.024, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.065, 0.90, 0.155);
  upperGrp.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.065, 0.90, 0.155);
  upperGrp.add(eyeR);

  // ── TORSO & SHIRT ──
  const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.36, 12), shirtMat);
  torsoMesh.position.y = 0.55;
  torsoMesh.castShadow = true;
  upperGrp.add(torsoMesh);

  // ── ARMS (Left & Right) ──
  const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.32, 10);
  armGeo.translate(0, -0.14, 0); // Pivot at top shoulder

  const armGrpL = new THREE.Group();
  armGrpL.position.set(-0.18, 0.68, 0);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.castShadow = true;
  armGrpL.add(armL);
  // Hand L
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
  handL.position.y = -0.30;
  armGrpL.add(handL);
  upperGrp.add(armGrpL);

  const armGrpR = new THREE.Group();
  armGrpR.position.set(0.18, 0.68, 0);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.castShadow = true;
  armGrpR.add(armR);
  // Hand R
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
  handR.position.y = -0.30;
  armGrpR.add(handR);
  upperGrp.add(armGrpR);

  // ── PANTS / PELVIS ──
  const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.12, 12), pantsMat);
  pelvisMesh.position.y = 0.34;
  pelvisMesh.castShadow = true;
  g.add(pelvisMesh);

  // ── LEGS & SHOES (Pivot at hip) ──
  const legGeo = new THREE.CylinderGeometry(0.052, 0.045, 0.28, 10);
  legGeo.translate(0, -0.12, 0); // Pivot at hip

  const legGrpL = new THREE.Group();
  legGrpL.position.set(-0.075, 0.30, 0);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.castShadow = true;
  legGrpL.add(legL);
  // Shoe L
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.15), shoeMat);
  shoeL.position.set(0, -0.26, 0.03);
  shoeL.castShadow = true;
  legGrpL.add(shoeL);
  g.add(legGrpL);

  const legGrpR = new THREE.Group();
  legGrpR.position.set(0.075, 0.30, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.castShadow = true;
  legGrpR.add(legR);
  // Shoe R
  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.15), shoeMat);
  shoeR.position.set(0, -0.26, 0.03);
  shoeR.castShadow = true;
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
