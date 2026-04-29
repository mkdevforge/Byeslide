import * as THREE from "./vendor/three.module.min.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const demos = [];

function initThreeDemo(canvas) {
  if (canvas.dataset.threeReady === "true") {
    return;
  }
  canvas.dataset.threeReady = "true";

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x01161e, 9, 24);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
  camera.position.set(0, 1.1, 8.8);

  const root = new THREE.Group();
  root.position.set(1.4, 0.1, 0);
  scene.add(root);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 5, 7);
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight(0xaec3b0, 0.7));

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.35, 0.34, 220, 32),
    new THREE.MeshStandardMaterial({
      color: 0x598392,
      emissive: 0x141426,
      metalness: 0.5,
      roughness: 0.24
    })
  );
  root.add(knot);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.55, 2),
    new THREE.MeshBasicMaterial({
      color: 0xaec3b0,
      opacity: 0.18,
      transparent: true,
      wireframe: true
    })
  );
  root.add(wire);

  const orbitMaterial = new THREE.MeshStandardMaterial({
    color: 0xaec3b0,
    emissive: 0x332522,
    metalness: 0.2,
    roughness: 0.32
  });
  const orbiters = Array.from({ length: 10 }, (_, index) => {
    const orbiter = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), orbitMaterial);
    orbiter.userData.phase = index * 0.68;
    orbiter.userData.radius = 2.35 + (index % 3) * 0.22;
    root.add(orbiter);
    return orbiter;
  });

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(260 * 3);
  for (let index = 0; index < 260; index += 1) {
    starPositions[index * 3] = (Math.random() - 0.5) * 18;
    starPositions[index * 3 + 1] = (Math.random() - 0.5) * 10;
    starPositions[index * 3 + 2] = -5 - Math.random() * 14;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xeff6e0,
      opacity: 0.68,
      size: 0.035,
      transparent: true
    })
  );
  scene.add(stars);

  const grid = new THREE.GridHelper(22, 22, 0xaec3b0, 0x01161e);
  grid.position.y = -2.75;
  grid.material.opacity = 0.28;
  grid.material.transparent = true;
  scene.add(grid);

  const startedAt = performance.now();
  let hasRendered = false;
  let frameId = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const drawingBuffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (drawingBuffer.x !== Math.round(width * renderer.getPixelRatio())
      || drawingBuffer.y !== Math.round(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  function isCurrentSlide() {
    const slide = canvas.closest("section");
    return !window.Reveal || !slide || slide.classList.contains("present");
  }

  function render() {
    resize();
    const elapsed = reducedMotion.matches ? 1.6 : (performance.now() - startedAt) / 1000;
    const active = isCurrentSlide();

    if (active || reducedMotion.matches || !hasRendered) {
      root.rotation.y = elapsed * 0.26;
      root.rotation.x = Math.sin(elapsed * 0.35) * 0.14;
      knot.rotation.y = elapsed * 0.58;
      knot.rotation.z = elapsed * 0.34;
      wire.rotation.y = -elapsed * 0.18;
      stars.rotation.y = elapsed * 0.018;
      grid.position.z = (elapsed * 0.55) % 1;

      orbiters.forEach((orbiter, index) => {
        const angle = elapsed * (0.58 + index * 0.015) + orbiter.userData.phase;
        orbiter.position.set(
          Math.cos(angle) * orbiter.userData.radius,
          Math.sin(angle * 1.35) * 0.85,
          Math.sin(angle) * orbiter.userData.radius
        );
      });

      renderer.render(scene, camera);
      hasRendered = true;
    }

    frameId = window.requestAnimationFrame(render);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  render();

  demos.push({
    canvas,
    renderer,
    scene,
    camera,
    stop() {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.dispose();
    }
  });
}

function initAllThreeDemos() {
  document.querySelectorAll("[data-three-demo]").forEach(initThreeDemo);
  window.ByeslideThreeDemos = demos;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAllThreeDemos, { once: true });
} else {
  initAllThreeDemos();
}
