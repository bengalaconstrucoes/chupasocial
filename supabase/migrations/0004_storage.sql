-- =============================================================================
-- ChupaSocial — 0004 — Supabase Storage
-- Leitura pública (feed rápido), escrita restrita à pasta do próprio usuário.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 4194304, array['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif']),
  ('post-media', 'post-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('community-images', 'community-images', true, 4194304, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chupa_media_read" on storage.objects;
create policy "chupa_media_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('avatars', 'banners', 'post-media', 'community-images'));

drop policy if exists "chupa_media_insert" on storage.objects;
create policy "chupa_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chupa_media_update" on storage.objects;
create policy "chupa_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chupa_media_delete" on storage.objects;
create policy "chupa_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
