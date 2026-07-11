# TEMP · Client-side overhaul plan (for review)

> **Status: proposal, not implemented.** No code or other docs have been changed. Read,
> argue with, and edit this first. When you're happy, we fold the accepted parts into
> [`client-structure.md`](./client-structure.md) and implement in slices.
> Tags: 🟢 **Recommended** · 🟡 **Alternative** · ❓ **Your call**.

---

# 📌 Summary (read this first)

The whole plan in one screen. Details are in the numbered sections below.

### The big picture

```mermaid
flowchart LR
    P["🗂️ PROJECT<br/>(was 'tree')"] --> E["◈ ENTITIES<br/>people · creatures · objects…"]
    P --> R["🔗 Relationships"]
    P --> T["🏷️ Tags<br/>(identity + members)"]
    P --> SC["🎬 Scenes<br/>(saved arrangements)"]
    P --> CAL["📅 Calendar<br/>(date system)"]
    T -. "shown & placed in" .-> SC
    MODE["🎚️ PROGRAM MODE<br/>Simple · Default · Advanced"] -. "gates which features appear" .-> P
    style P fill:#8b6cc5,color:#fff
    style MODE fill:#c95fa0,color:#fff
    style CAL fill:#4db6ac,color:#000
```

### Rename cheat-sheet

