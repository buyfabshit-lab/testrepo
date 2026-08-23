-- DIME streamer site: core content + interaction tables.
-- Namespaced `dime_` to sit alongside the existing ms_/ef_/locker_ families.

-- ---------------------------------------------------------------
-- Content DIME controls (read-only to the public)
-- ---------------------------------------------------------------

create table if not exists public.dime_settings (
  id                int primary key default 1 check (id = 1),
  display_name      text        not null default 'DIME',
  tagline           text,
  bio               text,
  avatar_url        text,
  is_live           boolean     not null default false,
  stream_title      text,
  stream_platform   text,
  stream_embed_url  text,
  stream_url        text,
  next_stream_at    timestamptz,
  socials           jsonb       not null default '[]'::jsonb,
  updated_at        timestamptz not null default now()
);
comment on table public.dime_settings is
  'Single-row site config. Edited by DIME via the Supabase dashboard; public read-only.';

create table if not exists public.dime_schedule (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  description  text,
  starts_at    timestamptz not null,
  duration_min int         check (duration_min is null or duration_min > 0),
  platform     text,
  created_at   timestamptz not null default now()
);
create index if not exists dime_schedule_starts_at_idx
  on public.dime_schedule (starts_at);

create table if not exists public.dime_products (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        not null unique,
  name         text        not null,
  description  text,
  price_cents  int         not null check (price_cents >= 0),
  currency     text        not null default 'USD',
  image_url    text,
  tags         text[]      not null default '{}',
  stock        int         check (stock is null or stock >= 0),
  is_active    boolean     not null default true,
  position     int         not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists dime_products_active_idx
  on public.dime_products (is_active, position);

-- ---------------------------------------------------------------
-- Fan interaction (public insert, never public update/delete)
-- ---------------------------------------------------------------

create table if not exists public.dime_chat_messages (
  id         bigint      generated always as identity primary key,
  fan_id     uuid        not null,
  handle     text        not null check (char_length(handle) between 1 and 24),
  body       text        not null check (char_length(body) between 1 and 280),
  hue        int         not null default 322 check (hue between 0 and 360),
  created_at timestamptz not null default now()
);
create index if not exists dime_chat_messages_created_at_idx
  on public.dime_chat_messages (created_at desc);
create index if not exists dime_chat_messages_fan_recent_idx
  on public.dime_chat_messages (fan_id, created_at desc);

create table if not exists public.dime_wall_posts (
  id         bigint      generated always as identity primary key,
  fan_id     uuid        not null,
  handle     text        not null check (char_length(handle) between 1 and 24),
  body       text        not null check (char_length(body) between 1 and 500),
  hue        int         not null default 322 check (hue between 0 and 360),
  hearts     int         not null default 0 check (hearts >= 0),
  created_at timestamptz not null default now()
);
create index if not exists dime_wall_posts_created_at_idx
  on public.dime_wall_posts (created_at desc);
create index if not exists dime_wall_posts_fan_recent_idx
  on public.dime_wall_posts (fan_id, created_at desc);

-- One heart per fan per post; the PK is the dedupe.
create table if not exists public.dime_wall_hearts (
  post_id    bigint      not null references public.dime_wall_posts (id) on delete cascade,
  fan_id     uuid        not null,
  created_at timestamptz not null default now(),
  primary key (post_id, fan_id)
);

create table if not exists public.dime_polls (
  id         uuid        primary key default gen_random_uuid(),
  question   text        not null check (char_length(question) between 1 and 200),
  is_open    boolean     not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dime_poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.dime_polls (id) on delete cascade,
  label    text not null check (char_length(label) between 1 and 80),
  position int  not null default 0
);
create index if not exists dime_poll_options_poll_idx
  on public.dime_poll_options (poll_id, position);

-- PK on (poll_id, fan_id) enforces one vote per fan per poll.
create table if not exists public.dime_poll_votes (
  poll_id    uuid        not null references public.dime_polls (id) on delete cascade,
  option_id  uuid        not null references public.dime_poll_options (id) on delete cascade,
  fan_id     uuid        not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, fan_id)
);
create index if not exists dime_poll_votes_option_idx
  on public.dime_poll_votes (option_id);

create table if not exists public.dime_reactions (
  id         bigint      generated always as identity primary key,
  fan_id     uuid        not null,
  emoji      text        not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now()
);
create index if not exists dime_reactions_created_at_idx
  on public.dime_reactions (created_at desc);
create index if not exists dime_reactions_fan_recent_idx
  on public.dime_reactions (fan_id, created_at desc);

-- Orders carry an email address, so this table is insert-only and never
-- readable through the public API. See the RLS migration.
create table if not exists public.dime_orders (
  id             uuid        primary key default gen_random_uuid(),
  fan_id         uuid,
  handle         text        check (handle is null or char_length(handle) <= 24),
  email          text        not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  items          jsonb       not null,
  subtotal_cents int         not null check (subtotal_cents >= 0),
  currency       text        not null default 'USD',
  status         text        not null default 'pending'
                   check (status in ('pending','paid','shipped','cancelled')),
  note           text        check (note is null or char_length(note) <= 500),
  created_at     timestamptz not null default now()
);
create index if not exists dime_orders_created_at_idx
  on public.dime_orders (created_at desc);
