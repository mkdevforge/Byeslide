const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createStaticServer, formatServerUrl } = require("../src/static-server");

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

test("static server does not serve files outside the real root", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "byeslide-server-link-"));
  const root = path.join(parent, "root");
  const outside = path.join(parent, "outside");
  await fs.mkdir(root);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, "secret.txt"), "secret\n");
  await fs.writeFile(path.join(outside, "index.html"), "outside index\n");

  try {
    await fs.symlink(outside, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      t.skip(`Cannot create directory link: ${error.code}`);
      return;
    }
    throw error;
  }

  const server = createStaticServer(root, { port: 0 });

  try {
    const url = await server.start();
    const response = await fetch(`${url}/linked/secret.txt`);
    assert.equal(response.status, 403);
    assert.equal(await response.text(), "Forbidden");

    const indexResponse = await fetch(`${url}/linked/`);
    assert.equal(indexResponse.status, 403);
    assert.equal(await indexResponse.text(), "Forbidden");
  } finally {
    await server.close();
  }
});

test("static server formats IPv6 addresses as valid URLs", () => {
  const url = formatServerUrl({ address: "::1", port: 4173 });

  assert.equal(url, "http://[::1]:4173");
  assert.equal(new URL(`${url}/index.html`).hostname, "[::1]");
});
