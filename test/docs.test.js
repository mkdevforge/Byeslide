const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { INDEX, stamp } = require("../scripts/stamp-docs");

test("the website loads every local file with its current content hash", () => {
  const html = fs.readFileSync(INDEX, "utf8");

  assert.match(html, /href="styles\.css\?v=[0-9a-f]{10}"/);
  assert.match(html, /src="site\.js\?v=[0-9a-f]{10}"/);
  assert.equal(stamp(html), html, "a file in docs/ changed: run node scripts/stamp-docs.js");
});
