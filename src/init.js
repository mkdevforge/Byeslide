const fs = require("node:fs/promises");
const path = require("node:path");
const { copyDirectory, pathExists } = require("./fs-utils");

async function initDeck(target = ".", options = {}) {
  const root = path.resolve(target);
  const templateRoot = path.resolve(__dirname, "..", "template");

  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root);
  if (entries.length > 0 && !options.force) {
    throw new Error(`Refusing to initialize ${root} because it is not empty. Use --force to overwrite matching files.`);
  }

  if (!(await pathExists(templateRoot))) {
    throw new Error(`Template directory not found: ${templateRoot}`);
  }

  await copyDirectory(templateRoot, root, {
    skip(entry) {
      return entry.name === "node_modules" || entry.name === "dist";
    }
  });
  await stampPackageVersion(root);

  return {
    deckDir: root
  };
}

async function stampPackageVersion(deckDir) {
  const sourcePackagePath = path.resolve(__dirname, "..", "package.json");
  const deckPackagePath = path.join(deckDir, "package.json");

  if (!(await pathExists(deckPackagePath))) {
    return;
  }

  const sourcePackage = JSON.parse(await fs.readFile(sourcePackagePath, "utf8"));
  const deckPackage = JSON.parse(await fs.readFile(deckPackagePath, "utf8"));
  deckPackage.devDependencies = {
    ...(deckPackage.devDependencies || {}),
    byeslide: sourcePackage.version
  };

  await fs.writeFile(deckPackagePath, `${JSON.stringify(deckPackage, null, 2)}\n`, "utf8");
}

module.exports = {
  initDeck,
  stampPackageVersion
};
