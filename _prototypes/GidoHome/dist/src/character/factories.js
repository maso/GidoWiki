import * as THREE from 'three';
import { toon, solid } from '../materials.js';
import { createAccessoryGroups } from './accessories.js';
import { FOOT_BASE_Y, FOOT_BASE_Z } from './stunts.js';

/* ═══════════════════════════════════════
   3D CHARACTER & EGG FACTORIES
═══════════════════════════════════════ */

export function mkCharacter(bodyCol, accentCol, eyeStyle = 'normal', pupilSize = 0.075) {
  const g = new THREE.Group();
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

  // ── ACCESSORIES ──
  const accessoryGroups = createAccessoryGroups(bodyMesh);

  // ── EYES (flat disc "decal" eyes, pasted tangent to the head surface) ──
  const eyeGrp = new THREE.Group();
  eyeGrp.position.set(0, 0.08, 0.41);

  const HEAD_R = 0.46;
  const EYE_SURFACE_PAD = 0.006;
  const isSleepy = eyeStyle === 'sleepy';

  function mkFlatEye(sideSign) {
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

    const pupil = new THREE.Mesh(new THREE.CircleGeometry(pupilSize, 18, thetaStart, thetaLength), eyeMat);
    pupil.position.z = 0.004;
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

  // ── HANDS ──
  const handGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const handL = new THREE.Mesh(handGeo, accentMat);
  handL.position.set(-0.52, 0.38, 0.1);
  handL.castShadow = true;
  upperGrp.add(handL);
  const handR = new THREE.Mesh(handGeo, accentMat);
  handR.position.set(0.52, 0.38, 0.1);
  handR.castShadow = true;
  upperGrp.add(handR);

  // ── FEET ──
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

  return {
    grp: g, upperGrp, bodyMesh, bodyMat, accentMat, accessoryGroups,
    eyeGrp, eyeL, eyeR, browL, browR, handL, handR, footL, footR,
    baseBodyY: 0.48, baseBodyScale: new THREE.Vector3(1, 1, 1)
  };
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
    grp, upperGrp, bodyMesh, bodyMat, accentMat,
    accessoryGroups: null, baseBodyY: 0, baseBodyScale,
    eyeGrp: null, eyeL: null, eyeR: null,
    handL: null, handR: null, footL: null, footR: null,
  };
}
