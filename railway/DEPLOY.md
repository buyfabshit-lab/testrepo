# Seedance v2.0 Generator → Railway

Runbook for deploying `video_generation/seedance-2-generator` from
[benlamiro/ShipGenAI](https://github.com/benlamiro/ShipGenAI) to Railway with
Supabase Postgres and Google login.

Verified against commit `e5ac121`.

---

## What was verified vs. what the brief assumed

The brief left several items marked "verify in `src/`". All are now settled
from the source, and three of them change what you should do:

| Brief said | Reality in code | Impact |
|---|---|---|
| Stripe webhook route "verify exact route" | **Two routes exist.** `/api/webhook/stripe` is live; `/api/stripe/webhook` is dead code | Point the Stripe webhook at `/api/webhook/stripe` |
| `WEBHOOK_URL` "likely the app's own callback URL for polling" | Correct on the URL, wrong on the mechanism — it's **push, not polling** | See "The WEBHOOK_URL trap" below |
| "If it hard-crashes on missing Stripe keys, stub test keys" | It does **not** crash — `src/lib/stripe.js` falls back to a placeholder key | No stub keys needed. Leave all three Stripe vars unset for Phase 1 |

Two more findings not in the brief:

- **`/api/checkout` is the live checkout route**, not `/api/stripe/checkout`.
  The pricing page (`src/app/pricing/page.js:30`) posts `{ planId }` to
  `/api/checkout`. The `/api/stripe/checkout` variant takes a different,
  incompatible argument shape (`{ price, credits }`) and nothing calls it.
- **`/api/stripe/webhook` is broken independently of which route you pick.**
  It calls `headers().get(...)` without `await`; `headers()` is async in Next
  16, so that route throws on every request. The live `/api/webhook/stripe`
  awaits correctly.

Neither dead route is on the Phase 1 path — but do not wire Stripe to them in
Phase 2.

---

## The WEBHOOK_URL trap

This is the single most likely cause of "deploy succeeded but no video ever
appears", so it is worth understanding before you start.

Generation is **fully webhook-driven**. `AIService.generate`
(`src/lib/services/ai.js:57`) submits the job to MuAPI with a callback URL:

```
${WEBHOOK_URL || NEXTAUTH_URL || "http://localhost:3000"}/api/webhook/muapi
```

MuAPI calls that URL when the render finishes, and
`/api/webhook/muapi` is what flips the `Creation` row from `processing` to
`completed`.

The client-facing `/api/seedance/check-status` endpoint **only reads the
database**. It never contacts MuAPI. So:

> If `WEBHOOK_URL` is unset, wrong, or not publicly reachable, the job runs
> and bills your MuAPI account, the UI spins forever, and the row stays
> `processing` permanently. There is no polling fallback and no timeout.

Set `WEBHOOK_URL` to the exact public Railway origin, scheme included, **no
trailing slash** (the code concatenates `/api/webhook/muapi` directly).

Because it falls back to `NEXTAUTH_URL`, setting both to the same Railway
origin is correct and is what this runbook does.

---

## 1. Supabase

Create (or pick) a project, then take both connection strings from
**Project Settings → Database → Connection string**:

| Railway var | Supabase string | Port |
|---|---|---|
| `DATABASE_URL` | Transaction pooler | 6543 |
| `DIRECT_URL` | Direct connection | 5432 |

Append `?pgbouncer=true&connection_limit=1` to `DATABASE_URL`.

`prisma.config.ts` resolves the CLI datasource as `DIRECT_URL || DATABASE_URL`,
so schema pushes go over the direct connection while the running app uses the
pooler. Note that `prisma/schema.prisma` intentionally declares no `url` —
under Prisma 7 the runtime URL comes from the `pg` driver adapter in
`src/lib/prisma.js` (which reads `DATABASE_URL`), and the CLI URL from
`prisma.config.ts`. Do not "fix" the schema by adding a `url` field.

## 2. Google OAuth

Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).

Authorized redirect URI — exact, one per environment:

```
https://<your-railway-domain>/api/auth/callback/google
```

