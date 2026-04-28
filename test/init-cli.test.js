const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { initDeck } = require("../src/init");
const { parseArgs } = require("../src/cli");

test("initDeck copies the starter template", async () => {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-init-"));
  const result = await initDeck(target);

  assert.equal(result.deckDir, target);
  assert.ok(await exists(path.join(target, "deck.config.js")));
  assert.ok(await exists(path.join(target, "patterns", "title.html")));
  assert.ok(await exists(path.join(target, ".codex", "skills", "byeslide-author", "SKILL.md")));
});

test("initDeck refuses a non-empty directory without force", async () => {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-init-"));
  await fs.writeFile(path.join(target, "existing.txt"), "keep");

  await assert.rejects(
    initDeck(target),
    /not empty/
  );
});

test("parseArgs supports flags, values, and negated flags", () => {
  const parsed = parseArgs(["build", "deck", "--out", "public", "--no-clean", "--json"]);
  assert.deepEqual(parsed.positionals, ["build", "deck"]);
  assert.equal(parsed.options.out, "public");
  assert.equal(parsed.options.clean, false);
  assert.equal(parsed.options.json, true);
});

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
