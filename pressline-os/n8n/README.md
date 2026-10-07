# PRESSLINE OS — n8n layer ("The Hunting Party", spec §8)

Importable n8n workflows for the cloud instance `https://deathcorps187.app.n8n.cloud`.
Every file in `n8n/workflows/` is a standard n8n export (`name`, `nodes`, `connections`,
`settings.executionOrder = "v1"`, `active: false`). Validate with `node n8n/validate.mjs`.

Nothing here touches Twilio, Shopify, Stripe or Supabase directly. n8n talks to the app
(signed HTTP), to Resend (email) and to Hedra (video). Everything with money, consent or
a token behind it goes through the app, which enforces the gates.

## 1. Import

n8n → **Workflows** → **⋯** (top right) → **Import from File…** → pick one JSON at a time.
Import all 13. Leave them inactive until the env vars below are set, then activate by phase.

After import, each webhook workflow's production URL is
`https://deathcorps187.app.n8n.cloud/webhook/<path>` (the app's `postToN8n()` builds exactly that
from `N8N_BASE_URL`). Nothing to configure on the n8n side for the paths.

## 2. Environment variables n8n needs

Set these in n8n cloud under **Settings → Variables** (or as instance env vars). The workflows read
them through `$env` in a Set node named **Secrets** at the top of every workflow.

| Variable | Used for | Required |
|---|---|---|
| `N8N_WEBHOOK_SECRET` | HMAC for every call in both directions. Must equal the app's `N8N_WEBHOOK_SECRET`. | yes |
| `PRESSLINE_APP_URL` | Base URL of the app. Defaults to `https://pressline.up.railway.app` when unset. | yes (prod) |
| `RESEND_API_KEY` | Every email (`POST https://api.resend.com/emails`). From is always `Midnight Fusion <orders@midnightfusion.co>`. | yes |
| `HEDRA_API_KEY` | `drop-teaser` video request ("Fusionism Engine"). | Phase 2B |
| `JUSTIN_EMAIL`, `JEFF_EMAIL`, `DANNY_EMAIL` | Who gets Outlaw pings and failure emails. | yes |
| `N8N_PUBLIC_URL` | This n8n's own public base, for workflow-to-workflow hand-offs. Defaults to `https://deathcorps187.app.n8n.cloud`. | no |
| `REVIEW_URL` | Review link in `review-referral` (Google / Etsy / whatever). Falls back to `<app>/review?o=<order_id>`. | no |

