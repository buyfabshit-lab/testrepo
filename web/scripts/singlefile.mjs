// Produces dist/single.html: the whole app as one self-contained file.
//
// Why this exists: some deploy paths (Netlify's server-side design import
// among them) accept exactly one HTML file fetched from a URL. Inlining the
// JS and CSS makes the build deployable that way with nothing else on the
// host. The portrait is already a data URI inside the JS bundle (see
// assetsInlineLimit in vite.config.ts).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist", import.meta.url).pathname;
let html = readFileSync(join(dist, "index.html"), "utf8");
const assets = readdirSync(join(dist, "assets"));

for (const file of assets) {
  const content = readFileSync(join(dist, "assets", file), "utf8");
  if (file.endsWith(".js")) {
    // "</script" inside JS source can only occur in strings or regexes,
    // where "<\/script" is byte-for-byte equivalent — the standard escape
    // for inlining scripts.
    const safe = content.replaceAll("</script", "<\\/script");
    html = html.replace(
      new RegExp(`<script type="module"[^>]*src="/assets/${file}"[^>]*></script>`),
      () => `<script type="module">${safe}</script>`,
    );
  } else if (file.endsWith(".css")) {
    const safe = content.replaceAll("</style", "<\\/style");
    html = html.replace(
      new RegExp(`<link rel="stylesheet"[^>]*href="/assets/${file}"[^>]*>`),
      () => `<style>${safe}</style>`,
    );
  }
}

// Favicon: inline it too, so no /dime.jpg request is left behind.
const icon = readFileSync(join(dist, "dime.jpg")).toString("base64");
html = html.replace(
  '<link rel="icon" href="/dime.jpg" />',
  `<link rel="icon" href="data:image/jpeg;base64,${icon}" />`,
);
// og:image must be an absolute URL; point it at the repo copy.
html = html.replace(
  '<meta property="og:image" content="/dime.jpg" />',
  '<meta property="og:image" content="https://raw.githubusercontent.com/buyfabshit-lab/testrepo/claude/dime-streamer-website-0tl7uk/web/public/dime.jpg" />',
);

if (/src="\/assets\//.test(html) || /href="\/assets\//.test(html)) {
  console.error("ERROR: an asset reference survived inlining");
  process.exit(1);
}

writeFileSync(join(dist, "single.html"), html);
console.log(`single.html written: ${(html.length / 1024).toFixed(0)} KB`);
