-- ============================================================
-- Biblioteca Personal — Storage bucket for custom book covers
-- Run once in the Supabase SQL editor (after schema.sql).
-- ============================================================

-- Public bucket so cover URLs render without auth.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Anyone may read covers (bucket is public, but be explicit).
drop policy if exists covers_read_all on storage.objects;
create policy covers_read_all on storage.objects
  for select to public
  using (bucket_id = 'covers');

-- A signed-in user may write only inside their own folder: covers/<uid>/...
drop policy if exists covers_insert_own on storage.objects;
create policy covers_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_update_own on storage.objects;
create policy covers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_delete_own on storage.objects;
create policy covers_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
