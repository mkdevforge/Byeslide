const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const {
  Bundler,
  bundleDeck,
  encodeDataUrlText,
  isSafeScriptText,
  parseSrcset
} = require("../src/bundle");
const { launchChromium } = require("../src/browser");
const { initDeck } = require("../src/init");
const { createStaticServer } = require("../src/static-server");

const templateRoot = path.resolve(__dirname, "..", "template");

test("encodeDataUrlText escapes only what a data: URL cannot carry", () => {
  assert.equal(encodeDataUrlText("a%b#c\td\ne\rf \"g\" <h>"), "a%25b%23c%09d%0Ae%0Df \"g\" <h>");
});

test("isSafeScriptText follows the HTML parser's script states", () => {
  assert.equal(isSafeScriptText("const a = 1;"), true);
  assert.equal(isSafeScriptText("const html = '</script>';"), false);
  assert.equal(isSafeScriptText("const a = '<!-- -->'; const b = '<script>';"), true);
  assert.equal(isSafeScriptText("const a = '<!--'; const b = '<script>';"), false);
});

test("parseSrcset keeps descriptors and handles commas inside URLs", () => {
  assert.deepEqual(parseSrcset("a.png 1x, b,c.png 2x,d.png"), [
    { url: "a.png", descriptor: "1x" },
    { url: "b,c.png", descriptor: "2x" },
    { url: "d.png", descriptor: "" }
  ]);
});

