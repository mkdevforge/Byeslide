const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { shouldIgnoreWatchPath } = require("../src/preview");

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