**Credential-free fallback.** If `$env` access is disabled on your n8n (Code node error "access to env
vars denied", or empty values), open the **Secrets** node in each workflow and replace the
`={{ $env.X }}` expressions with literal values. Every downstream node reads from that node
(`$('Secrets').first().json.secret`, `.appUrl`, `.resendKey`, …), so nothing else changes.
The Code nodes try `$env.N8N_WEBHOOK_SECRET` first and fall back to the Secrets node value.

**`require('crypto')` in Code nodes.** The Sign and Verify Code nodes use Node's `crypto`. On n8n cloud
the built-in `crypto` module is allowed by default; on self-hosted set
`NODE_FUNCTION_ALLOW_BUILTIN=crypto` (or `*`). If it is blocked, the node fails with
"Cannot find module 'crypto'" and nothing runs unsigned.

## 3. Signing scheme (matches `lib/n8n/sign.ts`)

Header: `X-Pressline-Signature: t=<unix seconds>,v1=<hex hmac-sha256>` over `` `${t}.${rawBody}` ``.
Replay window 5 minutes.

- **Outbound (n8n → app).** A Code node named `Sign: …` builds the body, runs `JSON.stringify` **once**,
  signs that exact string, and hands `{ url, method, raw, signature }` to an HTTP Request node that
  sends `raw` as a raw `application/json` body. The bytes signed are the bytes sent. GETs sign the
  empty string (`t.`), same as the app's `verify()` with an empty body.
- **Inbound (app → n8n).** Every app-facing webhook is `Webhook (POST, path, respond immediately 200,
  Raw Body on) → Secrets → Verify`. `Verify` recomputes the HMAC over the raw bytes
  (`this.helpers.getBinaryDataBuffer`, then base64 `binary.data`, then `JSON.stringify(body)` as a last
  resort) and **throws** when the header is missing, wrong, or older than 5 minutes, which stops the
  run. The webhook already answered 200 by then, by design (the app's `postToN8n` never waits).

Paths the app posts to: `pressline/lead`, `pressline/status`, `pressline/upload`,
`pressline/design-saved`, `pressline/published`.
Internal hand-offs between workflows use the same signed scheme on `pressline/internal/*` paths
(n8n signs with the same secret and posts to itself), so there is no unsigned entry point anywhere.

## 4. Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `status-pings` | `pressline/status` | Outlaw ping lines (verbatim from `lib/outlaw/index.ts` `pingFor()`) to Jeff / Danny / Justin by email, customer by email after a signed `GET /api/orders/:id`, and SMS for every ping **only** via `POST /api/sms/send`. On `DONE` fans out to `review-referral` and `reorder-radar`. |
| `nightly-gang-run` | Cron `0 0 * * *` America/Los_Angeles | Signed `POST /api/gang-runs/build { run_date }`. On failure emails Justin. No report post (the app logs it). |
| `shopify-token-refresh` | Every 20 h | Signed `POST /api/webhooks/n8n { kind: "shopify_refresh" }`. The app mints via client-credentials and stores the token. **No n8n Shopify credential anywhere.** On failure emails Justin. |
| `lead-capture` | `pressline/lead` | `customer_tag` + `touch` via `/api/webhooks/n8n`, welcome email, hands off to `logo-drop-mockup` (if `website`) and `vault-match` (if `niche`). |
| `logo-drop-mockup` | `pressline/internal/logo-drop` | Fetch site → HTML extract (og:image / logo img / icon) → `POST /api/imaging/clean` → `POST /api/imaging/mockup` → mockup email with quote link → touch → starts `follow-up-ladder`. |
| `vault-match` | `pressline/internal/vault-match` | Signed `GET /api/vault?tags=<niche>` → "Pick your 3" email → touch. |
| `quote-in-60` | `pressline/upload` | `POST /api/outlaw/intake` → `/api/imaging/clean` → `/api/imaging/mockup` → `POST /api/quotes` → email Justin a one-tap `/app/quotes/:id/approve` link → touch. |
| `arcade-hook` | `pressline/design-saved` | Emails the saved design back with a "Make it real" link → touch. |
| `follow-up-ladder` | `pressline/internal/follow-up` | Wait Day 2 / 5 / 10. Each rung: signed `GET /api/orders?customer_id=` → stop if any order past QUOTED or `replied`; else new mockup (different blank color), email, touch. |
| `reorder-radar` | `pressline/internal/reorder-radar` (from `status-pings` on DONE) | Wait 45 d → `GET /api/orders/:id` → "Time to restock" with last design preloaded; again at 90 d; touch. |
| `review-referral` | `pressline/internal/review-referral` (from `status-pings` on DONE) | Wait 24 h → review request; wait 3 d → referral code `MF-<order number>`; posts `referral_code` + touch. |
| `drop-teaser` | `pressline/published` | Hedra video request → `campaign_send` (email list) and `social_queue` via `/api/webhooks/n8n` → preview email to Justin. |
| `shop-kit-pitch` | Manual, or Mondays 09:17 LA | `POST /api/webhooks/n8n { kind: "wholesale_prospects" }` → personalized sell-sheet email per prospect → touches. |

## 5. Activation by phase

**Phase 1** (go live with the order board): `status-pings`, `nightly-gang-run`, `shopify-token-refresh`.

**Phase 2B** (hunting party): `lead-capture`, `logo-drop-mockup`, `vault-match`, `quote-in-60`,
`arcade-hook`, `follow-up-ladder`, `reorder-radar`, `review-referral`, `drop-teaser`, `shop-kit-pitch`.
Activate `follow-up-ladder`, `reorder-radar` and `review-referral` **before** the workflows that feed
them, or the hand-off POSTs will 404 (harmless, logged as `continueRegularOutput`, but the ladder never starts).

## 6. The SMS rule

n8n **never** calls Twilio. The only SMS path is `status-pings → POST /api/sms/send` (signed) with
`{ customer_id, to_role, order_id, body }`. The app decides: `SMS_ENABLED=true` **and**
`sms_consent_at` set **and** `sms_opted_out_at` null (`lib/sms/index.ts`). No checkbox = no texts.
Keep `SMS_ENABLED=false` in the app until A2P 10DLC is approved; with it off the route returns
`{ sent: false, reason: "SMS_ENABLED=false" }` and the workflow carries on with email only.
`validate.mjs` fails any workflow that contains a Twilio URL or a Shopify node.

## 7. Outlaw voice

Ping copy is the exact `pingFor()` text. The Code node `Build pings` only interpolates values that
arrive in the `pressline/status` payload (`number`, `to`, `from`, `reason`), filtered by the payload's
`audience`. Statuses with no line in `pingFor()` (NEW, QUOTED, APPROVED, DONE, CANCELLED) send no ping;
DONE instead kicks off the post-delivery workflows.

## 8. App-side contract these workflows assume (TODO where not yet in `docs/API.md`)

The app currently ships `/api/health` only; the rest is in `docs/API.md`. These workflows additionally rely on:

- `POST /api/sms/send` (n8n-signed) `{ customer_id, to_role?, order_id?, body }` → `{ sent, reason? }` — the gated route (not yet in API.md).
- `POST /api/imaging/clean` `{ customer_id, image_url? | storage_path?, print_width_in? }` → `{ png_url }` and
  `POST /api/imaging/mockup` `{ customer_id, png_url, blank, color, location }` → `{ mockup_url }` — n8n-signed wrappers over `lib/imaging`.
- `GET /api/orders/:id`, `GET /api/orders?customer_id=`, `GET /api/vault?tags=` must also accept the n8n signature (API.md lists them as staff-cookie only). `GET /api/orders?customer_id=` may return `replied: true` to stop the ladder.
- `POST /api/quotes` and `POST /api/outlaw/intake` accept the n8n signature (intake already does per API.md).
- `POST /api/webhooks/n8n` kinds used: `touch`, `customer_tag`, `shopify_refresh`, `campaign_send`, `social_queue`, `referral_code`, `wholesale_prospects` (returns `{ prospects: [{ customer_id, email, name, company?, niche? }] }`).
- Payload shapes assumed for app → n8n posts: `pressline/lead` = the `/api/capture` body plus `customer_id`;
  `pressline/upload` = `{ customer_id, order_id?, name?, email?, files: [{ name, mime, storage_path, url? }], blank_style?, blank_color?, blank_id?, method?, sizes?, locations?, width_in?, rush? }`;
  `pressline/design-saved` = `{ design_id, customer_id?, email, file_name, preview_url?, studio_url? }`;
  `pressline/published` = `{ product_id, name, brand?, description?, mockups: [url], published: { shopify?: url, … } }`.
- Hedra: `POST https://api.hedra.com/web-app/public/generations` with `X-API-Key`. Check the current Hedra API for the `ai_model_id` and field names before Phase 2B; the node continues on error so a Hedra outage never blocks the email.

## 9. Validate

```sh
node n8n/validate.mjs
```

Checks every file parses, has the required top-level keys, every node has `type` / `typeVersion` /
`position` / `parameters`, all connection sources and targets exist, no orphan nodes, one trigger,
a Secrets node, inbound webhooks are POST + respond-immediately + raw body + followed by Verify,
no duplicate webhook paths across files, every signed app call carries the header and sends the raw
string, and every Code node's JavaScript parses.