test("processCss inlines url(), @import and image-set() relative to each file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-css-"));
  await fs.mkdir(path.join(root, "css", "parts"), { recursive: true });
  await fs.writeFile(path.join(root, "css", "dot.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
  await fs.writeFile(path.join(root, "css", "parts", "font.woff2"), "font");
  await fs.writeFile(path.join(root, "css", "parts", "print.css"), "@charset \"utf-8\";\n@font-face { src: url(font.woff2) format(\"woff2\"); }");

  const bundler = new Bundler({ root, output: path.join(root, "out.html"), maxAssetMb: 20, linkLargeMedia: false });
  const css = [
    "@import url(\"https://fonts.example.com/a.css\");",
    ".a { background: url(dot.svg); }",
    "@import \"parts/print.css\" layer(base) screen;",
    ".b { background-image: image-set(\"dot.svg\" 1x); }",
    ".c { filter: url(#blur); background: url(\"data:image/svg+xml,%3Csvg%3E%3Cfilter id='n'/%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E\"); }",
    ".d { content: \"url(not-a-file.png)\"; }"
  ].join("\n");
  const out = await bundler.processCss(css, path.join(root, "css", "main.css"), "css/main.css");

  assert.match(out, /^@import url\("https:\/\/fonts\.example\.com\/a\.css"\);/);
  assert.match(out, /\.a \{ background: url\("data:image\/svg\+xml;base64,/);
  assert.match(out, /@layer base \{\n@media screen \{\n\n@font-face \{ src: url\("data:font\/woff2;base64,Zm9udA=="\) format\("woff2"\); \}/);
  assert.doesNotMatch(out, /@charset/);
  assert.match(out, /image-set\("data:image\/svg\+xml;base64,[^"]+" 1x\)/);
  assert.match(out, /filter: url\(#blur\)/);
  assert.match(out, /url\(%23n\)/);
  assert.match(out, /content: "url\(not-a-file\.png\)"/);
  assert.deepEqual(bundler.warnings, ["css/main.css: https://fonts.example.com/a.css is loaded from the network, so the bundle needs a connection for it."]);
});

test("bundleDeck stops on media above --max-asset-mb and names the file and the flags", async () => {
  const deckDir = await makeFixtureDeck({ bigVideo: true });
  await assert.rejects(
    bundleDeck(deckDir, { maxAssetMb: 1 }),
    (error) => {
      assert.match(error.message, /assets\/big\.webm is 1\.5 MB, above the 1 MB limit for media in a bundle\./);
      assert.match(error.message, /--max-asset-mb 2/);
      assert.match(error.message, /--link-large-media/);
      return true;
    }
  );
});

test("bundleDeck links large media instead with --link-large-media", async () => {
  const deckDir = await makeFixtureDeck({ bigVideo: true });
  const result = await bundleDeck(deckDir, { maxAssetMb: 1, linkLargeMedia: true });
  const html = await fs.readFile(result.output, "utf8");

  assert.match(html, /<video[^>]* src="assets\/big\.webm"/);
  assert.ok(result.warnings.some((warning) => /assets\/big\.webm \(1\.5 MB\) is linked, not inlined\. Share it next to bundle-fixture\.html as assets\/big\.webm\./.test(warning)));
});

test("bundleDeck warns about files that scripts load while the deck runs", async () => {
  const deckDir = await makeFixtureDeck();
  await fs.writeFile(path.join(deckDir, "assets", "lib", "label.js"), [
    "export const label = \"Loaded from a module\";",
    "export const data = () => fetch(\"assets/data.json\");",
    "export const remote = () => fetch(\"https://example.com/data.json\");"
  ].join("\n"));

  const result = await bundleDeck(deckDir);

  assert.deepEqual(result.warnings, [
    "assets/lib/label.js:2: fetch(\"assets/data.json\") loads a file while the deck runs. The bundle does not include it, so it fails offline."
  ]);
});

test("bundleDeck handles Reveal attributes, deck links and an existing import map", async (t) => {
  const deckDir = await makeFixtureDeck();
  await fs.writeFile(path.join(deckDir, "slides", "05-reveal.html"), `<section class="slide" data-background-video="assets/clip.webm" data-background-video-muted>
  <img data-src="assets/pic.svg" alt="Lazy picture">
  <div data-background-image="assets/pic.svg"></div>
  <a href="index.html#/1" data-back>Back to the module slide</a>
  <a href="assets/report.html" data-preview-link>Open the report</a>
  <link rel="modulepreload" href="./assets/main.js">
  <script type="importmap">{ "imports": { "label": "./assets/lib/label.js" } }</script>
  <script type="module">
    import { label } from "label";
    document.querySelector("[data-import-map-output]").textContent = label;
  </script>
  <p data-import-map-output>Waiting</p>
  <aside class="notes">Reveal notes.</aside>
</section>
`);

  const result = await bundleDeck(deckDir);
  const html = await fs.readFile(result.output, "utf8");

  assert.deepEqual(result.warnings, []);
  assert.match(html, /<img data-src="data:image\/svg\+xml;base64,/);
  assert.match(html, /data-background-image="data:image\/svg\+xml;base64,/);
  assert.match(html, /href="#\/1" data-back/);
  assert.match(html, /href="data:text\/html;charset=utf-8,[^"]*Section 2/);
  assert.doesNotMatch(html, /modulepreload/);
  assert.equal(html.match(/<script type="importmap">/g).length, 1);
  assert.match(html, /"label":"data:text\/javascript;charset=utf-8,/);
  assert.match(html, /data-byeslide-background-video="\[&quot;data:video\/webm;base64,/);

  const browser = await launchOrSkip(t);
  if (!browser) {
    return;
  }
  try {
    const page = await browser.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(pathToFileURL(await copyAlone(result.output)).href);
    await waitForReveal(page);
    await goToSlide(page, 4);
    await page.waitForFunction(() => document.querySelector("[data-import-map-output]").textContent === "Loaded from a module");
    await page.waitForFunction(() => document.querySelector(".slide-background.present video source")?.getAttribute("src").startsWith("blob:"));
    await page.waitForFunction(() => document.querySelector("img[alt='Lazy picture']").naturalWidth > 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("a bundled deck runs offline and matches the built deck", async (t) => {
  const browser = await launchOrSkip(t);
  if (!browser) {
    return;
  }
  const deckDir = await makeFixtureDeck();
  const result = await bundleDeck(deckDir);
  assert.deepEqual(result.warnings, []);
  const alone = await copyAlone(result.output);
  const server = createStaticServer(result.outDir);
  const url = await server.start();

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    context.on("request", (request) => requests.push(request.url()));
    context.on("page", (popup) => watchErrors(popup, errors));
    watchErrors(page, errors);

    await page.goto(pathToFileURL(alone).href);
    await waitForReveal(page);

    // Module with an import and top-level await.
    await page.waitForFunction(() => document.querySelector("[data-module-output]")?.textContent === "Loaded from a module");

    // Font from @font-face and a background image from the stylesheet.
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check("16px \"Fixture Mono\"")), true);
    assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".slide")).backgroundImage), /^url\("data:image\/svg\+xml/);

    // No element points at a relative file, in the deck or in the iframe.
    await goToSlide(page, 2);
    await page.waitForFunction(() => document.querySelector("iframe")?.contentDocument?.readyState === "complete");
    const relative = await page.evaluate(() => {
      const attributes = ["src", "href", "poster", "srcset", "data-src", "data-background-image", "data-background-video", "xlink:href"];
      const isRelative = (value) => value && !/^(?:data:|blob:|about:|https?:|mailto:|#)/i.test(value.trim());
      const documents = [document, ...Array.from(document.querySelectorAll("iframe")).map((frame) => frame.contentDocument)];
      return documents.flatMap((doc) => Array.from(doc.querySelectorAll("*")).flatMap((element) => attributes
        .map((name) => [name, element.getAttribute(name)])
        .filter(([, value]) => isRelative(value))
        .map(([name, value]) => `${element.tagName.toLowerCase()} ${name}=${value}`)));
    });
    assert.deepEqual(relative, []);

    // The iframe renders its own image, opens at its #section-2 anchor, and scrolls.
    const frame = page.frames().find((item) => item !== page.mainFrame());
    await frame.waitForFunction(() => window.scrollY > 500);
    assert.equal(await frame.evaluate(() => document.querySelector("img").naturalWidth > 0), true);
    assert.equal(await frame.evaluate(() => {
      window.scrollTo(0, 100);
      return window.scrollY;
    }), 100);

    // Video plays from the bundle.
    await goToSlide(page, 3);
    await page.waitForFunction(() => document.querySelector("video").readyState >= 2);

    // Fragments step one at a time.
    await goToSlide(page, 0);
    const visible = [];
    for (let step = 0; step < 3; step += 1) {
      visible.push(await page.evaluate(() => Reveal.getCurrentSlide().querySelectorAll(".fragment.visible").length));
      await page.evaluate(() => Reveal.nextFragment());
    }
    assert.deepEqual(visible, [0, 1, 2]);

    // The speaker view shows the notes of the current slide.
    await goToSlide(page, 0);
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.keyboard.press("s")]);
    await popup.waitForFunction(() => document.querySelector(".speaker-controls-notes .value")?.textContent.includes("Intro notes for the speaker."));
    await popup.close();

    // Screenshots of every slide match the built deck.
    const reference = await context.newPage();
    await reference.goto(`${url}/index.html`);
    await waitForReveal(reference);
    await reference.waitForFunction(() => document.querySelector("[data-module-output]")?.textContent === "Loaded from a module");
    const total = await page.evaluate(() => Reveal.getTotalSlides());
    for (let index = 0; index < total; index += 1) {
      const [bundled, built] = await Promise.all([settledScreenshot(page, index), settledScreenshot(reference, index)]);
      const difference = await compareScreenshots(reference, bundled, built);
      if (difference >= 0.002) {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-diff-"));
        await fs.writeFile(path.join(dir, "bundle.png"), bundled);
        await fs.writeFile(path.join(dir, "dist.png"), built);
        assert.fail(`slide ${index + 1} differs from dist/index.html in ${(difference * 100).toFixed(2)}% of pixels; screenshots in ${dir}`);
      }
    }

    const bundleUrl = pathToFileURL(alone).href;
    const outside = requests.filter((request) => !/^(?:data:|blob:|about:)/.test(request) && !request.startsWith(bundleUrl) && !request.startsWith(url));
    assert.deepEqual(outside, []);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the starter deck bundles into one file that runs offline", async (t) => {
  const browser = await launchOrSkip(t);
  if (!browser) {
    return;
  }
  const deckDir = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-starter-"));
  await initDeck(deckDir, { force: true });
  const result = await bundleDeck(deckDir);
  assert.deepEqual(result.warnings, []);
  const alone = await copyAlone(result.output);

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const requests = [];
    const errors = [];
    page.on("request", (request) => requests.push(request.url()));
    watchErrors(page, errors);
    await page.goto(pathToFileURL(alone).href);
    await waitForReveal(page);

    const total = await page.evaluate(() => Reveal.getTotalSlides());
    for (let index = 0; index < total; index += 1) {
      await goToSlide(page, index);
    }
    assert.equal(await page.evaluate(() => document.querySelector("[data-sheets]").dataset.sheetsReady), "true");
    assert.equal(await page.evaluate(() => Boolean(window.Chart?.getChart(document.querySelector("[data-context-chart]")))), true);

    const bundleUrl = pathToFileURL(alone).href;
    assert.deepEqual(requests.filter((request) => !/^(?:data:|blob:|about:)/.test(request) && !request.startsWith(bundleUrl)), []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

async function launchOrSkip(t) {
  try {
    const { chromium } = require("playwright");
    return await launchChromium(chromium);
  } catch (error) {
    t.skip(`Chromium is not available: run byeslide install-browsers. (${error.message.split("\n")[0]})`);
    return null;
  }
}

function watchErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
}

async function waitForReveal(page) {
  await page.waitForFunction(() => window.Reveal?.isReady?.());
}

async function goToSlide(page, index) {
  await page.evaluate((slide) => Reveal.slide(slide, 0, -1), index);
  await page.waitForTimeout(300);
}

async function settledScreenshot(page, index) {
  await goToSlide(page, index);
  // Both decks show iframes from the top, so the screenshots compare the same view.
  for (const frame of page.frames().filter((item) => item !== page.mainFrame())) {
    await frame.evaluate(() => window.scrollTo(0, 0));
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.querySelectorAll("video")).map((video) => new Promise((resolve) => {
      video.pause();
      if (video.readyState < 1) {
        video.addEventListener("loadedmetadata", () => {
          video.currentTime = 0;
          resolve();
        }, { once: true });
        return;
      }
      video.addEventListener("seeked", resolve, { once: true });
      video.currentTime = 0;
    })));
  });
  await page.waitForTimeout(300);
  return page.screenshot();
}

// Share of pixels where any channel differs by more than 24 of 255.
async function compareScreenshots(page, first, second) {
  return page.evaluate(async ([a, b]) => {
    const load = (base64) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = `data:image/png;base64,${base64}`;
    });
    const [imageA, imageB] = await Promise.all([load(a), load(b)]);
    const read = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const dataA = read(imageA);
    const dataB = read(imageB);
    let different = 0;
    for (let index = 0; index < dataA.length; index += 4) {
      if (Math.abs(dataA[index] - dataB[index]) > 24 || Math.abs(dataA[index + 1] - dataB[index + 1]) > 24 || Math.abs(dataA[index + 2] - dataB[index + 2]) > 24) {
        different += 1;
      }
    }
    return different / (dataA.length / 4);
  }, [first.toString("base64"), second.toString("base64")]);
}

async function copyAlone(file) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-alone-"));
  const target = path.join(dir, path.basename(file));
  await fs.copyFile(file, target);
  return target;
}

async function makeFixtureDeck(options = {}) {
  const deckDir = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-bundle-"));
  const write = async (relative, content) => {
    const file = path.join(deckDir, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };
  const svg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="${color}"/></svg>`;

  await write("deck.config.js", `module.exports = {
  title: "Bundle Fixture",
  width: 1280,
  height: 720,
  transition: "none",
  backgroundTransition: "none",
  controls: false,
  progress: false,
  hash: false,
  plugins: ["notes"],
  // Slides further than one step away stay hidden, so the iframe slide loads while hidden.
  reveal: { viewDistance: 1 }
};
`);
  await write("theme.css", "@font-face { font-family: \"Fixture Mono\"; src: url(\"assets/fonts/fixture.woff2\") format(\"woff2\"); }\n:root { --ink: #1d2657; }\n");
  await write("styles.css", ".reveal { font-family: \"Fixture Mono\", monospace; color: var(--ink); }\n.reveal .slides section.slide { background: url(assets/paper.svg); height: 100%; padding: 40px; }\n");
  await fs.mkdir(path.join(deckDir, "assets", "fonts"), { recursive: true });
  await fs.copyFile(path.join(templateRoot, "assets", "fonts", "martian-mono.woff2"), path.join(deckDir, "assets", "fonts", "fixture.woff2"));
  await write("assets/paper.svg", svg("#f5f6f2"));
  await write("assets/pic.svg", svg("#ff48b0"));
  await write("assets/chart.svg", svg("#0078bf"));
  await write("assets/main.js", "import { label } from \"./lib/label.js\";\nawait Promise.resolve();\ndocument.querySelector(\"[data-module-output]\").textContent = label;\n");
  await write("assets/lib/label.js", "export const label = \"Loaded from a module\";\n");
  await write("assets/report.html", `<!doctype html>
<html><head><meta charset="utf-8"><title>Report</title></head>
<body style="margin: 0; font: 16px sans-serif;">
  <div style="height: 1200px;">Top of the report</div>
  <h2 id="section-2">Section 2</h2>
  <img src="chart.svg" alt="Chart">
  <div style="height: 1200px;"></div>
</body></html>
`);
  await fs.copyFile(path.join(templateRoot, "assets", "live-reload.webm"), path.join(deckDir, "assets", "clip.webm"));

  await write("slides/01-intro.html", `<section class="slide">
  <h1>Bundle fixture</h1>
  <img src="assets/pic.svg" alt="Picture">
  <svg width="120" height="80" viewBox="0 0 120 80"><image href="assets/pic.svg" width="120" height="80"></image></svg>
  <ul>
    <li class="fragment">One</li>
    <li class="fragment">Two</li>
    <li class="fragment">Three</li>
  </ul>
  <aside class="notes">Intro notes for the speaker.</aside>
</section>
`);
  await write("slides/02-module.html", `<section class="slide">
  <p data-module-output>Waiting</p>
  <script type="module" src="./assets/main.js"></script>
  <aside class="notes">Module notes.</aside>
</section>
`);
  await write("slides/03-iframe.html", `<section class="slide">
  <iframe src="assets/report.html#section-2" style="width: 800px; height: 300px; border: 0;"></iframe>
  <aside class="notes">Iframe notes.</aside>
</section>
`);
  await write("slides/04-video.html", `<section class="slide">
  <video muted playsinline preload="auto" src="assets/clip.webm" style="width: 640px;"></video>
  <aside class="notes">Video notes.</aside>
</section>
`);

  if (options.bigVideo) {
    await write("assets/big.webm", Buffer.alloc(Math.round(1.5 * 1024 * 1024), 1));
    await write("slides/05-big.html", "<section class=\"slide\">\n  <video src=\"assets/big.webm\"></video>\n</section>\n");
  }
  return deckDir;
}
