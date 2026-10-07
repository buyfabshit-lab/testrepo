# Phase 1 — build, typecheck, lint, tests (2026-10-07)

Run from `pressline-os/` on the branch head.

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0, zero errors |
| Lint | `npx eslint .` | exit 0, zero errors / zero warnings |
| Unit tests | `npm test` | 8 files, **29 tests passed** |
| Production build | `npx next build` (Next 15.5) | ✓ Compiled; 43 API routes, 19 dashboard routes, 5 public routes, 14 world routes, middleware 94.6 kB |
| n8n | `node n8n/validate.mjs` | 13 workflows, 13 ok, 0 failed |

Tests cover: pricing bands + rush + setup fees, gang-sheet nesting (strip packing, spill, oversize skip, 300 DPI pixel boxes), file naming (Pacific date), intake screen (hold never rejects), n8n HMAC (tamper/stale/missing/invalid hex), order state machine (spec path, force, HOLD), office PIN (scrypt + token with trailing-garbage rejection — a real bug the test caught), Outlaw file classifier + ping copy.
