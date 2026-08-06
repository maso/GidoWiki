import * as THREE from 'three';
import { toon } from '../materials.js';

/* ═══════════════════════════════════════
   3D ACCESSORY MESH BUILDERS
═══════════════════════════════════════ */

export function createAccessoryGroups(bodyMesh) {
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

  // Classic top hat
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

  // Red baseball cap
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

  // Warm ivory horns
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

  // Soft rabbit ears
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

  // Curled mustache
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

  // Sheathed ninja sword
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

  // Dark sunglasses
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

  // Layered angel wings
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

  return accessoryGroups;
}
