const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const packageLockPath = path.join(rootDir, "package-lock.json");
const shrinkwrapPath = path.join(rootDir, "npm-shrinkwrap.json");

console.log("Finalizing package for deployment...\n");

if (!fs.existsSync(packageLockPath)) {
  console.warn("Warning: package-lock.json not found. Shrinkwrap not generated.");
  process.exit(1);
}

const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
fs.writeFileSync(shrinkwrapPath, JSON.stringify(packageLock, null, 2));

console.log("Generated npm-shrinkwrap.json for dependency locking.");
console.log("\nPackage finalize completed.");
