import * as THREE from 'three';

export function setupScene(wrap, gs) {
  let W = gs.offsetWidth;
  let H = gs.offsetHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
  camera.position.set(0.5, 5.5, 11.5);
  camera.lookAt(0.5, 0.5, 0);

  // Lighting (Clean, bright toon lighting)
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 10, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -8;
  sun.shadow.camera.right = sun.shadow.camera.top = 8;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0xa0e8ff, 0.4);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  // Shadow Catcher
  const catcherMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.ShadowMaterial({ opacity: 0.18 })
  );
  catcherMesh.rotation.x = -Math.PI / 2;
  catcherMesh.receiveShadow = true;
  scene.add(catcherMesh);

  window.addEventListener('resize', () => {
    W = gs.offsetWidth;
    H = gs.offsetHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  });

  return {
    scene,
    camera,
    renderer,
    getDimensions: () => ({ W: gs.offsetWidth, H: gs.offsetHeight })
  };
}
