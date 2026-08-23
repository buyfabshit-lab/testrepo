-- DIME is in New York. Two consequences worth storing rather than hardcoding:
-- a place to put on the page, and a timezone to anchor the schedule to, so a
-- fan in London knows a stream is 8pm *her* time and not theirs.
-- Both stay editable from the dashboard like everything else.

alter table public.dime_settings
  add column if not exists location text,
  add column if not exists timezone text;

update public.dime_settings
   set location = coalesce(location, 'New York'),
       timezone = coalesce(timezone, 'America/New_York')
 where id = 1;

-- Fold the city into the bio too. Narrow WHERE so this only touches the
-- seeded copy and never overwrites something DIME has since rewritten.
update public.dime_settings
   set bio = 'Variety streamer out of New York. Chaotic co-op, horror I regret picking, and the occasional 4am just-chatting spiral. Pull up.'
 where id = 1
   and bio = 'Variety streamer. Chaotic co-op, horror I regret picking, and the occasional 4am just-chatting spiral. Pull up.';
