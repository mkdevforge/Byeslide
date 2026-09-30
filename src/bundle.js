const fs = require("node:fs/promises");
const path = require("node:path");
const { parse: parseHtml } = require("parse5");
const lexer = require("es-module-lexer");
const { buildDeck } = require("./build");
const { slugify } = require("./browser");
const { ByeslideError } = require("./errors");
const { isInside, toPosixPath } = require("./fs-utils");

const DEFAULT_MAX_ASSET_MB = 20;
const MB = 1024 * 1024;
const MODULE_PREFIX = "byeslide-bundle/";

const MIME_TYPES = {
  ".aac": "audio/aac",
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".css": "text/css",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".m4a": "audio/mp4",
  ".m4v": "video/mp4",
  ".mjs": "text/javascript",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".opus": "audio/ogg",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".vtt": "text/vtt",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const RUNTIME_REFERENCE_PATTERNS = [
  /\bfetch\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
  /\bnew\s+URL\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1\s*,\s*import\.meta\.url/g,
  /\bnew\s+(?:Shared)?Worker\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
  /\bimportScripts\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g
];

// Turns data: URIs in data-background-video into blob URLs before Reveal starts.
// Reveal splits that attribute on commas, and every data: URI contains one.
const BACKGROUND_VIDEO_RUNTIME = `<script>
(() => {
  const toBlobUrl = (uri) => {
    const comma = uri.indexOf(",");
    const type = uri.slice(5, comma).split(";")[0];
    const bytes = Uint8Array.from(atob(uri.slice(comma + 1)), (character) => character.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type }));
  };
  document.querySelectorAll("[data-byeslide-background-video]").forEach((element) => {
    const sources = JSON.parse(element.getAttribute("data-byeslide-background-video"));
    element.setAttribute("data-background-video", sources.map((source) => source.startsWith("data:") ? toBlobUrl(source) : source).join(","));
    element.removeAttribute("data-byeslide-background-video");
  });
})();
</script>`;

async function bundleDeck(deckDir = process.cwd(), options = {}) {
  const maxAssetMb = parseMaxAssetMb(options.maxAssetMb);
  const result = await buildDeck(deckDir, {
    clean: options.clean !== false,
    outDir: options.outDir
  });
  const output = resolveBundleOutput(result, options.output);
  if (path.resolve(output) === path.resolve(result.indexPath)) {
    throw new ByeslideError("The bundle cannot replace the built index.html. Choose another --output file.");
  }

  const bundler = new Bundler({
    root: result.outDir,
    output,
    maxAssetMb,
    linkLargeMedia: Boolean(options.linkLargeMedia)
  });
  const html = await bundler.bundleDocument(result.indexPath);

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html, "utf8");

  return {
    ...result,
    output,
    size: Buffer.byteLength(html),
    assets: bundler.largestAssets(),
    warnings: bundler.warnings
  };
}

function parseMaxAssetMb(value) {
  if (value === undefined || value === null || value === true) {
    return DEFAULT_MAX_ASSET_MB;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new ByeslideError("--max-asset-mb must be a positive number of megabytes.");
  }
  return number;
}

function resolveBundleOutput(result, explicitOutput) {
  if (explicitOutput) {
    return path.resolve(result.deckDir, explicitOutput);
  }
  return path.join(result.outDir, `${slugify(result.config.title)}.html`);
}

class Bundler {
  constructor({ root, output, maxAssetMb, linkLargeMedia }) {
    this.root = path.resolve(root);
    this.output = output;
    this.maxAssetMb = maxAssetMb;
    this.maxAssetBytes = maxAssetMb * MB;
    this.linkLargeMedia = linkLargeMedia;
    this.warnings = [];
    this.warningSet = new Set();
    this.assets = new Map();
    this.files = new Map();
    this.modules = new Map();
    this.documents = [];
    this.realRoot = null;
  }

  warn(message) {
    if (!this.warningSet.has(message)) {
      this.warningSet.add(message);
      this.warnings.push(message);
    }
  }

  label(file) {
    return toPosixPath(path.relative(this.root, file)) || path.basename(file);
  }

