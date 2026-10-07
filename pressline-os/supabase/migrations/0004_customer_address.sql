-- Ship-to address on the customer so labels prefill (Jeff) and Shopify orders carry it in.
alter table pressline.customers add column if not exists address jsonb;
-- {"name","company","street1","street2","city","state","postalCode","country","phone"}
