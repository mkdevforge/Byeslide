#!/usr/bin/env node

// Builds or checks every starter template.
//   node scripts/examples.js build   writes template/dist/<name>/ for each template, plus an index page
//   node scripts/examples.js check   runs byeslide check on each template

const fs = require("node:fs/promises");
const path = require("node:path");
const { buildDeck } = require("../src/build");
const { checkDeck } = require("../src/browser");
const { copyDirectory } = require("../src/fs-utils");
const { TEMPLATE_ROOT, listTemplates } = require("../src/templates");

const OUT_DIR = path.join(TEMPLATE_ROOT, "dist");
// Title-slide thumbnails from the website, used as covers on the index page.
const COVERS_DIR = path.join(__dirname, "..", "docs", "assets", "slides");

async function build() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const template of listTemplates()) {
    const result = await buildDeck(template.dir);
    await copyDirectory(result.outDir, path.join(OUT_DIR, template.name));
    await fs.copyFile(path.join(COVERS_DIR, template.name, "01-title.webp"), path.join(OUT_DIR, `${template.name}-cover.webp`));
    console.log(`Built ${template.name}: ${result.slideFiles.length} slides`);
  }

  await fs.writeFile(path.join(OUT_DIR, "index.html"), renderIndex(listTemplates()), "utf8");
  // Cloudflare Pages headers: deck files keep their names between releases, so
  // browsers must check for a newer version on every visit.
  await fs.writeFile(path.join(OUT_DIR, "_headers"), "/*\n  Cache-Control: no-cache\n", "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), OUT_DIR)}`);
}

async function check() {
  let failed = false;
  for (const template of listTemplates()) {
    const result = await checkDeck(template.dir);
    const problems = result.slides.filter((slide) => slide.overflowX || slide.overflowY || slide.offenders.length > 0);
    if (problems.length === 0) {
      console.log(`${template.name}: no overflow across ${result.slides.length} slides.`);
      continue;
    }
    failed = true;
    console.log(`${template.name}: overflow detected:`);
    for (const slide of problems) {
      console.log(`- ${slide.source} (#${slide.index})${slide.offenders.length ? ` offenders: ${slide.offenders.join(", ")}` : ""}`);
    }
  }
  return failed ? 1 : 0;
}

function renderIndex(templates) {
  const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const items = templates.map((template) => `      <li>
        <a href="./${template.name}/">
          <img src="./${template.name}-cover.webp" alt="" width="1280" height="720">
          <strong>${escape(template.title)}</strong>
          <span>${escape(template.description)}</span>
          <code>byeslide init my-deck --template ${template.name}</code>
        </a>
      </li>`).join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Byeslide example decks</title>
    <meta name="description" content="The starter decks that byeslide init can create.">
    <script>
      // Old links pointed at the tour deck at the site root, for example /#/5.
      if (/^#\\/\\d/.test(location.hash)) {
        location.replace("./tour/" + location.hash);
      }
    </script>
    <style>
      :root { color-scheme: light; --text: #1d2657; --soft: #4a5384; --paper: #f5f6f2; --accent: #0078bf; }
      * { box-sizing: border-box; }
      body { background: var(--paper); color: var(--text); font: 18px/1.5 system-ui, "Segoe UI", sans-serif; margin: 0; padding: clamp(24px, 6vw, 80px); }
      h1 { font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.03em; line-height: 1; margin: 0 0 12px; }
      p { color: var(--soft); margin: 0 0 40px; max-width: 46ch; }
      ul { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); list-style: none; margin: 0; max-width: 1100px; padding: 0; }
      a { background: #fff; border: 2px solid var(--text); color: inherit; display: flex; flex-direction: column; gap: 10px; height: 100%; padding: 0 0 24px; text-decoration: none; transition: box-shadow 0.2s ease, transform 0.2s ease; }
      a > :not(img) { margin-inline: 24px; }
      img { aspect-ratio: 16 / 9; border-bottom: 2px solid var(--text); display: block; height: auto; margin-bottom: 8px; width: 100%; }
      a:hover, a:focus-visible { box-shadow: 8px 8px 0 var(--accent); transform: translate(-4px, -4px); }
      a:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
      strong { font-size: 1.5rem; letter-spacing: -0.01em; line-height: 1.1; }
      span { color: var(--soft); }
      code { font: 0.85rem/1.4 Consolas, ui-monospace, monospace; margin-top: auto; }
      @media (prefers-reduced-motion: reduce) { a { transition: none; } }
    </style>
  </head>
  <body>
    <h1>Byeslide example decks</h1>
    <p>Each deck is a starter that <code>byeslide init</code> can create. Open one to present it, or press S for the speaker view.</p>
    <ul>
${items}
    </ul>
  </body>
</html>
`;
}

async function main() {
  const mode = process.argv[2];
  if (mode === "build") {
    await build();
    return 0;
  }
  if (mode === "check") {
    return check();
  }
  console.error("Usage: node scripts/examples.js build|check");
  return 1;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