  largestAssets(limit = 5) {
    return [...this.assets.entries()]
      .map(([file, bytes]) => ({ file: this.label(file), bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, limit);
  }

  recordAsset(file, bytes) {
    this.assets.set(file, bytes);
  }

  // References -----------------------------------------------------------------

  classify(raw, fromFile) {
    const value = String(raw ?? "").trim();
    if (!value || value.startsWith("#")) {
      return { kind: "keep" };
    }
    if (value.startsWith("//")) {
      return { kind: "remote", url: value };
    }
    const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme) {
      const name = scheme[1].toLowerCase();
      return name === "http" || name === "https" ? { kind: "remote", url: value } : { kind: "keep" };
    }

    const hashIndex = value.indexOf("#");
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
    const pathPart = (hashIndex >= 0 ? value.slice(0, hashIndex) : value).split("?")[0];
    if (!pathPart) {
      return { kind: "keep" };
    }
    let decoded = pathPart;
    try {
      decoded = decodeURIComponent(pathPart);
    } catch {
      // Keep the raw path when it is not valid percent-encoding.
    }
    const file = decoded.startsWith("/")
      ? path.join(this.root, decoded)
      : path.resolve(path.dirname(fromFile), decoded);
    return { kind: "local", file, hash, ref: value };
  }

  async readLocal(target, context) {
    if (!isInside(this.root, target.file)) {
      this.warn(`${context}: ${target.ref} points outside the build output, so it was left as it is.`);
      return null;
    }
    if (!this.files.has(target.file)) {
      this.files.set(target.file, this.loadFile(target.file));
    }
    const loaded = await this.files.get(target.file);
    if (loaded === "missing") {
      this.warn(`${context}: ${target.ref} was not found, so it was left as it is.`);
      return null;
    }
    if (loaded === "outside") {
      this.warn(`${context}: ${target.ref} points outside the build output, so it was left as it is.`);
      return null;
    }
    return loaded;
  }

  async loadFile(file) {
    let real;
    try {
      real = await fs.realpath(file);
      const stat = await fs.stat(real);
      if (!stat.isFile()) {
        return "missing";
      }
    } catch {
      return "missing";
    }
    if (!this.realRoot) {
      this.realRoot = await fs.realpath(this.root);
    }
    if (!isInside(this.realRoot, real)) {
      return "outside";
    }
    return fs.readFile(real);
  }

  // Returns a data: URI, a relative link for large media with --link-large-media, or null.
  async inline(target, context, { media = false } = {}) {
    const buffer = await this.readLocal(target, context);
    if (!buffer) {
      return null;
    }
    if (media && buffer.length > this.maxAssetBytes) {
      const name = this.label(target.file);
      const size = formatBytes(buffer.length);
      if (!this.linkLargeMedia) {
        throw new ByeslideError([
          `${name} is ${size}, above the ${this.maxAssetMb} MB limit for media in a bundle.`,
          `Raise the limit with --max-asset-mb ${Math.ceil(buffer.length / MB)}, or keep the file next to the bundle with --link-large-media.`
        ].join("\n"));
      }
      const link = toPosixPath(path.relative(path.dirname(this.output), target.file))
        .split("/")
        .map((part) => part === ".." ? part : encodeURIComponent(part))
        .join("/");
      this.warn(`${name} (${size}) is linked, not inlined. Share it next to ${path.basename(this.output)} as ${link}.`);
      return `${link}${target.hash}`;
    }
    this.recordAsset(target.file, buffer.length);
    return `data:${mimeFor(target.file)};base64,${buffer.toString("base64")}${target.hash}`;
  }

  async resolveUrl(raw, fromFile, context, options = {}) {
    const target = this.classify(raw, fromFile);
    if (target.kind === "remote") {
      this.warnRemote(target.url, context);
      return null;
    }
    if (target.kind !== "local") {
      return null;
    }
    return this.inline(target, context, options);
  }

  warnRemote(url, context) {
    this.warn(`${context}: ${url} is loaded from the network, so the bundle needs a connection for it.`);
  }

  // HTML ---------------------------------------------------------------------

  async bundleDocument(file, options = {}) {
    if (this.documents.includes(file)) {
      this.warn(`${this.label(file)} includes itself in an iframe, so the inner copy was left as it is.`);
      return null;
    }
    this.documents.push(file);
    try {
      const html = await fs.readFile(file, "utf8");
      return await this.processHtml(html, file, options);
    } finally {
      this.documents.pop();
    }
  }

  async processHtml(html, file, { scrollTo = "" } = {}) {
    const document = parseHtml(html, { sourceCodeLocationInfo: true });
    const state = {
      file,
      html,
      label: this.label(file),
      edits: [],
      moduleKeys: new Set(),
      importMap: { imports: {}, scopes: null },
      backgroundVideo: false,
      firstBodyScript: null,
      bodyEnd: null
    };

    await this.walk(document, state, { source: null, inBody: false, parentTag: null });

    const inserts = [];
    const importMap = this.createImportMap(state);
    if (importMap) {
      inserts.push(importMap);
    }
    if (scrollTo) {
      inserts.push(scrollScript(scrollTo));
    }
    if (inserts.length > 0) {
      const at = headInsertionPoint(document);
      state.edits.push({ start: at, end: at, text: inserts.join("\n") });
    }
    if (state.backgroundVideo) {
      const at = state.firstBodyScript ?? state.bodyEnd ?? html.length;
      state.edits.push({ start: at, end: at, text: `${BACKGROUND_VIDEO_RUNTIME}\n` });
    }

    return applyEdits(html, state.edits);
  }

  async walk(node, state, ctx) {
    let next = ctx;
    if (node.tagName) {
      const tag = node.tagName.toLowerCase();
      const source = getAttr(node, "data-byeslide-source");
      next = {
        source: source || ctx.source,
        inBody: ctx.inBody || tag === "body",
        parentTag: tag
      };
      if (tag === "body" && node.sourceCodeLocation?.endTag) {
        state.bodyEnd = node.sourceCodeLocation.endTag.startOffset;
      }
      const handled = await this.visitElement(node, tag, state, { ...ctx, source: next.source, inBody: next.inBody });
      if (handled === "replaced") {
        return;
      }
    }
    for (const child of node.childNodes || []) {
      await this.walk(child, state, next);
    }
    if (node.content) {
      await this.walk(node.content, state, next);
    }
  }

  context(state, ctx) {
    return ctx.source || state.label;
  }

  async visitElement(node, tag, state, ctx) {
    if (!node.sourceCodeLocation) {
      return null;
    }
    const context = this.context(state, ctx);

    if (tag === "script") {
      return this.visitScript(node, state, ctx, context);
    }
    if (tag === "link") {
      return this.visitLink(node, state, context);
    }
    if (tag === "style") {
      await this.visitStyleElement(node, state, context);
    }

    const style = getAttr(node, "style");
    if (style) {
      const css = await this.processCss(style, state.file, context);
      if (css !== style) {
        setAttr(state, node, "style", css);
      }
    }

    switch (tag) {
      case "img":
        await this.rewriteAttr(node, state, context, "src");
        await this.rewriteAttr(node, state, context, "data-src");
        await this.rewriteSrcset(node, state, context, "srcset");
        break;
      case "source": {
        const media = ctx.parentTag === "video" || ctx.parentTag === "audio";
        await this.rewriteAttr(node, state, context, "src", { media });
        await this.rewriteAttr(node, state, context, "data-src", { media });
        await this.rewriteSrcset(node, state, context, "srcset");
        break;
      }
      case "video":
      case "audio":
        await this.rewriteAttr(node, state, context, "src", { media: true });
        await this.rewriteAttr(node, state, context, "data-src", { media: true });
        await this.rewriteAttr(node, state, context, "poster");
        break;
      case "track":
      case "embed":
        await this.rewriteAttr(node, state, context, "src");
        break;
      case "object":
        await this.rewriteAttr(node, state, context, "data");
        break;
      case "input":
        if ((getAttr(node, "type") || "").toLowerCase() === "image") {
          await this.rewriteAttr(node, state, context, "src");
        }
        break;
      case "iframe":
        await this.visitIframe(node, state, context);
        break;
      case "image":
      case "feimage":
        await this.rewriteAttr(node, state, context, "href");
        await this.rewriteAttr(node, state, context, "xlink:href");
        break;
      case "use":
        for (const name of ["href", "xlink:href"]) {
          const target = this.classify(getAttr(node, name), state.file);
          if (target.kind === "local") {
            this.warn(`${context}: <use> points to ${target.ref}. Browsers do not load <use> from data: URIs, so copy that SVG into the slide.`);
          }
        }
        break;
      case "a":
      case "area":
        await this.visitLink(node, state, context);
        break;
      default:
        break;
    }

    await this.rewriteAttr(node, state, context, "data-background-image");
    await this.rewriteAttr(node, state, context, "data-preview-image");
    await this.rewriteAttr(node, state, context, "data-preview-video", { media: true });
    await this.rewriteDocumentUrlAttr(node, state, context, "data-background-iframe");
    const previewLink = getAttr(node, "data-preview-link");
    if (previewLink && previewLink !== "true" && previewLink !== "false") {
      await this.rewriteDocumentUrlAttr(node, state, context, "data-preview-link");
    }
    await this.rewriteBackgroundVideo(node, state, context);
    return null;
  }

  async rewriteAttr(node, state, context, name, options = {}) {
    const value = getAttr(node, name);
    if (value === null) {
      return;
    }
    const replacement = await this.resolveUrl(value, state.file, context, options);
    if (replacement !== null) {
      setAttr(state, node, name, replacement);
    }
  }

  async rewriteSrcset(node, state, context, name) {
    const value = getAttr(node, name);
    if (!value) {
      return;
    }
    let changed = false;
    const candidates = parseSrcset(value);
    for (const candidate of candidates) {
      const replacement = await this.resolveUrl(candidate.url, state.file, context);
      if (replacement !== null) {
        candidate.url = replacement;
        changed = true;
      }
    }
    if (changed) {
      setAttr(state, node, name, candidates.map((candidate) => candidate.descriptor ? `${candidate.url} ${candidate.descriptor}` : candidate.url).join(", "));
    }
  }

  async rewriteBackgroundVideo(node, state, context) {
    const value = getAttr(node, "data-background-video");
    if (!value) {
      return;
    }
    const sources = [];
    let inlined = false;
    for (const part of value.split(",").map((item) => item.trim()).filter(Boolean)) {
      const replacement = await this.resolveUrl(part, state.file, context, { media: true });
      if (replacement !== null && replacement.startsWith("data:")) {
        inlined = true;
      }
      sources.push(replacement ?? part);
    }
    if (inlined) {
      removeAttr(state, node, "data-background-video");
      addAttr(state, node, "data-byeslide-background-video", JSON.stringify(sources));
      state.backgroundVideo = true;
    } else if (sources.join(",") !== value) {
      setAttr(state, node, "data-background-video", sources.join(","));
    }
  }

  // An HTML file as a data: URL, for attributes that Reveal turns into iframes.
  async rewriteDocumentUrlAttr(node, state, context, name) {
    const value = getAttr(node, name);
    const target = this.classify(value, state.file);
    if (target.kind === "remote") {
      this.warnRemote(target.url, context);
      return;
    }
    if (target.kind !== "local") {
      return;
    }
    if (isHtmlFile(target.file)) {
      const html = await this.bundleLocalDocument(target, context);
      if (html !== null) {
        setAttr(state, node, name, `data:text/html;charset=utf-8,${encodeDataUrlText(html)}`);
      }
      return;
    }
    const replacement = await this.inline(target, context);
    if (replacement !== null) {
      setAttr(state, node, name, replacement);
    }
  }

  async bundleLocalDocument(target, context, options = {}) {
    const buffer = await this.readLocal(target, context);
    if (!buffer) {
      return null;
    }
    this.recordAsset(target.file, buffer.length);
    return this.bundleDocument(target.file, options);
  }

  async visitIframe(node, state, context) {
    if (getAttr(node, "srcdoc") !== null) {
      return;
    }
    for (const name of ["src", "data-src"]) {
      const value = getAttr(node, name);
      const target = this.classify(value, state.file);
      if (target.kind === "remote") {
        this.warnRemote(target.url, context);
        continue;
      }
      if (target.kind !== "local") {
        continue;
      }
      if (!isHtmlFile(target.file)) {
        await this.rewriteAttr(node, state, context, name);
        continue;
      }
      const anchor = decodeHash(target.hash);
      const sandbox = getAttr(node, "sandbox");
      if (anchor && sandbox !== null && !/\ballow-scripts\b/.test(sandbox)) {
        this.warn(`${context}: the sandboxed iframe for ${target.ref} does not allow scripts, so it opens at the top instead of at #${anchor}.`);
      }
      const html = await this.bundleLocalDocument(target, context, { scrollTo: anchor });
      if (html === null) {
        continue;
      }
      removeAttr(state, node, name);
      addAttr(state, node, "srcdoc", html);
      return;
    }
  }

  async visitLink(node, state, context) {
    const tag = node.tagName.toLowerCase();
    const rel = (getAttr(node, "rel") || "").toLowerCase().split(/\s+/).filter(Boolean);
    const href = getAttr(node, "href");
    const target = this.classify(href, state.file);

    if (tag === "link" && rel.includes("stylesheet")) {
      if (target.kind === "remote") {
        this.warnRemote(target.url, context);
        return null;
      }
      if (target.kind !== "local") {
        return null;
      }
      const buffer = await this.readLocal(target, context);
      if (!buffer) {
        return null;
      }
      this.recordAsset(target.file, buffer.length);
      const css = await this.processCss(buffer.toString("utf8"), target.file, this.label(target.file));
      const attrs = attrsToString(node, ["rel", "href", "integrity", "crossorigin", "type", "referrerpolicy", "as", "fetchpriority"]);
      replaceElement(state, node, `<style${attrs}>\n${escapeStyleText(css)}\n</style>`);
      return "replaced";
    }

    if (tag === "link") {
      if (target.kind !== "local") {
        return null;
      }
      if (rel.some((item) => item === "icon" || item === "apple-touch-icon" || item === "mask-icon")) {
        await this.rewriteAttr(node, state, context, "href");
        return null;
      }
      if (rel.some((item) => item === "preload" || item === "prefetch" || item === "modulepreload")) {
        // The file is inlined where it is used, so the hint has nothing left to load.
        replaceElement(state, node, "");
        return "replaced";
      }
      this.warn(`${context}: <link rel="${rel.join(" ")}"> points to ${target.ref}, which a bundle cannot include.`);
      return null;
    }

    // <a> and <area>: links to the deck itself become plain #hash links.
    if (target.kind !== "local") {
      return null;
    }
    if (path.resolve(target.file) === path.resolve(state.file)) {
      setAttr(state, node, "href", target.hash || "#");
      return null;
    }
    if (getAttr(node, "data-preview-link") !== null) {
      await this.rewriteDocumentUrlAttr(node, state, context, "href");
      return null;
    }
    this.warn(`${context}: the link to ${target.ref} opens a separate file, so it will not work from the bundle.`);
    return null;
  }

  async visitStyleElement(node, state, context) {
    const text = node.childNodes?.[0];
    if (!text || !text.sourceCodeLocation) {
      return;
    }
    const css = await this.processCss(text.value, state.file, context);
    if (css !== text.value) {
      state.edits.push({ start: text.sourceCodeLocation.startOffset, end: text.sourceCodeLocation.endOffset, text: escapeStyleText(css) });
    }
  }

  // Scripts -----------------------------------------------------------------

  async visitScript(node, state, ctx, context) {
    const type = (getAttr(node, "type") || "").trim().toLowerCase();
    const src = getAttr(node, "src");
    const text = node.childNodes?.[0];
    const isModule = type === "module";
    const isClassic = type === "" || type === "text/javascript" || type === "application/javascript";

    if (ctx.inBody && state.firstBodyScript === null) {
      state.firstBodyScript = node.sourceCodeLocation.startOffset;
    }

    if (type === "importmap") {
      await this.mergeImportMap(text?.value || "", state, context);
      replaceElement(state, node, "");
      return "replaced";
    }
    if (!isModule && !isClassic) {
      return "replaced";
    }

    if (src !== null) {
      const target = this.classify(src, state.file);
      if (target.kind === "remote") {
        this.warnRemote(target.url, context);
        return "replaced";
      }
      if (target.kind !== "local") {
        return "replaced";
      }
      const attrs = attrsToString(node, ["src", "integrity", "crossorigin", "referrerpolicy", "fetchpriority", "charset"]);
      if (isModule) {
        const entry = await this.addModule(target, context);
        if (entry) {
          state.moduleKeys.add(entry);
          replaceElement(state, node, `<script${attrs}>import ${JSON.stringify(entry.key)};</script>`);
        }
        return "replaced";
      }

      const buffer = await this.readLocal(target, context);
      if (!buffer) {
        return "replaced";
      }
      this.recordAsset(target.file, buffer.length);
      const code = buffer.toString("utf8");
      this.scanRuntimeReferences(code, this.label(target.file));
      const deferred = getAttr(node, "defer") !== null || getAttr(node, "async") !== null;
      if (!deferred && isSafeScriptText(code)) {
        replaceElement(state, node, `<script${attrs}>\n${code}\n</script>`);
      } else {
        // Keeps defer and async timing, and code that cannot sit inside <script> as text.
        setAttr(state, node, "src", `data:text/javascript;charset=utf-8,${encodeDataUrlText(code)}`);
      }
      return "replaced";
    }

    if (!text || !text.sourceCodeLocation) {
      return "replaced";
    }
    const scriptContext = `${context} (inline script)`;
    this.scanRuntimeReferences(text.value, scriptContext);
    if (isModule) {
      const code = await this.rewriteModuleSource(text.value, state.file, scriptContext, state.moduleKeys);
      if (code !== text.value) {
        state.edits.push({ start: text.sourceCodeLocation.startOffset, end: text.sourceCodeLocation.endOffset, text: code });
      }
    }
    return "replaced";
  }

  async addModule(target, context) {
    if (this.modules.has(target.file)) {
      return this.modules.get(target.file);
    }
    const buffer = await this.readLocal(target, context);
    if (!buffer) {
      return null;
    }
    const label = this.label(target.file);
    const entry = { key: `${MODULE_PREFIX}${label}`, file: target.file, deps: new Set(), dataUrl: null };
    this.modules.set(target.file, entry);
    this.recordAsset(target.file, buffer.length);

    const mime = mimeFor(target.file);
    let code = buffer.toString("utf8");
    if (mime === "text/javascript") {
      this.scanRuntimeReferences(code, label);
      code = await this.rewriteModuleSource(code, target.file, label, entry.deps);
      if (/\bimport\.meta\.url\b/.test(code)) {
        // A data: URL module would report the whole data: URL; report where the file sits in dist/ instead.
        code = `import.meta.url = new URL(${JSON.stringify(encodeURI(label))}, document.baseURI).href;\n${code}`;
      }
    }
    entry.dataUrl = `data:${mime};charset=utf-8,${encodeDataUrlText(code)}`;
    return entry;
  }

  async rewriteModuleSource(code, baseFile, context, deps) {
    await lexer.init;
    let imports;
    try {
      [imports] = lexer.parse(code);
    } catch (error) {
      this.warn(`${context}: the imports could not be read (${firstLine(error.message)}), so the module was left as it is.`);
      return code;
    }

    const edits = [];
    for (const item of imports) {
      if (item.type === "import-meta") {
        continue;
      }
      if (item.specifier === null || item.specifier === undefined) {
        this.warn(`${context}:${lineAt(code, item.start)}: import() with a computed path cannot be bundled, so it fails offline when it loads a local file.`);
        continue;
      }
      const specifier = item.specifier;
      const urlLike = /^(?:\.{1,2}\/|\/)/.test(specifier) || /^[a-z][a-z0-9+.-]*:/i.test(specifier);
      if (!urlLike) {
        continue;
      }
      const target = this.classify(specifier, baseFile);
      if (target.kind === "remote") {
        this.warnRemote(target.url, context);
        continue;
      }
      if (target.kind !== "local") {
        continue;
      }
      const entry = await this.addModule(target, context);
      if (!entry) {
        continue;
      }
      deps.add(entry);
      edits.push({
        start: item.start,
        end: item.end,
        text: item.type === "dynamic" ? JSON.stringify(entry.key) : entry.key
      });
    }
    return applyEdits(code, edits);
  }

  // Every module a document can reach, directly or through other modules.
  moduleClosure(roots) {
    const seen = new Set();
    const visit = (entry) => {
      if (!entry || seen.has(entry)) {
        return;
      }
      seen.add(entry);
      entry.deps.forEach(visit);
    };
    roots.forEach(visit);
    return seen;
  }

  // A page may already have an import map. Browsers allow one, so it merges into ours.
  async mergeImportMap(json, state, context) {
    let map;
    try {
      map = JSON.parse(json);
    } catch {
      this.warn(`${context}: the import map is not valid JSON, so it was left out.`);
      return;
    }
    for (const [specifier, url] of Object.entries(map.imports || {})) {
      const target = this.classify(url, state.file);
      if (target.kind === "remote") {
        this.warnRemote(target.url, context);
      }
      if (target.kind !== "local" || specifier.endsWith("/")) {
        if (target.kind === "local") {
          this.warn(`${context}: the import map entry "${specifier}" maps a whole folder, which a bundle cannot include.`);
        }
        state.importMap.imports[specifier] = url;
        continue;
      }
      const entry = await this.addModule(target, context);
      if (entry) {
        state.moduleKeys.add(entry);
        state.importMap.imports[specifier] = entry;
      } else {
        state.importMap.imports[specifier] = url;
      }
    }
    if (map.scopes) {
      state.importMap.scopes = map.scopes;
      this.warn(`${context}: import map scopes are kept as they are; local files inside scopes are not bundled.`);
    }
  }

  createImportMap(state) {
    const imports = {};
    for (const [specifier, value] of Object.entries(state.importMap.imports)) {
      imports[specifier] = typeof value === "string" ? value : value.dataUrl;
    }
    for (const entry of this.moduleClosure(state.moduleKeys)) {
      imports[entry.key] = entry.dataUrl;
    }
    if (Object.keys(imports).length === 0 && !state.importMap.scopes) {
      return null;
    }
    const map = { imports };
    if (state.importMap.scopes) {
      map.scopes = state.importMap.scopes;
    }
    const json = JSON.stringify(map).replace(/</g, "\\u003c");
    return `<script type="importmap">${json}</script>`;
  }

  scanRuntimeReferences(code, context) {
    for (const pattern of RUNTIME_REFERENCE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(code))) {
        const value = match[2];
        const target = this.classify(value, path.join(this.root, "index.html"));
        if (target.kind !== "local") {
          continue;
        }
        const call = match[0].replace(/\s+/g, " ");
        this.warn(`${context}:${lineAt(code, match.index)}: ${call}${call.endsWith(")") ? "" : ")"} loads a file while the deck runs. The bundle does not include it, so it fails offline.`);
      }
    }
  }

  // CSS -----------------------------------------------------------------------

  async processCss(css, baseFile, context, stack = [], { stringsAreUrls = false } = {}) {
    let out = "";
    const hoisted = [];
    let index = 0;

    while (index < css.length) {
      const character = css[index];

      if (character === "/" && css[index + 1] === "*") {
        const end = css.indexOf("*/", index + 2);
        const stop = end < 0 ? css.length : end + 2;
        out += css.slice(index, stop);
        index = stop;
        continue;
      }

      if (character === "\"" || character === "'") {
        const stop = readCssString(css, index);
        const raw = css.slice(index, stop);
        if (stringsAreUrls) {
          const replacement = await this.resolveUrl(unquoteCss(raw), baseFile, context);
          out += replacement !== null ? `"${escapeCssString(replacement)}"` : raw;
        } else {
          out += raw;
        }
        index = stop;
        continue;
      }

      if (character === "@" && /^@import\b/i.test(css.slice(index, index + 8))) {
        const stop = findStatementEnd(css, index);
        const statement = css.slice(index, stop);
        const replacement = await this.inlineImport(statement, baseFile, context, stack, hoisted);
        out += replacement;
        index = stop;
        continue;
      }

      if (/^url\(/i.test(css.slice(index, index + 4)) && !isCssIdentCharacter(css[index - 1])) {
        const token = readCssUrl(css, index);
        const replacement = await this.resolveUrl(token.value, baseFile, context);
        out += replacement !== null ? `url("${escapeCssString(replacement)}")` : css.slice(index, token.end);
        index = token.end;
        continue;
      }

      const imageSet = css.slice(index, index + 18).match(/^(?:-webkit-)?image-set\(/i);
      if (imageSet && !isCssIdentCharacter(css[index - 1])) {
        const open = index + imageSet[0].length - 1;
        const close = findClosingParen(css, open);
        const inner = await this.processCss(css.slice(open + 1, close), baseFile, context, stack, { stringsAreUrls: true });
        out += `${css.slice(index, open + 1)}${inner}${css.slice(close, close + 1)}`;
        index = close + 1;
        continue;
      }

      out += character;
      index += 1;
    }

    return hoisted.length > 0 ? `${hoisted.join("\n")}\n${out}` : out;
  }

  async inlineImport(statement, baseFile, context, stack, hoisted) {
    const parsed = parseImportStatement(statement);
    if (!parsed) {
      return statement;
    }
    const target = this.classify(parsed.href, baseFile);
    if (target.kind === "remote") {
      this.warnRemote(target.url, context);
      // @import must stay before every other rule, so it moves to the top.
      hoisted.push(statement.trim());
      return "";
    }
    if (target.kind !== "local") {
      return statement;
    }
    if (stack.includes(target.file)) {
      this.warn(`${context}: ${parsed.href} imports itself, so the loop was cut.`);
      return "";
    }
    const buffer = await this.readLocal(target, context);
    if (!buffer) {
      return statement;
    }
    this.recordAsset(target.file, buffer.length);
    const imported = buffer.toString("utf8").replace(/^﻿?\s*@charset\s+(["']).*?\1\s*;/i, "");
    let css = await this.processCss(imported, target.file, this.label(target.file), [...stack, target.file]);
    if (parsed.media) {
      css = `@media ${parsed.media} {\n${css}\n}`;
    }
    if (parsed.supports) {
      css = `@supports ${parsed.supports} {\n${css}\n}`;
    }
    if (parsed.layer !== null) {
      css = `@layer${parsed.layer ? ` ${parsed.layer}` : ""} {\n${css}\n}`;
    }
    return css;
  }
}

// Helpers --------------------------------------------------------------------

function getAttr(node, name) {
  const attr = (node.attrs || []).find((item) => attrName(item) === name);
  return attr ? attr.value : null;
}

function attrName(attr) {
  return attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
}

function setAttr(state, node, name, value) {
  const location = node.sourceCodeLocation?.attrs?.[name];
  if (!location) {
    addAttr(state, node, name, value);
    return;
  }
  state.edits.push({ start: location.startOffset, end: location.endOffset, text: `${name}="${escapeAttribute(value)}"` });
}

function removeAttr(state, node, name) {
  const location = node.sourceCodeLocation?.attrs?.[name];
  if (location) {
    state.edits.push({ start: location.startOffset, end: location.endOffset, text: "" });
  }
}

function addAttr(state, node, name, value) {
  const startTag = node.sourceCodeLocation.startTag || node.sourceCodeLocation;
  const tagText = state.html.slice(startTag.startOffset, startTag.endOffset);
  const at = startTag.endOffset - (tagText.endsWith("/>") ? 2 : 1);
  state.edits.push({ start: at, end: at, text: ` ${name}="${escapeAttribute(value)}"` });
}

function replaceElement(state, node, text) {
  const location = node.sourceCodeLocation;
  state.edits.push({ start: location.startOffset, end: location.endOffset, text });
}

function attrsToString(node, skip) {
  return (node.attrs || [])
    .filter((attr) => !skip.includes(attrName(attr)))
    .map((attr) => attr.value === "" ? ` ${attrName(attr)}` : ` ${attrName(attr)}="${escapeAttribute(attr.value)}"`)
    .join("");
}

function applyEdits(text, edits) {
  const sorted = edits
    .map((edit, order) => ({ ...edit, order }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.order - b.order);
  let out = "";
  let position = 0;
  for (const edit of sorted) {
    if (edit.start < position) {
      throw new Error(`Internal bundler error: overlapping edits at offset ${edit.start}.`);
    }
    out += text.slice(position, edit.start) + edit.text;
    position = edit.end;
  }
  return out + text.slice(position);
}

function headInsertionPoint(document) {
  const html = document.childNodes.find((node) => node.tagName === "html");
  const head = html?.childNodes.find((node) => node.tagName === "head");
  if (head?.sourceCodeLocation?.startTag) {
    return head.sourceCodeLocation.startTag.endOffset;
  }
  if (html?.sourceCodeLocation?.startTag) {
    return html.sourceCodeLocation.startTag.endOffset;
  }
  const doctype = document.childNodes.find((node) => node.nodeName === "#documentType");
  return doctype?.sourceCodeLocation?.endOffset ?? 0;
}

function scrollScript(anchor) {
  const id = JSON.stringify(anchor).replace(/</g, "\\u003c");
  return `<script>addEventListener("load", () => { const target = document.getElementById(${id}) || document.getElementsByName(${id})[0]; if (target) target.scrollIntoView(); });</script>`;
}

function decodeHash(hash) {
  if (!hash || hash === "#") {
    return "";
  }
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

function isHtmlFile(file) {
  return /\.html?$/i.test(file);
}

function mimeFor(file) {
  return MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

// Percent-encodes only what a data: URL cannot carry as-is: "%" and "#", and the
// tabs and line breaks that URL parsing would strip.
function encodeDataUrlText(text) {
  return text.replace(/[%#\t\n\r]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeStyleText(css) {
  return css.replace(/<\/(style)/gi, "<\\/$1");
}

function escapeCssString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\a ");
}

function unquoteCss(raw) {
  return raw.slice(1, -1).replace(/\\(.)/g, "$1");
}

function readCssString(css, start) {
  const quote = css[start];
  let index = start + 1;
  while (index < css.length) {
    if (css[index] === "\\") {
      index += 2;
      continue;
    }
    if (css[index] === quote || css[index] === "\n") {
      return index + 1;
    }
    index += 1;
  }
  return css.length;
}

function readCssUrl(css, start) {
  let index = start + 4;
  while (/\s/.test(css[index] || "")) {
    index += 1;
  }
  let value;
  if (css[index] === "\"" || css[index] === "'") {
    const stop = readCssString(css, index);
    value = unquoteCss(css.slice(index, stop));
    index = stop;
    while (index < css.length && css[index] !== ")") {
      index += 1;
    }
  } else {
    const close = css.indexOf(")", index);
    const stop = close < 0 ? css.length : close;
    value = css.slice(index, stop).trim().replace(/\\(.)/g, "$1");
    index = stop;
  }
  return { value, end: Math.min(index + 1, css.length) };
}

function findClosingParen(css, open) {
  let depth = 0;
  let index = open;
  while (index < css.length) {
    const character = css[index];
    if (character === "\"" || character === "'") {
      index = readCssString(css, index);
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
    index += 1;
  }
  return css.length - 1;
}

function findStatementEnd(css, start) {
  let index = start;
  let depth = 0;
  while (index < css.length) {
    const character = css[index];
    if (character === "\"" || character === "'") {
      index = readCssString(css, index);
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === ";" && depth <= 0) {
      return index + 1;
    }
    index += 1;
  }
  return css.length;
}

function parseImportStatement(statement) {
  let rest = statement.replace(/^@import\s*/i, "").replace(/;\s*$/, "").trim();
  let href;
  if (rest.startsWith("\"") || rest.startsWith("'")) {
    const stop = readCssString(rest, 0);
    href = unquoteCss(rest.slice(0, stop));
    rest = rest.slice(stop).trim();
  } else if (/^url\(/i.test(rest)) {
    const token = readCssUrl(rest, 0);
    href = token.value;
    rest = rest.slice(token.end).trim();
  } else {
    return null;
  }

  let layer = null;
  const layerMatch = rest.match(/^layer(?:\(([^)]*)\))?/i);
  if (layerMatch) {
    layer = (layerMatch[1] || "").trim();
    rest = rest.slice(layerMatch[0].length).trim();
  }
  let supports = "";
  if (/^supports\(/i.test(rest)) {
    const close = findClosingParen(rest, rest.indexOf("("));
    supports = `(${rest.slice(rest.indexOf("(") + 1, close).trim()})`;
    rest = rest.slice(close + 1).trim();
  }
  return { href, layer, supports, media: rest };
}

function isCssIdentCharacter(character) {
  return Boolean(character) && /[\w-]/.test(character);
}

function parseSrcset(value) {
  const candidates = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,]/.test(value[index])) {
      index += 1;
    }
    if (index >= value.length) {
      break;
    }
    const start = index;
    while (index < value.length && !/\s/.test(value[index])) {
      index += 1;
    }
    let url = value.slice(start, index);
    let endsCandidate = false;
    while (url.endsWith(",")) {
      url = url.slice(0, -1);
      endsCandidate = true;
    }
    let descriptor = "";
    if (!endsCandidate) {
      const descriptorStart = index;
      let depth = 0;
      while (index < value.length) {
        const character = value[index];
        if (character === "(") {
          depth += 1;
        } else if (character === ")") {
          depth -= 1;
        } else if (character === "," && depth <= 0) {
          break;
        }
        index += 1;
      }
      descriptor = value.slice(descriptorStart, index).trim();
    }
    candidates.push({ url, descriptor });
  }
  return candidates;
}

// Follows the HTML parser through script text: the text is safe inside <script>
// when no "</script" ends it early and it does not end in the double-escaped state
// that "<!--" followed by "<script" starts.
function isSafeScriptText(text) {
  const lower = text.toLowerCase();
  let state = "data";
  for (let index = 0; index < lower.length; index += 1) {
    if (lower.startsWith("</script", index) && /[\s/>]/.test(lower[index + 8] || ">")) {
      if (state !== "double") {
        return false;
      }
      state = "escaped";
    } else if (state === "data" && lower.startsWith("<!--", index)) {
      state = "escaped";
    } else if (state !== "data" && lower.startsWith("-->", index)) {
      state = "data";
    } else if (state === "escaped" && lower.startsWith("<script", index) && /[\s/>]/.test(lower[index + 7] || ">")) {
      state = "double";
    }
  }
  return state !== "double";
}

function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
    }
  }
  return line;
}

function formatBytes(bytes) {
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function firstLine(value) {
  return String(value).split(/\r?\n/)[0];
}

module.exports = {
  DEFAULT_MAX_ASSET_MB,
  Bundler,
  bundleDeck,
  encodeDataUrlText,
  formatBytes,
  isSafeScriptText,
  parseSrcset,
  resolveBundleOutput
};
