const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { buildDeck } = require("./build");
const { createStaticServer } = require("./static-server");

async function exportPdf(deckDir = process.cwd(), options = {}) {
  const result = await buildDeck(deckDir, {
    clean: options.clean !== false,
    outDir: options.outDir
  });
  const output = resolvePdfOutput(result, options.output);
  await fs.mkdir(path.dirname(output), { recursive: true });

  const server = createStaticServer(result.outDir);
  const url = await server.start();
  const { chromium } = loadPlaywright();
  let browser;

  try {
    browser = await launchChromium(chromium);
    const page = await browser.newPage({
      viewport: {
        width: result.config.width,
        height: result.config.height
      }
    });
    const diagnostics = collectPageDiagnostics(page);
    await page.goto(`${url}/index.html?view=print`, { waitUntil: "networkidle" });
    await waitForReveal(page, diagnostics);
    await finishAnimations(page);
    await page.pdf({
      path: output,
      printBackground: true,
      preferCSSPageSize: true,
      width: `${result.config.width}px`,
      height: `${result.config.height}px`,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0"
      }
    });
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }

  return {
    ...result,
    output
  };
}

async function checkDeck(deckDir = process.cwd(), options = {}) {
  const result = await buildDeck(deckDir, {
    clean: options.clean !== false,
    outDir: options.outDir
  });
  const server = createStaticServer(result.outDir);
  const url = await server.start();
  const { chromium } = loadPlaywright();
  let browser;

  try {
    browser = await launchChromium(chromium);
    const page = await browser.newPage({
      viewport: {
        width: result.config.width,
        height: result.config.height
      }
    });
    const diagnostics = collectPageDiagnostics(page);
    await page.goto(`${url}/index.html`, { waitUntil: "networkidle" });
    await waitForReveal(page, diagnostics);
    const slides = await measureSlides(page);
    return {
      ...result,
      ok: slides.every((slide) => !slide.overflowX && !slide.overflowY && slide.offenders.length === 0),
      slides
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
}

async function screenshotDeck(deckDir = process.cwd(), options = {}) {
  const result = await buildDeck(deckDir, {
    clean: options.clean !== false,
    outDir: options.outDir
  });
  const outputDir = options.output
    ? path.resolve(result.deckDir, options.output)
    : path.join(result.outDir, "screenshots");
  const wait = options.wait === undefined ? 1000 : Number(options.wait);
  if (!Number.isFinite(wait) || wait < 0) {
    throw new Error("--wait must be a number of milliseconds.");
  }
  await fs.mkdir(outputDir, { recursive: true });
  await removeOldScreenshots(outputDir);

  const server = createStaticServer(result.outDir);
  const url = await server.start();
  const { chromium } = loadPlaywright();
  let browser;

  try {
    browser = await launchChromium(chromium);
    const page = await browser.newPage({
      viewport: {
        width: result.config.width,
        height: result.config.height
      }
    });
    const diagnostics = collectPageDiagnostics(page);
    await page.goto(`${url}/index.html`, { waitUntil: "networkidle" });
    await waitForReveal(page, diagnostics);
    // Fill the viewport with the slide at scale 1 and hide the presenter chrome.
    await page.evaluate(() => {
      window.Reveal.configure({
        margin: 0,
        controls: false,
        progress: false,
        slideNumber: false,
        transition: "none",
        backgroundTransition: "none"
      });
      window.Reveal.layout();
    });

    const slides = await page.evaluate(() => window.Reveal.getSlides().map((slide, index) => ({
      index: index + 1,
      source: slide.getAttribute("data-byeslide-source") || `slide-${index + 1}`
    })));
    const selected = selectSlides(slides, options.slides);
    const digits = Math.max(2, String(slides.length).length);
    const shots = [];

    for (const slide of selected) {
      // Show the slide with every fragment visible, as the audience sees it at the end.
      await page.evaluate((index) => {
        const target = window.Reveal.getSlides()[index - 1];
        const { h, v } = window.Reveal.getIndices(target);
        window.Reveal.slide(h, v);
        while (window.Reveal.nextFragment()) {
          // advance to the last fragment
        }
      }, slide.index);
      await waitFrames(page);
      await page.waitForTimeout(wait);
      await finishAnimations(page);
      await waitFrames(page);
      const file = path.join(outputDir, `slide-${String(slide.index).padStart(digits, "0")}.png`);
      await page.screenshot({ path: file });
      shots.push({ ...slide, file });
    }

    const sheet = path.join(outputDir, "sheet.png");
    await writeContactSheet(browser, shots, sheet, result.config);

    return {
      ...result,
      outputDir,
      sheet,
      shots
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
}

// Print view marks every slide as present, so CSS animations start at load.
// Jump finite animations and transitions to their end state before capture.
async function finishAnimations(page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (!Number.isFinite(animation.effect?.getComputedTiming().endTime)) {
        continue;
      }
      try {
        animation.finish();
      } catch {
        // A paused animation with playbackRate 0 cannot finish; leave it as is.
      }
    }
  });
}

async function waitFrames(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function selectSlides(slides, spec) {
  if (spec === undefined || spec === true || spec === "") {
    return slides;
  }

  const wanted = new Set();
  for (const part of String(spec).split(",")) {
    const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      throw new Error(`--slides expects slide numbers like 3 or 2,5-7, not "${part.trim()}".`);
    }
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    for (let index = Math.min(start, end); index <= Math.max(start, end); index += 1) {
      wanted.add(index);
    }
  }

  const missing = [...wanted].filter((index) => index < 1 || index > slides.length);
  if (missing.length > 0) {
    throw new Error(`The deck has ${slides.length} slides. No slide ${missing.join(", ")}.`);
  }

  return slides.filter((slide) => wanted.has(slide.index));
}

async function removeOldScreenshots(outputDir) {
  const entries = await fs.readdir(outputDir);
  await Promise.all(entries
    .filter((name) => /^slide-\d+\.png$/.test(name) || name === "sheet.png")
    .map((name) => fs.rm(path.join(outputDir, name), { force: true })));
}

async function writeContactSheet(browser, shots, output, config) {
  const columns = Math.min(4, shots.length);
  const thumbWidth = 480;
  const thumbHeight = Math.round(thumbWidth * config.height / config.width);
  const gap = 16;
  const figures = [];
  for (const shot of shots) {
    const data = (await fs.readFile(shot.file)).toString("base64");
    figures.push(`<figure><img src="data:image/png;base64,${data}"><figcaption>${shot.index} &middot; ${escapeHtml(shot.source)}</figcaption></figure>`);
  }

  const page = await browser.newPage({
    viewport: {
      width: columns * thumbWidth + (columns + 1) * gap,
      height: thumbHeight
    }
  });
  try {
    await page.setContent(`<!doctype html>
<style>
  body { margin: 0; padding: ${gap}px; background: #d4d4d4; font: 14px/1.3 system-ui, sans-serif; color: #222; }
  main { display: grid; grid-template-columns: repeat(${columns}, ${thumbWidth}px); gap: ${gap}px; }
  figure { margin: 0; }
  img { display: block; width: ${thumbWidth}px; height: ${thumbHeight}px; background: white; }
  figcaption { padding-top: 4px; }
</style>
<main>${figures.join("")}</main>`);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await page.screenshot({ path: output, fullPage: true });
  } finally {
    await page.close();
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    throw new Error("Playwright is required for this command. Run pnpm install in the Byeslide package or generated deck.");
  }
}

async function launchChromium(chromium) {
  const attempts = [
    { label: "bundled Chromium", options: { timeout: 30000 } },
    { label: "Google Chrome", options: { channel: "chrome", timeout: 30000 } },
    { label: "Microsoft Edge", options: { channel: "msedge", timeout: 30000 } }
  ];
  const failures = [];

  for (const attempt of attempts) {
    try {
      return await chromium.launch(attempt.options);
    } catch (error) {
      failures.push(`${attempt.label}: ${firstLine(error.message)}`);
    }
  }

  throw new Error([
    "Could not launch a Chromium browser for Byeslide.",
    "Run `byeslide install-browsers` to install the Playwright Chromium browser.",
    ...failures.map((failure) => `- ${failure}`)
  ].join("\n"));
}

async function installBrowsers(browser = "chromium") {
  const playwrightRoot = path.dirname(require.resolve("playwright"));
  const cliPath = path.join(playwrightRoot, "cli.js");

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "install", browser], {
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Playwright browser install failed with exit code ${code}.`));
      }
    });
  });
}

async function waitForReveal(page, diagnostics = [], timeoutMs = 15000) {
  try {
    await page.waitForFunction(
      () => window.Reveal && typeof window.Reveal.isReady === "function" && window.Reveal.isReady(),
      null,
      { timeout: timeoutMs }
    );
  } catch (error) {
    const details = formatDiagnostics(diagnostics);
    throw new Error(`Reveal did not become ready within ${timeoutMs}ms.${details ? `\n${details}` : ""}`);
  }
}

function collectPageDiagnostics(page) {
  const diagnostics = [];

  page.on("pageerror", (error) => {
    diagnostics.push(`pageerror: ${firstLine(error.message)}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      diagnostics.push(`console error: ${firstLine(message.text())}`);
    }
  });

  return diagnostics;
}

