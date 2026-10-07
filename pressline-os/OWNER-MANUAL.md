# PRESSLINE OS — Owner's Manual

For Justin, Jeff, and Danny. Plain English. If something here doesn't match what the screen does, the screen is wrong — tell Claude Code.

## What it is

One system that runs the shop end to end:

- **The Dashboard** (`/app`) is where Justin quotes, approves, and watches money. Jeff and Danny see the same board.
- **The customer side** is where people design, approve proofs, and pay.
- **The World** (`/world`) is the Clubhouse. Every room is a door into the same data — nothing lives only in the game.
- **Outlaw** is the dispatcher. He files every incoming order, pings Jeff and Danny in character, and answers "where's 1042?" from the log. He never makes things up. If the log doesn't say it, he says he doesn't know.

## The life of an order

| Status | Color | What it means | Who moves it |
|---|---|---|---|
| NEW | gray | came in, not priced | system |
| QUOTED | blue | customer has a price + proof link | Justin (Send quote) |
| APPROVED | purple | Justin tapped Approve | Justin (one tap on phone) |
| PAID | green | Stripe says paid | Stripe webhook |
| BLANKS_ORDERED | teal | S&S PO approved | Justin (Approve PO) |
| ART_READY | yellow | print file named + in Drive `01 TO GANG SHEET` | Justin / Jeff |
| ON_GANG_SHEET | orange | midnight run put it on a sheet | Outlaw (00:00) |
| PRINTED | pink | Danny printed it | Danny |
| PACKED | brown | Jeff packed it, Outlaw stamped the list | Jeff |
| SHIPPED | cyan | label + tracking, customer emailed | Jeff (Create label) |
| DONE | black | delivered; review request fires | ShipStation webhook |
| HOLD | red | screen flagged it; Justin only | screen / Justin |

Every move writes a line in the log and tells n8n. HOLD never rejects anybody; it just parks it for Justin's eyes.

## Daily

**Justin (phone):** open `/app/quotes` → tap a quote → **APPROVE**. That's the one tap. POs: `/app/suppliers` → Approve PO. Nothing real is bought until `LIVE_MONEY=true` on Railway — until then "Approve PO" shows exactly what *would* be sent.

**Jeff (phone):** `/app/jeff`. Tiles: Due today · Overdue · Printed → pack me · Packed → needs label. Tap "Mark packed", then "Create label" on `/app/shipping`. Outlaw stamps the packing list "Packed under Outlaw's watch — #1042."

**Danny:** midnight run puts tonight's sheets in Drive → FUSION INTAKE → `99 — PRINT READY (OUT)` → today's date, plus an email. Print, then mark orders PRINTED on the board (or tell Jeff).

**Everyone:** ask Outlaw in the chat drawer. "What's on hold?" "How'd last night go?" "Where's 1042?"

## Customers

- **Front Gate** `/join`: name, email, niche. Two separate unchecked boxes: email updates, and SMS consent (exact legal text). No box, no texts, ever.
- **Design Studio** `/design`: real blanks, the Vault, camo fills, text with arc, upload. Save → the file is named for them (`1042-DC-G5000-FRONT-20261007.png`) and lands in Storage and Drive. "Make it real" → instant price.
- **Proof** `/proof/<token>`: mockup, sizes, total. **Approve & Pay** locks the art (no edits after approval without a new revision) and opens Stripe. **Request change** goes to Justin.
- **Pop-up stores** `/s/<slug>`: team / school / club stores with open/close dates and a fundraising cut. When Justin closes the store, every paid order rolls into ONE production order.

## Money rules (hard-coded)

1. Stripe is in **test mode** until Justin flips `STRIPE_SECRET_KEY` to live AND sets `LIVE_MONEY=true`.
2. S&S purchase orders are **never** sent without an owner tap AND `LIVE_MONEY=true`.
3. Texts never go out unless `SMS_ENABLED=true` (after A2P 10DLC approval) AND the customer checked the SMS box AND hasn't replied STOP.
4. Email runs now.

## Where files live

Every file lands twice: Supabase Storage (`artwork` bucket, private) and Google Drive **FUSION INTAKE**. Outlaw sorts intake into: Incoming · Art Files · Client Requests · Customer Files · Artwork · Vectors · Fonts. Print files go to `01 TO GANG SHEET`; finished sheets go to `99 — PRINT READY (OUT)`. If it isn't in Drive, it can't be produced.

## The Business Office PIN

The tablet in the World's Business Office asks for a PIN before it shows money. Three wrong tries locks it for 15 minutes. Justin sets the PIN on Railway (`OFFICE_PIN_HASH`, made with `npm run pin:hash -- 1234`).

## When something looks wrong

- Order didn't move after paying → check `/app/orders/<id>` log for a Stripe line. If none, the Stripe webhook secret on Railway is wrong (see RUNBOOK).
- Midnight run didn't happen → `/app/board` shows no ON_GANG_SHEET at 00:05 → RUNBOOK "Midnight run failed".
- Outlaw says "radio is off" → `ANTHROPIC_API_KEY` missing.
- Studio can't load blank photos → S&S keys missing; it falls back to drawn blanks.
