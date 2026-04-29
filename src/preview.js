const fs = require("node:fs");
const path = require("node:path");
const { exportPdf } = require("./browser");
const { buildDeck } = require("./build");
const { isInside, toPosixPath } = require("./fs-utils");
const { createStaticServer } = require("./static-server");

async function previewDeck(deckDir = process.cwd(), options = {}) {
  let result = await buildDeck(deckDir, {
    clean: true,
    dev: true,
    outDir: options.outDir
  });
  let pdfExport = null;
  const exportCurrentPdf = (pdfDeckDir, pdfOptions) => {
    if (!pdfExport) {
      pdfExport = exportPdf(pdfDeckDir, pdfOptions).finally(() => {
        pdfExport = null;
      });
    }
    return pdfExport;
  };

  const server = createStaticServer(result.outDir, {
    host: options.host || "127.0.0.1",
    port: options.port || 4173,
    handleRequest: (request, response) => handlePreviewPdfRequest(request, response, () => result, exportCurrentPdf)
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

async function handlePreviewPdfRequest(request, response, getResult, pdfExporter = exportPdf) {
  const requestUrl = new URL(request.url, "http://localhost");
  if (requestUrl.pathname !== "/__byeslide/pdf") {
    return false;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, {
      ok: false,
      error: "Use POST to export the preview as PDF."
    });
    return true;
  }

  const current = getResult();
  try {
    const outDir = path.relative(current.deckDir, current.outDir);
    const output = resolvePreviewPdfOutput(current);
    const result = await pdfExporter(current.deckDir, {
      outDir,
      output
    });
    const url = previewPdfUrl(result, result.output);
    sendJson(response, 200, {
      ok: true,
      path: toPosixPath(path.relative(result.deckDir, result.output)),
      url
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: firstLine(error.message)
    });
  }

  return true;
}

function resolvePreviewPdfOutput(result) {
  return path.join(path.relative(result.deckDir, result.outDir), "deck.pdf");
}

function previewPdfUrl(result, output) {
  const relative = path.relative(result.outDir, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("PDF output must be inside the preview output directory.");
  }

  return `/${toPosixPath(relative).split("/").map(encodeURIComponent).join("/")}`;
}

function sendJson(response, statusCode, body) {
  const content = JSON.stringify(body);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(content));
  response.end(content);
}

function firstLine(value) {
  return String(value).split(/\r?\n/)[0];
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
  handlePreviewPdfRequest,
  previewPdfUrl,
  previewDeck,
  resolvePreviewPdfOutput,
  shouldIgnoreWatchPath,
  watchDeck
};
