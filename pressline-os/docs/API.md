# PRESSLINE OS — API contract (spec §10)

All JSON. Staff routes need a Supabase cookie session whose user is in `pressline.staff`, **or** the Business Office PIN cookie (`pl_office`, acts as owner — spec §9).
Routes marked **n8n** need `X-Pressline-Signature: t=<unix>,v1=<hmac-sha256-hex>` over `${t}.${rawBody}` with `N8N_WEBHOOK_SECRET` (see `lib/n8n/sign.ts`).
Money gates: anything that places a PO, charges live, or texts requires an explicit approval action AND `LIVE_MONEY=true` (SMS also needs `SMS_ENABLED=true`).

| Method | Path | Auth | Body → Result |
|---|---|---|---|
| GET | `/api/health` | none | `{ ok, version, time }` |
| POST | `/api/capture` | none (rate-limited, service role) | `{ name, email, phone?, company?, source, niche?, website?, sms_consent?: boolean, consent_text?, email_opt_in? }` → `{ customer_id, screen: "pass"|"hold" }` |
| POST | `/api/quotes` | staff or **n8n** | `{ customer_id, lines: [{ blank_id, method, sizes:{S:4}, locations:["front"], colors }], rush? }` → `{ quote }` (priced via price_rules) |
| GET | `/api/quotes/:id` | staff | → `{ quote, customer }` |
| POST | `/api/quotes/:id/send` | staff | → `{ ok, proof_url }` (creates order NEW→QUOTED + proof_token, emails link) |
| POST | `/api/quotes/:id/approve` | staff(owner) | one-tap → order APPROVED, `{ order, proof_url }` |
| POST | `/api/orders` | staff | `{ customer_id, lines, due_date?, rush? }` → `{ order }` |
| GET | `/api/orders` | staff or **n8n** | `?status=&customer_id=` → `{ orders }` |
| GET | `/api/orders/:id` | staff or **n8n** | → `{ order (with customer, lines, events, shipments) }` |
| PATCH | `/api/orders/:id/status` | staff | `{ status, reason?, force? }` → `{ order }` (writes event + n8n `pressline/status`) |
| GET | `/api/proof/:token` | token | → `{ order, customer, lines, mockups, total, paid }` |
| POST | `/api/proof/:token/approve` | token | → `{ checkout_url }` (locks design `approved_at`, Stripe Checkout; test mode unless LIVE_MONEY) |
| POST | `/api/proof/:token/request-change` | token | `{ comment }` → `{ ok }` (event + Outlaw pings Justin) |
| POST | `/api/designs` | staff or customer email | `{ customer_id?, order_id?, studio_json, print_png_base64, width_in, method, locations, brand?, blank_id?, vault_asset_ids? }` → `{ design, file_name, dpi_warning? }` (300 DPI file → Storage + Drive) |
| POST | `/api/quotes/instant` · `/api/quotes/instant/send` | none (rate-limited) | studio "Make it real": `{ qty, blank_style, blank_color, method }` → `{ total, unit, setup }`; send adds `{ email }` → saves draft quote + emails it |
| GET | `/api/vault` | anyone (studio: license-filtered, no MCG) / staff / **n8n** | `?q=&brand=&tags=a,b&license=` → `{ total, assets[] }` |
| POST | `/api/blanks/sanmar-refresh` | staff(owner|production) | → `{ upserted }` (pulls the SanMar EPDD file) |
| GET | `/api/blanks` | anyone (no costs to anon) | `?supplier=ss&style=5000&color=` → live S&S (or cached rows) |
| POST | `/api/po` | staff | `{ order_id, supplier:"ss", lines:[{identifier, qty}], ship_to }` → `{ po }` status pending_approval |
| POST | `/api/po/:id/approve` | staff(owner) | → places with S&S only if LIVE_MONEY=true, else `{ dry_run: true }` |
| POST | `/api/gang-runs/build` | **n8n** | `{ run_date?, max_height_in?, dry_run? }` → `RunResult` |
| POST | `/api/shipments` | staff | `{ order_id, ship_to, weight_oz, carrier?, service? }` → `{ shipment }` (label, tracking, order→SHIPPED, customer email) |
| POST | `/api/publish/:productId` | staff(owner) | `{ targets: ["shopify","skrewu","stripe","wholesale"] }` → `{ published: {...} }` |
| POST | `/api/stores/:slug/orders` | none | `{ product_id, sizes, name, email }` → `{ checkout_url }` |
| POST | `/api/stores/:id/close` | staff(owner) | → rolls paid store_orders into one production order |
| POST | `/api/outlaw/intake` | staff or **n8n** | `{ order_id, files:[{ name, mime, storage_path }] }` → `{ routed:[{name, class, drive_folder}] }` |
| POST | `/api/outlaw/chat` | staff (or proof token for customer audience) | `{ message, history?, token? }` → `{ text, tools_used }` |
| POST | `/api/office/pin` | none | `{ pin }` → sets httpOnly `pl_office` cookie; 3 failures → 15-min lockout |
| POST | `/api/webhooks/stripe` | Stripe sig | checkout.session.completed / invoice.paid → order PAID |
| POST | `/api/webhooks/n8n` | **n8n** | `{ kind, ... }` kinds: `touch`, `shopify_refresh`, `sanmar_refresh`, `outlaw_say`, `customer_tag`, `campaign_send`, `social_queue`, `referral_code`, `wholesale_prospects` (→ `{ prospects }`) |
| POST | `/api/webhooks/shopify` | Shopify HMAC | orders/create → mirror as order (store death-corps) |
| POST | `/api/webhooks/shipstation` | basic secret | shipment tracking → shipments.delivered_at |
| POST | `/api/webhooks/twilio` | Twilio sig | inbound SMS; STOP/HELP/START handled, replies TwiML |
| POST | `/api/sms/send` | staff or **n8n** | `{ customer_id, body, campaign_id? }` → `{ sent, sid }` (the only way a text leaves; gated by SMS_ENABLED + consent) |
| POST | `/api/imaging/bg-remove` · `/distress` · `/upscale` | none (rate-limited) | `{ png_base64, ... }` → `{ png_base64 }` (studio tools) |
| POST | `/api/imaging/clean` | staff or **n8n** | `{ url | png_base64, width_in?, remove_bg? }` → `{ png_url, storage_path }` |
| POST | `/api/imaging/mockup` | staff or **n8n** | `{ art_url | art_storage_path, blank: tee|hoodie|hat, color }` → `{ mockup_url }` |
| GET | `/api/outlaw/intercom` | none | `?limit=` → `{ messages: [{ id, text, at }] }` (Outlaw's public lines only) |
| POST | `/api/sms/opt-in` | none | `{ phone, consent:true, consent_text, source }` → records consent (used by email opt-in link) |

Status colors + lanes: `lib/orders/status.ts`. File naming: `lib/naming`. Pricing: `lib/pricing`.
