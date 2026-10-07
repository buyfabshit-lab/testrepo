# Open items — ask Justin, don't guess

From spec §13 plus what the build surfaced. Each one blocks the thing in **bold**.

1. ~~**Repo.**~~ Done 2026-10-07: `buyfabshit-lab/pressline-os` (private) holds this app at its root, split from `testrepo/pressline-os` with full history.
2. **Supabase target.** Both active projects (`midnight-fusion-staging`, `oceanaire-midnight-press`) already carry the Standalone app's `public.orders` / `public.products`. PRESSLINE went into `midnight-fusion-staging` as schema `pressline`. Confirm that is the consolidated project, then add `pressline` to *Exposed schemas* (RUNBOOK §0.1). **Blocks: every app query.**
3. **Printavo?** Bridge or skip. If bridge: Printavo API key → import customers/orders/quotes into `pressline.*`, verify counts, cut over.
4. **Jeff + Danny costs** → replace the placeholder `price_rules` (migration 0003) with real numbers. **Blocks: real quotes.**
5. **Where the 75K vault lives** (Drive / external drive / buckets). `scripts/vault-ingest.ts` walks a local folder today; Drive source needs the service account first.
6. **Outlaw's original character text** → paste into `lib/outlaw/persona.md` between the markers. The Standalone repo has an "Outlaw Helper" intercom voice (`server/outlawHelper.ts`) but no persona prompt; nothing was fetched from Manus.
7. **Consent wording sign-off** from Grahm or Jay. The exact text is in `lib/sms/index.ts` `CONSENT_TEXT` and is shown on `/join`, the proof page, and the opt-in route.
8. **Rotate Outlaw's leaked credentials** before `ANTHROPIC_API_KEY` goes on Railway.
9. **`screen.py` + `blocklist.json`** were not in any repo this session could reach. `lib/screen/` is a faithful re-implementation with a starter blocklist; drop the original list into `lib/screen/blocklist.json`.
10. **midnightnest / Pocket Fixer sources** likewise not reachable; nesting is ported from the Standalone `gangSheetEngine.ts` (same algorithm), imaging tools are rebuilt on sharp. Point me at the originals to port 1:1.
11. **Ship-from address** for ShipStation labels (`SHIP_FROM_STREET/CITY/STATE/ZIP` env or hard-code in `lib/shipping`).
12. **Network policy for this cloud environment** blocks `*.supabase.co`, so the app could not be exercised end-to-end from here. Phase 1 proof is schema-level (SQL) + unit tests + typecheck/build. Add `nbrahnwdrtezjpnuccrg.supabase.co` to the environment's allowed domains and `npm run smoke:phase1` runs the real flow.
