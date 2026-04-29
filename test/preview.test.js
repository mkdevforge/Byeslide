const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {
  handlePreviewPdfRequest,
  previewPdfUrl,
  resolvePreviewPdfOutput,
  shouldIgnoreWatchPath
} = require("../src/preview");

test("preview PDF output matches the generated pnpm pdf target", () => {
  const result = {
    deckDir: path.resolve("deck"),
    outDir: path.resolve("deck", "dist")
  };

  const output = resolvePreviewPdfOutput(result);

  assert.equal(output, path.join("dist", "deck.pdf"));
  assert.equal(previewPdfUrl(result, path.resolve("deck", output)), "/deck.pdf");
});

test("preview PDF endpoint exports the current deck", async () => {
  const deckDir = path.resolve("deck");
  const current = {
    deckDir,
    outDir: path.join(deckDir, "dist")
  };
  const response = createResponse();

  const handled = await handlePreviewPdfRequest(
    { method: "POST", url: "/__byeslide/pdf" },
    response,
    () => current,
    async (requestedDeckDir, options) => ({
      ...current,
      deckDir: requestedDeckDir,
      outDir: path.resolve(requestedDeckDir, options.outDir),
      output: path.resolve(requestedDeckDir, options.output)
    })
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    path: "dist/deck.pdf",
    url: "/deck.pdf"
  });
});

test("preview watcher ignores nested custom output directories", () => {
  const root = path.resolve("deck");
  const outDir = path.join(root, "public", "deck");

  assert.equal(shouldIgnoreWatchPath(root, path.join(outDir, "index.html"), outDir), true);
  assert.equal(shouldIgnoreWatchPath(root, path.join(root, "public", "source.html"), outDir), false);
});

test("preview watcher ignores git and dependency directories", () => {
  const root = path.resolve("deck");
  const outDir = path.join(root, "dist");

  assert.equal(shouldIgnoreWatchPath(root, path.join(root, ".git", "index"), outDir), true);
  assert.equal(shouldIgnoreWatchPath(root, path.join(root, "node_modules", "pkg", "index.js"), outDir), true);
  assert.equal(shouldIgnoreWatchPath(root, path.join(root, "slides", "01.html"), outDir), false);
});

function createResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(content) {
      this.body = content;
    }
  };
}
