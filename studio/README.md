# Apparel Design Studio

Design tees and caps in the browser, watch the mockup update live, and export
two print-shop files: a **300 DPI transparent PNG** of the print area and a
**2000×2000 mockup PNG**. React + Vite + TypeScript, Supabase for saved designs
and uploads, deployable to Railway as a static site.

## Run it locally

```bash
cd studio
npm install
npm run dev        # http://localhost:5173
```

No backend is needed to try it: without Supabase variables the app runs in
**Local mode** and saves designs to IndexedDB in your browser.

## What v1 does

| Area | Details |
|---|---|
| Blanks | Tee front, tee back (12×16 in), cap front (4.5×2.25 in), cap side (2.5×1.5 in) |
| Colors | 16 garment colors; shading, seams and fabric grain adapt to the color |
| Layers | Upload PNG/JPG/WebP/SVG art (drag-drop works), add text with 9 display fonts |
| Editing | Drag to move, corner handles to scale, orange handle to rotate (⇧ snaps 15°), arrow-key nudge, undo/redo, duplicate, lock, hide, reorder |
| Preview | The design renders *under* the garment lighting so it reads as printed fabric |
| Export | `*-print-300dpi.png` is exactly the print area at 300 DPI with a pHYs DPI tag; `*-mockup.png` is a studio or transparent mockup |
| Saving | Cloud (Supabase) when configured, otherwise local; thumbnails included |

Shortcuts: `⌘Z` undo · `⌘⇧Z` redo · `⌘D` duplicate · `⌘E` export · `Del` delete · `Esc` deselect.

## Supabase setup (optional, enables cloud saves)

1. Create a project and run `supabase/migrations/20261004120000_studio_designs.sql`
   (SQL editor or `supabase db push`). It creates `public.studio_designs`, the
   public `studio-uploads` bucket, and owner-scoped RLS policies.
2. In **Authentication → Providers**, enable **Anonymous sign-ins**. The studio
   signs each browser in anonymously so designs are private without a login wall.
3. Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon or publishable key>
```

Both values are safe for the browser; RLS does the gating. Never commit `.env.local`.

## Deploy to Railway

1. New service → Deploy from GitHub repo → this repository.
2. Settings → **Root Directory**: `studio`. The `railway.json` and
   `nixpacks.toml` here pin Node 22, `npm ci`, `npm run build`, `npm start`.
3. Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
   (Vite inlines them at build time, so redeploy after changing them).
4. Generate a domain. Health check hits `/`.

## Project layout

```
src/engine/   types, blanks (parametric SVG garments), text rasterizer,
              export renderer, PNG DPI tagging, design store (undo/redo)
src/lib/      supabase client, IndexedDB fallback, save/load/delete
src/components/  Stage (editor), SidePanel, Inspector, TopBar, ExportModal, SavedDrawer
```

All layer geometry is stored in print pixels at 300 DPI with the origin at the
print area's top-left, so the print export is a 1:1 draw and the editor and
mockup are pure projections of the same data.
