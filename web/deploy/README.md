# Single-file deploy artifact

`single.html` is the entire site as one self-contained file — JS, CSS and the
portrait inlined — produced by `npm run build && node scripts/singlefile.mjs`.

It exists because the Netlify design importer deploys from a single publicly
fetchable HTML URL (this repo is public, so the raw.githubusercontent.com URL
of this file works). It is a build artifact committed on purpose; regenerate it
after any web/ change that should reach the live site this way.
