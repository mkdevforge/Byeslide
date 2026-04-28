const fs = require("node:fs/promises");
const path = require("node:path");

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(target) {
  if (!(await pathExists(target))) {
    return "";
  }
  return fs.readFile(target, "utf8");
}

async function listHtmlFiles(dir) {
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => collator.compare(path.basename(a), path.basename(b)));
}

async function copyDirectory(source, destination, options = {}) {
  if (!(await pathExists(source))) {
    return;
  }

  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (options.skip && options.skip(entry, sourcePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath, options);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

module.exports = {
  copyDirectory,
  isInside,
  listHtmlFiles,
  pathExists,
  readTextIfExists,
  toPosixPath
};
