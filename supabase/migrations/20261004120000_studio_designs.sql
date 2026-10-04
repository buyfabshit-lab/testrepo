-- Apparel Design Studio: saved designs + upload bucket.
-- Designs belong to the (anonymous or signed-in) auth user that created them.
-- Enable "Allow anonymous sign-ins" under Authentication > Providers for the
-- login-free flow the studio uses by default.

create table if not exists public.studio_designs (
  id            uuid primary key,
  owner         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null default 'Untitled',
  blank         text not null check (blank in ('tee-front','tee-back','hat-front','hat-side')),
  color         text not null default 'black',
  layers        jsonb not null default '[]'::jsonb,
  thumbnail_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists studio_designs_owner_updated_idx
  on public.studio_designs (owner, updated_at desc);

alter table public.studio_designs enable row level security;

drop policy if exists "studio_designs_select_own" on public.studio_designs;
create policy "studio_designs_select_own" on public.studio_designs
  for select to authenticated using (owner = auth.uid());

drop policy if exists "studio_designs_insert_own" on public.studio_designs;
create policy "studio_designs_insert_own" on public.studio_designs
  for insert to authenticated with check (owner = auth.uid());

drop policy if exists "studio_designs_update_own" on public.studio_designs;
create policy "studio_designs_update_own" on public.studio_designs
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "studio_designs_delete_own" on public.studio_designs;
create policy "studio_designs_delete_own" on public.studio_designs
  for delete to authenticated using (owner = auth.uid());

-- Uploaded artwork and mockup thumbnails. Public-read so saved designs can
-- reference plain URLs; writes are scoped to a per-user folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-uploads', 'studio-uploads', true, 26214400,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "studio_uploads_public_read" on storage.objects;
create policy "studio_uploads_public_read" on storage.objects
  for select using (bucket_id = 'studio-uploads');

drop policy if exists "studio_uploads_insert_own_folder" on storage.objects;
create policy "studio_uploads_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'studio-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "studio_uploads_update_own_folder" on storage.objects;
create policy "studio_uploads_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'studio-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "studio_uploads_delete_own_folder" on storage.objects;
create policy "studio_uploads_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'studio-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
