-- Enable RLS on the tables created by `prisma db push` for seedance-2-generator.
--
-- WHY THIS IS SAFE FOR THE APP:
-- The Next.js app talks to Postgres through Prisma using the `postgres`
-- superuser role in DATABASE_URL. That role owns these tables and Postgres
-- does not apply RLS to a table's owner unless FORCE ROW LEVEL SECURITY is
-- set. We deliberately do NOT force it, so Prisma keeps full access and the
-- app is unaffected.
--
-- WHAT IT ACTUALLY PROTECTS:
-- Supabase auto-exposes every table in `public` through PostgREST. Without
-- RLS, anyone holding the project's anon key can read these tables over
-- HTTPS -- including User.email and every Creation row. Enabling RLS with no
-- policies makes PostgREST deny-all for anon/authenticated while leaving the
-- Prisma path untouched.
--
-- Auth in this app is NextAuth (not Supabase Auth), so there is no
-- auth.uid() to write per-user policies against. Deny-all is the correct
-- posture here: all legitimate access is server-side through Prisma.

ALTER TABLE public."User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Account"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Creation"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VerificationToken" ENABLE ROW LEVEL SECURITY;

-- Belt and braces: revoke the PostgREST-facing roles explicitly, so the
-- tables stay closed even if a policy is added carelessly later.
REVOKE ALL ON public."User"              FROM anon, authenticated;
REVOKE ALL ON public."Account"           FROM anon, authenticated;
REVOKE ALL ON public."Session"           FROM anon, authenticated;
REVOKE ALL ON public."Creation"          FROM anon, authenticated;
REVOKE ALL ON public."VerificationToken" FROM anon, authenticated;

-- Verify: every row should show rowsecurity = true.
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
