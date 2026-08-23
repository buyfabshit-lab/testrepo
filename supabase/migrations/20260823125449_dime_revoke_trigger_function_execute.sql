-- Both functions are trigger functions and are only ever reached through the
-- triggers that own them. Postgres would refuse a direct call anyway
-- ("trigger functions can only be called as triggers"), but they were still
-- listed as anon-executable SECURITY DEFINER routines on /rest/v1/rpc.
-- Revoking EXECUTE removes them from the public API surface entirely.

revoke execute on function public.dime_rate_limit()  from anon, authenticated, public;
revoke execute on function public.dime_apply_heart() from anon, authenticated, public;
