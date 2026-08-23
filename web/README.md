# DIME — live

A live room for the streamer DIME. Chat, polls, reactions and presence update
in real time for everyone at once; the wall, the shop and the schedule persist.
All of it is backed by Supabase.

React 19 + Vite 7 + Tailwind 4. No server of its own — the built output is
static files, and the browser talks to Supabase directly under RLS.

---

## Running it

```bash
cd web
npm install
cp .env.example .env      # already points at the NW2 project
npm run dev
```

`npm run build` produces `dist/`. `npm run typecheck` runs `tsc` alone.

Both env vars are safe in a browser bundle. The publishable key grants exactly
what the RLS policies allow and nothing else — see **Security posture**.

---

## What's live, and how

| Feature | Mechanism |
|---|---|
| Chat | `INSERT` on `dime_chat_messages` + realtime `postgres_changes` |
| Fan wall | Same, plus a trigger-maintained heart counter |
| Poll | Votes insert; `dime_poll_results` view tallies; bars move on every viewer's screen |
| Reactions | Each row is *both* the animation trigger and the persisted hype total |
| Presence ("N here now") | Realtime presence channel — ephemeral, never written to a table |
| Live/offline banner | `dime_settings.is_live`, pushed over realtime; flipping it in the dashboard changes every open tab |

### Schedule times

Stream times render in the **viewer's** own timezone, with DIME's shown
underneath whenever it differs — "3:40 PM / 10:40 AM EDT for New York". A fan in
New York is not told the same time twice; the comparison is by actual UTC offset
at that instant, not by zone name, so Toronto correctly counts as the same clock.

`Intl` does the conversion, so the EST/EDT switch is handled without any date
maths of ours, and a typo in `dime_settings.timezone` degrades to "no second
line" rather than a blank page.

Sends deliberately round-trip through Postgres instead of rendering optimistically,
so what you see is what everyone else sees, and a rejected write surfaces as an
error rather than a message that silently never existed. The two exceptions are
poll votes and hearts, where the local state flips immediately and the realtime
echo supplies the authoritative count.

---

## How DIME edits the site

Everything editable lives in the database — there is no admin UI. From the
Supabase dashboard (Table Editor):

- **Go live**: `dime_settings.is_live` → `true`. Set `stream_title`. Every open
  tab switches over instantly.
- **Stream embed**: `stream_url` (a `twitch.tv/...` or YouTube watch URL) is
  converted to a player automatically. `stream_embed_url` overrides it if the
  guess is ever wrong; if neither can be embedded the page shows the portrait
  and a link-out rather than a broken frame.
- **Schedule**: add rows to `dime_schedule`. Author `starts_at` in whatever
  timezone you like — it is stored as `timestamptz`, so the instant is absolute.
- **Where DIME is**: `location` ("New York") shows on the hero chip and in the
  schedule footnote; `timezone` ("America/New_York") is the zone her schedule is
  announced in. Both are plain rows, so a move means editing one field.
- **New poll**: insert into `dime_polls`, then its `dime_poll_options`. Set the
  old poll's `is_open` to `false` — RLS then refuses further votes on it.
- **Merch**: `dime_products`. `is_active = false` hides an item; `stock` drives
  the "only N left" and sold-out states; tag one `bestseller` for the badge.
- **Orders**: read `dime_orders` in the dashboard. The site can write orders but
  cannot read them back.

---

## Security posture

The site has no login, so every visitor is the Postgres `anon` role. The rules:

- **Content tables** (`dime_settings`, `dime_schedule`, `dime_products`,
  `dime_polls`, `dime_poll_options`) — read-only to the public.
- **Interaction tables** — read + append only. `UPDATE` and `DELETE` are revoked
  for `anon`/`authenticated` on every table in the set, so nothing can be edited
  or erased after the fact, including by its author.
- **`dime_orders` is write-only.** Orders carry an email address, so `SELECT` is
  revoked outright, not merely left unpolicied — a carelessly added policy later
  still cannot expose them.
- **Voting into a closed poll** is refused by the policy's `WITH CHECK`, not just
  hidden in the UI.
- **Trigger functions** are `SECURITY DEFINER` but have `EXECUTE` revoked, so they
  are not reachable through `/rest/v1/rpc`.

Verified by running each read, write and denial as the `anon` role against the
live database, and by provoking each guard rather than assuming it fires:

| Guard | Result |
|---|---|
| 12 chat messages in a burst | blocked at 8 (rate-limit trigger) |
| Same fan votes twice | blocked (primary key) |
| Same fan hearts a post twice | blocked (primary key) |
| 400-character chat message | blocked (CHECK) |
| Order with a malformed email | blocked (CHECK) |
| Empty handle | blocked (CHECK) |
| `SELECT` on `dime_orders` | denied |
| `UPDATE` on chat, `DELETE` on wall | denied |

### The limit worth knowing about

Fan identity is a uuid minted in `localStorage`. It dedupes hearts and votes and
is what the rate-limit triggers count against — but **a determined abuser can
clear it and get a fresh one**. The triggers stop casual flooding, not a
motivated attacker.

Closing that properly means moving writes behind an Edge Function that throttles
on IP, or adding Supabase Auth. Neither is in this change. If the room gets
raided, that is the fix — not tighter trigger limits.

---

## Shop: what's wired and what isn't

The catalogue, cart and order capture are real: an order writes a row to
`dime_orders` with the line items, subtotal and the fan's email, and DIME
fulfils it manually from the dashboard.

**No payment is taken.** There is no Stripe integration, and the UI says so
plainly rather than implying a card was charged. Adding checkout means a server
component (an Edge Function or a small API) to create the session and handle the
webhook — `dime_orders.status` already has `paid`/`shipped`/`cancelled` waiting
for it.

---

## Database

Schema lives in `../supabase/migrations` and is applied to the Supabase project
**NW2** (`qmztuagvxopahowexrum`). Tables are namespaced `dime_` alongside the
existing `ms_`/`ef_`/`locker_` families in that project.

`src/lib/types.ts` is hand-written and covers only what this site touches.
Regenerate it fully with `supabase gen types typescript` if the surface grows.

---

## Deploying

Static output — any host will do (Netlify, Vercel, Cloudflare Pages, Railway).

- Build: `npm run build`
- Publish: `web/dist`
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

One host-specific note: **Twitch embeds check the parent domain.** The player URL
is built with `location.hostname` at runtime, so it works on whatever domain you
land on without configuration — but the stream will not play from a `file://`
page or an origin Twitch rejects.
