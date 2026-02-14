import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const configPath = path.join(root, "ha-app/config.yaml");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const current = pkg.version;
const parts = current.split(".");
if (parts.length !== 3 || parts.some(p => !/^\d+$/.test(p))) {
  console.error(`version: expected YYYY.M.MICRO, got "${current}"`);
  process.exit(1);
}

const versionYear = Number(parts[0]);
const versionMonth = Number(parts[1]);
const versionMicro = Number(parts[2]);

const now = new Date();
const currentYear = now.getUTCFullYear();
const currentMonth = now.getUTCMonth() + 1;

let nextVersion;
if (versionYear === currentYear && versionMonth === currentMonth) {
  nextVersion = `${versionYear}.${versionMonth}.${versionMicro + 1}`;
}
else if (versionYear === currentYear) {
  nextVersion = `${versionYear}.${currentMonth}.0`;
}
else {
  nextVersion = `${currentYear}.1.0`;
}

pkg.version = nextVersion;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const config = fs.readFileSync(configPath, "utf8");
fs.writeFileSync(configPath, config.replace(/^version:.*/m, `version: ${nextVersion}`));

console.warn(nextVersion);
