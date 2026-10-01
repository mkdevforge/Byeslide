const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { buildDeck } = require("../src/build");
const { listTemplates } = require("../src/templates");

const root = path.resolve(__dirname, "..");

test("the published package has the template but not its build output", async () => {
  // The release workflow builds the templates before it publishes, so their dist/ folders exist then too.
  for (const template of listTemplates()) {
    await buildDeck(template.dir);
  }

  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  assert.equal(result.status, 0, result.stderr);
  const files = JSON.parse(result.stdout)[0].files.map((file) => file.path);

  assert.ok(files.includes("template/shared/gitignore"), "the shared gitignore is published so init can restore .gitignore");
  for (const template of listTemplates()) {
    assert.ok(files.includes(`template/${template.name}/deck.config.js`), `the ${template.name} template is published`);
  }
  assert.ok(files.includes("src/cli.js"));
  assert.deepEqual(files.filter((file) => /^template\/(?:[^/]+\/)?(?:dist|node_modules)\//.test(file)), []);
});