You cannot fill this in until Railway has assigned a domain, so expect to come
back to this step after step 3.

## 3. Railway service

- **Root directory:** `video_generation/seedance-2-generator` — required; the
  monorepo has no root manifest and the build fails without it.
- **Build:** `npm run build` (already runs `prisma generate` first)
- **Start:** `npm start`
- **Node:** 22 (see `nixpacks.toml`)

Copy `railway.json` and `nixpacks.toml` from this directory into the app root
if you want the config committed rather than set through the dashboard.

Generate the auth secret:

```bash
openssl rand -base64 32
```

### Environment variables — Phase 1

```
DATABASE_URL=postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...@db....supabase.co:5432/postgres
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://<your-railway-domain>
WEBHOOK_URL=https://<your-railway-domain>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SEEDANCE_V2_API_KEY=...
NEXT_PUBLIC_THEME=indigo
```

Leave `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and
`STRIPE_WEBHOOK_SECRET` **unset**. Verified: the build and boot both succeed
without them, emitting only a `[CONFIG] Warning:` line per missing key.

Chicken-and-egg: `NEXTAUTH_URL` and `WEBHOOK_URL` need the domain that only
exists after the first deploy. Deploy once, generate the domain, set all
three URL-dependent values (plus the Google redirect URI), redeploy.

## 4. Database schema

There is no `prisma/migrations` directory, so `db push` is correct here —
`migrate deploy` would fail with nothing to apply.

Run once, from the Railway service shell:

```bash
npx prisma db push
```

Do not put `db push` in the build command. It would re-run on every deploy and
can silently drop columns when the schema drifts.

## 5. Enable RLS

`db push` creates five tables in `public`, which Supabase immediately exposes
through PostgREST to anyone holding the anon key — including `User.email` and
every `Creation` row.

Apply `sql/enable-rls.sql` in the Supabase SQL editor.

This does not affect the app: Prisma connects as the table owner, and RLS is
not forced, so the server-side path is unchanged. See the comments in that
file for the reasoning.

---

## Verifying the deploy

1. **App boots** — Railway domain loads the generator UI.
2. **Google sign-in** — sign in, land back on the app. A loop here is almost
   always `NEXTAUTH_URL` not exactly matching the Railway origin, or the
   redirect URI missing `/api/auth/callback/google`.
3. **Row created** — after sign-in, `User` has a row with `credits = 10` (the
   schema default). The UI's cheapest option — 480p, basic, 5s, the minimum
   duration — costs 120 credits, and the default 720p/basic/5s costs 150. So
   **the 10-credit default cannot pay for a single generation.** Top up before
   testing:

   ```sql
   UPDATE public."User" SET credits = 1000 WHERE email = '<your-email>';
   ```

   Otherwise `/api/seedance` returns 403 `Insufficient credits` and you will
   misread it as a bad API key.
4. **Generate** — submit a short text-to-video. Expect `processing`, then
   `completed` once MuAPI calls back.
5. **If it stays `processing`** — that is the `WEBHOOK_URL` trap, not a slow
   render. Check the Railway logs for a `POST /api/webhook/muapi` hit. No hit
   means MuAPI could not reach you: re-check `WEBHOOK_URL` for a trailing
   slash, `http://`, or a stale domain.

---

## Phase 2 — Stripe

- Webhook endpoint: `https://<railway-domain>/api/webhook/stripe`
  (**not** `/api/stripe/webhook` — see above)
- Set the three Stripe vars and redeploy.
- Checkout posts `{ planId }` to `/api/checkout`. `src/lib/config.js` defines
  exactly one plan, `default`: 50 credits for $5.00 USD.

---

## Known fragility

`prisma.config.ts` does `import "dotenv/config"`, but `dotenv` is not declared
in `package.json`. It currently resolves only because npm hoists it from
`prisma → @prisma/config → c12 → dotenv`. The build works today; it would
break if that transitive chain changes. A one-line
`npm i -D dotenv` in the app makes it explicit and is worth doing upstream.
