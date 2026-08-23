-- Triggers, aggregate view, RLS and realtime for the DIME site.

-- ---------------------------------------------------------------
-- Abuse friction. The site is anonymous by design (no login), so the
-- only handle we have is a client-generated fan_id, which a determined
-- abuser can rotate. These limits stop casual flooding; real protection
-- needs an Edge Function throttling on IP. Documented in the README.
-- ---------------------------------------------------------------

create or replace function public.dime_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max    int      := TG_ARGV[0]::int;
  v_window interval := TG_ARGV[1]::interval;
  v_count  int;
begin
  execute format(
    'select count(*) from public.%I where fan_id = $1 and created_at > now() - $2',
    TG_TABLE_NAME
  )
  into v_count
  using NEW.fan_id, v_window;

  if v_count >= v_max then
    raise exception 'Rate limit: at most % rows per % on %', v_max, v_window, TG_TABLE_NAME
      using errcode = '53400';
  end if;

  return NEW;
end;
$$;

drop trigger if exists dime_chat_rate_limit on public.dime_chat_messages;
create trigger dime_chat_rate_limit
  before insert on public.dime_chat_messages
  for each row execute function public.dime_rate_limit('8', '20 seconds');

drop trigger if exists dime_wall_rate_limit on public.dime_wall_posts;
create trigger dime_wall_rate_limit
  before insert on public.dime_wall_posts
  for each row execute function public.dime_rate_limit('5', '10 minutes');

drop trigger if exists dime_reactions_rate_limit on public.dime_reactions;
create trigger dime_reactions_rate_limit
  before insert on public.dime_reactions
  for each row execute function public.dime_rate_limit('40', '10 seconds');

-- ---------------------------------------------------------------
-- Hearts. Fans may not UPDATE dime_wall_posts directly, so the counter
-- is maintained by a definer-rights trigger on the (deduped) heart row.
-- ---------------------------------------------------------------

create or replace function public.dime_apply_heart()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.dime_wall_posts
     set hearts = hearts + 1
   where id = NEW.post_id;
  return NEW;
end;
$$;

drop trigger if exists dime_wall_heart_applied on public.dime_wall_hearts;
create trigger dime_wall_heart_applied
  after insert on public.dime_wall_hearts
  for each row execute function public.dime_apply_heart();

-- ---------------------------------------------------------------
-- Poll tallies. security_invoker keeps the caller's RLS in force.
-- ---------------------------------------------------------------

create or replace view public.dime_poll_results
with (security_invoker = on) as
select
  o.poll_id,
  o.id       as option_id,
  o.label,
  o.position,
  count(v.fan_id)::int as votes
from public.dime_poll_options o
left join public.dime_poll_votes v on v.option_id = o.id
group by o.poll_id, o.id, o.label, o.position;

-- ---------------------------------------------------------------
-- RLS. Everything on, then re-open exactly what the public site needs.
-- ---------------------------------------------------------------

alter table public.dime_settings      enable row level security;
alter table public.dime_schedule      enable row level security;
alter table public.dime_products      enable row level security;
alter table public.dime_chat_messages enable row level security;
alter table public.dime_wall_posts    enable row level security;
alter table public.dime_wall_hearts   enable row level security;
alter table public.dime_polls         enable row level security;
alter table public.dime_poll_options  enable row level security;
alter table public.dime_poll_votes    enable row level security;
alter table public.dime_reactions     enable row level security;
alter table public.dime_orders        enable row level security;

-- Read-only content.
drop policy if exists dime_settings_read on public.dime_settings;
create policy dime_settings_read on public.dime_settings
  for select to anon, authenticated using (true);

drop policy if exists dime_schedule_read on public.dime_schedule;
create policy dime_schedule_read on public.dime_schedule
  for select to anon, authenticated using (true);

drop policy if exists dime_products_read on public.dime_products;
create policy dime_products_read on public.dime_products
  for select to anon, authenticated using (is_active);

drop policy if exists dime_polls_read on public.dime_polls;
create policy dime_polls_read on public.dime_polls
  for select to anon, authenticated using (true);

drop policy if exists dime_poll_options_read on public.dime_poll_options;
create policy dime_poll_options_read on public.dime_poll_options
  for select to anon, authenticated using (true);

-- Fan interaction: read + append. No update, no delete, for anyone.
drop policy if exists dime_chat_read on public.dime_chat_messages;
create policy dime_chat_read on public.dime_chat_messages
  for select to anon, authenticated using (true);
drop policy if exists dime_chat_append on public.dime_chat_messages;
create policy dime_chat_append on public.dime_chat_messages
  for insert to anon, authenticated with check (true);

drop policy if exists dime_wall_read on public.dime_wall_posts;
create policy dime_wall_read on public.dime_wall_posts
  for select to anon, authenticated using (true);
drop policy if exists dime_wall_append on public.dime_wall_posts;
create policy dime_wall_append on public.dime_wall_posts
  for insert to anon, authenticated with check (true);

drop policy if exists dime_hearts_read on public.dime_wall_hearts;
create policy dime_hearts_read on public.dime_wall_hearts
  for select to anon, authenticated using (true);
drop policy if exists dime_hearts_append on public.dime_wall_hearts;
create policy dime_hearts_append on public.dime_wall_hearts
  for insert to anon, authenticated with check (true);

-- Votes are readable (they are only uuids) so the tally view can aggregate
-- them under security_invoker. Voting into a closed poll is refused here.
drop policy if exists dime_votes_read on public.dime_poll_votes;
create policy dime_votes_read on public.dime_poll_votes
  for select to anon, authenticated using (true);
drop policy if exists dime_votes_append on public.dime_poll_votes;
create policy dime_votes_append on public.dime_poll_votes
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.dime_polls p where p.id = poll_id and p.is_open)
    and exists (
      select 1 from public.dime_poll_options o
       where o.id = option_id and o.poll_id = dime_poll_votes.poll_id
    )
  );

drop policy if exists dime_reactions_read on public.dime_reactions;
create policy dime_reactions_read on public.dime_reactions
  for select to anon, authenticated using (true);
drop policy if exists dime_reactions_append on public.dime_reactions;
create policy dime_reactions_append on public.dime_reactions
  for insert to anon, authenticated with check (true);

-- Orders hold an email address. Write-only: no SELECT policy exists, and
-- the grant below removes SELECT outright so a future careless policy
-- still cannot expose them.
drop policy if exists dime_orders_append on public.dime_orders;
create policy dime_orders_append on public.dime_orders
  for insert to anon, authenticated with check (true);

revoke all on public.dime_orders from anon, authenticated;
grant insert on public.dime_orders to anon, authenticated;

-- No table in this set is publicly mutable after the fact.
revoke update, delete on
  public.dime_settings, public.dime_schedule, public.dime_products,
  public.dime_chat_messages, public.dime_wall_posts, public.dime_wall_hearts,
  public.dime_polls, public.dime_poll_options, public.dime_poll_votes,
  public.dime_reactions
from anon, authenticated;

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'dime_chat_messages', 'dime_wall_posts', 'dime_wall_hearts',
    'dime_reactions', 'dime_poll_votes', 'dime_polls',
    'dime_poll_options', 'dime_settings'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
