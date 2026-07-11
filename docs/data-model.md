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
  "scenarios":      { "<scenarioId>": { /* Scenario */ } },
  "images":         { "<imageId>": { /* Image */ } },
  "settings":       { "<treeId>:<key>": "<value>" },   // per-tree
  "globalSettings": { "theme": "dark" }                // app-wide
}
```

Every collection is keyed by ID (an object map, not an array). All IDs are v4 UUIDs
generated with Node's `crypto.randomUUID()`. Timestamps are stored as
`"YYYY-MM-DD HH:MM:SS"` strings (`nowStr()`), in local time.

## Entity relationships at a glance

```mermaid
erDiagram
    TREE ||--o{ PERSON : "scopes"
    TREE ||--o{ RELATIONSHIP : "scopes"
    TREE ||--o{ SCENARIO : "scopes"
    TREE ||--o{ IMAGE : "scopes"
    TREE ||--o{ SETTING : "scopes"
    PERSON ||--o{ IMAGE : "has photos"
    PERSON ||--o{ RELATIONSHIP : "person_a / person_b"
    SCENARIO ||--o{ FACTION : "owns"
    FACTION }o--o{ PERSON : "member_ids (many-to-many)"

    TREE {
        string id PK
        string name
    }
    PERSON {
        string id PK
        string tree_id FK
        string name
        number birth_year
        number death_year
        string gender
    }
    RELATIONSHIP {
        string id PK
        string tree_id FK
        string person_a_id FK
        string person_b_id FK
        string type
        string status
    }
    SCENARIO {
        string id PK
        string tree_id FK
        string name
    }
    FACTION {
        string id PK
        string tree_id FK
        string scenario_id FK
        string_array member_ids
    }
    IMAGE {
        string id PK
        string person_id FK
        string file_path
        boolean is_primary
    }
```

Everything hangs off **Tree** — it's the scoping root. A `FACTION` is the only
many-to-many join (a person can be in many factions; a faction holds many people), and
it's stored as a plain `member_ids` array rather than a join table.

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

**Cascade map** — what each delete takes down with it:

```mermaid
flowchart LR
    delTree["🗑️ delete TREE"] --> persons & rels & scenarios2["scenarios"] & images2["images (+files)"] & settings2["settings"]
    delPerson["🗑️ delete PERSON"] --> pRels["its relationships"] & pImgs["its images (+files)"] & pMem["removed from all member_ids"]
    delScenario["🗑️ delete SCENARIO"] --> sFactions["its factions"]
    delScenario -. "people untouched" .-> nothing1["∅"]
    delFaction["🗑️ delete FACTION"] -. "people untouched" .-> nothing2["∅"]

    style delTree fill:#c0392b,color:#fff
    style delPerson fill:#c0392b,color:#fff
    style delScenario fill:#e67e22,color:#fff
    style delFaction fill:#e67e22,color:#fff
```

Deleting a **faction** or a **scenario** never deletes people — it only removes the
grouping. Deleting a **person** or a **tree** is the destructive direction.

### Faction

A user-defined group shown in the **Factions** view — a family, company, school,
house, elemental affinity, or any other camp. Membership is a plain ID list on the
faction (people may belong to any number of factions). Every faction belongs to a
**scenario**; the view shows one scenario at a time.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | |
| `tree_id` | string | |
| `scenario_id` | string | Owning scenario. |
| `name` | string | Defaults to `"New Faction"`. Same-name factions in different scenarios are treated as "the same faction" when animating scenario switches. |
| `description` | string | Free text shown as a tooltip in the manager panel. |
| `color` | string | Hex color; drives the zone ring and membership arcs. |
| `icon` | string | Emoji shown in the zone header. |
| `member_ids` | string[] | Person IDs belonging to the faction. |
| `x` / `y` | number | Zone centre in the Factions view's world space. |
| `visible` | boolean | Hidden factions don't render or attract members. |
| `created_at` / `updated_at` | string | |

### Scenario

A named configuration of factions in the **Factions** view. Scenarios share the
tree's people but each holds its own faction set (e.g. "By family" vs. "By
company"). Deleting a scenario cascades its factions; people are untouched. The
per-tree setting `activeScenarioId` remembers which scenario is open.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | |
| `tree_id` | string | |
| `name` | string | Defaults to `"New Scenario"`. |
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

`initDB()` runs on every load and brings any older file up to the current shape:

```mermaid
flowchart TD
    load(["load familytree.json"]) --> ensure["1 · backfill any missing<br/>top-level collections"]
    ensure --> q1{"activeTreeId<br/>or trees exist?"}
    q1 -->|no| mig["2 · single-tree → multi-tree:<br/>create default tree, tag old<br/>persons/rels/images, move theme<br/>to globalSettings, re-scope settings"]
    q1 -->|yes| q2
    mig --> q2{"factions without<br/>scenario_id?"}
    q2 -->|yes| adopt["3 · adopt them into a<br/>default “Scenario 1” per tree"]
    q2 -->|no| q3
    adopt --> q3{"any data at all?"}
    q3 -->|no| seed["4 · seed sample Anderson family<br/>(6 persons, 8 relationships)"]
    q3 -->|yes| done
    seed --> done(["5 · ensure activeTreeId is valid"])
```

In prose, `initDB()` is idempotent and self-migrating. On load it:

1. Ensures every top-level collection exists (backfills empty objects).
2. **Single-tree → multi-tree migration:** if there is no `activeTreeId` and no
   trees, it creates a default tree, tags any pre-existing persons/relationships/
   images with the new `tree_id`, migrates the old flat `theme` setting into
   `globalSettings`, and re-scopes remaining settings under the `"<treeId>:"` prefix.
3. **Scenario adoption:** factions created before scenarios existed (no
   `scenario_id`) are adopted into a default `"Scenario 1"` created per tree.
4. **First-run seeding:** a fresh install with no data seeds a sample three-
   generation Anderson family (6 persons, 8 relationships) so the graph is not empty.
5. Falls back to the first available tree if `activeTreeId` is missing.

These paths are covered by [`tests/db.test.js`](../tests/db.test.js) — see
[developer.md](./developer.md#testing).

## Data integrity

The store does not enforce referential integrity at write time; the
**Relationships** view surfaces problems instead (self-links, orphaned references,
duplicates, conflicting pairs, temporal inconsistencies, more than two parents). This
keeps the write path simple and lets users fix imported or hand-edited data
interactively.
