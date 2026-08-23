// Assembles midnight-fusion/index.html into dist/mf.html with every asset
// (fonts, portrait) inlined as data URIs — same single-file deploy pipeline
// as the DIME site.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const b64 = (p) => readFileSync(p).toString("base64");
const F = "../web/src/assets/fonts";

let html = readFileSync("index.html", "utf8")
  .replaceAll("__FONT_DISPLAY__", `data:font/woff2;base64,${b64(`${F}/big-shoulders-latin-wght-normal.woff2`)}`)
  .replaceAll("__FONT_BODY__", `data:font/woff2;base64,${b64(`${F}/archivo-latin-wght-normal.woff2`)}`)
  .replaceAll("__FONT_MONO__", `data:font/woff2;base64,${b64(`${F}/space-mono-latin-400-normal.woff2`)}`)
  .replaceAll("__FONT_MONO_BOLD__", `data:font/woff2;base64,${b64(`${F}/space-mono-latin-700-normal.woff2`)}`)
  .replaceAll("__PORTRAIT__", `data:image/webp;base64,${b64("../web/src/assets/dime.webp")}`);

mkdirSync("dist", { recursive: true });
writeFileSync("dist/mf.html", html);
console.log(`dist/mf.html: ${(html.length / 1024).toFixed(0)} KB`);
