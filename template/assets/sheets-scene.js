import * as THREE from "./vendor/three.module.min.js";

// Every slide file of this deck becomes a sheet of paper. The sheets drift
// apart, then fly into one stack (the build), then drift apart again.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const SHEET_WIDTH = 1.6;
const SHEET_HEIGHT = 0.9;
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 576;
const GATHER_AT = 2.2;
const RELEASE_AT = 9;
const HOLD_TIME = 7;
const CYCLE = 13;

await Promise.all([
  document.fonts.load('800 160px "Bricolage Grotesque"'),
  document.fonts.load('500 30px "Martian Mono"')
]).catch(() => {});

document.querySelectorAll("[data-sheets]").forEach(initSheets);

function initSheets(canvas) {
  if (canvas.dataset.sheetsReady === "true") {
    return;
  }
  canvas.dataset.sheetsReady = "true";

  const slide = canvas.closest("section");
  const ownSource = slide?.getAttribute("data-byeslide-source") || "";
  const sources = Array.from(document.querySelectorAll(".reveal .slides section[data-byeslide-source]"))
    .map((section) => section.getAttribute("data-byeslide-source"));
  const files = sources.length > 0 ? sources : Array.from({ length: 12 }, (_, index) => `slides/${String(index + 1).padStart(2, "0")}.html`);

  const count = slide?.querySelector("[data-sheet-count]");
  if (count && sources.length > 0) {
    count.innerHTML = `This deck has ${sources.length} files in <code>slides/</code>. The build stacks them into one <code>dist/index.html</code>.`;
  }

  // Three.js needs WebGL 2. Without it the slide keeps its heading and skips the scene.
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) {
    console.warn("Byeslide: WebGL 2 is not available in this browser, so the 3D scene on this slide is not shown.");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  const cameraBase = new THREE.Vector3(0.4, 1.4, 7.2);
  const lookAt = new THREE.Vector3(1.5, -0.05, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4680, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-3, 7, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 6;
  scene.add(sun);

  const geometry = new THREE.BoxGeometry(SHEET_WIDTH, SHEET_HEIGHT, 0.006);
  const sheets = files.map((file, index) => createSheet(file, index));

  function createSheet(file, index) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = TEXTURE_WIDTH;
    textureCanvas.height = TEXTURE_HEIGHT;
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const front = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82 });
    const mesh = new THREE.Mesh(geometry, [paper, paper, paper, paper, front, paper]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Scatter the sheets up and to the right; the heading sits in the lower left.
    const random = seeded(index + 7);
    const angle = index * 2.399963;
    const radius = 1.5 + random() * 1.6;
    const scatterPosition = new THREE.Vector3(
      2.1 + Math.cos(angle) * radius * 1.15,
      0.55 + Math.sin(angle * 1.3) * 1.15 + (random() - 0.5) * 0.4,
      -1.4 + Math.sin(angle) * radius * 0.8
    );
    if (scatterPosition.x < 1.6 && scatterPosition.y < 0.3) {
      scatterPosition.y = 0.3 + random() * 1.1;
    }
    const scatter = {
      position: scatterPosition,
      rotation: new THREE.Euler((random() - 0.5) * 0.9, (random() - 0.5) * 1.3, (random() - 0.5) * 0.6)
    };
    const stack = {
      position: new THREE.Vector3(
        2.75 + (random() - 0.5) * 0.05,
        -0.05 + (files.length - index) * 0.04,
        2.2 + (random() - 0.5) * 0.04
      ),
      rotation: new THREE.Euler(-0.95, 0.12, (random() - 0.5) * 0.05)
    };

    const sheet = { file, index, mesh, texture, textureCanvas, scatter, stack, phase: random() * Math.PI * 2 };
    drawSheet(sheet);
    return sheet;
  }

  function drawSheet(sheet) {
    const inks = readInks();
    const ctx = sheet.textureCanvas.getContext("2d");
    const random = seeded(sheet.index + 101);
    const w = TEXTURE_WIDTH;
    const h = TEXTURE_HEIGHT;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = inks.paper;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "multiply";
    const layout = sheet.index % 4;
    if (layout === 0) {
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(w * 0.58, 0, w * 0.42, h);
      ctx.fillStyle = inks.ink1;
      ctx.fillRect(72, 110, 420, 64);
      ctx.fillRect(72, 196, 300, 64);
      ctx.fillStyle = inks.ink3;
      ctx.beginPath();
      ctx.arc(w * 0.74, h * 0.46, 120, 0, Math.PI * 2);
      ctx.fill();
    } else if (layout === 1) {
      ctx.fillStyle = inks.ink1;
      ctx.fillRect(72, 90, 520, 58);
      for (let line = 0; line < 5; line += 1) {
        ctx.fillRect(72, 200 + line * 44, 300 + random() * 220, 18);
      }
      ctx.fillStyle = inks.ink3;
      ctx.fillRect(w * 0.64, 80, 290, 330);
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(w * 0.64 + 40, 150, 290, 220);
    } else if (layout === 2) {
      ctx.fillStyle = inks.ink3;
      ctx.fillRect(56, 70, w - 112, h - 190);
      ctx.fillStyle = inks.ink1;
      for (let bar = 0; bar < 7; bar += 1) {
        const barHeight = 60 + random() * 230;
        ctx.fillRect(110 + bar * 118, h - 130 - barHeight, 70, barHeight);
      }
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(56, h - 120, 360, 22);
    } else {
      ctx.fillStyle = inks.text;
      ctx.fillRect(56, 70, w * 0.62, h - 190);
      ctx.fillStyle = inks.ink3;
      for (let line = 0; line < 6; line += 1) {
        ctx.fillRect(100 + (line % 3) * 30, 110 + line * 48, 180 + random() * 260, 16);
      }
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(w * 0.72, 70, 200, 200);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = inks.text;
    ctx.font = '800 150px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = inks.ink1;
    ctx.fillText(String(sheet.index + 1).padStart(2, "0"), w - 48, h - 44);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = inks.text;
    ctx.textAlign = "left";
    ctx.font = '500 30px "Martian Mono", monospace';
    if ("fontStretch" in ctx) {
      ctx.fontStretch = "semi-condensed";
    }
    ctx.fillText(sheet.file, 56, h - 44);

    if (sheet.file === ownSource) {
      ctx.strokeStyle = inks.ink2;
      ctx.lineWidth = 28;
      ctx.strokeRect(14, 14, w - 28, h - 28);
    }

    sheet.texture.needsUpdate = true;
  }

  function readInks() {
    const style = getComputedStyle(document.documentElement);
    const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    return {
      paper: read("--color-paper", "#f5f6f2"),
      text: read("--color-text", "#1d2657"),
      ink1: read("--ink-1", "#0078bf"),
      ink2: read("--ink-2", "#ff48b0"),
      ink3: read("--ink-3", "#ffe800")
    };
  }

  document.addEventListener("byeslide:inks", () => sheets.forEach(drawSheet));

  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  slide?.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1
    );
  });

  const scatterQuaternion = new THREE.Quaternion();
  const stackQuaternion = new THREE.Quaternion();
  const floatPosition = new THREE.Vector3();
  let startedAt = performance.now();
  let hasRendered = false;
  let wasActive = false;

  // Each cycle: drift, fly into the stack one by one, hold, fly apart.
  function place(sheet, time) {
    const cycleTime = time % CYCLE;
    const n = sheets.length;
    let progress;
    if (cycleTime < GATHER_AT) {
      progress = 0;
    } else if (cycleTime < RELEASE_AT) {
      progress = easeInOut(clamp((cycleTime - GATHER_AT - sheet.index * (2 / n)) / 1.4));
    } else {
      progress = 1 - easeInOut(clamp((cycleTime - RELEASE_AT - (n - sheet.index) * (1.2 / n)) / 1.6));
    }

    const bob = Math.sin(time * 0.7 + sheet.phase);
    floatPosition.copy(sheet.scatter.position);
    floatPosition.y += bob * 0.12;
    floatPosition.x += Math.cos(time * 0.4 + sheet.phase) * 0.08;

    sheet.mesh.position.lerpVectors(floatPosition, sheet.stack.position, progress);
    sheet.mesh.position.y += Math.sin(progress * Math.PI) * 0.7;

    const wobble = (1 - progress) * 0.12;
    scatterQuaternion.setFromEuler(new THREE.Euler(
      sheet.scatter.rotation.x + Math.sin(time * 0.5 + sheet.phase) * wobble,
      sheet.scatter.rotation.y + Math.cos(time * 0.45 + sheet.phase) * wobble,
      sheet.scatter.rotation.z
    ));
    stackQuaternion.setFromEuler(sheet.stack.rotation);
    sheet.mesh.quaternion.slerpQuaternions(scatterQuaternion, stackQuaternion, progress);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (buffer.x !== Math.round(width * renderer.getPixelRatio()) || buffer.y !== Math.round(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  function isCurrentSlide() {
    return !window.Reveal || !slide || slide.classList.contains("present");
  }

  function render() {
    const active = isCurrentSlide();
    if (active && !wasActive) {
      startedAt = performance.now();
    }
    wasActive = active;
    if (active || !hasRendered) {
      resize();
      const time = reducedMotion.matches ? HOLD_TIME : (performance.now() - startedAt) / 1000;
      pointer.lerp(pointerTarget, 0.05);
      camera.position.set(cameraBase.x + pointer.x * 0.9, cameraBase.y - pointer.y * 0.5, cameraBase.z);
      camera.lookAt(lookAt);
      sheets.forEach((sheet) => place(sheet, time));
      renderer.render(scene, camera);
      hasRendered = true;
    }
    window.requestAnimationFrame(render);
  }

  new ResizeObserver(resize).observe(canvas);
  render();
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function easeInOut(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
