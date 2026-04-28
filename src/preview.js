const fs = require("node:fs");
const path = require("node:path");
const { buildDeck } = require("./build");
const { createStaticServer } = require("./static-server");

async function previewDeck(deckDir = process.cwd(), options = {}) {
  let result = await buildDeck(deckDir, {
    clean: true,
    dev: true,
    outDir: options.outDir
  });

  const server = createStaticServer(result.outDir, {
    host: options.host || "127.0.0.1",
    port: options.port || 4173
  });
  const url = await server.start();
  const watcher = watchDeck(result.deckDir, result.config.outDir, async () => {
    try {
      result = await buildDeck(deckDir, {
        clean: true,
        dev: true,
        outDir: options.outDir
      });
      server.setRoot(result.outDir);
      server.broadcast("reload", "rebuilt");
      console.log(`Rebuilt ${path.relative(result.deckDir, result.indexPath)}`);
    } catch (error) {
      console.error(`Build failed: ${error.message}`);
    }
  });

  console.log(`Preview: ${url}/index.html`);
  console.log("Watching deck files. Press Ctrl+C to stop.");

  await new Promise((resolve) => {
    const stop = async () => {
      watcher.close();
      await server.close();
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

function watchDeck(root, outDir, onChange) {
  const ignored = new Set([".git", "node_modules", outDir || "dist"]);
  let timer = null;

  const schedule = (filename) => {
    if (!filename) {
      return;
    }
    const parts = filename.split(/[\\/]/);
    if (parts.some((part) => ignored.has(part))) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(onChange, 120);
  };

  try {
    return fs.watch(root, { recursive: true }, (_event, filename) => schedule(String(filename || "")));
  } catch {
    return watchRecursively(root, schedule, ignored);
  }
}

function watchRecursively(root, onChange, ignored) {
  const watchers = [];

  const add = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    watchers.push(fs.watch(dir, (_event, filename) => onChange(path.relative(root, path.join(dir, String(filename || ""))))));
    for (const entry of entries) {
      if (entry.isDirectory() && !ignored.has(entry.name)) {
        add(path.join(dir, entry.name));
      }
    }
  };

  add(root);
  return {
    close() {
      for (const watcher of watchers) {
        watcher.close();
      }
    }
  };
}

module.exports = {
  previewDeck,
  watchDeck
};
