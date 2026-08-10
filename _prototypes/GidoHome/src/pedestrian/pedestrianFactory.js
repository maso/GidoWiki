import * as THREE from 'three';
import { toon, solid } from '../materials.js';

/* ═══════════════════════════════════════
   3D PEDESTRIAN (路人) LEGO MINIFIGURE FACTORY
═══════════════════════════════════════ */


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

  // ── LEGO HEAD & TOP STUD ──
  const headGrp = new THREE.Group();
  headGrp.position.y = 0.72;

  // Main Lego cylindrical head with slightly rounded top/bottom edges
  const headGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.22, 20);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headGrp.add(headMesh);

  // Top Lego stud
  const studGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14);
  const studMesh = new THREE.Mesh(studGeo, skinMat);
  studMesh.position.y = 0.135;
  studMesh.castShadow = true;
  headGrp.add(studMesh);

  // Lego Hair / Cap
  const hairGeo = new THREE.SphereGeometry(0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.position.set(0, 0.03, -0.01);
  hairMesh.castShadow = true;
  headGrp.add(hairMesh);

  // Eyes & Smile
  const eyeGeo = new THREE.CircleGeometry(0.022, 12);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.055, 0.01, 0.147);
  headGrp.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.055, 0.01, 0.147);
  headGrp.add(eyeR);

  // Classic Lego smile line
  const smileGeo = new THREE.RingGeometry(0.032, 0.042, 12, 1, Math.PI * 1.1, Math.PI * 0.8);
  const smileMesh = new THREE.Mesh(smileGeo, eyeMat);
  smileMesh.position.set(0, -0.045, 0.147);
  headGrp.add(smileMesh);

  upperGrp.add(headGrp);

  // ── LEGO TRAPEZOIDAL TORSO ──
  // Cylinder with 4 segments rotated 45deg creates a clean trapezoid box torso (narrower shoulders, wider hips)
  const torsoGeo = new THREE.CylinderGeometry(0.20, 0.28, 0.28, 4);
  torsoGeo.rotateY(Math.PI / 4);
  const torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
  torsoMesh.scale.set(0.9, 1, 0.52); // Flatten depth to match Lego minifig body ratio
  torsoMesh.position.y = 0.44;
  torsoMesh.castShadow = true;
  upperGrp.add(torsoMesh);

  // ── LEGO ARMS & C-HANDS ──
  const armGeo = new THREE.CylinderGeometry(0.042, 0.038, 0.22, 10);
  armGeo.translate(0, -0.09, 0);

  // Left Arm & Hand
  const armGrpL = new THREE.Group();
  armGrpL.position.set(-0.16, 0.52, 0);
  armGrpL.rotation.z = 0.18; // angled outward like Lego arms
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.castShadow = true;
  armGrpL.add(armL);

  // C-Clamp Lego Hand Left
  const handGeo = new THREE.TorusGeometry(0.032, 0.012, 8, 16, Math.PI * 1.4);
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.set(0, -0.21, 0);
  handL.rotation.x = Math.PI / 2;
  handL.rotation.z = Math.PI / 4;
  armGrpL.add(handL);
  upperGrp.add(armGrpL);

  // Right Arm & Hand
  const armGrpR = new THREE.Group();
  armGrpR.position.set(0.16, 0.52, 0);
  armGrpR.rotation.z = -0.18;
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.castShadow = true;
  armGrpR.add(armR);

  // C-Clamp Lego Hand Right
  const handR = new THREE.Mesh(handGeo, skinMat);
  handR.position.set(0, -0.21, 0);
  handR.rotation.x = Math.PI / 2;
  handR.rotation.z = -Math.PI / 4;
  armGrpR.add(handR);
  upperGrp.add(armGrpR);

  // ── LEGO HIPS ──
  const hipsGeo = new THREE.BoxGeometry(0.27, 0.06, 0.13);
  const hipsMesh = new THREE.Mesh(hipsGeo, pantsMat);
  hipsMesh.position.y = 0.26;
  hipsMesh.castShadow = true;
  g.add(hipsMesh);

  // ── LEGO BLOCKY LEGS & FEET (Pivot at hips) ──
  const legGeo = new THREE.BoxGeometry(0.12, 0.21, 0.13);
  legGeo.translate(0, -0.09, 0);

  // Left Leg
  const legGrpL = new THREE.Group();
  legGrpL.position.set(-0.07, 0.24, 0);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.castShadow = true;
  legGrpL.add(legL);
  // Shoe / Toe box
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.16), shoeMat);
  shoeL.position.set(0, -0.205, 0.015);
  shoeL.castShadow = true;
  legGrpL.add(shoeL);
  g.add(legGrpL);

  // Right Leg
  const legGrpR = new THREE.Group();
  legGrpR.position.set(0.07, 0.24, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.castShadow = true;
  legGrpR.add(legR);
  // Shoe / Toe box
  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.16), shoeMat);
  shoeR.position.set(0, -0.205, 0.015);
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

