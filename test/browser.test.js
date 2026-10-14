const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { formatDiagnostics, resolvePdfOutput, selectSlides, waitForReveal } = require("../src/browser");

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

test("selectSlides picks slides by number and range", () => {
  const slides = [1, 2, 3, 4, 5].map((index) => ({ index }));

  assert.deepEqual(selectSlides(slides).map((slide) => slide.index), [1, 2, 3, 4, 5]);
  assert.deepEqual(selectSlides(slides, "4,1-2").map((slide) => slide.index), [1, 2, 4]);
  assert.deepEqual(selectSlides(slides, 3).map((slide) => slide.index), [3]);
  assert.throws(() => selectSlides(slides, "2,9"), /The deck has 5 slides\. No slide 9\./);
  assert.throws(() => selectSlides(slides, "two"), /--slides expects slide numbers/);
});
