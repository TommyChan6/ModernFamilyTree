# Wild ideas & the idea backlog

*A blue-sky brainstorm for FamilyTree — the place for "wouldn't it be cool if…". Half of
this is impractical, some of it is a signature feature waiting to happen, and a few are
things **no one has built before**. Nothing here is a commitment; it's raw material.*

*Companion to the grounded roadmaps in [`design.md`](./design.md#roadmap),
[`MID_DEVELOPMENT.md`](./MID_DEVELOPMENT.md) §8–9, the character-specific
[`CHARACTER_VIEW_PROPOSAL.md`](./CHARACTER_VIEW_PROPOSAL.md#wild-ideas), and the aspirational
[`designDraft.txt`](../designDraft.txt). Read those for what's already planned; read **this**
for what's over the horizon.*

---

## How to read this

Every new idea is tagged so you can scan by appetite:

| Tag | Meaning |
|-----|---------|
| 🎯 **Practical** | Real user value, would earn its keep |
| 😎 **Cool** | Mostly delight / shareability / "whoa" |
| 🧪 **Experimental** | Nobody's obviously done this; risk *is* the point |
| 🚀 **Moonshot** | Big, probably later, changes what the app *is* |
| 🏗️ **Leans on** | The existing system it reuses (so it's cheaper than it looks) |
| 💸 | Note on the zero-cost constraint (no paid services, no card-required tiers) |
| Effort | **S** hours–day · **M** days · **L** weeks+ |

The guiding lens: **this app already owns a fast WebGL graph engine, a d3-force
simulation, a kinship graph, a pure-layout-math architecture, structured `DateValue`
dates, tags/scenes, and a renderer-agnostic `CharacterDoc`.** The best new ideas are the
ones that fall out of things we *already have* — a new pure function, a new layout type, a
new lens over the same data. Those are marked with 🏗️.

---

## Part 1 — Status snapshot (so we don't reinvent)

A one-glance map of what's **already captured** elsewhere, so Part 2 can stay genuinely new.
Full detail lives in the linked docs.

### ✅ Already shipped (in code)
Five views (Graph WebGL · Timeline WebGL · Groups WebGL · Directory · Relationships) ·
Projects · Program Modes (Simple/Standard/Advanced) · Scenes + layout types + autosave/
checkpoint · Tags over a membership join · Accounts/auth · **3D Space** graph (Labs) ·
**Character View Phase 1** (paper-doll portraits, Cartoon pack, age binding, set-as-portrait) ·
web build (IndexedDB) · CI + TS adoption started.

### 📋 Already planned / documented (don't duplicate — extend instead)
- **Platform:** Supabase backend, cloud auth, sharing/visibility, fork & remix, public
  **Explore** gallery, embeddable widget, real-time collab, mobile (responsive→PWA), i18n,
  legal/privacy blockers. → [`MID_DEVELOPMENT.md`](./MID_DEVELOPMENT.md) §4–8, §11.
- **Editor:** in-graph edit (ctrl-click to link), multi-select drag, editable link
  curvature, physics sliders, self-defined relationship types, unknown age/name/gender,
  GEDCOM import/export, derived/smart tags, **custom calendars**. → [`design.md`](./design.md#roadmap).
- **Exploration:** time-lapse, "reveal info", relationship path finder, minimap, map view,
  import background image, export styled image, onboarding tutorial. → [`design.md`](./design.md#roadmap).
- **AI:** Claude-API tree-builder + Wikidata import (💸 **deferred** — API is pay-per-use). → §9.
- **Character:** genetics, aging on timeline, gene-pool randomize, style crossfade,
  expressions, trait-driven wardrobe, resemblance overlay, DNA share codes, crest builder,
  3D characters. → [`CHARACTER_VIEW_PROPOSAL.md`](./CHARACTER_VIEW_PROPOSAL.md#wild-ideas).

Everything in **Part 2 below is new** — not found in the docs above (except where it
explicitly *extends* a captured idea with a fresh angle).

---

## Part 2 — New ideas

### A. Make the graph *understand* kinship

The app stores relationships but doesn't yet *reason* over them. A handful of pure graph
functions unlock a whole category of features — all zero-cost, all client-side, all testable
like the existing layout math.

**A1. "What are we?" — the kinship calculator** 🎯 · Effort **M** · 🏗️ the relationship graph
Click two people → get the exact label: *"second cousin once removed"*, *"great-grand-aunt"*,
*"half-brother"*. A pure BFS over `parent_child` edges + a relationship-naming table. This is
*the* table-stakes genealogy feature we don't have, and it works identically for fictional
casts. Ships as an Inspector line ("Relation to selected: …") and powers A4, F2, F4 below.

**A2. The Habsburg-meter — consanguinity & pedigree collapse** 😎🧪 · Effort **M** · 🏗️ kinship graph · 💸 free
Compute the **coefficient of relationship** between any couple and flag *pedigree collapse*
(the same ancestor appearing on both sides). Render it as a cheeky "bloodline" gauge on a
marriage edge. Genuinely used in real genealogy (genetic risk); *hilarious and irresistible*
for royal and fantasy houses (Targaryens, Habsburgs, Lannisters). Nobody makes this
approachable — we can.

**A3. Relationship *dynamics* — a sentiment/allegiance layer** 🎯🧪 · Effort **L** · 🏗️ relationships + Focus lens
Generalize "self-defined relationship types" (already planned) into a **weighted affect
dimension**: each edge can carry sentiment — *loves · estranged · rival · mentor · fears* —
with an intensity. A new **Dynamics lens** recolors the graph warm↔cold and sizes edges by
intensity. For writers it's a plot map; for real families it's the honest layer a genealogy
chart never shows (who actually talks to whom). Non-destructive, like every other Focus.

**A4. Drama detector / "gossip mode"** 😎🧪 · Effort **M** · 🏗️ kinship graph + tags + A3
Pattern-match the graph for narrative tension and surface it as cards: **love triangles**
(two people sharing a partner), **feuds** (rival edges across a family line), **forbidden
romance** (marriage across two rival tags/houses), **reconciliations**, **black sheep**
(a person with only estranged edges). Pure pattern queries. A worldbuilder's dream, and a
delightful "did you know?" for real trees.

**A5. Structural analysis — who is the linchpin?** 🎯 · Effort **M** · 🏗️ kinship graph
Betweenness/centrality over the graph to answer: *who connects otherwise-separate clusters?*
Highlight the **bridge people** whose removal would split the family into islands. Practical
for understanding a large cast at a glance; a genuinely useful "reveal info" companion.

### B. Time, as a first-class thing

The Timeline engine and structured `DateValue`s are underused. Time is this app's *soul*
(per the Character proposal) — lean into it.

**B1. Events beyond birth/marriage/death — a story-beat track** 🎯🧪 · Effort **L** · 🏗️ Timeline + DateValues
A general **Event** entity on the shared date axis: *battle, coronation, migration,
betrayal, founding, first meeting*. Attach to one or many people. The Timeline becomes a
**plot board** for writers and a real historical record for genealogists ("emigrated 1887").
This is the single highest-leverage new data type — it turns a family chart into a *history*.

**B2. The living-census scrubber** 😎 · Effort **M** · 🏗️ Present date + Timeline
Drag the **Present** date and watch a live demographic ticker: population alive, active
marriages, average age, births-this-decade, a little mortality sparkline. Turns the existing
"as-of" date into a time machine you can *feel*. Pairs perfectly with the planned time-lapse.

**B3. "What-if" branch canons — parallel timelines** 🧪🚀 · Effort **L** · 🏗️ projects/scenes
Branch a project at a moment ("what if the heir had lived?") and explore the divergent
lineage as a sibling canon, with a **diff view** that shows which people/relationships exist
in one branch but not the other. Fan-fiction and counterfactual-history in one feature.
Alternate-canon is a thing fandom *wants* and no tree tool offers.

**B4. Migration flows on a map, animated over time** 😎 · Effort **L** · 🏗️ map view (planned) + Timeline + WebGL
*Extends the planned map view.* As the time-lapse plays, draw **animated migration ribbons**
between `location` fields — watch a family diaspora spread across a map as decades pass.
Birth→marriage→death cities become a moving story. The WebGL ribbon primitives from the
Timeline renderer transfer directly.

### C. Generate a world — without paying for AI

The AI tree-builder is 💸 deferred (paid API). But **procedural generation is zero-cost,
offline, and arguably more fun** — and this app already ships a first-run seed generator.

**C1. Procedural dynasty generator** 🎯🧪 · Effort **L** · 🏗️ the seed generator · 💸 free
"Generate a plausible 5-generation noble house." Rule-based: name banks, demographic models
(birth/marriage/death rates, family sizes), title inheritance. Produces a full, editable
tree in one click — the zero-cost stand-in for the AI builder, and a killer way to seed the
public gallery. Add knobs: era, culture, mortality, feud-likelihood.

**C2. Culture-aware name generator** 😎 · Effort **S** · 🏗️ tags · 💸 free
Markov chains over a small seed corpus, bound to a tag ("House Stark names sound like *this*").
Every new person gets a suggested in-world name. Tiny, pure, delightful — and feeds C1.

**C3. Trait inheritance simulator (a Mendelian playground)** 🎯🧪 · Effort **M** · 🏗️ structured fields + kinship
Model traits as structured fields — eye/hair color, blood type, or a fictional **magic gene**
— and simulate inheritance with Punnett-style probabilities. Predict a hypothetical child's
traits from any two parents; flag carriers of a recessive trait across the tree. Educational
for classrooms, magical for fantasy powers ("who could inherit the Sight?"). This is the
*data* sibling of the Character view's visual genetics.

**C4. Deterministic sigils for every tag** 😎 · Effort **S** · 🏗️ Groups view · 💸 free
*Precursor to the Character view's crest builder.* Hash a tag's name+color into a unique,
deterministic generated **emblem** so every group/house gets a visual identity in the Groups
view *today*, with zero art assets. Upgrade to the full heraldry pack later.

### D. New ways to *see* the same tree

New layout types and renderer skins are cheap here — layout math is pure, and the WebGL
renderer already draws thousands of nodes. Each of these is "a new pure function" away.

**D1. Fan chart (radial ancestry sunburst)** 🎯😎 · Effort **M** · 🏗️ layout-type architecture
The single most-recognized genealogy visualization we *don't* have: ego at the center,
ancestors radiating outward in colored rings. Slots straight into the layout-type system as a
new scene type. Beautiful, instantly legible, and the thing people screenshot and print.

**D2. Bloodline flow — ink through the graph** 😎 · Effort **M** · 🏗️ Focus + WebGL animation
Pick an ancestor → animate a glowing "flow" of descent that spreads through the graph like
ink in water, lighting every descendant in sequence. Non-destructive, uses the on-demand
frame loop. The prettiest possible answer to "show me everyone descended from her."

**D3. Constellation / night-sky skin** 😎🧪 · Effort **M** · 🏗️ Graph renderer (skin only)
A cosmetic renderer theme: people become **stars**, relationships become constellation lines,
brightness scales with descendant count, deceased twinkle faintly. A "poster mode" people
share. Basically free given the WebGL stack — it's a shader/material swap over existing nodes.

**D4. The family fingerprint** 😎🧪 · Effort **M** · 🏗️ graph structure + export
Deterministically generate a unique **abstract mandala/sigil** from the whole tree's
structure (generation depth, branching, size). Every project gets a shareable, brandable
signature artwork. Regenerates as the tree grows — a living crest for the *whole* family.

**D5. Ego-network / POV re-root** 🎯🧪 · Effort **M** · 🏗️ kinship graph + A1
Re-root the entire view from one person's perspective: relabel *everyone* relative to them
(via A1) and recolor by kinship distance. "See the family as Grandpa sees it." A profound
shift in a couple of pure functions — the same data, a completely different story.

### E. Turn it into a living archive (the emotional hook for real families)

A chart is cold. Memories are why people care. This is the direction that makes families
*love* the app, not just use it.

**E1. Memory capsules — voices, letters, video** 🎯🚀 · Effort **L** · 🏗️ images pipeline (generalize to media)
Attach audio, scanned letters, documents, and video to a person — a **digital heirloom**,
not a data field. Generalize the existing image pipeline to arbitrary media. This reframes
the product from "family-tree editor" to "the place your family's memory lives." 💸 On
desktop, local files are free; cloud storage is a later/paid concern — desktop-first is fine.

**E2. Oral-history interview mode** 🎯 · Effort **M** · 🏗️ E1 + person fields
Guided prompts to record from elders — *"Tell me about your grandmother. What did she do?"* —
with the recording auto-attached to the right person. Genealogy's hardest problem is
*capturing* stories before they're lost; nobody makes that gentle. This does.

**E3. Time capsule — a letter to descendants** 😎 · Effort **S** · 🏗️ DateValues + E1
Write a message sealed until a future date, addressed to whoever opens the tree then. A
small, deeply human feature that fits the time-centric design perfectly.

**E4. Auto-generated life story / obituary** 🎯 · Effort **M** · 🏗️ person data + A1 + relationships · 💸 free (templated, not AI)
Compose a readable prose biography from the structured data — birth, marriages, children,
occupation, relationships — via templates (no AI needed). Doubles as the **screen-reader
narrative** (accessibility!) and the SSR profile-page body for shared trees.

### F. Play & learn

The kinship engine (A1) turns the tree into a game board and a teaching tool for free.

**F1. Tree-completeness meter + quests** 🎯 · Effort **S** · 🏗️ person data
Gamify data hygiene: "4 people missing birth years · 12 without photos · 2 orphaned nodes."
A gentle progress ring plus quests. Practical nudge that measurably improves data quality.

**F2. Relationship quiz / puzzle mode** 😎 · Effort **M** · 🏗️ A1 kinship engine
"How is Arya related to Jon?" multiple-choice, generated from the real graph. Or reverse it:
*"Find someone who is X's second cousin."* A classroom tool and a fandom time-sink, powered
entirely by A1.

**F3. Guess-who / twenty-questions** 😎🧪 · Effort **M** · 🏗️ person attributes
Akinator-style: narrow to a mystery person via yes/no questions on attributes and relations.
Pure fun, surprisingly sticky, and a novel way to explore a large cast.

**F4. Six-degrees challenge** 😎 · Effort **S** · 🏗️ A1 + path finder (planned)
*Extends the planned path finder into a game.* Pick two random people, race to connect them;
share the chain. "You and Charlemagne are 40th cousins" as a viral card.

### G. Sharing & interop that respects zero-cost

**G1. Whole-tree share codes (serverless)** 🎯 · Effort **M** · 🏗️ the export format · 💸 free
*Extends the Character view's DNA-code idea to whole (small) trees.* Compress a tree into a
URL fragment (`#data=…`) — share a complete interactive tree with **no server, no account,
no cost**. Perfect for the deferred-deployment era: sharing works *today*, offline.

**G2. Reunion pack — printable everything** 🎯 · Effort **M** · 🏗️ export + person data
One click → a **family-reunion kit**: a printable wall chart, name-tag sheets, a "who's who"
booklet, and a relationship quiz (F2). QR codes (G3) on each card. Real families would pay
for this; it costs us a print stylesheet.

**G3. QR per person / tree** 😎 · Effort **S** · 💸 free
A QR that opens a person's profile or the tree. Feeds G2 and makes physical→digital handoff
trivial at gatherings. Client-side QR generation, no dependencies of note.

**G4. Cross-project universe links** 🧪 · Effort **L** · 🏗️ projects + relationships
Let a person in one project reference a person in another — **crossovers and shared
universes** for prolific worldbuilders (the MCU problem: one character, many stories). A
"linked profiles" concept above the project boundary.

### H. Truly out-there

**H1. Sentiment as physics — emergent social topology** 🧪🚀 · Effort **M** · 🏗️ d3-force sim + A3
Feed the A3 sentiment weights *into the force simulation*: rivals repel, lovers attract,
mentors pull close. The auto-layout then **self-organizes into social clusters** with no
manual grouping — the family's emotional structure emerges as literal shape. A novel,
almost-free use of the sim we already run.

**H2. Dynasty simulator (Crusader-Kings-lite)** 🧪🚀 · Effort **L** · 🏗️ C1 + time-lapse
Let the tree evolve *forward*: apply rules (marriages, births, deaths, succession, feuds)
and generate future generations you then curate. A game *inside* the editor, built on the
procedural generator and time-lapse engine. Wildly fun, genuinely novel for this category.

**H3. Sonify the family** 🧪 · Effort **M** · 🏗️ tree structure · 💸 free (Web Audio)
Map generations to octaves and births to notes; "play" a lineage as a melody, or generate an
ambient soundscape unique to a tree. Doubles as an accessibility affordance (hearing
structure). Pure Web Audio, no assets, no cost.

**H4. Confidence & provenance as a visible spectrum** 🎯🧪 · Effort **M** · 🏗️ relationships + sources (planned)
*Generalizes "canon vs headcanon" into a dial.* Every fact carries a **confidence** and a
**source**; uncertain relationships render dashed/faded, well-sourced ones solid. Genealogists
get honest uncertainty; fandoms get a canon-confidence spectrum; collaborators (later) can
**vote**, with edge opacity tracking consensus — community epistemics made visual.

**H5. WebXR "walk your constellation"** 🧪🚀 · Effort **L** · 🏗️ Space 3D graph · 💸 free (WebXR)
The 3D Space graph, but you *stand inside it* in VR/AR via WebXR — walk among your ancestors
as stars (D3). The 3D engine already exists; WebXR is a camera/input layer over it. The
ultimate "whoa" demo for large dynasties.

---

## Part 3 — If you only did five

Highest delight-or-value per unit effort, given what's already built:

1. **A1 — Kinship calculator.** Table-stakes, unlocks F1–F4 and the path finder. Do this first.
2. **D1 — Fan chart.** One pure layout function; the most-wanted view we lack.
3. **B1 — Story-beat events.** Turns a chart into a history; the writers' hook.
4. **A2 — The Habsburg-meter.** Cheap, unique, irresistibly shareable.
5. **C1 — Procedural dynasty generator.** The zero-cost answer to "AI builder," and it fills
   the gallery.

> These are aspirational, not commitments — see [`contributing.md`](./contributing.md) before
> starting anything large, and check it still fits the zero-cost + web-parity constraints in
> [`CLAUDE.md`](../CLAUDE.md).
</content>
</invoke>
