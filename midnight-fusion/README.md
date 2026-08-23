# Midnight Fusion — the label front

A one-page site in the SKREW U mold, rebranded: Midnight Fusion is the label,
DIME is the face. Deployed at https://midnightfusion.netlify.app (via the
single-file artifact → Netlify import pipeline; see web/deploy/README.md).

Structure follows skrewu.com's public page: manifesto hero → creed → the floor
(live `listings` from NW2, read-only while in preview; bidding stays on
skrewu.com) → the wall (SHARED with dime-live: same `dime_wall_posts` table,
posting and hearts work) → drops (`dime_products`) → the signal
(`dime_settings` live status + countdown).

`node build.mjs` inlines the fonts and portrait from ../web/src/assets into
dist/mf.html. Same Supabase publishable key as everything else — browser-safe
by design.

Status: DRAFT, not merged to the default branch — awaiting a verdict.
