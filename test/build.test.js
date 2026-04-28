const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildDeck, extractSlideScripts, normalizeSlideHtml, stripFullDocument } = require("../src/build");

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
  const result = extractSlideScripts("<section><h1>Demo</h1><script type=\"module\" src=\"./assets/demo.js\"></script></section>");
  assert.equal(result.html, "<section><h1>Demo</h1></section>");
  assert.deepEqual(result.scripts, ["<script type=\"module\" src=\"./assets/demo.js\"></script>"]);
});

test("buildDeck writes a Reveal-compatible deck", async () => {
  const deckDir = await makeDeck();
  const result = await buildDeck(deckDir);
  const index = await fs.readFile(result.indexPath, "utf8");

  assert.equal(result.slideFiles.length, 2);
  assert.match(index, /<div class="reveal">/);
  assert.match(index, /data-byeslide-source="slides\/01-title\.html"/);
  assert.match(index, /Reveal\.initialize/);
  assert.ok(await exists(path.join(result.outDir, "vendor", "reveal", "reveal.css")));
  assert.ok(await exists(path.join(result.outDir, "assets", "note.txt")));
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
  const scriptIndex = index.indexOf("<script type=\"module\" src=\"./assets/demo.js\"></script>");

  assert.ok(slideStart >= 0);
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
