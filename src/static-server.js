const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { isInside } = require("./fs-utils");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function createStaticServer(root, options = {}) {
  let staticRoot = path.resolve(root);
  const clients = new Set();

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");
      if (requestUrl.pathname === "/__byeslide/events") {
        handleEvents(request, response, clients);
        return;
      }

      await serveFile(staticRoot, requestUrl.pathname, response);
    } catch (error) {
      response.statusCode = 500;
      response.end(error.message);
    }
  });

  return {
    get root() {
      return staticRoot;
    },
    setRoot(nextRoot) {
      staticRoot = path.resolve(nextRoot);
    },
    async start() {
      const host = options.host || "127.0.0.1";
      const port = Number(options.port || 0);
      await new Promise((resolve) => server.listen(port, host, resolve));
      const address = server.address();
      return `http://${address.address}:${address.port}`;
    },
    async close() {
      for (const client of clients) {
        client.end();
      }
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
    broadcast(event, data = "") {
      for (const client of clients) {
        client.write(`event: ${event}\n`);
        client.write(`data: ${String(data).replace(/\n/g, "\\n")}\n\n`);
      }
    }
  };
}

async function serveFile(root, pathname, response) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  let filePath = path.resolve(root, relativePath);

  if (!isInside(root, filePath)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stat = await fsp.stat(filePath);
    }
  } catch {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Length", stat.size);
  response.setHeader("Content-Type", MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(response);
}

function handleEvents(request, response, clients) {
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream"
  });
  response.write("\n");
  clients.add(response);
  request.on("close", () => clients.delete(response));
}

module.exports = {
  createStaticServer
};
