#!/usr/bin/env node

const path = require("node:path");
const packageJson = require("../package.json");
const { buildDeck } = require("./build");
const { checkDeck, exportPdf, installBrowsers } = require("./browser");
const { loadConfig } = require("./config");
const { initDeck } = require("./init");
const { previewDeck } = require("./preview");
const { listHtmlFiles, toPosixPath } = require("./fs-utils");

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const command = parsed.positionals.shift();

  if (parsed.options.version || command === "version") {
    printVersion();
    return 0;
  }

  if (!command || command === "help" || parsed.options.help) {
    printHelp();
    return 0;
  }

  switch (command) {
    case "init":
      return runInit(parsed);
    case "build":
      return runBuild(parsed);
    case "preview":
      return runPreview(parsed);
    case "check":
      return runCheck(parsed);
    case "pdf":
      return runPdf(parsed);
    case "patterns":
      return runPatterns(parsed);
    case "install-browsers":
      return runInstallBrowsers(parsed);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function runInit(parsed) {
  const target = parsed.positionals[0] || ".";
  const result = await initDeck(target, {
    force: Boolean(parsed.options.force)
  });
  console.log(`Initialized Byeslide deck in ${result.deckDir}`);
  return 0;
}

async function runBuild(parsed) {
  const deckDir = parsed.positionals[0] || process.cwd();
  const result = await buildDeck(deckDir, {
    clean: parsed.options.clean !== false,
    outDir: parsed.options.out
  });
  console.log(`Built ${path.relative(result.deckDir, result.indexPath) || result.indexPath}`);
  console.log(`Slides: ${result.slideFiles.length}`);
  return 0;
}

async function runPreview(parsed) {
  const deckDir = parsed.positionals[0] || process.cwd();
  await previewDeck(deckDir, {
    host: parsed.options.host || "127.0.0.1",
    port: parsed.options.port || 4173,
    outDir: parsed.options.out
  });
  return 0;
}

async function runCheck(parsed) {
  const deckDir = parsed.positionals[0] || process.cwd();
  const result = await checkDeck(deckDir, {
    clean: parsed.options.clean !== false,
    outDir: parsed.options.out
  });

  if (parsed.options.json) {
    console.log(JSON.stringify({
      ok: result.ok,
      slides: result.slides
    }, null, 2));
  } else {
    printCheckResult(result);
  }

  return result.ok ? 0 : 1;
}

async function runPdf(parsed) {
  const deckDir = parsed.positionals[0] || process.cwd();
  const result = await exportPdf(deckDir, {
    clean: parsed.options.clean !== false,
    outDir: parsed.options.out,
    output: parsed.options.output
  });
  console.log(`Wrote ${path.relative(result.deckDir, result.output) || result.output}`);
  return 0;
}

async function runPatterns(parsed) {
  const deckDir = path.resolve(parsed.positionals[0] || process.cwd());
  const config = await loadConfig(deckDir);
  const patternsDir = path.resolve(deckDir, config.patternsDir);
  const files = await listHtmlFiles(patternsDir);
  if (files.length === 0) {
    console.log("No pattern HTML files found.");
    return 0;
  }
  for (const file of files) {
    console.log(toPosixPath(path.relative(deckDir, file)));
  }
  return 0;
}

async function runInstallBrowsers(parsed) {
  const browser = parsed.positionals[0] || "chromium";
  await installBrowsers(browser);
  return 0;
}

function printCheckResult(result) {
  if (result.ok) {
    console.log(`No overflow detected across ${result.slides.length} slides.`);
    return;
  }

  console.log("Overflow detected:");
  for (const slide of result.slides.filter((item) => item.overflowX || item.overflowY || item.offenders.length > 0)) {
    const axes = [
      slide.overflowX ? "x" : null,
      slide.overflowY ? "y" : null
    ].filter(Boolean).join("/");
    const axisLabel = axes ? ` axis=${axes}` : "";
    console.log(`- ${slide.source} (#${slide.index})${axisLabel}`);
    if (slide.offenders.length > 0) {
      console.log(`  offenders: ${slide.offenders.join(", ")}`);
    }
  }
}

function parseArgs(args) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    if (withoutPrefix.startsWith("no-")) {
      options[toCamelCase(withoutPrefix.slice(3))] = false;
      continue;
    }

    const [rawKey, inlineValue] = withoutPrefix.split(/=(.*)/s, 2);
    const key = toCamelCase(rawKey);
    if (inlineValue !== undefined) {
      options[key] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }

  return {
    options,
    positionals
  };
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function printVersion() {
  console.log(packageJson.version);
}

function printHelp() {
  console.log(`Byeslide

Usage:
  byeslide --version
  byeslide version
  byeslide init [dir] [--force]
  byeslide build [dir] [--out dist] [--no-clean]
  byeslide preview [dir] [--host 127.0.0.1] [--port 4173] [--out dist]
  byeslide check [dir] [--json] [--out dist] [--no-clean]
  byeslide pdf [dir] [--output dist/deck.pdf] [--out dist] [--no-clean]
  byeslide patterns [dir]
  byeslide install-browsers [chromium]
`);
}

if (require.main === module) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = {
  main,
  parseArgs
};
