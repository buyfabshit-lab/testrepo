# Phase 1 — order flow + RLS proof (staging, 2026-10-07)

Environment note: this cloud session's network policy blocks `*.supabase.co`, so the Next.js routes could not be exercised against the live project from here. The proof below is the same flow the routes execute, run at the SQL level through the Supabase MCP, plus unit tests (`npm test`, 29 passing) and a clean `npm run typecheck` / `npm run build`. Run `npm run smoke:phase1` against the Railway deploy to produce the HTTP-level transcript (Open Item #12).

## Test order #1000

```
number | status | due_date   | customer              | company        | total  | paid | events
1000   | PAID   | 2026-10-14 | Phase 1 Test Customer | Test Moto Shop | 414.00 | true | 4
```

Log (oldest → newest):

| actor | msg |
|---|---|
| justin | #1000 NEW → QUOTED — quote sent |
| justin | #1000 QUOTED → APPROVED — one-tap approve |
| system | #1000 APPROVED → PAID — stripe checkout (test, simulated at SQL level) |
| outlaw | → jeff: 1000 for Test Moto Shop is paid. It's real now. Due 2026-10-14. |

Order sequence starts at 1000 (migration 0001), so the first real order is #1001.

## RLS (same database, same rows)

| role | orders | customers | events | quotes | notes |
|---|---|---|---|---|---|
| `anon` | 0 | 0 | 0 | — | `integration_tokens` also 0 |
| `authenticated`, not in `staff` | 0 | 0 | 0 | 0 | |
| `authenticated`, email = customer's | **1** | **1** | 0 | **1** | `price_rules` 0 — customers never see cost tables |
| `service_role` | 1 | 1 | 4 | — | server routes only |

## Security Advisor

See `01-security-advisor-2026-10-07.md`: 0 errors, 0 warnings.

## Realtime

`pressline.orders`, `pressline.events`, `pressline.quotes` are in publication `supabase_realtime` (migration 0001). The board subscribes to `postgres_changes` on schema `pressline`, table `orders`.
