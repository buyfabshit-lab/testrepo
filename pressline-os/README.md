# PRESSLINE OS

Midnight Fusion's shop OS. One platform, three faces, one database:

| Face | Path | Who |
|---|---|---|
| Command Dashboard | `/app` | Justin, Jeff, Danny |
| Customer side | `/design`, `/proof/[token]`, `/s/[slug]`, `/join` | customers |
| The World | `/world` | everyone |

Plus **Outlaw** (the dispatcher) and **n8n** (every trigger, sync, nightly job, and sales sequence).

- **Spec:** the build spec Justin handed over is the source of truth. `docs/API.md` is the route contract.
- **Owner's manual:** `OWNER-MANUAL.md` (plain English). **Ops:** `RUNBOOK.md`.
- **Open items for Justin:** `docs/OPEN-ITEMS.md`.
- **Proof per phase:** `docs/phase-proof/`.

## Run it

```bash
npm ci
cp .env.example .env.local   # fill values locally; Railway holds the real ones
npm run dev                  # http://localhost:3000
npm test                     # unit tests (pricing, nesting, naming, screen, HMAC, state machine, PIN)
npm run typecheck
```

## Layout

```
app/(dashboard)/app/*   staff dashboard        app/api/*        route handlers (docs/API.md)
app/(public)/*          customer pages         lib/*            domain logic (no UI)
app/world/*             the Clubhouse          n8n/workflows/*  importable n8n workflows
supabase/migrations/*   schema `pressline`     scripts/*        pin-hash, vault-ingest, smoke-phase1
```

Rules of engagement that are enforced in code: nothing from Manus; secrets only in env; real money (S&S POs, live Stripe, SMS) behind an approval tap **and** `LIVE_MONEY=true`; every file lands in Storage **and** Drive; Outlaw never invents facts; RLS on every table; n8n calls are HMAC-signed both ways.
