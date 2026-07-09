# Data model

All application data is stored in a single JSON file, `familytree.json`, under
Electron's `userData` directory. The main process reads it once at startup into an
in-memory object and rewrites the whole file on every mutation. See
[`db.js`](../src/main/db.js).

## Top-level shape

```jsonc
{
  "trees":          { "<treeId>": { /* Tree */ } },
  "activeTreeId":   "<treeId> | null",
  "persons":        { "<personId>": { /* Person */ } },
  "relationships":  { "<relId>":   { /* Relationship */ } },
  "factions":       { "<factionId>": { /* Faction */ } },
  "images":         { "<imageId>": { /* Image */ } },
  "settings":       { "<treeId>:<key>": "<value>" },   // per-tree
  "globalSettings": { "theme": "dark" }                // app-wide
}
```

Every collection is keyed by ID (an object map, not an array). All IDs are v4 UUIDs
generated with Node's `crypto.randomUUID()`. Timestamps are stored as
`"YYYY-MM-DD HH:MM:SS"` strings (`nowStr()`), in local time.

## Entities

### Tree

A named family tree. The app supports multiple trees; each is shown as a tab in the
top bar, and all persons/relationships/images/settings are scoped to one tree.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | |
| `name` | string | Defaults to `"Unnamed Family Tree"`. |
| `created_at` | string | |
| `updated_at` | string | Bumped on rename. |

### Person

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | |
| `tree_id` | string | Owning tree. |
| `name` | string | Full name; the UI splits first/last on whitespace. |
| `birth_year` | number \| null | |
| `death_year` | number \| null | |
| `gender` | `"male"` \| `"female"` \| `"unknown"` | Drives node color. |
| `bio` | string | |
| `occupation` | string | |
| `location` | string | |
| `created_at` / `updated_at` | string | |

`persons:getAll` enriches each row with a computed `primary_image` (the file path of
the person's primary image, or `null`) — this field is **not** persisted, it is
derived from the `images` collection on read.

### Relationship

An undirected-ish edge between two persons. Direction matters for `parent_child` and
`adopted` (A is the parent/adopter of B); for `spouse` the order is not meaningful.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | |
| `tree_id` | string | |
| `person_a_id` | string | For `parent_child`/`adopted`: the **parent**. |
| `person_b_id` | string | For `parent_child`/`adopted`: the **child**. |
| `type` | `"parent_child"` \| `"spouse"` \| `"adopted"` | |
| `status` | `"active"` \| `"divorced"` | Meaningful for `spouse`. |
| `formed_date` | number \| null | Marriage / relationship start year. |
| `created_at` | string | |

Deleting a person cascades: all relationships referencing it and all its images
(files included) are removed, and the person is dropped from every faction's
`member_ids`.

### Faction

A user-defined group shown in the **Factions** view — a family, company, school,
house, elemental affinity, or any other camp. Membership is a plain ID list on the
faction (people may belong to any number of factions).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | |
| `tree_id` | string | |
| `name` | string | Defaults to `"New Faction"`. |
| `description` | string | Free text shown as a tooltip in the manager panel. |
| `color` | string | Hex color; drives the zone ring and membership arcs. |
| `icon` | string | Emoji shown in the zone header. |
| `member_ids` | string[] | Person IDs belonging to the faction. |
| `x` / `y` | number | Zone centre in the Factions view's world space. |
| `visible` | boolean | Hidden factions don't render or attract members. |
| `created_at` / `updated_at` | string | |

### Image

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | |
| `tree_id` | string | |
| `person_id` | string | Owning person. |
| `file_path` | string | Absolute path inside `userData/images/`. |
| `is_primary` | boolean | At most one primary per person. |
| `created_at` | string | |

On `images:add`, the source file selected by the user is **copied** into
`userData/images/<uuid><ext>` — the original is never referenced. Setting a new
primary clears the flag on the person's other images. Deleting an image unlinks the
file from disk.

### Settings

Two distinct scopes:

- **`settings`** — per-tree, keyed by `"<treeId>:<key>"`. Notable keys:
  - `graphState` — the serialized graph layout (modes, states, node positions,
    generation rows). See [graph.md](./graph.md#persistence).
  - `graph_<name>` — individual graph appearance settings.
- **`globalSettings`** — app-wide. Currently just `theme` (`"dark"` / `"light"`).

## Migrations

`initDB()` is idempotent and self-migrating. On load it:

1. Ensures every top-level collection exists (backfills empty objects).
2. **Single-tree → multi-tree migration:** if there is no `activeTreeId` and no
   trees, it creates a default tree, tags any pre-existing persons/relationships/
   images with the new `tree_id`, migrates the old flat `theme` setting into
   `globalSettings`, and re-scopes remaining settings under the `"<treeId>:"` prefix.
3. **First-run seeding:** a fresh install with no data seeds a sample three-
   generation Anderson family (6 persons, 8 relationships) so the graph is not empty.
4. Falls back to the first available tree if `activeTreeId` is missing.

These paths are covered by [`tests/db.test.js`](../tests/db.test.js) — see
[developer.md](./developer.md#testing).

## Data integrity

The store does not enforce referential integrity at write time; the
**Relationships** view surfaces problems instead (self-links, orphaned references,
duplicates, conflicting pairs, temporal inconsistencies, more than two parents). This
keeps the write path simple and lets users fix imported or hand-edited data
interactively.
