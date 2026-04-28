const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { formatDiagnostics, resolvePdfOutput, waitForReveal } = require("../src/browser");

test("waitForReveal fails when Reveal never becomes ready", async () => {
  const page = {
    async waitForFunction() {
      throw new Error("timeout");
    }
  };

  await assert.rejects(
    waitForReveal(page, ["pageerror: reveal crash"], 25),
    /Reveal did not become ready within 25ms\.[\s\S]*pageerror: reveal crash/
  );
});

test("formatDiagnostics keeps the most recent diagnostics", () => {
  const diagnostics = ["one", "two", "three", "four", "five", "six"];
  assert.equal(formatDiagnostics(diagnostics), "- two\n- three\n- four\n- five\n- six");
});

test("resolvePdfOutput defaults to the actual build output directory", () => {
  const result = {
    deckDir: path.resolve("deck"),
    outDir: path.resolve("deck", "public"),
    config: {
      title: "Demo Deck"
    }
  };

  assert.equal(resolvePdfOutput(result), path.resolve("deck", "public", "demo-deck.pdf"));
  assert.equal(resolvePdfOutput(result, "exports/demo.pdf"), path.resolve("deck", "exports", "demo.pdf"));
});
