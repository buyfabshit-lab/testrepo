-- Stripe checkout for the DIME shop.
--
-- The site is static, so there is nowhere safe to hold a Stripe secret key.
-- Checkout therefore moves to two Edge Functions, and this migration gives
-- the order row the fields those functions need.

alter table public.dime_orders
  add column if not exists stripe_session_id    text,
  add column if not exists stripe_payment_intent text,
  add column if not exists amount_total_cents   int,
  add column if not exists paid_at              timestamptz,
  add column if not exists shipping             jsonb;

-- One order per Checkout Session. This is also what makes the webhook safe to
-- replay: a duplicate delivery can't create a second order.
create unique index if not exists dime_orders_session_uniq
  on public.dime_orders (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists dime_orders_status_idx
  on public.dime_orders (status, created_at desc);

-- Webhook idempotency. Stripe retries on any non-2xx and can deliver the same
-- event more than once even on success, so every event id is recorded and a
-- repeat is a no-op rather than a double-fulfilment.
create table if not exists public.dime_stripe_events (
  id          text        primary key,
  type        text        not null,
  received_at timestamptz not null default now()
);
alter table public.dime_stripe_events enable row level security;
revoke all on public.dime_stripe_events from anon, authenticated;

-- Orders are now created server-side by the checkout function using the
-- service role, which bypasses RLS. The browser no longer writes orders at
-- all, so drop the public INSERT it used to need. This closes the gap where
-- anyone holding the publishable key could fabricate order rows.
drop policy if exists dime_orders_append on public.dime_orders;
revoke all on public.dime_orders from anon, authenticated;
