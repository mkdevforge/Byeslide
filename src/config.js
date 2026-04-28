const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { pathExists } = require("./fs-utils");

const DEFAULT_CONFIG = {
  title: "Untitled Byeslide Deck",
  description: "",
  width: 1920,
  height: 1080,
  margin: 0.04,
  minScale: 0.2,
  maxScale: 2,
  center: false,
  controls: true,
  progress: true,
  hash: true,
  slideNumber: false,
  transition: "slide",
  backgroundTransition: "fade",
  outDir: "dist",
  slidesDir: "slides",
  patternsDir: "patterns",
  assetsDir: "assets",
  theme: "theme.css",
  styles: "styles.css",
  plugins: ["notes", "highlight", "search", "zoom"]
};

async function loadConfig(deckDir) {
  const root = path.resolve(deckDir);
  const configPath = path.join(root, "deck.config.js");
  let userConfig = {};

  if (await pathExists(configPath)) {
    userConfig = await loadConfigFile(configPath, root);
  }

  if (typeof userConfig === "function") {
    userConfig = await userConfig({ deckDir: root });
  }

  return normalizeConfig(root, userConfig || {});
}

async function loadConfigFile(configPath, root) {
  try {
    const resolved = require.resolve(configPath);
    delete require.cache[resolved];
    return require(resolved);
  } catch (error) {
    if (error.code !== "ERR_REQUIRE_ESM") {
      throw error;
    }

    const stat = await fs.stat(configPath);
    const url = `${pathToFileURL(configPath).href}?mtime=${stat.mtimeMs}`;
    const imported = await import(url);
    return imported.default || imported;
  }
}

function normalizeConfig(root, userConfig) {
  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig
  };

  merged.deckDir = root;
  merged.width = toPositiveNumber(merged.width, DEFAULT_CONFIG.width, "width");
  merged.height = toPositiveNumber(merged.height, DEFAULT_CONFIG.height, "height");
  merged.margin = toNumber(merged.margin, DEFAULT_CONFIG.margin);
  merged.minScale = toNumber(merged.minScale, DEFAULT_CONFIG.minScale);
  merged.maxScale = toNumber(merged.maxScale, DEFAULT_CONFIG.maxScale);
  merged.cssFiles = [
    ...normalizeFileList(merged.theme),
    ...normalizeFileList(merged.styles)
  ];
  merged.plugins = Array.isArray(merged.plugins)
    ? merged.plugins
    : DEFAULT_CONFIG.plugins;

  return merged;
}

function normalizeFileList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return [value];
}

function toPositiveNumber(value, fallback, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`deck.config.js ${label} must be a positive number.`);
  }
  return number;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function revealOptions(config) {
  const base = {
    width: config.width,
    height: config.height,
    margin: config.margin,
    minScale: config.minScale,
    maxScale: config.maxScale,
    center: config.center,
    controls: config.controls,
    progress: config.progress,
    hash: config.hash,
    slideNumber: config.slideNumber,
    transition: config.transition,
    backgroundTransition: config.backgroundTransition
  };

  return {
    ...base,
    ...(config.reveal || {})
  };
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  revealOptions
};
