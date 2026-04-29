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
  const slideScripts = [];
  for (const file of slideFiles) {
    const source = toPosixPath(path.relative(root, file));
    const raw = await fs.readFile(file, "utf8");
    const normalized = normalizeSlide(raw, source);
    slides.push(normalized.html);
    slideScripts.push(...normalized.scripts);
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
    slideScripts: prepareSlideScripts(slideScripts).join("\n"),
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
  return normalizeSlide(raw, source).html;
}

function normalizeSlide(raw, source) {
  const html = stripFullDocument(raw.replace(/^\uFEFF/, "")).trim();
  const extracted = extractSlideScripts(html, source);
  const slideHtml = extracted.html.trim();
  if (!slideHtml) {
    return {
      html: `<section data-byeslide-source="${escapeAttribute(source)}"></section>`,
      scripts: extracted.scripts
    };
  }

  if (/^<section(?:\s|>)/i.test(slideHtml)) {
    return {
      html: addSourceAttribute(slideHtml, source),
      scripts: extracted.scripts
    };
  }

  return {
    html: `<section data-byeslide-source="${escapeAttribute(source)}">\n${slideHtml}\n</section>`,
    scripts: extracted.scripts
  };
}

function extractSlideScripts(html, source = "") {
  const scripts = [];
  let scriptIndex = 0;
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (script) => {
    scripts.push(annotateSlideScript(script.trim(), source, scriptIndex));
    scriptIndex += 1;
    return "";
  });

  return {
    html: withoutScripts,
    scripts
  };
}

function annotateSlideScript(script, source, index) {
  let next = script;
  const scriptId = createScriptId(source, index);
  if (!hasHtmlAttribute(next, "data-byeslide-script-id")) {
    next = addScriptAttribute(next, "data-byeslide-script-id", scriptId);
  }
  if (!hasHtmlAttribute(next, "data-byeslide-script-index")) {
    next = addScriptAttribute(next, "data-byeslide-script-index", String(index));
  }
  if (source && !hasHtmlAttribute(next, "data-byeslide-source")) {
    next = addScriptAttribute(next, "data-byeslide-source", source);
  }
  if (isInlineModuleScript(next)) {
    next = injectModuleSlideBinding(next, scriptId);
  }
  return next;
}

function addScriptAttribute(script, name, value) {
  return script.replace(/^<script\b/i, `<script ${name}="${escapeAttribute(value)}"`);
}

function createScriptId(source, index) {
  return `byeslide-${Buffer.from(source || "inline").toString("base64url")}-${index}`;
}

function isInlineModuleScript(script) {
  return getHtmlAttribute(script, "type").toLowerCase() === "module"
    && !getHtmlAttribute(script, "src");
}

function injectModuleSlideBinding(script, scriptId) {
  return script.replace(/^(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)$/i, (_match, open, body, close) => {
    const prelude = [
      `import.meta.byeslideScript = window.Byeslide?.scriptForId(${safeJson(scriptId)});`,
      "import.meta.byeslideSlide = window.Byeslide?.slideForScript(import.meta);"
    ].join("\n");
    return `${open}\n${prelude}\n${body.trimStart()}${close}`;
  });
}

