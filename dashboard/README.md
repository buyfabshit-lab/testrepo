# Day Book

A personal organizer that stands on its own: one HTML file, no build step, no
server, no database, and no dependency on the DIME site, its Supabase project,
or anything else in this repo. Open `index.html` in a browser and it works.

```
open dashboard/index.html          # macOS
xdg-open dashboard/index.html      # Linux
```

To host it, copy `dashboard/` to any static host — it is a single file plus this
README. Nothing here is wired into the root `vercel.json` / `railway.json`
builds, which still build and serve `web/`.

## What it does

- **One-line capture.** Type the task; the shorthand is parsed as you type and
  previewed as chips before you commit it.
- **Next up.** The three tasks with the highest urgency score, each showing the
  reasons it ranked — `4d late`, `critical`, `quick win` — so the ordering is
  auditable rather than magic.
- **Day plan.** Give it the hours you actually have; it packs the highest-scoring
  tasks into that budget and lays them out against the clock.
- **Week load.** Estimated minutes per day for the next seven days, so an
  overbooked Thursday is visible on Monday. Today's column includes overdue work.
- **Projects.** Derived from `#tags`, with completion percentage. Click to filter.
- **Brain dump.** A scratchpad; "Turn lines into tasks" converts each non-empty
  line (shorthand included) and keeps whatever is left.
- **Done today** with undo, and a day streak counted from completion history.

## Capture shorthand

| Token | Meaning | Examples |
| --- | --- | --- |
| `#name` | project | `#label`, `#shows` |
| `!` / `!!` | high / critical | `!!` |
| `@…` | due date | `@today` `@tomorrow` `@fri` `@+3d` `@9/14` `@2026-09-14` `@sep14` |
| `~…` | estimate | `~45m` `~90` `~2h` `~1.5h` |

Anything left over is the title. A `@token` that isn't a date is left in the
title and flagged in the preview rather than silently dropped.

`/` jumps to the capture bar. Click any task title to edit it in place — the
shorthand works there too, so typing `@mon` into a title reschedules it.

## Ranking

`Next up` and `Build plan` share one score, in `score()`:

| Signal | Weight |
| --- | --- |
| critical / high / normal | 50 / 28 / 10 |
| overdue | 55 + 4 per day late (capped at 100) |
| due today / tomorrow / this week | 44 / 26 / 20 minus 2 per day |
| age | 1.5 per day it has sat, capped at 15 |
| estimate ≤ 15m / ≤ 30m | 6 / 3 |

Tasks with no estimate are treated as 30 minutes when planning.

## Where the data lives

`localStorage` under `daybook.v1`, so it stays in the browser you use it in.
Nothing is sent anywhere.

Published as a Claude Artifact, it additionally saves to `data/state.json`
alongside the page via the `artifact` capability, which makes it durable and
readable from any device you open the artifact on. The page picks whichever copy
has the newer `updatedAt` at load, and the footer says which store is in use.

**Export JSON** writes a full backup; **Import JSON** replaces the current state
with one. That file is the only real backup — clearing site data clears the rest.