| Kind | Now | 🟢 New name |
|------|-----|-------------|
| Container / tab | Tree | **Project** |
| The node-link view | Tree View | **Graph** *(alt: Web / Constellation / Nexus)* |
| The browse-grid view | All People | **People** — but the label follows a per-project **entity noun** (People / Characters / Creatures / Items) |
| The clustering view | Factions | **Groups** ✓ |
| Table view | Relationships | **Relationships** *(alt: Table)* |
| Timeline view | Timeline | **Timeline** ✓ |
| A group of members | Faction | **Tag** *(shown as a **Group** bubble)* |
| A saved arrangement | Scenario **and** State | **Scene** *(one word for both)* |
| Graph layout algorithm | mode (Custom/Auto/Age/Gen) | **type** → **Free · Organic · Birth · Generations** |
| App feature tier | *(none)* | **Mode** → **Simple · Default · Advanced** |
| Emphasis panel | Highlights | **Focus** |
| Visual styling panel | Graph Settings | **Style** |
| Declutter toggle | Clean Tree | **Clean View** |
| "Now" reference | Current Date / "as-of year" | **Present** |
| Save button | Save Layout | *removed* → autosave + **Save**/**Revert** in Project menu |

### Four new concepts your feedback introduced

```mermaid
flowchart TB
    subgraph NEW["🆕 New concepts"]
        M["🎚️ Program Modes<br/>Simple / Default / Advanced<br/>— feature tiers for the whole app"]
        C["📅 Custom Calendars<br/>define your own date system<br/>(20 gex/year, etc.) — Advanced only"]
        D["🗂️ People Drawer (Roster)<br/>collapsible, summonable in ANY view;<br/>drag entities onto the canvas"]
        S["💾 Autosave + Checkpoint<br/>always autosaves; manual Save + Revert;<br/>exit asks to discard unsaved changes"]
    end
```

### The three orthogonal concepts that were tangled before

```mermaid
flowchart LR
    subgraph one["1 · PROGRAM MODE (app-wide)"]
        m1[Simple] ~~~ m2[Default] ~~~ m3[Advanced]
    end
    subgraph two["2 · VIEW (the lens)"]
        v1[Graph] ~~~ v2[Timeline] ~~~ v3[Groups] ~~~ v4[People] ~~~ v5[Relationships]
    end
    subgraph three["3 · SCENE (saved arrangement) — with a layout TYPE for Graph"]
        s1["Scene 'Reunion' · type Free"] ~~~ s2["Scene 'Pedigree' · type Generations"]
    end
    one --> two --> three
```

### What changed since the last draft (your feedback)
- ✅ Keep a **manual Save** + **Revert** + exit prompt (not autosave-only).
- ✅ "By Age" → **Birth**; "Present/Zen" → **Clean View**.
- ✅ New **Program Modes** (Simple/Default/Advanced); tree "modes" → **types**.
- ✅ "Tree" view → **Graph** (it's a graph, not a tree).
- ✅ **Custom calendars** + rename the "now" marker to **Present**.
- ✅ Drag-and-drop works in **every** view via a **People Drawer**; scenes draw only *placed* entities.
- ✅ **Faction → Group** confirmed.
- ✅ "All People" → **dynamic entity noun** (entities aren't always people).

---
---

# Full detail

## 1. The naming overhaul

### 1.1 Why the old names hurt

Three *independent* things were sharing loose words:

- **"View"** meant a lens (Tree/Timeline/…) — fine.
- **"Mode"** meant a graph layout algorithm — but you now want "mode" for the *app-wide*
  Simple/Default/Advanced tiers.
- **A saved arrangement** was called a *state* in the graph but a *scenario* in factions —
  two words, one idea.

The fix gives each concept exactly one word (see the orthogonal diagram in the summary):

| Concept | 🟢 Word | Scope |
|---------|---------|-------|
| Feature tier | **Mode** | whole app (Simple/Default/Advanced) |
| Lens | **View** | Graph / Timeline / Groups / People / Relationships |
| Saved arrangement | **Scene** | inside a spatial view (was state + scenario) |
| Graph layout algorithm | **Type** | inside a Graph scene (Free/Organic/Birth/Generations) |

### 1.2 The Graph view (was "Tree")

You're right: a family tree with remarriage, adoption, and non-family links is a **graph**,
not a tree. 🟢 **Recommended: "Graph"** — honest, neutral, works for people/creatures/objects.

🟡 **Branded alternatives** if you want something with more personality:

| Name | Feel | Caution |
|------|------|---------|
| **Web** | approachable, "web of relations" | reads oddly next to the *web build* in dev docs (not user-facing though) |
| **Constellation** | signature, evocative (nodes = stars) | whimsical for genealogists |
| **Nexus** | short, "connection" | slightly sci-fi |
| **Network / Map** | clear | "Map" clashes with the planned geographic **Map view** |

❓ Pick one. I'll assume **Graph** below.

### 1.3 The browse view (was "All People")

Entities aren't always people — creatures, objects, inventions (an "invention tree").
🟢 **Recommended: a per-project *entity noun*.** One setting decides what the app calls its
nodes, and the view label + node labels + buttons all follow it:

```mermaid
flowchart LR
    N["Project setting:<br/>entity noun"] --> A["family → 'Person' → view 'People'"]
    N --> B["novel → 'Character' → view 'Characters'"]
    N --> C["bestiary → 'Creature' → view 'Creatures'"]
    N --> D["tech tree → 'Invention' → view 'Inventions'"]
    style N fill:#8b6cc5,color:#fff
```

- **Default noun = "Person" → view "People"** (so nothing feels foreign for the common case).
- 🟡 If you'd rather not do dynamic labels yet, a static neutral name works: **"Directory"**
  (or "Roster" / "Cast" / "Catalog").
- Internally the data stays `persons` for now — this is a *display* noun, not a data rename.

### 1.4 Graph layout **types** (was "modes")

| Now | Icon | 🟢 New | Why |
|-----|------|--------|-----|
| Custom | ✋ | **Free** | you place nodes anywhere |
| Auto | ⚡ | **Organic** | physics/force clustering |
| Age | 📅 | **Birth** | positioned by birth date (one word, per your note) |
| Gen | 🏛 | **Generations** | top-down family hierarchy |

Reads as: *Layout type: **Free · Organic · Birth · Generations***. 🟡 "Birth" alternatives:
*Era / Chronology / Lifespan*.

### 1.5 Panels & controls

| Now | 🟢 New | Why |
|-----|--------|-----|
| Highlights | **Focus** | non-destructive emphasis on a subset |
| Legend | **Legend** (keep, collapsible) | universal |
| Graph Settings | **Style** | purely visual styling |
| Clean Tree | **Clean View** | declutters the current view; "Clean Scene" would collide with Scene |
| Current Date / "as-of year" | **Present** | the date the app treats as "now" (see §5, works with custom calendars) |
| Save Layout | **Save** (in Project ▾) | see the save model in §4.3 |

---

## 2. The tag system

### 2.1 Person owns tags, or tags own persons? → **Neither. A join owns it.**

It's **many-to-many**; the moment one side owns the other, the reverse lookup gets slow and
the future Postgres migration gets painful. Store membership as its own join and build fast
lookups **both** ways in memory.

```mermaid
erDiagram
    ENTITY  ||--o{ ENTITY_TAG : ""
    TAG     ||--o{ ENTITY_TAG : ""
    ENTITY_TAG { string entity_id FK  string tag_id FK }
    ENTITY { string id PK  string name }
    TAG { string id PK  string label  string type  string source  string color  string icon }
```

On load, build two `Map`s — `tagsOf[entityId]` and `membersOf[tagId]` — so *"what tags does
this node have?"* (node emblems, cards) and *"who's in this tag?"* (Groups view) are both O(1).

| Approach | tags-of-entity | members-of-tag | → Postgres | per-link data later |
|----------|:---:|:---:|:---:|:---:|
| array on entity | ✅ | ❌ scan all | ⚠️ | ❌ |
| array on tag *(today's factions)* | ❌ scan all | ✅ | ⚠️ | ❌ |
| 🟢 **join `entity_tags`** | ✅ | ✅ | ✅ 1:1 table | ✅ ("since", "canon"…) |

The join is the exact shape Supabase/Postgres wants (`entity_tags(entity_id, tag_id)` with an
index on each column) — **client model = future DB model**, no rewrite. See
[MID_DEVELOPMENT.md §5](./MID_DEVELOPMENT.md).

### 2.2 Two kinds of tags — one is free

```mermaid
flowchart TB
    T["🏷️ Tag"] --> M["MANUAL — user assigns → stored in join"]
    T --> D["DERIVED (smart) — computed from a field, NOT stored<br/>e.g. everyone with occupation='Engineer'"]
    style D fill:#4db6ac,color:#000
```

Occupation, location, birth date already live on each entity, so "common preexisting tags"
(location / occupation / decade / school) can be **derived** — zero storage, self-updating.
Manual tags (House Stark, Team Fire, Villains) use the join. A `tag.source` field splits them.
🟢 Ship **manual + join** first; derived tags as a fast follow (mostly a store getter).

### 2.3 A faction is just a tag with a place on screen

Split the two jobs a faction currently mashes together:

| Job | Today (Faction) | 🟢 New |
|-----|-----------------|--------|
| *who belongs* | `member_ids`, **copied per scenario** | **Tag** (one member set, shared everywhere) |
| *where it sits / shown* | `x`,`y`,`visible`,`scenario_id` | **Scene placement** (§3) |

---

## 3. Groups, Scenes & the faction/scenario question

### 3.1 The problem: factions are trapped in a scenario

```mermaid
flowchart TD
    subgraph TODAY["❌ Today"]
        Sc1["Scenario: By family"] --> Fa["Faction 'Starks' (member copy A)"]
        Sc2["Scenario: Allegiance"] --> Fb["Faction 'Starks' (member copy B)"]
    end
```

### 3.2 The fix: tags are global, scenes reference & place them

```mermaid
flowchart TD
    subgraph NEW["✅ Proposed"]
        Tag["🏷️ Tag 'Starks' — ONE member set"]
        Sc1["🎬 Scene: By family"] -->|places at x,y| Tag
        Sc2["🎬 Scene: Allegiance"] -->|places same tag| Tag
        Sc3["🎬 Scene: Heroes vs Villains"] -.->|may ignore it| Tag
    end
    style Tag fill:#f5a623,color:#000
```

A **Group** is a tag placed in a scene. "Move a faction between scenarios" becomes trivial —
you add the tag to another scene; **membership never moves** because it lives on the tag.

### 3.3 Do factions & scenarios still exist?

| Concept | Verdict | Becomes |
|---------|---------|---------|
| **Faction** | dissolves | **Tag** + **scene placement**; UI word is **Group** |
| **Scenario** | survives, renamed | **Scene** — the same idea as a graph "state" (§4) |

Your instinct — *"scenarios are just different visualizations of combinations of tags"* — is
exactly what a Groups scene is: pick tags, arrange them, save as a Scene.

---

## 4. One unified **Scene** + the save model

### 4.1 State + Scenario + (future) timeline positions = **Scene**

```mermaid
flowchart TB
    Scene["🎬 SCENE (project + view + name)"]
    Scene --> GSc["Graph scene<br/>· layout TYPE (Free/Organic/Birth/Generations)<br/>· positions of PLACED entities<br/>· focus + style overrides"]
    Scene --> TSc["Timeline scene<br/>· lane order + manual position overrides<br/>· time/width zoom"]
    Scene --> GrSc["Groups scene (old 'scenario')<br/>· which TAGS are shown + each tag's x/y/visible"]
    style Scene fill:#6c8ef5,color:#fff
```

The graph "mode" becomes a **type** *inside* a scene, so instead of "4 modes × N states each"
you get a flat list of scenes, each with its own type:

```
BEFORE: Graph ─ mode(custom) ─ state1,2 ; mode(auto) ─ state1 ; …   (nested)
AFTER:  Graph ─ Scene "Reunion" (Free) ; Scene "Pedigree" (Generations) ; …   (flat)
```

### 4.2 Scenes draw only **placed** entities (fixes "everyone shows up")

You noted the Graph/Timeline showing *every* entity is wrong. 🟢 A scene stores positions for
the entities you've **placed**; unplaced entities aren't drawn. You add them by dragging from
the **People Drawer** (§6.3). Removing an entity from a scene never deletes it from the project.

```mermaid
flowchart LR
    Roster["🗂️ People Drawer<br/>(all entities)"] -->|drag onto canvas| Placed["entities placed in this scene"]
    Placed -->|remove from scene| Roster
    Placed -->|delete entity| Gone["deleted from project (with confirm)"]
    style Gone fill:#c0392b,color:#fff
```

### 4.3 Save model — autosave **and** manual save (your requirement)

You want autosave *and* the ability to discard all unsaved changes. So we keep two layers,
like a document with autosave + explicit Save/Revert:

```mermaid
flowchart TB
    edit["✏️ every edit"] -->|debounced| draft["💾 WORKING COPY (autosaved)<br/>survives crashes / reloads"]
    draft -->|manual 'Save'| ckpt["📌 SAVED CHECKPOINT"]
    ckpt -->|'Revert to saved'| draft
    exit{"user exits & working ≠ checkpoint?"} -->|yes| ask["ask: Save / Discard / Cancel"]
    style draft fill:#f5a623,color:#000
    style ckpt fill:#4db6ac,color:#000
```

- **Autosave** → nothing is ever lost to a crash (writes to the working copy).
- **Save** (in **Project ▾** menu, ⌘S) → commits a checkpoint you can return to.
- **Revert to saved** → discards everything since the last Save.
- **On exit**, if the working copy differs from the checkpoint → *Save / Discard / Cancel*.
- The on-canvas **Save Layout** button and the pulsing dirty badge go away; the safety net moves
  into the menu + the exit prompt.

---

## 5. Custom calendars & the **Present**

### 5.1 Why

Real projects use Gregorian; fantasy projects may use wildly different systems ("20 months a
year, 100 days a month", extra cycles). Dates should also become **year-month-day**, not just a
year. So a project owns a **Calendar**, and every date is interpreted through it.

```mermaid
flowchart LR
    Cal["📅 Project CALENDAR"] --> Def["definition: ordered units<br/>largest → smallest, each with a name<br/>and how many of the next it holds"]
    Def --> Date["a DATE = components + precision<br/>e.g. {y:298, m:3, d:12} or year-only"]
    Date --> Ord["calendarMath.toOrdinal(date, cal) → one number"]
    Ord --> Use["used by Birth layout ordering<br/>+ Timeline spacing + age/alive math"]
    style Cal fill:#4db6ac,color:#000
```

### 5.2 Two calendar kinds

| Kind | Definition | Math |
|------|-----------|------|
| 🟢 **Gregorian (default)** | real months + leap years | handled specially (accurate) |
| **Custom (Advanced mode)** | **uniform** nested units (each unit = fixed N of the next) | simple positional math |

**Fantasy example** — *year ▸ 20 gex ▸ 100 days*:
`ordinal = (year × 20 + gex) × 100 + day` → total order for free, so Birth-type layout and the
Timeline "just work" with no special cases.

### 5.3 Design rules

- Dates support **partial precision** (year-only, year+month, full) — birth years are often all
  you know.
- Layout math stays **pure**: `calendarMath.toOrdinal / fromOrdinal / format / duration` live
  beside `layoutAge`/`timelineLayout` (matches the codebase's pure-math principle — see
  [graph.md](./graph.md)).
- Store the **components** + precision (not a raw ordinal), so redefining a calendar doesn't
  corrupt data; the ordinal is derived on demand.
- Custom-calendar editing is **Advanced-mode only** (§7); Simple/Default use Gregorian.

### 5.4 The "Present"

The old "Current Date"/"as-of year" is renamed **Present** — *the date the app treats as "now"*
for age and living/deceased calculations. It's a full date in the project's calendar (defaults
to the latest date in the data). 🟡 Alternatives: *Now / Vantage*.

---

## 6. Program **Modes** + the UI overhaul

### 6.1 Program Modes: Simple / Default / Advanced

A whole-app feature tier so different users get the right amount of tool. **This "Mode" is
unrelated to the graph layout "types."**

```mermaid
flowchart LR
    S["🟢 Simple<br/>bare minimum to build a<br/>good-looking graph + view it"]
    D["🔵 Default<br/>most features, all the<br/>central ones"]
    A["🟣 Advanced<br/>everything: rare, gimmick &<br/>experimental features"]
    S --> D --> A
    style S fill:#4db6ac,color:#000
    style D fill:#6c8ef5,color:#fff
    style A fill:#8b6cc5,color:#fff
```

| Feature | Simple | Default | Advanced |
|---------|:---:|:---:|:---:|
| Graph + People views | ✅ | ✅ | ✅ |
| Timeline / Groups / Relationships | — | ✅ | ✅ |
| Scenes (multiple saved arrangements) | 1 auto | ✅ | ✅ |
| Layout types | Organic only | all 4 | all 4 |
| Focus / Style panels | — | basic | full + physics sliders |
| Tags | — | manual | manual + derived + smart realign |
| Custom calendars | — | — | ✅ |
| Custom entity noun / relationship types | — | — | ✅ |

Implementation is just **progressive disclosure**: a higher mode reveals more rail items,
pill tools, and popovers — no separate UIs. 🟡 rename *Default → Standard* if you prefer.

### 6.2 Layout: icon rail + one tool pill + contextual inspector + summonable roster

**Today** (cluttered): 4+ floating panels on the canvas; the right sidebar permanently holds
the whole people list; settings live in 3 places.

**Proposed:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ ≡  Project ▾   Scene: Reunion ▾        🔍 ⌘K      Mode: Default ▾  ⚙  │ slim top
├──┬───────────────────────────────────────────────────┬───────────────┤
│◫ │  ‹ People Drawer (roster)  ┊                       │   INSPECTOR   │
│🕸│  slides over the canvas     ┊                       │  ┌─────────┐  │
│👥│  search + draggable list    ┊   ACTIVE VIEW         │  │ selected│  │
│🔗│  (summon in ANY view)       ┊                       │  │ entity  │  │
│📅│  ‹ collapse to a thin edge  ┊                       │  │ details │  │
│◈ │                             ┊                       │  │ +tags   │  │
│  │        ╭──────── bottom tool pill ─────────╮        │  │ +rels   │  │
│＋│        │ Type▾  ⊕ − ⊡   Focus▾   Legend    │        │  └─────────┘  │
│⚙ │        ╰──────────────────────────────────╯        │  [collapse ⟩] │
│  ├───────────────────────────────────────────────────┴───────────────┤
│  │  Scene tabs:  ▸Reunion  ▸Big picture  +                  (spatial)  │
└──┴────────────────────────────────────────────────────────────────────┘
   ↑ icon rail (~56px): views + roster toggle (◫) + add (＋) + settings (⚙)
```

| Element | From | 🟢 To |
|---------|------|------|
| View switching | left sidebar list | **icon rail** (always visible, tiny) |
| Canvas tools | 3 separate bars | **one bottom pill** (Type + zoom + Focus popover + Legend toggle) |
| Focus / Legend | always-open panels | **on-demand** popover / toggle |
| Scene switching | tree "states bar" + factions "scenario bar" | **one Scene tab strip** (spatial views) |
| Stats + data actions (Export/Import/**Save**/**Revert**) | left sidebar | **Project ▾** menu |
| Settings (theme + Style + Program Mode + Calendar) | 3 places | **one ⚙ Settings** (tabbed) + quick theme + Mode picker in top bar |
| Jump to any entity | per-view search boxes | **⌘K palette** (+ keep per-view filter) |

