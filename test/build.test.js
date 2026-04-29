const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const rootPackage = require("../package.json");
const {
  buildDeck,
  extractSlideScripts,
  normalizeSlideHtml,
  prepareSlideScripts,
  stripFullDocument
} = require("../src/build");

test("normalizes slide fragments into Reveal sections", () => {
  const html = normalizeSlideHtml("<h1>Hello</h1>", "slides/01.html");
  assert.match(html, /^<section data-byeslide-source="slides\/01\.html">/);
  assert.match(html, /<h1>Hello<\/h1>/);
});

test("preserves existing section markup and adds source", () => {
  const html = normalizeSlideHtml("<section class=\"slide\"><h1>Hello</h1></section>", "slides/01.html");
  assert.match(html, /^<section data-byeslide-source="slides\/01\.html" class="slide">/);
});

test("extracts body content from full HTML documents", () => {
  const html = stripFullDocument("<!doctype html><html><head><title>x</title></head><body><main>Slide</main></body></html>");
  assert.equal(html, "<main>Slide</main>");
});

test("extracts slide scripts from Reveal slide markup", () => {
  const result = extractSlideScripts(
    "<section><h1>Demo</h1><script type=\"module\" src=\"./assets/demo.js\"></script></section>",
    "slides/03-demo.html"
  );
  assert.equal(result.html, "<section><h1>Demo</h1></section>");
  assert.deepEqual(result.scripts, [
    "<script data-byeslide-source=\"slides/03-demo.html\" data-byeslide-script-index=\"0\" data-byeslide-script-id=\"byeslide-c2xpZGVzLzAzLWRlbW8uaHRtbA-0\" type=\"module\" src=\"./assets/demo.js\"></script>"
  ]);
});

test("extracts inline module scripts with import.meta slide bindings", () => {
  const result = extractSlideScripts(
    "<section><script type=\"module\">const slide = window.Byeslide.slideForScript(import.meta);</script></section>",
    "slides/03-demo.html"
  );

  assert.equal(result.html, "<section></section>");
  assert.match(result.scripts[0], /data-byeslide-script-id="byeslide-c2xpZGVzLzAzLWRlbW8uaHRtbA-0"/);
  assert.match(result.scripts[0], /import\.meta\.byeslideScript = window\.Byeslide\?\.scriptForId\("byeslide-c2xpZGVzLzAzLWRlbW8uaHRtbA-0"\);/);
  assert.match(result.scripts[0], /import\.meta\.byeslideSlide = window\.Byeslide\?\.slideForScript\(import\.meta\);/);
});

test("prepareSlideScripts keeps repeated inline setup scripts", () => {
  const scripts = [
    "<script data-byeslide-source=\"slides/01.html\" data-byeslide-script-index=\"0\">init()</script>",
    "<script data-byeslide-source=\"slides/02.html\" data-byeslide-script-index=\"0\">init()</script>"
  ];

  assert.deepEqual(prepareSlideScripts(scripts), scripts);
});

test("prepareSlideScripts dedupes repeated external dependencies only", () => {
  const scripts = [
    "<script data-byeslide-source=\"slides/01.html\" data-byeslide-script-index=\"0\" src=\"./assets/vendor/chart.umd.js\"></script>",
    "<script data-byeslide-source=\"slides/01.html\" data-byeslide-script-index=\"1\">initOne()</script>",
    "<script data-byeslide-source=\"slides/02.html\" data-byeslide-script-index=\"0\" src=\"./assets/vendor/chart.umd.js\"></script>",
    "<script data-byeslide-source=\"slides/02.html\" data-byeslide-script-index=\"1\">initTwo()</script>"
  ];

  assert.deepEqual(prepareSlideScripts(scripts), [scripts[0], scripts[1], scripts[3]]);
});

