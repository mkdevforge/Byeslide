const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createStaticServer } = require("../src/static-server");

test("static server falls back when the requested port is occupied", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-server-"));
  await fs.writeFile(path.join(root, "index.html"), "ok\n");

  const first = createStaticServer(root, { port: 0 });
  const firstUrl = await first.start();
  const occupiedPort = new URL(firstUrl).port;
  const second = createStaticServer(root, {
    port: occupiedPort,
    portAttempts: 10
  });
  let secondStarted = false;

  try {
    const secondUrl = await second.start();
    secondStarted = true;
    assert.notEqual(new URL(secondUrl).port, occupiedPort);
  } finally {
    if (secondStarted) {
      await second.close();
    }
    await first.close();
  }
});
