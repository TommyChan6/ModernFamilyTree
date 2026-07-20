-- ============================================================================
-- newFamilyTree — Postgres schema for the hosted (Supabase) backend
-- ============================================================================
--
-- This mirrors the current JSON data model (src/shared/types.ts + the object
-- maps written by src/main/db.js) as relational tables, and folds in the three
-- migration-time additions recommended in docs/MID_DEVELOPMENT.md §5:
--   • trees.visibility        (private | unlisted | public)
--   • trees.forked_from       (fork / remix lineage)
--   • tree_collaborators      (per-tree sharing: owner / editor / viewer)
-- plus a trees.owner_id pointing at the logged-in Supabase user.
--
-- Vocabulary note: the running app renamed some containers, but this file uses
-- the doc's (and the roadmap's) names so it reads cleanly:
--   trees      ==  the app's "projects"
--   factions   ==  the app's "tags"
--   scenarios  ==  the app's "scenes"   (saved graph / groups / timeline layouts)
--
-- Design choices, kept deliberately simple:
--   • Users are NOT stored here — Supabase Auth owns them in auth.users.
--     Everything that needs an owner references auth.users(id).
--   • Structured-but-flexible bits (dates, positions, per-person traits) are
--     JSONB columns rather than their own tables. They already travel as JSON
--     between client and backend, so this is a straight lift.
--   • Referential integrity uses ON DELETE CASCADE for the HARD invariants only
--     (delete a person → its relationships + images vanish). The app keeps its
--     SOFT checks (self-links, >2 parents, temporal conflicts) as UI warnings —
--     see the doc; the DB must never reject a half-entered tree.
--   • Every child table is indexed on tree_id, the column every read filters by.
--
-- Run once against a fresh Supabase project (SQL editor, or `supabase db push`).
-- Row Level Security policies are intentionally NOT included here — add them in
-- a follow-up once the access rules (owner + collaborators + public visibility)
-- are settled.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto; Supabase usually has it enabled already.
create extension if not exists pgcrypto;


