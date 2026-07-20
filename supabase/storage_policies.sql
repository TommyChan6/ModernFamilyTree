-- ============================================================================
-- storage_policies.sql — the photos bucket + who may touch which files
-- ============================================================================
--
-- Run ONCE in the Supabase SQL editor (after schema.sql — it reuses the
-- can_read_tree / can_write_tree helpers defined there).
--
-- Photos are uploaded to the PRIVATE bucket 'images' at paths shaped
-- `<treeId>/<uuid>.webp`. A private bucket denies everything by default, so
-- these policies grant exactly the same access as the tree's data rows:
--   read a file  → you can read the tree named by its folder
--   add a file   → you can write that tree
--   delete       → you can write that tree
-- The app reads via short-lived SIGNED URLS; creating a signed URL requires
-- the SELECT policy below, so signing obeys the same rule.
-- ============================================================================

-- The bucket itself (private). The dashboard's "New bucket" does the same
-- thing — this just makes the setup scriptable; safe if it already exists.
insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

-- (storage.foldername(name))[1] is the first path segment — the tree id.

-- READ (also gates signed-URL creation): can you read that tree?
create policy images_storage_select on storage.objects
  for select
  using (
    bucket_id = 'images'
    and can_read_tree(((storage.foldername(name))[1])::uuid)
  );

-- UPLOAD: only into a tree you may write.
create policy images_storage_insert on storage.objects
  for insert
  with check (
    bucket_id = 'images'
    and can_write_tree(((storage.foldername(name))[1])::uuid)
  );

-- DELETE: only from a tree you may write.
create policy images_storage_delete on storage.objects
  for delete
  using (
    bucket_id = 'images'
    and can_write_tree(((storage.foldername(name))[1])::uuid)
  );
