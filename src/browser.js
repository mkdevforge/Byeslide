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
  formatDiagnostics,
  installBrowsers,
  launchChromium,
  measureSlides,
  resolvePdfOutput,
  slugify,
  waitForReveal
};