-- ============================================================================
-- trees  — the top-level container a user owns (the app's "project")
-- ============================================================================
create table trees (
  id           uuid primary key default gen_random_uuid(),

  -- The logged-in account that owns this tree. Deleting the auth user deletes
  -- their trees (and, by cascade, everything inside them).
  owner_id     uuid not null references auth.users (id) on delete cascade,

  name         text not null default 'Untitled',

  -- Sharing foundation (doc §5). Discovery & share links read this.
  visibility   text not null default 'private'
                 check (visibility in ('private', 'unlisted', 'public')),

  -- Fork / remix lineage: which tree this one was copied from, if any.
  -- SET NULL (not CASCADE) so deleting the original doesn't delete the forks.
  forked_from  uuid references trees (id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index trees_owner_id_idx   on trees (owner_id);
create index trees_visibility_idx on trees (visibility);  -- powers the Explore/public listing


-- ============================================================================
-- tree_collaborators  — who else can see or edit a tree, and at what level
-- (doc §5: powers sharing and the "log in?" collaboration item)
-- ============================================================================
create table tree_collaborators (
  tree_id    uuid not null references trees (id)      on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,

  -- owner  = full control (usually mirrors trees.owner_id)
  -- editor = can modify the tree's data
  -- viewer = read-only access to a non-public tree
  role       text not null default 'viewer'
               check (role in ('owner', 'editor', 'viewer')),

  created_at timestamptz not null default now(),

  -- One membership row per (tree, user).
  primary key (tree_id, user_id)
);

create index tree_collaborators_user_id_idx on tree_collaborators (user_id);


-- ============================================================================
-- persons  — a node in the tree
-- ============================================================================
-- The legacy "columns" (name/gender/birth/death/bio/…) survive as DERIVED
-- SNAPSHOTS recomputed from the trait system on every write, so views read
-- them unchanged. The full trait defs + per-person values live in `traits`
-- JSONB here to keep this schema simple (they can graduate to their own
-- field_defs / field_values tables later without touching callers).
create table persons (
  id          uuid primary key default gen_random_uuid(),

  -- Which tree this person belongs to. Deleting the tree deletes its people.
  tree_id     uuid not null references trees (id) on delete cascade,

  name        text not null default '',

  -- Structured dates ({ year, month, day, precision, calendar }); null = unknown.
  birth       jsonb,
  death       jsonb,

  gender      text not null default 'unknown',
  gender_t    real,                     -- gender as a 0..1 gradient position (null = unknown)

  bio         text not null default '',
  occupation  text not null default '',
  location    text not null default '',

  graph_label text,                     -- name + any traits flagged display_in_graph
  highlight   jsonb,                    -- { color } for the highlight ring; null = none

  -- The trait system's per-person data (FieldValue rows for this person).
  traits      jsonb not null default '[]'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index persons_tree_id_idx on persons (tree_id);


-- ============================================================================
-- relationships  — a directed/symmetric edge between two persons
-- ============================================================================
create table relationships (
  id           uuid primary key default gen_random_uuid(),

  tree_id      uuid not null references trees (id) on delete cascade,

  -- Deleting EITHER endpoint person removes the edge (the hard invariant the
  -- doc calls out). For directed types, a→b follows the type's roles
  -- (parent→child, mentor→student, …).
  person_a_id  uuid not null references persons (id) on delete cascade,
  person_b_id  uuid not null references persons (id) on delete cascade,

  -- Points at a relationship-type key in this tree's registry
  -- ('parent_child', 'spouse', a custom def's id, …). Kept as free text so the
  -- self-defined-relationships feature and the doc's category generalization
  -- slot in without a schema change.
  type         text not null,
  status       text not null default '',

  formed       jsonb,                   -- when it began; null = unknown
  ended        jsonb,                   -- when it ended (divorce, falling-out); null = ongoing
  label        text,                    -- optional per-edge display text

  created_at   timestamptz not null default now()
);

create index relationships_tree_id_idx     on relationships (tree_id);
create index relationships_person_a_id_idx on relationships (person_a_id);
create index relationships_person_b_id_idx on relationships (person_b_id);


-- ============================================================================
-- factions  — a labelled set of people (the app's "tags": a family, a house,
-- "Villains", …). Membership is stored inline as a person-id array to keep the
-- schema small; promote to a faction_members join table if you need to query
-- membership from the DB side.
-- ============================================================================
create table factions (
  id          uuid primary key default gen_random_uuid(),

  tree_id     uuid not null references trees (id) on delete cascade,

  label       text not null default '',
  type        text not null default '',   -- free-form category ('family', 'allegiance', …)
  color       text not null default '',
  icon        text not null default '',

  member_ids  jsonb not null default '[]'::jsonb,  -- person ids in this faction

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index factions_tree_id_idx on factions (tree_id);


-- ============================================================================
-- scenarios  — a saved arrangement of ONE view (the app's "scenes"): graph
-- layouts, groups clustering, or timeline. Positions/config are viewer state,
-- so they live as JSONB.
-- ============================================================================
create table scenarios (
  id          uuid primary key default gen_random_uuid(),

  tree_id     uuid not null references trees (id) on delete cascade,

  view        text not null,            -- 'graph' | 'groups' | 'timeline'
  name        text not null default '',
  type        text,                     -- graph layout on screen (free/organic/birth/…); null elsewhere

  config      jsonb not null default '{}'::jsonb,
  positions   jsonb not null default '{}'::jsonb,
  layouts     jsonb,                    -- graph only: per-layout-type arrangements

  -- Groups scenes: the faction placements shown in this scenario (the app's
  -- "scene_tags" rows — { id, scene_id, tag_id, x, y, visible, … }). Kept
  -- inline with their scene so they scope and cascade with it; promote to a
  -- join table if placements ever need DB-side querying.
  scene_tags  jsonb not null default '[]'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index scenarios_tree_id_idx on scenarios (tree_id);


-- ============================================================================
-- images  — a photo attached to a person
-- ============================================================================
create table images (
  id          uuid primary key default gen_random_uuid(),

  tree_id     uuid not null references trees (id) on delete cascade,

  -- Deleting the person removes their images too (the hard invariant, alongside
  -- relationships). NOTE: this drops the DB row; deleting the stored file in
  -- Supabase Storage is the app's job (as it is on desktop today).
  person_id   uuid not null references persons (id) on delete cascade,

  file_path   text not null,            -- Storage path / URL (desktop used a local path)
  is_primary  boolean not null default false,
  role        text not null default '', -- 'portrait' | 'fullbody' | 'background' | ''
  source      text not null default '', -- '' = user photo; 'character' = rendered portrait

  created_at  timestamptz not null default now()
);

create index images_tree_id_idx   on images (tree_id);
create index images_person_id_idx on images (person_id);


-- ============================================================================
-- settings  — per-tree key/value bag (was `${projectId}:key` → value in JSON)
-- ============================================================================
create table settings (
  tree_id     uuid not null references trees (id) on delete cascade,
  key         text not null,
  value       jsonb,

  updated_at  timestamptz not null default now(),

  -- One value per (tree, key).
  primary key (tree_id, key)
);

create index settings_tree_id_idx on settings (tree_id);


-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
--
-- The access rules, in one sentence each:
--   READ  a tree (and everything in it): the tree is public, OR you own it,
--         OR you're listed as a collaborator on it (any role).
--   WRITE a tree (and everything in it): you own it, OR you're a collaborator
--         with role 'editor' or 'owner'.
--
-- Every content table hangs off a tree via tree_id, so both rules reduce to a
-- single question about that tree. We answer it with two helper functions so
-- each table's policies stay short and identical.
--
-- Why SECURITY DEFINER helpers instead of inlining the sub-selects into every
-- policy: a policy on `trees` that reads `tree_collaborators`, plus a policy on
-- `tree_collaborators` that reads `trees`, makes Postgres evaluate one table's
-- RLS while checking the other's — mutual recursion, which errors at query
-- time. A SECURITY DEFINER function runs as its owner and BYPASSES RLS on the
-- tables it touches, so these lookups can't trigger that loop. `auth.uid()` is
-- the id of the currently authenticated user (NULL for anonymous requests).
-- ============================================================================

-- Returns true if the current user may READ the given tree.
create or replace function can_read_tree(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from trees t
    where t.id = tid
      and (
        t.visibility = 'public'          -- anyone, even logged-out, may read public trees
        or t.owner_id = auth.uid()       -- the owner
        or exists (                      -- any collaborator, regardless of role
          select 1 from tree_collaborators c
          where c.tree_id = t.id
            and c.user_id = auth.uid()
        )
      )
  );
$$;

-- Returns true if the current user may WRITE the given tree.
create or replace function can_write_tree(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from trees t
    where t.id = tid
      and (
        t.owner_id = auth.uid()          -- the owner
        or exists (                      -- a collaborator, but only editor/owner (not viewer)
          select 1 from tree_collaborators c
          where c.tree_id = t.id
            and c.user_id = auth.uid()
            and c.role in ('editor', 'owner')
        )
      )
  );
$$;


-- Turn RLS on for every table. With RLS enabled and no matching policy, access
-- is denied by default — so the policies below are the ONLY way in.
alter table trees              enable row level security;
alter table tree_collaborators enable row level security;
alter table persons            enable row level security;
alter table relationships      enable row level security;
alter table factions           enable row level security;
alter table scenarios          enable row level security;
alter table images             enable row level security;
alter table settings           enable row level security;


-- ── trees ───────────────────────────────────────────────────────────────────

-- READ a tree row: public, or you own it, or you collaborate on it. (We inline
-- the check here rather than calling can_read_tree(id) — it's the same logic,
-- and keeping it inline documents the rule at the table it protects.)
create policy trees_select on trees
  for select
  using (
    visibility = 'public'
    or owner_id = auth.uid()
    or exists (
      select 1 from tree_collaborators c
      where c.tree_id = trees.id and c.user_id = auth.uid()
    )
  );

-- CREATE a tree: you may only insert a tree you own (owner_id must be yourself).
create policy trees_insert on trees
  for insert
  with check (owner_id = auth.uid());

-- UPDATE a tree row: owner or editor/owner collaborator (the write rule). The
-- WITH CHECK re-applies it to the NEW row so an editor can't hand the tree to
-- someone else. (Consider tightening this to owner-only if you don't want
-- collaborators renaming or re-sharing the tree.)
create policy trees_update on trees
  for update
  using (can_write_tree(id))
  with check (can_write_tree(id));

-- DELETE a tree: only the owner. Dropping an entire tree (and cascading away
-- all its people, edges, and images) is deliberately an owner-only action,
-- stricter than the general write rule.
create policy trees_delete on trees
  for delete
  using (owner_id = auth.uid());


-- ── tree_collaborators ────────────────────────────────────────────────────────
-- This table is both the sharing list AND an input to the rules above, so its
-- own policies are written directly against trees (via the helpers) to stay
-- consistent.

-- READ the collaborator list: anyone who can read the tree, plus a user can
-- always see their own membership row.
create policy tree_collaborators_select on tree_collaborators
  for select
  using (
    can_read_tree(tree_id)
    or user_id = auth.uid()
  );

-- ADD / CHANGE / REMOVE collaborators: writers of the tree (owner or
-- editor/owner collaborator). If you want only owners to manage sharing,
-- swap can_write_tree(tree_id) for an owner_id = auth.uid() check on the tree.
create policy tree_collaborators_insert on tree_collaborators
  for insert
  with check (can_write_tree(tree_id));

create policy tree_collaborators_update on tree_collaborators
  for update
  using (can_write_tree(tree_id))
  with check (can_write_tree(tree_id));

create policy tree_collaborators_delete on tree_collaborators
  for delete
  using (can_write_tree(tree_id));


-- ── Content tables ────────────────────────────────────────────────────────────
-- persons, relationships, factions, scenarios, images, and settings all follow
-- the exact same pattern: readable if you can read the parent tree, writable if
-- you can write it. WITH CHECK on insert/update stops a writer from moving a row
-- into (or out of) a tree they can't write.

-- persons
create policy persons_select on persons for select using (can_read_tree(tree_id));
create policy persons_insert on persons for insert with check (can_write_tree(tree_id));
create policy persons_update on persons for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy persons_delete on persons for delete using (can_write_tree(tree_id));

-- relationships
create policy relationships_select on relationships for select using (can_read_tree(tree_id));
create policy relationships_insert on relationships for insert with check (can_write_tree(tree_id));
create policy relationships_update on relationships for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy relationships_delete on relationships for delete using (can_write_tree(tree_id));

-- factions
create policy factions_select on factions for select using (can_read_tree(tree_id));
create policy factions_insert on factions for insert with check (can_write_tree(tree_id));
create policy factions_update on factions for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy factions_delete on factions for delete using (can_write_tree(tree_id));

-- scenarios
create policy scenarios_select on scenarios for select using (can_read_tree(tree_id));
create policy scenarios_insert on scenarios for insert with check (can_write_tree(tree_id));
create policy scenarios_update on scenarios for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy scenarios_delete on scenarios for delete using (can_write_tree(tree_id));

-- images
create policy images_select on images for select using (can_read_tree(tree_id));
create policy images_insert on images for insert with check (can_write_tree(tree_id));
create policy images_update on images for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy images_delete on images for delete using (can_write_tree(tree_id));

-- settings
create policy settings_select on settings for select using (can_read_tree(tree_id));
create policy settings_insert on settings for insert with check (can_write_tree(tree_id));
create policy settings_update on settings for update using (can_write_tree(tree_id)) with check (can_write_tree(tree_id));
create policy settings_delete on settings for delete using (can_write_tree(tree_id));


-- ============================================================================
-- Accounts: profiles, plan limits, and quota enforcement
-- ============================================================================
--
-- Supabase Auth owns the login row (auth.users), but we can't add app columns
-- there. `profiles` is the standard companion table: one row per user, created
-- automatically at sign-up, holding app-level fields — here just which `plan`
-- the user is on. `plan_limits` is a tiny lookup table of the per-plan caps.
--
-- The whole point of splitting caps into their own table: adding a paid tier is
-- ONE INSERT into plan_limits (and moving a user's profiles.plan to it) — the
-- enforcement triggers read their numbers from that table, so there is NO code
-- or trigger change to support a new plan.
-- ============================================================================

-- ── plan_limits ───────────────────────────────────────────────────────────────
-- Per-plan caps, keyed by plan name. The 'free' row's numbers come straight
-- from PLAN_LIMITS in src/shared/auth.ts (maxProjects/maxPersons/maxImages).
-- Every limit is counted PER USER (across all of that user's trees), matching
-- how the app's usageOf() tallies them today.
create table plan_limits (
  plan         text primary key,          -- 'free', and later 'pro', etc.
  max_trees    integer not null,          -- app's maxProjects (a "tree" == a "project")
  max_persons  integer not null,          -- app's maxPersons
  max_images   integer not null           -- app's maxImages (photos)
);

-- Seed the free tier. To add a paid tier later, just add another row here, e.g.
--   insert into plan_limits values ('pro', 1000, 1000000, 100000);
insert into plan_limits (plan, max_trees, max_persons, max_images)
values ('free', 10, 2500, 300);


-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth user. Deleting the auth user deletes their profile. `plan`
-- defaults to 'free' and is FK-checked against plan_limits, so a profile can
-- never point at a plan that has no defined caps.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  plan        text not null default 'free' references plan_limits (plan),
  created_at  timestamptz not null default now()
);


-- ── Auto-create a profile when a user signs up ────────────────────────────────
-- Trigger on auth.users: every new account gets a matching profiles row (on the
-- default 'free' plan). SECURITY DEFINER so it can write to public.profiles even
-- though the sign-up itself runs with no app privileges; ON CONFLICT keeps it
-- safe if a row somehow already exists.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ── Quota enforcement (BEFORE INSERT triggers) ────────────────────────────────
-- Each trigger looks up the owner's cap from plan_limits (via their profile),
-- counts what they already have, and raises a clear error if the new row would
-- exceed the cap. Reading the number from plan_limits is what makes a new paid
-- tier a data-only change. A NULL limit (no profile / unknown plan — e.g. a
-- system or seed insert) means "don't enforce", so these never block setup.

-- trees: capped per owner (owner_id lives right on the row).
create or replace function enforce_tree_limit()
returns trigger
language plpgsql
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select pl.max_trees into v_limit
  from profiles p
  join plan_limits pl on pl.plan = p.plan
  where p.id = new.owner_id;

  if v_limit is null then
    return new;                       -- no plan on record → skip enforcement
  end if;

  select count(*) into v_count from trees where owner_id = new.owner_id;

  if v_count >= v_limit then
    raise exception 'Plan limit reached: your plan allows at most % trees', v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trees_enforce_limit
  before insert on trees
  for each row execute function enforce_tree_limit();


-- persons: capped per owner, counted across ALL of that owner's trees. We reach
-- the owner through the person's tree (persons.tree_id → trees.owner_id).
create or replace function enforce_person_limit()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
  v_limit integer;
  v_count integer;
begin
  select owner_id into v_owner from trees where id = new.tree_id;

  select pl.max_persons into v_limit
  from profiles p
  join plan_limits pl on pl.plan = p.plan
  where p.id = v_owner;

  if v_limit is null then
    return new;
  end if;

  -- Count this owner's people in every tree they own (per-user quota).
  select count(*) into v_count
  from persons ps
  join trees t on t.id = ps.tree_id
  where t.owner_id = v_owner;

  if v_count >= v_limit then
    raise exception 'Plan limit reached: your plan allows at most % people', v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger persons_enforce_limit
  before insert on persons
  for each row execute function enforce_person_limit();


-- images: capped per owner, counted across ALL of that owner's trees (same
-- shape as persons — reach the owner via images.tree_id → trees.owner_id).
create or replace function enforce_image_limit()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
  v_limit integer;
  v_count integer;
begin
  select owner_id into v_owner from trees where id = new.tree_id;

  select pl.max_images into v_limit
  from profiles p
  join plan_limits pl on pl.plan = p.plan
  where p.id = v_owner;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from images im
  join trees t on t.id = im.tree_id
  where t.owner_id = v_owner;

  if v_count >= v_limit then
    raise exception 'Plan limit reached: your plan allows at most % photos', v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger images_enforce_limit
  before insert on images
  for each row execute function enforce_image_limit();


-- ── RLS for the two new tables (keeps the "RLS on every table" invariant) ─────
alter table profiles    enable row level security;
alter table plan_limits enable row level security;

-- profiles: a user may read and update only their own row. (Inserts happen via
-- the SECURITY DEFINER sign-up trigger, which bypasses RLS, so no insert policy
-- is needed. Changing your own `plan` is allowed here — lock this down to a
-- server-side/service-role flow once billing exists.)
create policy profiles_select on profiles
  for select using (id = auth.uid());
create policy profiles_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- plan_limits: reference data — readable by everyone, writable by no one
-- (manage tiers with the service role / SQL editor, which bypasses RLS).
create policy plan_limits_select on plan_limits
  for select using (true);


-- ============================================================================
-- Trait system + relationship-type registry
-- ============================================================================
-- Added after the original schema. Stored as `doc` JSONB (the whole entity)
-- because they're app-internal registries the shared trait logic reads/writes
-- whole, never column-by-column. Also lives in supabase/add_trait_tables.sql as
-- a standalone migration for databases created before this section existed.

-- Per-project trait DEFINITIONS (FieldDef): what traits a tree has + their slots.
create table field_defs (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references trees (id) on delete cascade,
  doc         jsonb not null,
  created_at  timestamptz not null default now()
);
create index field_defs_tree_id_idx on field_defs (tree_id);

-- Per-person trait VALUES (FieldValue). Cascades with both its tree and person.
create table field_values (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references trees (id)   on delete cascade,
  person_id   uuid not null references persons (id) on delete cascade,
  doc         jsonb not null,
  created_at  timestamptz not null default now()
);
create index field_values_tree_id_idx   on field_values (tree_id);
create index field_values_person_id_idx on field_values (person_id);

-- Per-project relationship-type registry (RelationshipTypeDef). `key` is the
-- slug Relationship.type points at.
create table rel_type_defs (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references trees (id) on delete cascade,
  key         text not null,
  doc         jsonb not null,
  created_at  timestamptz not null default now()
);
create index rel_type_defs_tree_id_idx on rel_type_defs (tree_id);

-- RLS: read if you can read the tree, write if you can write it.
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
