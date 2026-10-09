// Bundles every design in public/vault/files into dist/vault/all-designs.zip
// so "Download all" is a single same-origin file. Runs after `vite build`.
// Stored, not deflated: the designs are already-compressed images.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

const SRC = new URL("../public/vault/files/", import.meta.url).pathname;
const OUT = new URL("../dist/vault/all-designs.zip", import.meta.url).pathname;

function walk(dir, out = {}) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name.toLowerCase() === "readme.md") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out[relative(SRC, full).split("\\").join("/")] = readFileSync(full);
  }
  return out;
}

const files = walk(SRC);
const names = Object.keys(files);
mkdirSync(new URL("../dist/vault/", import.meta.url).pathname, { recursive: true });
writeFileSync(OUT, zipSync(files, { level: 0 }));
console.log(`all-designs.zip: ${names.length} file(s), ${(statSync(OUT).size / 1024 / 1024).toFixed(1)} MB`);
