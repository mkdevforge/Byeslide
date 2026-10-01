import * as THREE from "./vendor/three.module.min.js";

// Every slide file of this deck becomes a sheet of paper. The sheets float
// as a fan in reading order, fly into one stack (the build), then fan out again.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const SHEET_WIDTH = 1.6;
const SHEET_HEIGHT = 0.9;
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 576;
const GATHER_AT = 2.2;
const RELEASE_AT = 9;
const HOLD_TIME = 7;
const CYCLE = 13;

// The fan: a hand of cards that radiates from a pivot below it. Every sheet
// shares one tilt and differs only in how far it turns within its own plane,
// so the sheets stay parallel and never cut through each other. Later sheets
// sit in front, so each sheet shows a wedge with its number and file name.
const FAN_PIVOT = new THREE.Vector3(2.25, -1.95, -0.3);
const FAN_RADIUS = 3.3;
const FAN_SPREAD = 0.82;
const FAN_DEPTH_STEP = 0.1;
const FAN_TILT = new THREE.Euler(-0.26, 0.22, 0);
const SHADOW_OFFSET = 0.05;

await Promise.all([
  document.fonts.load('800 200px "Bricolage Grotesque"'),
  document.fonts.load('500 26px "Martian Mono"')
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

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  const cameraBase = new THREE.Vector3(0.4, 1.4, 7.2);
  const lookAt = new THREE.Vector3(1.5, -0.05, 0);

  // Lights only shade the paper edges. The printed face ignores light, so the inks stay true.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4680, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 7, 6);
  scene.add(sun);

  const geometry = new THREE.BoxGeometry(SHEET_WIDTH, SHEET_HEIGHT, 0.006);
  const shadowGeometry = new THREE.PlaneGeometry(SHEET_WIDTH, SHEET_HEIGHT);
  // A hard offset shadow in the text color, as in the deck. Over the navy
  // background it disappears. Over another sheet it separates the two.
  const shadowMaterial = new THREE.MeshBasicMaterial();
  const sheets = files.map((file, index) => createSheet(file, index));

  function createSheet(file, index) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = TEXTURE_WIDTH;
    textureCanvas.height = TEXTURE_HEIGHT;
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const front = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, [paper, paper, paper, paper, front, paper]);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.position.z = -0.012;
    mesh.add(shadow);
    scene.add(mesh);

    // The sheet's place in the fan: left to right in slide order, one step
    // forward each, then the whole fan tilts as one piece.
    const random = seeded(index + 7);
    const n = files.length;
    const angle = n === 1 ? 0 : ((index / (n - 1)) * 2 - 1) * FAN_SPREAD;
    const offset = new THREE.Vector3(
      FAN_RADIUS * Math.sin(angle),
      FAN_RADIUS * Math.cos(angle),
      index * FAN_DEPTH_STEP
    ).applyEuler(FAN_TILT);
    const scatter = {
      position: FAN_PIVOT.clone().add(offset),
      turn: -angle
    };
    const stack = {
      position: new THREE.Vector3(
        2.75 + (random() - 0.5) * 0.05,
        -0.05 + (files.length - index) * 0.04,
        2.2 + (random() - 0.5) * 0.04
      ),
      rotation: new THREE.Euler(-0.95, 0.12, (random() - 0.5) * 0.05)
    };

    return { file, index, mesh, shadow, texture, textureCanvas, scatter, stack, phase: random() * Math.PI * 2 };
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

    // The left column holds the file name and number: the part of each sheet the fan leaves visible.
    const slash = sheet.file.lastIndexOf("/");
    const folder = slash >= 0 ? sheet.file.slice(0, slash + 1) : "";
    const name = sheet.file.slice(slash + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = '500 26px "Martian Mono", monospace';
    if ("fontStretch" in ctx) {
      ctx.fontStretch = "semi-condensed";
    }
    ctx.fillStyle = inks.soft;
    ctx.fillText(folder, 44, 74);
    ctx.fillStyle = inks.text;
    ctx.fillText(name, 44, 108);
    if ("fontStretch" in ctx) {
      ctx.fontStretch = "normal";
    }
    ctx.font = '800 150px "Bricolage Grotesque", sans-serif';
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = inks.ink1;
    ctx.fillText(String(sheet.index + 1).padStart(2, "0"), 34, 262);

    // A sketch of a slide in the art area on the right.
    const ax = 330;
    const ay = 56;
    const aw = w - ax - 48;
    const ah = h - ay - 56;
    const layout = sheet.index % 4;
    if (layout === 0) {
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(ax + aw * 0.56, ay, aw * 0.44, ah);
      ctx.fillStyle = inks.ink1;
      ctx.fillRect(ax, ay + 40, aw * 0.5, 54);
      ctx.fillRect(ax, ay + 116, aw * 0.36, 54);
      ctx.fillStyle = inks.ink3;
      ctx.beginPath();
      ctx.arc(ax + aw * 0.7, ay + ah * 0.56, ah * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else if (layout === 1) {
      ctx.fillStyle = inks.ink1;
      ctx.fillRect(ax, ay + 20, aw * 0.62, 50);
      for (let line = 0; line < 6; line += 1) {
        ctx.fillRect(ax, ay + 118 + line * 46, aw * (0.34 + random() * 0.2), 18);
      }
      ctx.fillStyle = inks.ink3;
      ctx.fillRect(ax + aw * 0.62, ay + 110, aw * 0.3, ah * 0.6);
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(ax + aw * 0.7, ay + 170, aw * 0.3, ah * 0.5);
    } else if (layout === 2) {
      ctx.fillStyle = inks.ink3;
      ctx.fillRect(ax, ay, aw, ah);
      ctx.fillStyle = inks.ink1;
      const barWidth = (aw - 60) / 6;
      for (let bar = 0; bar < 6; bar += 1) {
        const barHeight = ah * (0.2 + random() * 0.6);
        ctx.fillRect(ax + 40 + bar * barWidth, ay + ah - 36 - barHeight, barWidth - 26, barHeight);
      }
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(ax, ay + ah - 22, aw * 0.5, 22);
    } else {
      ctx.fillStyle = inks.text;
      ctx.fillRect(ax, ay, aw * 0.78, ah);
      ctx.fillStyle = inks.ink3;
      for (let line = 0; line < 7; line += 1) {
        ctx.fillRect(ax + 36 + (line % 3) * 30, ay + 44 + line * 54, aw * (0.2 + random() * 0.3), 16);
      }
      ctx.fillStyle = inks.ink2;
      ctx.fillRect(ax + aw * 0.66, ay + 30, aw * 0.34, aw * 0.34);
    }
    ctx.globalCompositeOperation = "source-over";

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
      soft: read("--color-text-soft", "#4a5384"),
      ink1: read("--ink-1", "#0078bf"),
      ink2: read("--ink-2", "#ff48b0"),
      ink3: read("--ink-3", "#ffe800")
    };
  }

  function paint() {
    shadowMaterial.color.set(readInks().text);
    sheets.forEach(drawSheet);
  }

  document.addEventListener("byeslide:inks", paint);
  paint();

  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  slide?.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1
    );
  });

  const fanEuler = new THREE.Euler();
  const fanQuaternion = new THREE.Quaternion();
  const stackQuaternion = new THREE.Quaternion();
  const floatPosition = new THREE.Vector3();
  let startedAt = performance.now();
  let hasRendered = false;
  let wasActive = false;

  // Each cycle: float as a fan, fly into the stack one by one, hold, fan out again.
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

    // Floating moves each sheet within the fan only, so the sheets stay parallel.
    floatPosition.copy(sheet.scatter.position);
    floatPosition.y += Math.sin(time * 0.8 + sheet.index * 0.45) * 0.035;

    // The shadow falls to the lower left, onto the sheet behind. In the stack it hides.
    sheet.shadow.position.x = -SHADOW_OFFSET * (1 - progress);
    sheet.shadow.position.y = -SHADOW_OFFSET * (1 - progress);

    sheet.mesh.position.lerpVectors(floatPosition, sheet.stack.position, progress);
    sheet.mesh.position.y += Math.sin(progress * Math.PI) * 0.25;

    // Euler order XYZ turns the sheet about its own normal first, then applies the shared tilt.
    fanEuler.set(FAN_TILT.x, FAN_TILT.y, sheet.scatter.turn + Math.sin(time * 0.6 + sheet.phase) * 0.01);
    fanQuaternion.setFromEuler(fanEuler);
    stackQuaternion.setFromEuler(sheet.stack.rotation);
    sheet.mesh.quaternion.slerpQuaternions(fanQuaternion, stackQuaternion, progress);
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
