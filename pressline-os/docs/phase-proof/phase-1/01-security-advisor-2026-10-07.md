# Supabase Security Advisor — after migrations 0001, 0002, 0003

Project: `midnight-fusion-staging` (nbrahnwdrtezjpnuccrg) · 2026-10-07 13:17 UTC

**Errors: 0. Warnings: 0.** INFO only:

| Level | Lint | Table | Why it's fine |
|---|---|---|---|
| INFO | rls_enabled_no_policy | `pressline.integration_tokens` | Service-role only by design (Shopify token store). No API path for anon/authenticated. |
| INFO | rls_enabled_no_policy | `pressline.pin_attempts` | Service-role only by design (PIN lockout state). |
| INFO | rls_enabled_no_policy | 23 × `public.*` | Standalone MF app tables that predate PRESSLINE. Not touched by this build. |

Every `pressline.*` table has RLS enabled. Helper functions are `security definer` with `search_path = ''` and revoked from `anon`.
