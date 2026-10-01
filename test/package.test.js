const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { buildDeck } = require("../src/build");

const root = path.resolve(__dirname, "..");

test("the published package has the template but not its build output", async () => {
  // The release workflow builds the template before it publishes, so template/dist exists then too.
  await buildDeck(path.join(root, "template"));

  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  assert.equal(result.status, 0, result.stderr);
  const files = JSON.parse(result.stdout)[0].files.map((file) => file.path);

  assert.ok(files.includes("template/gitignore"), "template/gitignore is published so init can restore .gitignore");
  assert.ok(files.includes("template/slides/01-title.html"));
  assert.ok(files.includes("src/cli.js"));
  assert.deepEqual(files.filter((file) => file.startsWith("template/dist/")), []);
  assert.deepEqual(files.filter((file) => file.startsWith("template/node_modules/")), []);
});
