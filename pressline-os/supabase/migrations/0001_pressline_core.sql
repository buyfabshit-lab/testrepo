-- PRESSLINE OS — core schema.
-- Lives in its own `pressline` schema so it never collides with the Standalone
-- MF app's public.orders / public.products in the same consolidated project.
-- Expose `pressline` on the Data API (see RUNBOOK → "Exposed schemas").

create schema if not exists pressline;

grant usage on schema pressline to anon, authenticated, service_role;
alter default privileges for role postgres in schema pressline grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema pressline grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema pressline grant all on sequences to anon, authenticated, service_role;

-- PEOPLE
create table pressline.customers (
  id uuid primary key default gen_random_uuid(),
  name text, email text, phone text, company text,
  source text,                -- front_gate|arcade|checkout|live|wholesale|outlaw|import
  niche text,                 -- moto|surf|skate|bar|gym|team|band|other
  brand_affinity text[],
  vip boolean default false,
  email_opt_in boolean default false,
  sms_consent_at timestamptz,
  sms_consent_text text,
  sms_consent_source text,
  sms_consent_ip inet,
  sms_opted_out_at timestamptz,
  screened_at timestamptz,
  screen_result text,         -- pass|hold
  created_at timestamptz default now()
);
create unique index customers_email_key on pressline.customers (lower(email)) where email is not null;
create index customers_phone_idx on pressline.customers (phone);

create table pressline.staff (
  id uuid primary key references auth.users on delete cascade,
  name text, role text not null check (role in ('owner','production','print','ship'))
);

-- ART
create table pressline.vault_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null, drive_file_id text,
  brand text,                 -- death_corps|odins_reich|combatant|black_metal|death_squad|skrew_u|valhalla|...
  title text, tags text[], colors int, dpi int,
  license text check (license in ('mcg','customer','camo')),
  thumb_url text,
  content_hash text,
  created_at timestamptz default now()
);
create unique index vault_assets_hash_key on pressline.vault_assets (content_hash) where content_hash is not null;
create index vault_assets_brand_idx on pressline.vault_assets (brand);
create index vault_assets_tags_idx on pressline.vault_assets using gin (tags);

create table pressline.designs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references pressline.customers,
  vault_asset_ids uuid[],
  studio_json jsonb,          -- Fabric.js canvas state
  print_file_path text,       -- 300 DPI PNG
  file_name text,             -- auto: {ORDER}-{BRAND}-{SKU}-{LOC}-{YYYYMMDD}.png
  drive_file_id text,
  method text check (method in ('screen','dtf','emb','uv')),
  colors int, locations text[],
  width_in numeric, height_in numeric,
  approved_at timestamptz, created_at timestamptz default now()
);
create index designs_customer_idx on pressline.designs (customer_id);

-- CATALOG
create table pressline.blanks (
  id uuid primary key default gen_random_uuid(),
  supplier text check (supplier in ('ss','sanmar','unity','other')),
  style text, brand text, color text, sizes text[],
  cost numeric, photo_front text, photo_back text,
  supplier_style_id text,
  updated_at timestamptz default now()
);
create index blanks_supplier_style_idx on pressline.blanks (supplier, style);

create table pressline.price_rules (
  id uuid primary key default gen_random_uuid(),
  method text, qty_min int, qty_max int,
  base numeric, per_location numeric, per_color numeric,
  setup_fee numeric, margin_pct numeric
);

-- MONEY + ORDERS
create type pressline.order_status as enum (
  'NEW','QUOTED','APPROVED','PAID','BLANKS_ORDERED','ART_READY',
  'ON_GANG_SHEET','PRINTED','PACKED','SHIPPED','DONE','HOLD','CANCELLED');

create table pressline.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references pressline.customers,
  lines jsonb, subtotal numeric, total numeric,
  status text default 'draft',  -- draft|sent|approved|declined
  approved_by uuid references pressline.staff, approved_at timestamptz,
  created_at timestamptz default now()
);
create index quotes_customer_idx on pressline.quotes (customer_id);

create table pressline.orders (
  id uuid primary key default gen_random_uuid(),
  number serial unique,
  quote_id uuid references pressline.quotes,
  customer_id uuid references pressline.customers,
  store_id uuid,
  status pressline.order_status default 'NEW',
  due_date date, assigned_to uuid references pressline.staff,
  proof_token text unique,
  rush boolean default false,
  created_at timestamptz default now()
);
alter sequence pressline.orders_number_seq restart with 1000;
create index orders_status_idx on pressline.orders (status);
create index orders_due_idx on pressline.orders (due_date);
create index orders_customer_idx on pressline.orders (customer_id);