### 6.3 The right panel + the drag-and-drop problem

You want drag-and-drop of entities in **every** view (Graph, Timeline, Relationships, Groups),
*and* you don't want every entity auto-present. So we separate two jobs:

```mermaid
flowchart TD
    RP["Right dock = INSPECTOR (contextual, collapsible)"] --> sel{"entity selected?"}
    sel -->|yes| det["its photo, fields, tags, relationships + quick edit"]
    sel -->|no| coll["collapse (or a slim scene summary)"]
    DR["Left ◫ = PEOPLE DRAWER / Roster"] --> src["searchable list of ALL entities;<br/>summonable in ANY view; DRAG onto canvas to place"]
    src -. "same list component as the People view" .-> src
    style DR fill:#8b6cc5,color:#fff
```

- **Inspector** (right, contextual): tells you about what you clicked; collapses when idle —
  it stops permanently duplicating the People view.
- **People Drawer / Roster** (left, toggled by the ◫ rail icon): the draggable source of
  entities, available in *every* view. Default collapsed to a thin edge; open it, drag people
  onto the Graph/Timeline/Groups canvas (or into the Relationships table) to place/relate them.
- It's the **same list component** as the full **People view** — one implementation, two
  surfaces (full-screen browse vs. slim drag-source).

This gives you drag-to-place everywhere, keeps the canvas maximal by default, and matches the
"placed entities only" scene model (§4.2). It's also mobile/PWA-friendly (a drawer collapses;
a permanent sidebar doesn't).

