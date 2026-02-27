const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const filesToCopy = ["src/index.html", "src/index.css", "README.md", "assets/icon.svg"];

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

for (const relativePath of filesToCopy) {
  const sourcePath = path.join(rootDir, relativePath);
  const destPath = path.join(distDir, path.basename(relativePath));
  fs.copyFileSync(sourcePath, destPath);
}

console.log("Copied static assets to dist.");
