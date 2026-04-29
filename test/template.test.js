const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { listHtmlFiles } = require("../src/fs-utils");

const templateRoot = path.resolve(__dirname, "..", "template");

test("starter styles do not apply slide layout to the Reveal root", async () => {
  const css = await fs.readFile(path.join(templateRoot, "styles.css"), "utf8");

  assert.doesNotMatch(css, /(^|\n)\.slide\s*\{/);
  assert.match(css, /(^|\n)\.reveal \.slides section\.slide\s*\{/);
});

test("starter slides expose print padding for Reveal print view", async () => {
  const css = await fs.readFile(path.join(templateRoot, "styles.css"), "utf8");

  assert.match(css, /--byeslide-slide-padding: var\(--slide-padding\);/);
  assert.match(css, /--byeslide-slide-padding: 0px;/);
});

test("starter slides include speaker notes", async () => {
  const files = await listHtmlFiles(path.join(templateRoot, "slides"));

  assert.ok(files.length > 0);
  for (const file of files) {
    const html = await fs.readFile(file, "utf8");
    assert.match(html, /<aside\s+class=["']notes["']/i, path.relative(templateRoot, file));
  }
});
