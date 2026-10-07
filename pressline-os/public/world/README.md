# The World — static assets

The Death Squad Clubhouse (`/world`) is a skin over PRESSLINE's APIs. The map you see today is an
original inline-SVG building cutaway drawn in `components/world/Map.tsx`; it needs no files from here.

## Where the ported clubhouse art goes

Drop the ported clubhouse art (the chatgpt.site build) into **`public/world/assets/`**:

```
public/world/assets/
  clubhouse.png          full cutaway (upstairs / ground floor / street)
  rooms/<slug>.png       one hero per room, slug = route segment (gate, office, arcade, vault, floor,
                         dock, district, back-room, rf-dc, skrewu-lot, drive-in, showroom, intercom)
  sprites/               Outlaw, bar, bay doors, arcade cabinet, concession sign, ...
  audio/                 optional: intercom chime, coin drop
```

Reference them as `/world/assets/...`. When the full cutaway lands, swap the `<rect>` walls in
`Map.tsx` for the image and keep the `<a>` hit areas (they are what makes the rooms clickable and
what screen readers announce). The flat menu under the map always renders and is the phone UI, so
no art file is ever load-bearing.

Keep this folder free of anything that is not art: no keys, no customer files, no print files
(those live in Supabase Storage / Drive, see `lib/naming`).

## Wiring order

1. **Business Office** — PIN wall (`/api/office/pin`), quote + PO approvals.
2. **Print Floor** — lane counts + Outlaw's last gang-run report.
3. **Arcade** — `/design?mode=arcade` inside the cabinet.
4. **Supplier Row** — S&S / SanMar / Unity / Danny / Oceanaire status cards.
5. **Stores** — Back Room (`death-squad`, Stripe), RF × Death Corps (`death-corps`, Shopify),
   Skrew U Lot (`skrew-u`), The Lot / Lineup showroom (wholesale).
6. **Drive-In** — featured drops + pop-up group stores (`/s/[slug]`).

The Front Gate, Vault, Loading Dock and Intercom ride on routes that already exist.
