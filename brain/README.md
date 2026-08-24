# Second Brain

Everything you know, as bubbles you can drift through.

You drop things in — a thought, a link, a name, something to do — and each one
becomes a bubble on an endless canvas. Bubbles about the same thing drift
together, get a topic name, and draw lines between themselves. Click one and the
rest of the canvas recedes so you can see only what it touches. Ask a question
and the bubbles it was answered from light up.

No folders. No "where should this go?" before you're allowed to save.

## The idea

Most note apps make you file a thought before you understand it. This one lets
it float until it finds its own neighbours: structure is a *consequence* of what
you capture, not a prerequisite for capturing it.

That means the canvas has to organise itself, which happens in two layers:

**The local layer** does the work and needs no API key. Notes are turned into
tf-idf vectors, scored pairwise for similarity (with a bonus for shared tags),
thinned to each bubble's strongest handful of links, and grouped by *primary
tag* — whichever of a note's tags the rest of your brain leans on most. A small
force simulation then lays the whole thing out: bubbles repel, links pull,
clusters have gravity. Search runs against the same vectors.

**The Claude layer** is optional and additive. With an API key, every captured
thought gets a title, a kind and reusable tags from `claude-opus-5`, and the ask
box answers from your notes with `[id]` citations that the canvas turns into
glowing bubbles. Without a key the box still finds — it just doesn't answer.

Nothing about the app breaks without a key. That was the design constraint.

## Running it

```bash
cd brain
npm install
npm run dev
```

Then open the printed URL. There's a demo brain loaded so the canvas has shape
on first run; wipe it from Settings once your own notes take over.

| script | what it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | typecheck + production build into `dist/` |
| `npm run preview` | serve the built bundle |
| `npm run typecheck` | types only |

## Getting around

- **Drag** the background to pan, **scroll** to zoom, **drag a bubble** to move it.
- **Click** a bubble to open it — everything unrelated fades back.
- **Enter** captures, **Shift+Enter** adds a line.
- **`/`** jumps to the ask box, **Esc** lets go of whatever you're in.
- **Recentre** reframes the whole brain.

## Your data

Everything lives in this browser's `localStorage` and is never uploaded. Export
to JSON from Settings before you clear a browser or move machines; import merges
by id rather than overwriting.

The API key is yours, is stored in the same place, and is sent only to
`api.anthropic.com` — the SDK runs in the browser with
`dangerouslyAllowBrowser`, which is the right call for a single-user local-first
app holding its own credential, and the wrong one for anything multi-user. If
this ever grows accounts, the Claude calls move behind a server first.

## Layout

```
src/
  lib/
    types.ts    the Thought record and the shape of everything derived from it
    text.ts     tokenising, tf-idf, cosine similarity, local title/kind guessing
    graph.ts    pairwise linking, primary-tag clustering, local search
    store.ts    localStorage persistence, import/export
    claude.ts   the two Claude calls: enrich (structured) and ask (streaming)
    seed.ts     the demo brain
  hooks/
    useBrain.ts   thoughts, settings, the enrichment queue
    useLayout.ts  the force simulation
  components/
    BubbleCanvas.tsx  the SVG canvas, camera, focus mode
    CaptureBar.tsx    the one box
    AskPanel.tsx      retrieval, streaming answers, citations
    DetailPanel.tsx   one bubble, editable, and what it drifts near
    SettingsSheet.tsx key, data, shortcuts
```

## Deploying

This app is independent of the site in `web/`, and the repo's root
`package.json`, `vercel.json` and `railway.json` still build and serve that
site. To put this one online, point a host at the `brain/` directory with build
command `npm run build`, output `dist/`, and an SPA rewrite to `/index.html`.
