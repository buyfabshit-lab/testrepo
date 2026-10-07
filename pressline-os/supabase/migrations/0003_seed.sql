-- PRESSLINE OS — seed data. Price rules are PLACEHOLDERS until Justin supplies
-- Jeff + Danny costs (Open Item #3). Stores carry env var NAMES only.

insert into pressline.price_rules (method, qty_min, qty_max, base, per_location, per_color, setup_fee, margin_pct) values
  ('dtf',    1,   11,  9.50, 4.00, 0.00, 0.00, 0.55),
  ('dtf',    12,  47,  7.25, 3.00, 0.00, 0.00, 0.50),
  ('dtf',    48,  143, 6.00, 2.25, 0.00, 0.00, 0.45),
  ('dtf',    144, 9999,5.00, 1.75, 0.00, 0.00, 0.40),
  ('screen', 1,   23,  8.00, 3.50, 1.25, 25.00, 0.50),
  ('screen', 24,  71,  5.50, 2.50, 0.90, 25.00, 0.45),
  ('screen', 72,  143, 4.25, 2.00, 0.70, 20.00, 0.42),
  ('screen', 144, 9999,3.50, 1.50, 0.55, 0.00,  0.40),
  ('emb',    1,   11,  12.00, 6.00, 0.00, 45.00, 0.50),
  ('emb',    12,  47,  9.00,  5.00, 0.00, 45.00, 0.45),
  ('emb',    48,  9999,7.00,  4.00, 0.00, 0.00,  0.42),
  ('uv',     1,   49,  2.50, 0.00, 0.00, 0.00, 0.60),
  ('uv',     50,  9999,1.50, 0.00, 0.00, 0.00, 0.55);

insert into pressline.stores (name, slug, type, config, world_room) values
  ('Death Corps (deathcorps.shop)', 'death-corps', 'shopify',
    '{"shop_env":"SHOPIFY_DC_SHOP","client_id_env":"SHOPIFY_DC_CLIENT_ID","client_secret_env":"SHOPIFY_DC_CLIENT_SECRET"}', 'rf_dc'),
  ('Death Squad', 'death-squad', 'stripe', '{"checkout":"stripe"}', 'back_room'),
  ('Skrew U', 'skrew-u', 'skrewu', '{"url_env":"SKREWU_SUPABASE_URL","key_env":"SKREWU_SERVICE_KEY"}', 'skrewu_lot'),
  ('The Lot (moto wholesale)', 'the-lot', 'wholesale', '{"moq":24,"tiers":[{"min":24,"pct":0.30},{"min":72,"pct":0.40}]}', 'the_lot'),
  ('The Lineup (surf/skate wholesale)', 'the-lineup', 'wholesale', '{"moq":24,"tiers":[{"min":24,"pct":0.30},{"min":72,"pct":0.40}]}', 'the_lot');

insert into pressline.blanks (supplier, style, brand, color, sizes, cost, supplier_style_id) values
  ('ss', '5000',  'Gildan',       'Black', '{S,M,L,XL,2XL,3XL}', 3.10, '16'),
  ('ss', '3001',  'Bella+Canvas', 'Black', '{XS,S,M,L,XL,2XL}',  5.20, '29'),
  ('ss', '1717',  'Comfort Colors','Black','{S,M,L,XL,2XL,3XL}', 7.40, '1822'),
  ('ss', '18500', 'Gildan',       'Black', '{S,M,L,XL,2XL,3XL}', 11.90, '395'),
  ('ss', '6006',  'Yupoong',      'Black', '{OS}',               4.60, '4118');