function formatDiagnostics(diagnostics) {
  if (!diagnostics.length) {
    return "";
  }

  return diagnostics.slice(-5).map((entry) => `- ${entry}`).join("\n");
}

async function measureSlides(page) {
  return page.evaluate(async () => {
    const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Measure each slide at rest: no slide transitions, no auto-animate, and CSS
    // animations and transitions jump to their end state.
    window.Reveal.configure({ autoAnimate: false, backgroundTransition: "none", transition: "none" });
    const settle = document.createElement("style");
    settle.textContent = "*, *::before, *::after { animation-delay: 0s !important; animation-duration: 0s !important; transition-delay: 0s !important; transition-duration: 0s !important; }";
    document.head.append(settle);

    const slides = window.Reveal.getSlides();
    const results = [];

    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      const indices = window.Reveal.getIndices(slide);
      window.Reveal.slide(indices.h, indices.v);
      await waitFrame();

      const source = slide.getAttribute("data-byeslide-source")
        || slide.closest("[data-byeslide-source]")?.getAttribute("data-byeslide-source")
        || `slide-${index + 1}`;
      const overflowX = slide.scrollWidth > slide.clientWidth + 1;
      const overflowY = slide.scrollHeight > slide.clientHeight + 1;
      const sectionRect = slide.getBoundingClientRect();
      const offenders = Array.from(slide.querySelectorAll("*"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            return false;
          }
          return rect.right > sectionRect.right + 1
            || rect.bottom > sectionRect.bottom + 1
            || rect.left < sectionRect.left - 1
            || rect.top < sectionRect.top - 1;
        })
        .slice(0, 5)
        .map(describeElement);

      results.push({
        index: index + 1,
        source,
        overflowX,
        overflowY,
        scrollWidth: slide.scrollWidth,
        scrollHeight: slide.scrollHeight,
        clientWidth: slide.clientWidth,
        clientHeight: slide.clientHeight,
        offenders
      });
    }

    return results;

    function describeElement(element) {
      const id = element.id ? `#${element.id}` : "";
      const classes = Array.from(element.classList).slice(0, 3).map((name) => `.${name}`).join("");
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    }
  });
}

function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "deck";
}

function resolvePdfOutput(result, explicitOutput) {
  if (explicitOutput) {
    return path.resolve(result.deckDir, explicitOutput);
  }

  return path.join(result.outDir, `${slugify(result.config.title)}.pdf`);
}

function firstLine(value) {
  return String(value).split(/\r?\n/)[0];
}

module.exports = {
  checkDeck,
  exportPdf,
  collectPageDiagnostics,
  finishAnimations,
  formatDiagnostics,
  installBrowsers,
  launchChromium,
  measureSlides,
  resolvePdfOutput,
  screenshotDeck,
  selectSlides,
  slugify,
  waitForReveal
};
