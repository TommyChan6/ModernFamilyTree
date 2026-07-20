-- ============================================================================
-- reset.sql — drop every object schema.sql creates, so it can be re-run clean
-- ============================================================================
--
-- ⚠️  DESTRUCTIVE. This deletes ALL app tables and their data. Only run it
-- before go-live (or in a throwaway project) — never once real users/trees
-- exist. It exists to recover from a half-applied schema.sql (the
-- "relation already exists" error you get from re-running a plain-CREATE file).
--
-- Usage: run this whole file in the Supabase SQL editor, THEN run schema.sql.
--
-- Order: the trigger on auth.users first (auth.users is NOT ours to drop, so
-- its trigger must go explicitly); then the tables (CASCADE takes their own
-- triggers, policies, and indexes); then the functions.
-- ============================================================================

-- The signup trigger lives on Supabase's auth.users table — drop it by name.
drop trigger if exists on_auth_user_created on auth.users;

-- App tables. CASCADE also removes their policies, per-table triggers, indexes,
-- and FK references, so order between them doesn't matter.
drop table if exists field_values       cascade;
drop table if exists field_defs         cascade;
drop table if exists rel_type_defs       cascade;
drop table if exists settings           cascade;
drop table if exists images             cascade;
drop table if exists scenarios          cascade;
drop table if exists factions           cascade;
drop table if exists relationships      cascade;
drop table if exists persons            cascade;
drop table if exists tree_collaborators cascade;
drop table if exists trees              cascade;
drop table if exists profiles           cascade;
drop table if exists plan_limits        cascade;

-- Storage policies (from storage_policies.sql). The bucket and its files are
-- NOT touched — empty/delete the 'images' bucket from the dashboard if needed.
drop policy if exists images_storage_select on storage.objects;
drop policy if exists images_storage_insert on storage.objects;
drop policy if exists images_storage_delete on storage.objects;

-- Functions (now that nothing references them).
drop function if exists handle_new_user()        cascade;
drop function if exists can_read_tree(uuid)      cascade;
drop function if exists can_write_tree(uuid)     cascade;
drop function if exists enforce_tree_limit()     cascade;
drop function if exists enforce_person_limit()   cascade;
drop function if exists enforce_image_limit()    cascade;