create table pressline.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references pressline.orders on delete cascade,
  blank_id uuid references pressline.blanks,
  sizes jsonb,                -- {"S":4,"M":10,"L":6}
  design_id uuid references pressline.designs,
  locations text[], unit_price numeric
);
create index order_lines_order_idx on pressline.order_lines (order_id);

create table pressline.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references pressline.orders,
  stripe_invoice_id text, stripe_checkout_session_id text,
  amount numeric, paid_at timestamptz
);
create index invoices_order_idx on pressline.invoices (order_id);

create table pressline.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references pressline.orders,
  supplier text, supplier_po text, lines jsonb,
  status text default 'pending_approval', -- pending_approval|placed|received
  approved_by uuid references pressline.staff, approved_at timestamptz,
  created_at timestamptz default now()
);
create index purchase_orders_order_idx on pressline.purchase_orders (order_id);

-- PRODUCTION
create table pressline.gang_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date unique, sheet_files text[], design_ids uuid[],
  sent_to_danny_at timestamptz, report text,
  created_at timestamptz default now()
);

create table pressline.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references pressline.orders,
  carrier text, tracking text, label_url text,
  shipped_at timestamptz, delivered_at timestamptz
);
create index shipments_order_idx on pressline.shipments (order_id);

-- SELLING
create table pressline.stores (
  id uuid primary key default gen_random_uuid(),
  name text, slug text unique,
  type text check (type in ('shopify','stripe','skrewu','popup','wholesale')),
  config jsonb,               -- NO secrets here; reference env var names only
  world_room text,            -- back_room|rf_dc|skrewu_lot|drive_in|the_lot
  opens_at timestamptz, closes_at timestamptz,
  fundraising_pct numeric default 0,
  closed_order_id uuid references pressline.orders,
  created_at timestamptz default now()
);

create table pressline.products (
  id uuid primary key default gen_random_uuid(),
  design_id uuid references pressline.designs, blank_id uuid references pressline.blanks,
  store_id uuid references pressline.stores,
  title text, price numeric, mockups text[],
  published jsonb default '{}',  -- {"shopify":"gid...","skrewu":"id..."}
  created_at timestamptz default now()
);
create index products_store_idx on pressline.products (store_id);

create table pressline.store_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references pressline.stores on delete cascade,
  customer_id uuid references pressline.customers,
  product_id uuid references pressline.products,
  sizes jsonb, total numeric,
  stripe_checkout_session_id text, paid_at timestamptz,
  created_at timestamptz default now()
);
create index store_orders_store_idx on pressline.store_orders (store_id);

create table pressline.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text, channel text check (channel in ('email','sms')),
  workflow text, audience_filter jsonb, status text default 'draft'
);

create table pressline.touches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references pressline.customers, campaign_id uuid references pressline.campaigns,
  channel text, payload jsonb,
  sent_at timestamptz, replied_at timestamptz, converted_order_id uuid references pressline.orders
);
create index touches_customer_idx on pressline.touches (customer_id);

-- LOG (Outlaw's memory + audit trail)
create table pressline.events (
  id bigserial primary key,
  order_id uuid references pressline.orders,
  actor text,                 -- outlaw|justin|jeff|danny|customer|n8n|system
  kind text, msg text, data jsonb,
  ts timestamptz default now()
);
create index events_order_idx on pressline.events (order_id, ts desc);
create index events_ts_idx on pressline.events (ts desc);

-- INTEGRATION STATE (tokens live here, never in stores.config)
create table pressline.integration_tokens (
  provider text primary key,       -- shopify_dc
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

-- PIN lockout state for the Business Office tablet
create table pressline.pin_attempts (
  key text primary key,            -- ip or device id
  failures int default 0,
  locked_until timestamptz,
  updated_at timestamptz default now()
);

-- Realtime: the board and the world listen to these.
alter publication supabase_realtime add table pressline.orders, pressline.events, pressline.quotes;

grant all on all tables in schema pressline to anon, authenticated, service_role;
grant all on all sequences in schema pressline to anon, authenticated, service_role;
