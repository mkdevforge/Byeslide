const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");
const { loadConfig, revealOptions } = require("./config");
const {
  copyDirectory,
  isInside,
  listHtmlFiles,
  pathExists,
  readTextIfExists,
  toPosixPath
} = require("./fs-utils");
const { resolvePlugins } = require("./plugins");

const requireFromHere = createRequire(__filename);

async function buildDeck(deckDir = process.cwd(), options = {}) {
  const root = path.resolve(deckDir);
  const config = await loadConfig(root);
  const outDir = path.resolve(root, options.outDir || config.outDir);

  if (outDir === root) {
    throw new Error("Refusing to build into the deck root. Choose a nested dist directory.");
  }
  if (!isInside(root, outDir)) {
    throw new Error("Refusing to clean or write an output directory outside the deck root.");
  }

  if (options.clean !== false) {
    await fs.rm(outDir, { recursive: true, force: true });
  }
  await fs.mkdir(outDir, { recursive: true });

  const slidesDir = path.resolve(root, config.slidesDir);
  const slideFiles = await listHtmlFiles(slidesDir);
  if (slideFiles.length === 0) {
    throw new Error(`No slide HTML files found in ${path.relative(root, slidesDir) || config.slidesDir}.`);
  }

  const slides = [];
  for (const file of slideFiles) {
    const source = toPosixPath(path.relative(root, file));
    const raw = await fs.readFile(file, "utf8");
    slides.push(normalizeSlideHtml(raw, source));
  }

  const cssBlocks = [];
  for (const cssFile of config.cssFiles) {
    const cssPath = path.resolve(root, cssFile);
    const css = await readTextIfExists(cssPath);
    if (css) {
      cssBlocks.push(`/* ${toPosixPath(path.relative(root, cssPath))} */\n${css}`);
    }
  }

  const plugins = resolvePlugins(config.plugins);
  const html = renderIndex({
    config,
    revealOptions: revealOptions(config),
    slides: slides.join("\n\n"),
    css: cssBlocks.join("\n\n"),
    plugins,
    dev: Boolean(options.dev)
  });

  await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
  await copyRevealRuntime(outDir);
  await copyDeckAssets(root, outDir, config.assetsDir);

  return {
    config,
    deckDir: root,
    indexPath: path.join(outDir, "index.html"),
    outDir,
    slideFiles
  };
}

function normalizeSlideHtml(raw, source) {
  const html = stripFullDocument(raw.replace(/^\uFEFF/, "")).trim();
  if (!html) {
    return `<section data-byeslide-source="${escapeAttribute(source)}"></section>`;
  }

  if (/^<section(?:\s|>)/i.test(html)) {
    return addSourceAttribute(html, source);
  }

  return `<section data-byeslide-source="${escapeAttribute(source)}">\n${html}\n</section>`;
}

function stripFullDocument(html) {
  const bodyMatch = html.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }

  return html
    .replace(/^\s*<!doctype[^>]*>\s*/i, "")
    .replace(/<\/?html(?:\s[^>]*)?>/gi, "")
    .replace(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/gi, "");
}

function addSourceAttribute(html, source) {
  if (/^<section[^>]*\sdata-byeslide-source=/i.test(html)) {
    return html;
  }

  return html.replace(
    /^<section\b/i,
    `<section data-byeslide-source="${escapeAttribute(source)}"`
  );
}

async function copyRevealRuntime(outDir) {
  const revealEntry = requireFromHere.resolve("reveal.js");
  const revealDist = path.dirname(revealEntry);
  const vendorDir = path.join(outDir, "vendor", "reveal");

  await fs.mkdir(vendorDir, { recursive: true });
  await copyDirectory(revealDist, vendorDir);
}

async function copyDeckAssets(root, outDir, assetsDir) {
  if (!assetsDir) {
    return;
  }

  const source = path.resolve(root, assetsDir);
  if (!(await pathExists(source))) {
    return;
  }

  if (isInside(outDir, source)) {
    return;
  }

  await copyDirectory(source, path.join(outDir, "assets"), {
    skip(_entry, sourcePath) {
      return isInside(outDir, sourcePath);
    }
  });
}

function renderIndex({ config, revealOptions, slides, css, plugins, dev }) {
  const pluginStyles = plugins
    .filter((plugin) => plugin.stylesheet)
    .map((plugin) => `<link rel="stylesheet" href="./vendor/reveal/${escapeAttribute(plugin.stylesheet)}">`)
    .join("\n    ");
  const pluginScripts = plugins
    .map((plugin) => `<script src="./vendor/reveal/${escapeAttribute(plugin.script)}"></script>`)
    .join("\n    ");
  const pluginGlobals = plugins
    .map((plugin) => plugin.global)
    .filter(Boolean);
  const optionsJson = safeJson(revealOptions);
  const globalsJson = safeJson(pluginGlobals);
  const devScript = dev ? `
    <script>
      (() => {
        const events = new EventSource("/__byeslide/events");
        events.addEventListener("reload", () => window.location.reload());
      })();
    </script>` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(config.title)}</title>
    <meta name="description" content="${escapeAttribute(config.description || "")}">
    <link rel="stylesheet" href="./vendor/reveal/reset.css">
    <link rel="stylesheet" href="./vendor/reveal/reveal.css">
    ${pluginStyles}
    <style>
      :root {
        --byeslide-width: ${config.width}px;
        --byeslide-height: ${config.height}px;
      }

      @page {
        size: ${config.width}px ${config.height}px;
        margin: 0;
      }

      .reveal .slides {
        text-align: left;
      }

      .reveal .slides section {
        box-sizing: border-box;
      }

      .reveal .slides section[data-byeslide-source] {
        width: 100%;
        height: 100%;
      }

${indentCss(css || "/* No deck CSS files were found. */", 6)}
    </style>
  </head>
  <body>
    <div class="reveal">
      <div class="slides">
${indent(slides, 8)}
      </div>
    </div>
    <script src="./vendor/reveal/reveal.js"></script>
    ${pluginScripts}
    <script>
      (() => {
        const params = new URLSearchParams(window.location.search);
        const options = ${optionsJson};
        const requestedView = params.get("view");
        if (requestedView === "scroll" || requestedView === "print") {
          options.view = requestedView;
        }

        const plugins = ${globalsJson}
          .map((name) => window[name])
          .filter(Boolean);

        Reveal.initialize({
          ...options,
          plugins
        });
      })();
    </script>${devScript}
  </body>
</html>
`;
}

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value
    .split(/\r?\n/)
    .map((line) => line ? `${prefix}${line}` : line)
    .join("\n");
}

function indentCss(value, spaces) {
  return indent(value.trimEnd(), spaces);
}

function safeJson(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

module.exports = {
  addSourceAttribute,
  buildDeck,
  copyDeckAssets,
  normalizeSlideHtml,
  renderIndex,
  stripFullDocument
};
