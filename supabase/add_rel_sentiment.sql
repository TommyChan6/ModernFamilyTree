-- Relationship dynamics: a per-edge feeling the graph's Dynamics lens draws
-- warm <-> cold and thick <-> thin (src/shared/sentiment.ts). Run once on
-- databases created before it; schema.sql already has the columns for new
-- ones. Both are optional: null = inherit the relationship type's sentiment /
-- the default intensity. Type sentiment needs nothing: rel_type_defs store
-- the whole def as a jsonb doc.
alter table relationships add column if not exists sentiment real
  check (sentiment is null or (sentiment >= -1 and sentiment <= 1));
alter table relationships add column if not exists intensity real
  check (intensity is null or (intensity >= 0 and intensity <= 1));
