-- Starter content so the site is never empty on first load.
-- All of it is editable from the Supabase dashboard.
-- Every statement is guarded, so re-running this never duplicates rows.

insert into public.dime_settings (
  id, display_name, tagline, bio, avatar_url, is_live,
  stream_title, stream_platform, stream_url, next_stream_at, socials
) values (
  1,
  'DIME',
  'late nights, loud games, louder chat',
  'Variety streamer. Chaotic co-op, horror I regret picking, and the occasional 4am just-chatting spiral. Pull up.',
  '/dime.jpg',
  false,
  'ranked until my hands give out',
  'twitch',
  'https://twitch.tv/dime',
  now() + interval '1 day',
  '[
    {"label":"Twitch","url":"https://twitch.tv/dime"},
    {"label":"YouTube","url":"https://youtube.com/@dime"},
    {"label":"TikTok","url":"https://tiktok.com/@dime"},
    {"label":"Instagram","url":"https://instagram.com/dime"},
    {"label":"Discord","url":"https://discord.gg/dime"}
  ]'::jsonb
)
on conflict (id) do nothing;

insert into public.dime_schedule (title, description, starts_at, duration_min, platform)
select * from (values
  ('Ranked grind',        'Climbing until the hands stop working.',      now() + interval '1 day',  240, 'twitch'),
  ('Horror night',        'Chat picks the game. I already regret this.', now() + interval '3 days', 180, 'twitch'),
  ('Just chatting + art', 'Low key. Bring your questions.',              now() + interval '5 days', 120, 'twitch'),
  ('Co-op chaos',         'Duos with whoever answers the phone.',        now() + interval '8 days', 200, 'youtube')
) as v(title, description, starts_at, duration_min, platform)
where not exists (select 1 from public.dime_schedule);

with p as (
  insert into public.dime_polls (question, is_open)
  select 'what should i play on stream tonight?', true
  where not exists (select 1 from public.dime_polls)
  returning id
)
insert into public.dime_poll_options (poll_id, label, position)
select p.id, v.label, v.position
from p, (values
  ('something horror', 0),
  ('ranked, no mercy', 1),
  ('cozy farming sim', 2),
  ('chat picks, i suffer', 3)
) as v(label, position);

insert into public.dime_products (slug, name, description, price_cents, image_url, tags, stock, position)
select * from (values
  ('dime-hoodie',   'DIME Signature Hoodie',  'Heavyweight cotton, embroidered wordmark, oversized cut.',   6800, null, array['apparel','bestseller'], 40, 0),
  ('late-night-tee','Late Night Tee',         'Washed black tee with the 4am spiral print on the back.',    3200, null, array['apparel'],              85, 1),
  ('hoop-sticker',  'Hoop Sticker Pack',      'Six die-cut vinyl stickers. Dishwasher-brave.',               900, null, array['accessories'],          200, 2),
  ('chat-mug',      'Chat Is Wrong Mug',      '15oz ceramic. Holds coffee and the weight of bad takes.',    2400, null, array['accessories'],           60, 3),
  ('dime-mousepad', 'Desk Mat XL',            '900x400 stitched-edge mat. The whole desk, covered.',        4200, null, array['gear'],                  35, 4),
  ('vip-discord',   'VIP Discord Role',       'Colored name, private channels, monthly hangout call.',      1500, null, array['digital'],              null, 5)
) as v(slug, name, description, price_cents, image_url, tags, stock, position)
where not exists (select 1 from public.dime_products);