test("buildDeck writes a Reveal-compatible deck", async () => {
  const deckDir = await makeDeck();
  const result = await buildDeck(deckDir);
  const index = await fs.readFile(result.indexPath, "utf8");

  assert.equal(result.slideFiles.length, 2);
  assert.match(index, /<div class="reveal">/);
  assert.match(index, new RegExp(`<meta name="generator" content="Byeslide ${escapeRegExp(rootPackage.version)}">`));
  assert.match(index, new RegExp(`version: "${escapeRegExp(rootPackage.version)}"`));
  assert.match(index, /data-byeslide-source="slides\/01-title\.html"/);
  assert.match(index, /Reveal\.initialize/);
  assert.match(index, /const PDF_ENDPOINT = "";/);
  assert.doesNotMatch(index, /\/__byeslide\/pdf/);
  assert.match(index, /window\.addEventListener\("keydown"/);
  assert.match(index, /url\.searchParams\.set\("view", "print"\)/);
  assert.match(index, /exitPrintView\(\)/);
  assert.match(index, /event\.key === "Escape"/);
  assert.match(index, /html\.reveal-print \.pdf-page/);
  assert.match(index, /padding: var\(--byeslide-slide-padding, 0\) !important;/);
  assert.match(index, /options\.margin = 0;/);
  assert.ok(await exists(path.join(result.outDir, "vendor", "reveal", "reveal.css")));
  assert.ok(await exists(path.join(result.outDir, "assets", "note.txt")));
});

test("dev builds include the preview PDF endpoint", async () => {
  const deckDir = await makeDeck();
  const result = await buildDeck(deckDir, { dev: true });
  const index = await fs.readFile(result.indexPath, "utf8");

  assert.match(index, /const PDF_ENDPOINT = "\/__byeslide\/pdf";/);
});

test("buildDeck moves slide-owned scripts outside Reveal slides", async () => {
  const deckDir = await makeDeck();
  await fs.writeFile(path.join(deckDir, "slides", "03-script.html"), [
    "<section class=\"slide\">",
    "  <h2>Scripted</h2>",
    "  <script type=\"module\" src=\"./assets/demo.js\"></script>",
    "</section>"
  ].join("\n"));

  const result = await buildDeck(deckDir);
  const index = await fs.readFile(result.indexPath, "utf8");
  const slideStart = index.indexOf("data-byeslide-source=\"slides/03-script.html\"");
  const slideEnd = index.indexOf("</section>", slideStart);
  const scriptIndex = index.indexOf("<script data-byeslide-source=\"slides/03-script.html\" data-byeslide-script-index=\"0\" data-byeslide-script-id=\"byeslide-c2xpZGVzLzAzLXNjcmlwdC5odG1s-0\" type=\"module\" src=\"./assets/demo.js\"></script>");

  assert.ok(slideStart >= 0);
  assert.match(index, /window\.Byeslide = Object\.assign/);
  assert.match(index, /scriptForId\(id\)/);
  assert.ok(scriptIndex > slideEnd);
});

test("buildDeck refuses to write outside the deck root", async () => {
  const deckDir = await makeDeck();
  const outside = path.join(path.dirname(deckDir), "outside-dist");
  await assert.rejects(
    buildDeck(deckDir, { outDir: outside }),
    /outside the deck root/
  );
});

test("buildDeck skips generated output when copying broad asset directories", async () => {
  const deckDir = await makeDeck({
    extraConfig: "assetsDir: '.',\n"
  });

  const result = await buildDeck(deckDir);
  assert.ok(await exists(path.join(result.outDir, "assets", "slides", "01-title.html")));
  assert.equal(await exists(path.join(result.outDir, "assets", "dist")), false);
});

async function makeDeck(options = {}) {
  const deckDir = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-build-"));
  await fs.mkdir(path.join(deckDir, "slides"), { recursive: true });
  await fs.mkdir(path.join(deckDir, "assets"), { recursive: true });
  await fs.writeFile(path.join(deckDir, "deck.config.js"), `module.exports = {
    title: "Test Deck",
    ${options.extraConfig || ""}
    plugins: []
  };
`);
  await fs.writeFile(path.join(deckDir, "theme.css"), ":root { --color-ink: #111; }\n");
  await fs.writeFile(path.join(deckDir, "styles.css"), ".slide { color: var(--color-ink); }\n");
  await fs.writeFile(path.join(deckDir, "assets", "note.txt"), "asset\n");
  await fs.writeFile(path.join(deckDir, "slides", "01-title.html"), "<section class=\"slide\"><h1>One</h1></section>\n");
  await fs.writeFile(path.join(deckDir, "slides", "02-body.html"), "<h2>Two</h2>\n");
  return deckDir;
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
