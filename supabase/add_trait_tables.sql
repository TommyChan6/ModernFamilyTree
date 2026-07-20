-- ============================================================================
-- add_trait_tables.sql — migration: the trait system + relationship-type registry
-- ============================================================================
--
-- Run this ONCE in the Supabase SQL editor if you already applied schema.sql
-- (it's also included at the end of schema.sql now, for fresh setups). Safe to
-- run on a database that already has trees/persons — it only ADDS tables.
--
-- These three registries were added to the app after the original schema was
-- written. They're stored as `doc` JSONB (the whole entity) because they're
-- app-internal and never queried column-by-column — the app's shared trait
-- logic reads/writes them whole. tree_id scopes + cascades them; field_values
-- also cascades when its person is deleted.
-- ============================================================================

-- Per-project trait DEFINITIONS (FieldDef): what traits a tree has + their slots.
create table field_defs (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references trees (id) on delete cascade,
  doc         jsonb not null,                 -- the full FieldDef object
  created_at  timestamptz not null default now()
);
create index field_defs_tree_id_idx on field_defs (tree_id);

-- Per-person trait VALUES (FieldValue). Cascades with both its tree and person.
create table field_values (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references trees (id)   on delete cascade,
  person_id   uuid not null references persons (id) on delete cascade,
  doc         jsonb not null,                 -- the full FieldValue object
  created_at  timestamptz not null default now()
);
create index field_values_tree_id_idx   on field_values (tree_id);
create index field_values_person_id_idx on field_values (person_id);

-- Per-project relationship-type registry (RelationshipTypeDef). `key` is the
-- slug Relationship.type points at (kept as a column for readability/lookups).
create table rel_type_defs (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references trees (id) on delete cascade,
  key         text not null,
  doc         jsonb not null,                 -- the full RelationshipTypeDef object
  created_at  timestamptz not null default now()
);
create index rel_type_defs_tree_id_idx on rel_type_defs (tree_id);

-- RLS: same rule as every content table — read if you can read the tree, write
-- if you can write it (uses the can_read_tree / can_write_tree helpers).
alter table field_defs    enable row level security;
alter table field_values  enable row level security;
alter table rel_type_defs  enable row level security;

create policy field_defs_select on field_defs for select using (can_read_tree(tree_id));
create policy field_defs_insert on field_defs for insert with check (can_write_tree(tree_id));
create policy field_defs_update on field_defs for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy field_defs_delete on field_defs for delete using (can_write_tree(tree_id));

create policy field_values_select on field_values for select using (can_read_tree(tree_id));
create policy field_values_insert on field_values for insert with check (can_write_tree(tree_id));
create policy field_values_update on field_values for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy field_values_delete on field_values for delete using (can_write_tree(tree_id));

create policy rel_type_defs_select on rel_type_defs for select using (can_read_tree(tree_id));
create policy rel_type_defs_insert on rel_type_defs for insert with check (can_write_tree(tree_id));
create policy rel_type_defs_update on rel_type_defs for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy rel_type_defs_delete on rel_type_defs for delete using (can_write_tree(tree_id));