### 6.4 Colors

🔴 **Fix a real collision:** female = pink **and** spouse-link = pink means color encodes two
things. Give relationships their own hue family so color never double-means:

| Encodes | Channel | 🟢 Proposed |
|---------|---------|-------------|
| Gender | node fill | male indigo-blue · female magenta · unknown slate |
| Relationship | **line style + separate hues** | parent/child solid violet · spouse **gold/teal** (not pink) · adopted dashed amber · divorced faded |
| Tag / Group | user-chosen per tag | unchanged |

🟢 **Direction (clean / cool / modern / simplistic):** one accent (keep indigo `--accent`),
lots of neutral grays, hairline borders, generous whitespace; color only where it *means*
something. **Polish light mode** as its own warm-neutral palette (not an inversion). The panel
consolidation in §6.2 already removes most on-canvas color noise.

---

## 7. Proposed data model

```mermaid
erDiagram
    PROJECT ||--o{ ENTITY : scopes
    PROJECT ||--o{ RELATIONSHIP : scopes
    PROJECT ||--o{ TAG : scopes
    PROJECT ||--o{ SCENE : scopes
    PROJECT ||--|| CALENDAR : has
    PROJECT ||--o{ IMAGE : scopes
    ENTITY ||--o{ ENTITY_TAG : ""
    TAG    ||--o{ ENTITY_TAG : ""
    SCENE  ||--o{ SCENE_TAG : "(groups scenes)"
    TAG    ||--o{ SCENE_TAG : ""
    ENTITY ||--o{ RELATIONSHIP : "a / b"

    PROJECT { string id PK  string name  string entity_noun  string mode }
    CALENDAR { string project_id FK  string kind  json units  json eras }
    ENTITY { string id PK  string project_id FK  string name  json birth  json death }
    TAG { string id PK  string label  string type  string source  string color  string icon }
    ENTITY_TAG { string entity_id FK  string tag_id FK }
    SCENE { string id PK  string view  string name  json config  json positions }
    SCENE_TAG { string scene_id FK  string tag_id FK  number x  number y  boolean visible }
```

