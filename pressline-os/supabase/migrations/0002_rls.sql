-- PRESSLINE OS — row level security on every table.
--
-- Rules:
--   * staff (pressline.staff by auth.uid()) read everything; owners write everything;
--     production/print/ship write only what their station touches.
--   * customers (authenticated, email matches customers.email) read their own
--     quotes / orders / designs / invoices / shipments.
--   * anon gets NOTHING directly. Lead capture and proof-token access go
--     through server routes using the service role (which bypasses RLS).
--   * events are append-only.

-- Helpers (SECURITY DEFINER, pinned search_path, no anon execute)
create or replace function pressline.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from pressline.staff s where s.id = auth.uid());
$$;

create or replace function pressline.staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select s.role from pressline.staff s where s.id = auth.uid();
$$;

create or replace function pressline.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.role = 'owner' from pressline.staff s where s.id = auth.uid()), false);
$$;

create or replace function pressline.my_customer_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from pressline.customers c
  where c.email is not null and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

revoke all on function pressline.is_staff() from public, anon;
revoke all on function pressline.staff_role() from public, anon;
revoke all on function pressline.is_owner() from public, anon;
revoke all on function pressline.my_customer_id() from public, anon;
grant execute on function pressline.is_staff(), pressline.staff_role(), pressline.is_owner(), pressline.my_customer_id() to authenticated, service_role;

-- Enable RLS everywhere
alter table pressline.customers          enable row level security;
alter table pressline.staff              enable row level security;
alter table pressline.vault_assets       enable row level security;
alter table pressline.designs            enable row level security;
alter table pressline.blanks             enable row level security;
alter table pressline.price_rules        enable row level security;
alter table pressline.quotes             enable row level security;
alter table pressline.orders             enable row level security;
alter table pressline.order_lines        enable row level security;
alter table pressline.invoices           enable row level security;
alter table pressline.purchase_orders    enable row level security;
alter table pressline.gang_runs          enable row level security;
alter table pressline.shipments          enable row level security;
alter table pressline.stores             enable row level security;
alter table pressline.products           enable row level security;
alter table pressline.store_orders       enable row level security;
alter table pressline.campaigns          enable row level security;
alter table pressline.touches            enable row level security;
alter table pressline.events             enable row level security;
alter table pressline.integration_tokens enable row level security;
alter table pressline.pin_attempts       enable row level security;

-- Staff: read all
create policy staff_read on pressline.customers       for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.staff           for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.vault_assets    for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.designs         for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.blanks          for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.price_rules     for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.quotes          for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.orders          for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.order_lines     for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.invoices        for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.purchase_orders for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.gang_runs       for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.shipments       for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.stores          for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.products        for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.store_orders    for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.campaigns       for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.touches         for select to authenticated using ((select pressline.is_staff()));
create policy staff_read on pressline.events          for select to authenticated using ((select pressline.is_staff()));

-- Owner: write all (money, catalog, people, selling)
create policy owner_write on pressline.customers       for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.staff           for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.vault_assets    for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.designs         for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.blanks          for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.price_rules     for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.quotes          for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.orders          for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.order_lines     for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.invoices        for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.purchase_orders for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.gang_runs       for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.shipments       for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.stores          for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.products        for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.store_orders    for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.campaigns       for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));
create policy owner_write on pressline.touches         for all to authenticated using ((select pressline.is_owner())) with check ((select pressline.is_owner()));

-- Production floor (production/print/ship): move orders, log events, record runs + shipments
create policy floor_update_orders on pressline.orders for update to authenticated
  using ((select pressline.staff_role()) in ('production','print','ship'))
  with check ((select pressline.staff_role()) in ('production','print','ship'));
create policy floor_write_gang_runs on pressline.gang_runs for all to authenticated
  using ((select pressline.staff_role()) in ('production','print'))
  with check ((select pressline.staff_role()) in ('production','print'));
create policy floor_write_shipments on pressline.shipments for all to authenticated
  using ((select pressline.staff_role()) in ('production','ship'))
  with check ((select pressline.staff_role()) in ('production','ship'));
create policy floor_update_designs on pressline.designs for update to authenticated
  using ((select pressline.staff_role()) in ('production','print'))
  with check ((select pressline.staff_role()) in ('production','print'));

-- Events: any staff may append; nobody updates or deletes through the API.
create policy staff_append_events on pressline.events for insert to authenticated with check ((select pressline.is_staff()));

-- Customers: their own rows, read only.
create policy customer_read_self on pressline.customers for select to authenticated using (id = (select pressline.my_customer_id()));
create policy customer_read_quotes on pressline.quotes for select to authenticated using (customer_id = (select pressline.my_customer_id()));
create policy customer_read_orders on pressline.orders for select to authenticated using (customer_id = (select pressline.my_customer_id()));
create policy customer_read_order_lines on pressline.order_lines for select to authenticated
  using (order_id in (select o.id from pressline.orders o where o.customer_id = (select pressline.my_customer_id())));
create policy customer_read_designs on pressline.designs for select to authenticated using (customer_id = (select pressline.my_customer_id()));
create policy customer_read_invoices on pressline.invoices for select to authenticated
  using (order_id in (select o.id from pressline.orders o where o.customer_id = (select pressline.my_customer_id())));
create policy customer_read_shipments on pressline.shipments for select to authenticated
  using (order_id in (select o.id from pressline.orders o where o.customer_id = (select pressline.my_customer_id())));
create policy customer_read_store_orders on pressline.store_orders for select to authenticated using (customer_id = (select pressline.my_customer_id()));

-- Public catalog for open pop-up stores (products in a store that is open now). Still no anon:
-- the /s/[slug] page renders server-side with the service role and only shows open stores.

-- integration_tokens + pin_attempts: service role only (no policies → nobody via API).

-- STORAGE: private `artwork` bucket, signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit)
values ('artwork', 'artwork', false, 104857600)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy artwork_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'artwork' and (select pressline.is_staff()));
create policy artwork_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'artwork' and (select pressline.is_staff()));
create policy artwork_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'artwork' and (select pressline.is_staff()))
  with check (bucket_id = 'artwork' and (select pressline.is_staff()));
create policy artwork_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'artwork' and (select pressline.is_owner()));