function prepareSlideScripts(scripts) {
  const seenExternalScripts = new Set();
  const prepared = [];

  for (const script of scripts.filter(Boolean)) {
    const src = getHtmlAttribute(script, "src");
    if (!src || hasHtmlAttribute(script, "data-byeslide-repeat")) {
      prepared.push(script);
      continue;
    }

    const type = getHtmlAttribute(script, "type");
    const key = `${type}\0${src}`;
    if (seenExternalScripts.has(key)) {
      continue;
    }

    seenExternalScripts.add(key);
    prepared.push(script);
  }

  return prepared;
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

function getHtmlAttribute(html, name) {
  const openingTag = getOpeningTag(html);
  const pattern = new RegExp(
    "\\s" + escapeRegExp(name) + "(?:\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))|(?=\\s|/?>))",
    "i"
  );
  const match = openingTag.match(pattern);
  if (!match) {
    return "";
  }

  return match[1] ?? match[2] ?? match[3] ?? "";
}

function hasHtmlAttribute(html, name) {
  const openingTag = getOpeningTag(html);
  const pattern = new RegExp("\\s" + escapeRegExp(name) + "(?:\\s|=|/?>)", "i");
  return pattern.test(openingTag);
}

function getOpeningTag(html) {
  return html.match(/^<[^>]+>/)?.[0] || html;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function renderIndex({ config, revealOptions, slides, slideScripts, css, plugins, dev }) {
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

      html.reveal-print,
      html.reveal-print body,
      html.reveal-print .reveal-viewport,
      html.reveal-print .reveal,
      html.reveal-print .slides,
      html.reveal-print .pdf-page,
      html.reveal-print .reveal .slides section[data-byeslide-source] {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      html.reveal-print body,
      html.reveal-print .reveal-viewport {
        background: transparent;
        margin: 0;
        padding: 0;
      }

      html.reveal-print .pdf-page {
        background: transparent;
        height: var(--byeslide-height) !important;
        margin: 0 !important;
        overflow: hidden;
        width: var(--byeslide-width) !important;
      }

      html.reveal-print .reveal .slides section[data-byeslide-source] {
        box-sizing: border-box !important;
        height: var(--byeslide-height) !important;
        min-height: var(--byeslide-height) !important;
        padding: var(--byeslide-slide-padding, 0) !important;
        width: var(--byeslide-width) !important;
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
    ${renderByeslideRuntime({ dev })}
    <script>
      (() => {
        const params = new URLSearchParams(window.location.search);
        const options = ${optionsJson};
        const requestedView = params.get("view");
        if (requestedView === "scroll" || requestedView === "print") {
          options.view = requestedView;
          if (requestedView === "print") {
            options.margin = 0;
          }
        }

        const plugins = ${globalsJson}
          .map((name) => window[name])
          .filter(Boolean);

        const revealReady = Reveal.initialize({
          ...options,
          plugins
        });

        if (params.get("print") === "1") {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("print");
          try {
            window.history.replaceState(null, "", cleanUrl.href);
          } catch {
            // Some browsers reject history updates for local file URLs.
          }
          Promise.resolve(revealReady).then(() => {
            window.setTimeout(() => window.print(), 250);
          });
        }
      })();
    </script>${slideScripts ? `\n${indent(slideScripts, 4)}` : ""}${devScript}
  </body>
</html>
`;
}

function renderByeslideRuntime({ dev = false } = {}) {
  return `<script>
      (() => {
        const PDF_ENDPOINT = ${safeJson(dev ? "/__byeslide/pdf" : "")};

        const api = {
          async exportPdf() {
            if (await tryPreviewPdfExport()) {
              return;
            }
            openPrintView();
          },
          scriptForId(id) {
            if (!id) {
              return null;
            }
            return Array.from(document.querySelectorAll("script[data-byeslide-script-id]"))
              .find((script) => script.dataset.byeslideScriptId === String(id)) || null;
          },
          slideForSource(source) {
            if (!source) {
              return null;
            }
            return Array.from(document.querySelectorAll("[data-byeslide-source]"))
              .find((slide) => slide.getAttribute("data-byeslide-source") === source) || null;
          },
          slideForScript(script = document.currentScript) {
            if (script?.byeslideSlide) {
              return script.byeslideSlide;
            }
            if (script?.byeslideScript) {
              return api.slideForScript(script.byeslideScript);
            }
            if (typeof script === "string") {
              return api.slideForScript(api.scriptForId(script)) || api.slideForSource(script);
            }
            if (!script) {
              return null;
            }
            if (typeof script.closest !== "function") {
              return null;
            }
            const localSlide = script.closest("section[data-byeslide-source]");
            return localSlide || api.slideForSource(script.dataset.byeslideSource);
          }
        };

        window.Byeslide = Object.assign(window.Byeslide || {}, api);

        window.addEventListener("keydown", (event) => {
          if (!isPdfShortcut(event)) {
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();
          api.exportPdf().catch(openPrintView);
        }, true);

        async function tryPreviewPdfExport() {
          if (!PDF_ENDPOINT || window.location.protocol === "file:") {
            return false;
          }

          try {
            const response = await fetch(PDF_ENDPOINT, {
              method: "POST",
              headers: {
                "Accept": "application/json"
              }
            });
            if (!response.ok) {
              return false;
            }
            const payload = await response.json();
            if (!payload?.url) {
              return false;
            }
            downloadPdf(payload.url, pdfFilename(payload));
            return true;
          } catch {
            return false;
          }
        }

        function openPrintView() {
          const url = new URL(window.location.href);
          if (url.searchParams.get("view") === "print") {
            window.print();
            return;
          }

          url.searchParams.set("view", "print");
          url.searchParams.set("print", "1");
          window.location.assign(url.href);
        }

        function downloadPdf(url, filename) {
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.rel = "noopener";
          document.body.append(link);
          link.click();
          link.remove();
        }

        function pdfFilename(payload) {
          const source = payload.path || payload.url || "deck.pdf";
          return source.split("/").filter(Boolean).pop() || "deck.pdf";
        }

        function isPdfShortcut(event) {
          if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) {
            return false;
          }
          if (String(event.key).toLowerCase() !== "p") {
            return false;
          }
          const target = event.target;
          if (!target) {
            return true;
          }
          if (target.isContentEditable) {
            return false;
          }
          return !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
        }
      })();
    </script>`;
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
  extractSlideScripts,
  normalizeSlideHtml,
  prepareSlideScripts,
  renderIndex,
  stripFullDocument
};
