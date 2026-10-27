-- Tag auras: a special effect every member of a tag wears in the Graph and
-- Timeline (src/shared/auras.ts). Run once on databases created before it;
-- schema.sql already has the column for new ones. Trait auras need nothing:
-- field_defs store the whole def as a jsonb doc.
alter table factions add column if not exists aura jsonb;
