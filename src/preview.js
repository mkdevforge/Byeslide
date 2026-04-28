const fs = require("node:fs");
const path = require("node:path");
const { buildDeck } = require("./build");
const { isInside } = require("./fs-utils");
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
  const watcher = watchDeck(result.deckDir, path.relative(result.deckDir, result.outDir), async () => {
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
  const resolvedRoot = path.resolve(root);
  const ignoredOutput = path.resolve(resolvedRoot, outDir || "dist");
  let timer = null;

  const schedule = (filename) => {
    if (!filename) {
      return;
    }
    const candidate = path.resolve(resolvedRoot, filename);
    if (shouldIgnoreWatchPath(resolvedRoot, candidate, ignoredOutput)) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(onChange, 120);
  };

  try {
    return fs.watch(resolvedRoot, { recursive: true }, (_event, filename) => schedule(String(filename || "")));
  } catch {
    return watchRecursively(resolvedRoot, schedule, ignoredOutput);
  }
}

function watchRecursively(root, onChange, ignoredOutput) {
  const watchers = [];

  const add = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    watchers.push(fs.watch(dir, (_event, filename) => onChange(path.relative(root, path.join(dir, String(filename || ""))))));
    for (const entry of entries) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory() && !shouldIgnoreWatchPath(root, child, ignoredOutput)) {
        add(child);
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

function shouldIgnoreWatchPath(root, candidate, ignoredOutput) {
  const relative = path.relative(root, candidate);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return false;
  }

  const parts = relative.split(/[\\/]+/);
  if (parts.includes(".git") || parts.includes("node_modules")) {
    return true;
  }

  return isInside(ignoredOutput, candidate);
}

module.exports = {
  previewDeck,
  shouldIgnoreWatchPath,
  watchDeck
};
