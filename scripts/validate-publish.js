const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

if (!pkg.name || !pkg.name.startsWith("@")) {
  fail("package.json name must be scoped (e.g., @org/tool-name).");
}

if (!pkg.displayName || pkg.displayName.trim().length < 3) {
  fail("package.json displayName is required.");
}

if (!pkg.description || pkg.description.trim().length < 10) {
  fail("package.json description is required.");
}

if (!pkg.main || typeof pkg.main !== "string") {
  fail("package.json main is required.");
} else if (!fileExists(pkg.main)) {
  fail(`main entry not found: ${pkg.main}`);
}

const allowedLicenses = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "GPL-2.0",
  "GPL-3.0",
  "LGPL-3.0",
  "ISC",
  "AGPL-3.0-only",
]);

if (!pkg.license || !allowedLicenses.has(pkg.license)) {
  fail("package.json license must be an approved open-source license.");
}

if (!Array.isArray(pkg.contributors) || pkg.contributors.length === 0) {
  fail("package.json contributors array is required.");
}

if (!pkg.configurations || typeof pkg.configurations !== "object") {
  fail("package.json configurations is required.");
} else {
  if (!pkg.configurations.repository) {
    fail("configurations.repository is required.");
  }
  if (!pkg.configurations.readmeUrl) {
    fail("configurations.readmeUrl is required.");
  } else if (!pkg.configurations.readmeUrl.includes("raw.githubusercontent.com")) {
    fail("configurations.readmeUrl must point to raw.githubusercontent.com.");
  }
}

if (!fileExists("dist/index.html")) {
  fail("dist/index.html missing. Run npm run build.");
}

if (!fileExists("README.md")) {
  fail("README.md missing.");
}

if (!fileExists("npm-shrinkwrap.json")) {
  fail("npm-shrinkwrap.json missing. Run npm run finalize-package.");
}

if (process.exitCode) {
  process.exit(process.exitCode);
} else {
  console.log("Publish validation passed.");
}
