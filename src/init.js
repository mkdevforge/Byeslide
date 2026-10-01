const fs = require("node:fs/promises");
const path = require("node:path");
const { copyDirectory, pathExists } = require("./fs-utils");
const { SHARED_DIR, resolveTemplate } = require("./templates");

async function initDeck(target = ".", options = {}) {
  const root = path.resolve(target);
  const template = resolveTemplate(options.template);

  for (const dir of [SHARED_DIR, template.dir]) {
    if (!(await pathExists(dir))) {
      throw new Error(`Template directory not found: ${dir}`);
    }
  }

  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root);
  if (entries.length > 0 && !options.force) {
    throw new Error(`Refusing to initialize ${root} because it is not empty. Use --force to overwrite matching files.`);
  }

  // Files every deck shares first, then the chosen deck. The deck wins where both have a file.
  const skip = (entry) => entry.name === "node_modules" || entry.name === "dist";
  await copyDirectory(SHARED_DIR, root, { skip });
  await copyDirectory(template.dir, root, { skip });
  await restoreGitignore(root);
  await stampPackageVersion(root);

  return {
    deckDir: root,
    template: template.name
  };
}

// npm leaves .gitignore files out of published packages, so the template
// stores it as "gitignore" and init gives it its real name.
async function restoreGitignore(deckDir) {
  const stored = path.join(deckDir, "gitignore");
  if (await pathExists(stored)) {
    await fs.rename(stored, path.join(deckDir, ".gitignore"));
  }
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
