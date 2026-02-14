import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "README.md");
const dest = path.join(root, "ha-app", "README.md");

const content = fs.readFileSync(src, "utf8");
fs.writeFileSync(dest, content);
console.warn("Copied README.md to ha-app/README.md");
