# PRESSLINE OS — Runbook

## 0. One-time setup (do these first)

1. **Supabase project:** `midnight-fusion-staging` (`nbrahnwdrtezjpnuccrg`, us-west-1). PRESSLINE lives in schema **`pressline`** (the Standalone app owns `public`).
   **Expose the schema on the Data API:** Dashboard → Project Settings → Data API → *Exposed schemas* → add `pressline` → Save. Without this, every app query returns `PGRST106`. (Grants are already applied by migration 0001.)
2. **Migrations:** `supabase/migrations/0001_pressline_core.sql`, `0002_rls.sql`, `0003_seed.sql` are applied to staging (2026-10-07). For a new project: run them in order in the SQL editor, then Security Advisor → zero errors (see `docs/phase-proof/phase-1/`).
3. **Staff accounts:** create users in Supabase Auth (email/password), then `insert into pressline.staff (id, name, role) values ('<auth uid>', 'Justin', 'owner')` — roles: `owner | production | print | ship`.
4. **Realtime:** `pressline.orders`, `events`, `quotes` are in the `supabase_realtime` publication (migration 0001).
5. **Storage:** bucket `artwork` is private. The app signs URLs.
6. **Railway:** service from this repo (root directory `pressline-os` if deploying from the monorepo), Node 22, `npm run build` / `npm start`, health check `/api/health`. Set every var in `.env.example` (values never in git).
7. **Google Drive:** make a service account, put its JSON in `GOOGLE_SERVICE_ACCOUNT_JSON` (raw or base64), and **share the FUSION INTAKE folder** (`1hmg3Gh8H5o54hXizMWK1yVAbJ-HmYWEm`) with the service account email as Editor.
8. **Stripe:** test keys first. Webhook endpoint `https://<app>/api/webhooks/stripe` for `checkout.session.completed`, `invoice.paid` → `STRIPE_WEBHOOK_SECRET`.
9. **Shopify (deathcorps.shop / cae949-fc):** Dev Dashboard app → Client ID + Secret into `SHOPIFY_DC_CLIENT_ID/SECRET`. The app mints a token with the client-credentials grant and stores it in `pressline.integration_tokens`; n8n's `shopify-token-refresh` re-mints every 20h. Never use n8n's Shopify credential node. Webhook `orders/create` → `https://<app>/api/webhooks/shopify`.
10. **n8n:** import `n8n/workflows/*.json` (see `n8n/README.md`), set `N8N_WEBHOOK_SECRET` (same value on Railway), `PRESSLINE_APP_URL`, `RESEND_API_KEY`. Activate Phase 1: `status-pings`, `nightly-gang-run`, `shopify-token-refresh`.
11. **Office PIN:** `npm run pin:hash -- <pin>` → `OFFICE_PIN_HASH`; `APP_SIGNING_SECRET` = 32+ random chars.
12. **Twilio:** keep `SMS_ENABLED=false` until A2P 10DLC is approved. Inbound webhook `https://<app>/api/webhooks/twilio`.
13. **ShipStation:** keys in env; webhook `https://<app>/api/webhooks/shipstation?key=<APP_SIGNING_SECRET>`.

## 1. Deploys

- Push to the branch Railway watches. Build = `next build`. Health = `/api/health`.
- Migrations are not auto-applied. Apply new `supabase/migrations/*` by hand (SQL editor or `supabase db push`), then run Security Advisor. Zero errors before merge.
- Smoke after deploy: `PRESSLINE_URL=https://<app> STAFF_EMAIL=… STAFF_PASSWORD=… NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run smoke:phase1`.

## 2. Env vars

See `.env.example` (names only). Notable: `SUPABASE_STORAGE_BUCKET` (NOT `SUPABASE_BUCKET`), `LIVE_MONEY` (default false), `SMS_ENABLED` (default false), `N8N_WEBHOOK_SECRET` must match n8n.

## 3. Token refresh (Shopify)

Automatic: n8n every 20h → `POST /api/webhooks/n8n {kind:"shopify_refresh"}` (signed). Manual: same call from the dashboard Settings page, or `select * from pressline.integration_tokens` to see `expires_at`. If publishing fails with 401, re-mint: the next `accessToken()` call does it on its own when within 30 min of expiry.

## 4. When the midnight run fails

The run is `POST /api/gang-runs/build` (HMAC) from n8n at 00:00 America/Los_Angeles.

1. Check n8n execution log for `nightly-gang-run`. 401 → `N8N_WEBHOOK_SECRET` mismatch. 5xx → read Railway logs for `[gang]`.
2. `select * from pressline.gang_runs order by run_date desc limit 1;` — if a row exists for tonight with `report = 'already ran tonight'` the trigger fired twice; nothing to do.
3. Re-run by hand (signed): from n8n → open the workflow → *Execute workflow*. Or dry-run to see what would nest: body `{"dry_run":true}`.
4. "nothing ART_READY" → no order was in ART_READY. Move the orders and run again.
5. Drive missing → sheets are still in Storage `gang-sheets/<date>/`; the log line says "NOT mirrored". Fix `GOOGLE_SERVICE_ACCOUNT_JSON` / folder sharing, then re-upload from the dashboard or re-run with a different `run_date`.
6. Danny didn't get the email → `DANNY_EMAIL` or `RESEND_API_KEY` missing.

## 5. Stripe didn't mark PAID

`select * from pressline.invoices where order_id = '<id>'`. No `paid_at` → the webhook never arrived: check Stripe → Developers → Webhooks → recent deliveries. 400 "bad signature" → `STRIPE_WEBHOOK_SECRET` wrong. Force by hand only as owner: PATCH `/api/orders/<id>/status {status:"PAID", force:true, reason:"paid outside Stripe"}`.

## 6. HOLD queue

`/app/orders?status=HOLD`. Release = move to the status it should be in (owner can force). The hit reason is in the order's log (`kind = lead` or `status`).

## 7. SMS

`SMS_ENABLED=false` → every send returns `not sent: SMS_ENABLED=false` and logs nothing to Twilio. STOP/HELP/START are handled by `/api/webhooks/twilio` regardless. The 1,418-contact list: email them a link to `/join?source=optin` (or the proof page), never text first.

## 8. Rotations

`SUPABASE_SERVICE_ROLE_KEY`, `N8N_WEBHOOK_SECRET`, `APP_SIGNING_SECRET`, `STRIPE_*`, `SHOPIFY_DC_CLIENT_SECRET`: rotate in the provider, update Railway, redeploy. Nothing is cached on disk. Open Item #7: confirm Outlaw's leaked credentials were rotated before Outlaw goes live.

## 9. Moving this app to its own repo

```bash
git subtree split --prefix=pressline-os -b pressline-os-main
git push git@github.com:buyfabshit-lab/pressline-os.git pressline-os-main:main
```
