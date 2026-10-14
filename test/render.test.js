const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildDeck } = require("../src/build");
const { finishAnimations, launchChromium } = require("../src/browser");
const { createStaticServer } = require("../src/static-server");

async function makeDeck(slides, css) {
  const deckDir = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-render-"));
  await fs.mkdir(path.join(deckDir, "slides"));
  for (const [name, html] of Object.entries(slides)) {
    await fs.writeFile(path.join(deckDir, "slides", name), html);
  }
  await fs.writeFile(path.join(deckDir, "styles.css"), css);
  return deckDir;
}

async function withBrowser(t, run) {
  const { chromium } = require("playwright");
  let browser;
  try {
    browser = await launchChromium(chromium);
  } catch (error) {
    t.skip(`no Chromium browser: ${error.message.split("\n")[0]}`);
    return;
  }
  try {
    await run(browser);
  } finally {
    await browser.close();
  }
}

async function openDeck(browser, url, view) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${url}/index.html${view === "print" ? "?view=print" : ""}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.Reveal?.isReady?.());
  return page;
}

test("print view keeps each slide's live padding", async (t) => {
  const deckDir = await makeDeck({
    "01-token.html": "<section class=\"slide\"><h2>Token padding</h2></section>",
    "02-custom.html": "<section class=\"slide custom\"><h2>Custom padding</h2></section>"
  }, [
    ".reveal .slides section.slide { --byeslide-slide-padding: 108px; padding: 108px; }",
    ".reveal .slides section.custom { padding: 60px 200px; }"
  ].join("\n"));
  const result = await buildDeck(deckDir);
  const server = createStaticServer(result.outDir);
  const url = await server.start();

  try {
    await withBrowser(t, async (browser) => {
      const measure = (page) => page.evaluate(() => Array.from(document.querySelectorAll("section[data-byeslide-source]"))
        .map((slide) => {
          const heading = slide.querySelector("h2");
          return `${heading.offsetLeft},${heading.offsetTop}`;
        }));
      const live = await measure(await openDeck(browser, url, "live"));
      const print = await measure(await openDeck(browser, url, "print"));

      assert.deepEqual(live, ["108,108", "200,60"]);
      assert.deepEqual(print, live);
    });
  } finally {
    await server.close();
  }
});

test("finishAnimations shows CSS animations at their end state", async (t) => {
  const deckDir = await makeDeck({
    "01-grow.html": "<section class=\"slide\"><div class=\"grow\" style=\"width: 400px; height: 20px\"></div></section>"
  }, [
    "@keyframes grow { from { width: 0; } }",
    ".reveal .slides section.present .grow { animation: grow 30s both; }"
  ].join("\n"));
  const result = await buildDeck(deckDir);
  const server = createStaticServer(result.outDir);
  const url = await server.start();

  try {
    await withBrowser(t, async (browser) => {
      const page = await openDeck(browser, url, "print");
      const width = () => page.evaluate(() => document.querySelector(".grow").getBoundingClientRect().width);

      assert.ok(await width() < 400);
      await finishAnimations(page);
      assert.equal(await width(), 400);
    });
  } finally {
    await server.close();
  }
});
