#!/usr/bin/env node

// Adds a content hash to every local file that docs/index.html loads, for
// example styles.css?v=1a2b3c4d5e. A changed file gets a new URL, so browsers
// never combine a new page with an old stylesheet or script from their cache.
// Run after changing anything in docs/:  node scripts/stamp-docs.js

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DOCS_DIR = path.join(__dirname, "..", "docs");
const INDEX = path.join(DOCS_DIR, "index.html");
// Fonts are left out: they never change, and styles.css loads them without a version.
const LOCAL_REF = /(\s(?:href|src)=")((?:styles\.css|site\.js|assets\/(?!fonts\/)[^"?#]+))(?:\?v=[0-9a-f]+)?(")/g;
const TEXT_FILE = /\.(?:css|js|svg|html|txt)$/;

// Text files are hashed with Unix line endings, so a Windows checkout and CI agree.
function contentHash(file) {
  let content = fs.readFileSync(file);
  if (TEXT_FILE.test(file)) {
    content = Buffer.from(content.toString("utf8").replace(/\r\n/g, "\n"));
  }
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 10);
}

function stamp(html) {
  return html.replace(LOCAL_REF, (_match, before, ref, after) => {
    const file = path.join(DOCS_DIR, ref);
    if (!fs.existsSync(file)) {
      throw new Error(`docs/index.html loads ${ref}, which does not exist.`);
    }
    return `${before}${ref}?v=${contentHash(file)}${after}`;
  });
}

if (require.main === module) {
  const html = fs.readFileSync(INDEX, "utf8");
  const stamped = stamp(html);
  fs.writeFileSync(INDEX, stamped);
  console.log(stamped === html ? "docs/index.html was already up to date." : "Updated the file versions in docs/index.html.");
}

module.exports = {
  DOCS_DIR,
  INDEX,
  stamp
};
