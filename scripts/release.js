#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const VERSION_SPECS = new Set([
  "major",
  "minor",
  "patch"
]);
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")));
const versionSpec = rawArgs.find((arg) => !arg.startsWith("--")) || "patch";
const dryRun = flags.has("--dry-run");
const noPush = flags.has("--no-push");

main();

function main() {
  if (!VERSION_SPECS.has(versionSpec) && !SEMVER.test(versionSpec)) {
    fail(`Invalid version spec "${versionSpec}". Use patch, minor, major, or an explicit semver version.`);
  }

  const packagePath = path.join(process.cwd(), "package.json");
  const packageText = fs.readFileSync(packagePath, "utf8");
  const packageJson = JSON.parse(packageText);
  const nextVersion = resolveNextVersion(packageJson.version, versionSpec);
  if (nextVersion === packageJson.version) {
    fail(`Package is already at version ${nextVersion}.`);
  }

  if (dryRun) {
    console.log("Dry run: commands will be printed but not executed.");
  } else {
    assertOnMain();
    assertClean("Release requires a clean working tree.");
  }

  run("pnpm", ["test"]);
  run("pnpm", ["run", "build:template"]);

  if (!dryRun) {
    assertClean("Release checks produced uncommitted changes.");
  }

  setPackageVersion(packagePath, packageText, packageJson, nextVersion);
  run("npm", ["pack", "--dry-run"]);
  run("git", ["add", "package.json"]);
  run("git", ["commit", "-m", `Release ${nextVersion}`]);
  run("git", ["tag", `v${nextVersion}`]);

  if (noPush) {
    if (dryRun) {
      console.log("Dry run complete. No files, commits, tags, or pushes were changed.");
      return;
    }

    console.log("Created the release commit and tag locally. Push with: git push origin main --follow-tags");
    return;
  }

  run("git", ["push", "origin", "main", "--follow-tags"]);
  if (dryRun) {
    console.log("Dry run complete. No files, commits, tags, or pushes were changed.");
    return;
  }

  console.log("Release pushed. GitHub Actions will publish the package from the version tag.");
}

function resolveNextVersion(currentVersion, spec) {
  if (SEMVER.test(spec)) {
    return spec.replace(/^v/, "");
  }

  const match = currentVersion.match(SEMVER);
  if (!match) {
    fail(`Current package version "${currentVersion}" is not a supported semver version.`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  switch (spec) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      fail(`Invalid version spec "${spec}".`);
  }
}

function setPackageVersion(packagePath, originalText, packageJson, nextVersion) {
  console.log(`> set package.json version to ${nextVersion}`);
  if (dryRun) {
    return;
  }

  packageJson.version = nextVersion;
  const newline = originalText.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2).replace(/\n/g, newline)}${newline}`);
}

function assertOnMain() {
  const branch = capture("git", ["branch", "--show-current"]).trim();
  if (branch !== "main") {
    fail(`Releases must be run from main. Current branch: ${branch || "(detached)"}`);
  }
}

function assertClean(message) {
  const status = capture("git", ["status", "--porcelain"]).trim();
  if (status) {
    fail(`${message}\n\n${status}`);
  }
}

function run(command, args) {
  console.log(`> ${formatCommand(command, args)}`);
  if (dryRun) {
    return;
  }

  const invocation = resolveCommand(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function capture(command, args) {
  const invocation = resolveCommand(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(result.stderr || `${command} ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function resolveCommand(command, args) {
  if (process.platform === "win32" && (command === "npm" || command === "pnpm")) {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", formatWindowsCommand(command, args)]
    };
  }

  return { command, args };
}

function formatCommand(command, args) {
  return [command, ...args].map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ");
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(" ");
}

function quoteWindowsArg(arg) {
  if (!/[\s"&|<>^]/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
