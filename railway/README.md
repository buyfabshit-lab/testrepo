# seedance-2-generator → Railway deployment kit

Deployment configuration and a verified runbook for shipping
`video_generation/seedance-2-generator` from
[benlamiro/ShipGenAI](https://github.com/benlamiro/ShipGenAI) to Railway.

Prepared against upstream commit `e5ac121`.

## Contents

| File | Purpose |
|---|---|
| `DEPLOY.md` | The runbook. Start here. |
| `railway.json` | Railway build/deploy config for the service |
| `nixpacks.toml` | Pins Node 22 and the install/build/start phases |
| `sql/enable-rls.sql` | Locks down the five tables `prisma db push` creates |

`railway.json` and `nixpacks.toml` belong in the **app root**
(`video_generation/seedance-2-generator/`) if you want them committed
upstream rather than configured through the Railway dashboard.

## Why the deploy isn't already live

Executing the deploy needs four credentials that this environment does not
have and cannot create: a Railway account/token (no Railway CLI or API access
here), a Google Cloud OAuth client, a MuAPI account for
`SEEDANCE_V2_API_KEY`, and a Supabase project chosen for this app. Everything
that could be verified without them has been — see below.

## What was verified by execution, not inspection

- `npm install` and `npm run build` both succeed on Node 22 (npm 10.9.7).
- **The app builds cleanly with all three Stripe variables absent**, emitting
  only `[CONFIG] Warning:` lines. The brief's contingency plan of stubbing
  test Stripe keys is unnecessary — `src/lib/stripe.js` already falls back to
  a placeholder.
- All 16 routes compile; the route inventory in `DEPLOY.md` is taken from the
  build output.

## The three findings that change the deploy

1. **Two Stripe webhook routes exist.** `/api/webhook/stripe` is live;
   `/api/stripe/webhook` is dead *and* broken (unawaited `headers()`, which
   throws under Next 16). Phase 2 must target the former.
2. **Generation is push-based, not polled.** `WEBHOOK_URL` must be the exact
   public Railway origin or videos hang in `processing` forever with no
   timeout — while still billing MuAPI. This is the most likely failure mode
   of the whole deploy.
3. **The 10-credit signup default cannot fund one generation** (cheapest is
   120 credits). Without a manual top-up the first test returns
   403 `Insufficient credits`, which reads like a bad API key.

Details and reasoning in `DEPLOY.md`.