**Migration from today (all mechanical, covered by the Vitest data-layer suite):**

| Today | New | How |
|-------|-----|-----|
| `trees` | `projects` (+`entity_noun`, `mode`, `calendar`) | rename; `tree_id`→`project_id` |
| `factions{member_ids, scenario_id, x,y,visible}` | `tags` + `entity_tags` + `scene_tags` | dedupe factions by name → tags; members → join; one `scene_tag` row per scenario placement |
| `scenarios` | `scenes` (view='groups') | rename; add `view`,`config`,`positions` |
| tree `graphState` blob | `scenes` (view='graph') | unpack modes/states into scene rows; mode → `config.type` |
| `birth_year` / `death_year` (number) | `birth` / `death` (date value + precision) | wrap the year as `{y, precision:'year'}` |

Storage notes: keep the object-map style client-side; `entity_tags`/`scene_tags` are small join
collections with two-way index Maps built at load. In Postgres later these are literal tables
with composite PKs; `config`/`positions`/`units` stay `jsonb`. Derived tags are never stored.

---

## 8. Open decisions for you

1. **Graph view name:** Graph 🟢 / Web / Constellation / Nexus? → ____
2. **Browse view:** dynamic entity noun 🟢 / static "Directory"? → ____
3. **"Birth" layout type** ok, or Era / Chronology? → ____
4. **Present** ok, or Now / Vantage? → ____
5. **Program Modes** names: Simple / Default / Advanced — keep "Default" or use "Standard"? → ____
6. **Relationships view:** keep name or "Table"? → ____
7. **Spouse link color** off pink (gold/teal)? 🟢 → ____
8. **People Drawer on the left** (near rail) 🟢 vs right (tab beside Inspector)? → ____

---

## 9. Suggested rollout order (each step shippable, low-risk)

```mermaid
flowchart LR
    S1["① tree→project<br/>(mechanical rename)"] --> S2["② Tag + entity_tags + index"]
    S2 --> S3["③ factions → tags + scene_tags<br/>(migrate data)"]
    S3 --> S4["④ state+scenario → Scene<br/>+ save/checkpoint model"]
    S4 --> S5["⑤ UI shell: rail, tool pill,<br/>Inspector, People Drawer, ⌘K"]
    S5 --> S6["⑥ Program Modes + entity noun"]
    S6 --> S7["⑦ Custom calendars + Present"]
    S7 --> S8["⑧ Derived/smart tags"]
```

①–④ are data/logic (Vitest-coverable — see [developer.md](./developer.md#testing)); ⑤ is
presentation; ⑥–⑧ are additive. Custom calendars (⑦) come late because they touch every date
field — do them once the structure is settled.

---

### Once approved
Fold the accepted decisions into [`client-structure.md`](./client-structure.md), update
[`data-model.md`](./data-model.md) + [`graph.md`](./graph.md) to match, and delete this temp file.
