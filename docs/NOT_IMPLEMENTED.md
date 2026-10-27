# Not yet implemented — the consolidated backlog

*Compiled 2026-10-11 from every planning document in the repo, with each item checked
against the code on that date (not against what the docs claim). Updated the same day
after §1 (housekeeping and quick fixes) was worked through. **Re-verified 2026-10-18**
against the code including uncommitted work: no open item had shipped in between; the
Medieval theme and the plate node shapes moved §5.8 and §6.6 forward and added
follow-ups (see those entries and Appendix A). This is the single
list of everything that was planned, proposed, or wished for and does not exist yet,
or exists only partly.*

**Sources swept:** [`designDraft.txt`](../designDraft.txt) ·
[`MID_DEVELOPMENT.md`](./MID_DEVELOPMENT.md) · [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) ·
[`CODE_PROTECTION_PLAN.md`](./CODE_PROTECTION_PLAN.md) · [`MONETIZATION.md`](./MONETIZATION.md) ·
[`WILD_IDEAS.md`](./WILD_IDEAS.md) · [`CHARACTER_VIEW_PROPOSAL.md`](./CHARACTER_VIEW_PROPOSAL.md) ·
[`PERSON_FORM_REWORK.md`](./PERSON_FORM_REWORK.md) · [`OVERHAUL_GUIDE.md`](./OVERHAUL_GUIDE.md) ·
[`design.md`](./design.md) · [`data-model.md`](./data-model.md) ·
[`client-structure.md`](./client-structure.md) · [`graph.md`](./graph.md) ·
[`CLAUDE.md`](../CLAUDE.md), plus `TODO` / "not implemented" / "coming soon" markers in `src/`.

**How to read an entry**

| Field | Meaning |
|---|---|
| **Status** | `Not started`: nothing in code. `Partial`: some of it exists; the entry says exactly what's missing. |
| **Blocked** | `zero-cost`: needs a paid service or card details (forbidden for now). `hosted`: needs the deployed Supabase backend. Unmarked = can be built today, client-side. |
| **Effort** | **S** hours to a day · **M** days · **L** weeks or more (estimates). |
| **Source** | Which doc asked for it. |

Items the docs still list as planned but which **already shipped** are collected in
[Appendix A](#appendix-a--planned-items-that-already-shipped), so they don't get built twice.

---

## Contents

0. [Top of the list](#0-top-of-the-list)
1. [Housekeeping and quick fixes](#1-housekeeping-and-quick-fixes)
2. [Graph view](#2-graph-view)
3. [Other views: Timeline, Groups, Directory, Map](#3-other-views)
4. [People data: traits, tags, dates, provenance](#4-people-data)
5. [Character view](#5-character-view)
6. [App-wide UX](#6-app-wide-ux)
7. [Generation, storytelling and play](#7-generation-storytelling-and-play)
8. [Sharing, community and interop](#8-sharing-community-and-interop)
9. [Hosted backend (Supabase) gaps](#9-hosted-backend-supabase-gaps)
10. [Deployment, security, privacy and legal](#10-deployment-security-privacy-and-legal)
11. [Monetization](#11-monetization)
12. [Engineering and tooling](#12-engineering-and-tooling)
13. [Mobile](#13-mobile)
14. [Moonshots and commercial bets](#14-moonshots-and-commercial-bets)
- [Appendix A: planned items that already shipped](#appendix-a--planned-items-that-already-shipped)
- [Appendix B: stale statements in other docs](#appendix-b--stale-statements-in-other-docs)
- [Appendix C: in-code markers](#appendix-c--in-code-markers)

---

## 0. Top of the list

The items that are cheapest to fix, most visible, or would block a launch:

1. **Personal work email still shipped in the UI** (§1.1). It's now a one-line change in `lib/appInfo.ts` once the new address exists.
2. **`projects:update` missing on the hosted backend**: on Supabase, saving a project's visibility or description fails (§9.1).
3. **Hosted plan is always `free`**: `mirrorAuthUser` hardcodes it and never reads `profiles` (§9.2).
4. **No account deletion or data export**: a GDPR launch blocker (§10.3).
5. **Privacy Policy text is wrong for the hosted build**: it says "no email", but Supabase signup collects one (§10.4).
6. **No LICENSE file**, though the protection plan relies on one (§10.6). The README now states the terms, but the file itself is missing.
7. **Directory "only people in this view" toggle** (§3.3): small, and asked for in the design draft.
8. **Graph physics sliders with "?" explainers** (§2.6): half built.
9. **First-run tutorial** (§6.1): asked for in three docs.
10. **GEDCOM import/export** (§8.1): the table-stakes interop feature for genealogists.

---

## 1. Housekeeping and quick fixes

*Worked through 2026-10-11. Everything here is done except the email swap, which
waits on the new address.*

### 1.1 Replace the hardcoded contact email
- **Status:** Partial (waiting on the new address) · **Effort:** S · **Source:** designDraft ("look for all places with my email, and change it")
- **Done:** the address is defined once, as `CONTACT_EMAIL` in `src/renderer/src/lib/appInfo.ts`. `HomePage.vue` (contact links) and `SettingsModal.vue` (About + feedback mailto) both read it through `contactMailto()`. No other file holds an email address (`SupabaseAuthGate.vue`'s `you@example.com` is only an input placeholder).
- **Remaining:** once the new address exists, change that one constant. Until then the work address still ships in the UI, by choice.

### 1.2 App version from package.json
- **Status:** Done
- `package.json`'s `version` is injected at build time as `__APP_VERSION__` (a `define` in `electron.vite.config.js`, `vite.config.web.js` and `vitest.config.js`) and exported as `APP_VERSION` from `lib/appInfo.ts`. Settings → About and the feedback subject line use it, so a release only needs a bump in `package.json`.

### 1.3 Norwegian UI locale
- **Status:** Done (for strings that go through i18n; see §6.11)
- `i18n/locales/nb.js` (Norsk bokmål) is a full translation of `en.js`: all 1,485 keys, with every `{placeholder}` preserved, checked by script. It's registered in `SUPPORTED_LOCALES` as "Norsk bokmål", and sets `<html lang="nb">`.
- Kinship naming follows the UI language: a Norwegian UI now defaults kin names to Norsk (`kinshipLang.ts` maps `nb`/`nn` → `no`), unless the viewer has picked a naming language.
- A native speaker should still proofread it. About 30 strings stay identical to English because they're loanwords in Norwegian too (Status, Partner, Studio, Jeans…).

### 1.4 Smaller view title bar
- **Status:** Done
- `.view-header` (`ViewHeader.vue`) went from about **71px** to **51px**. The earlier "61px" estimate missed that the toggle rails add their own padding.
  - padding is 6px instead of 14px;
  - toggle rails inside the bar get 2px padding instead of 4px, through a scoped `:deep(.ct-rail)` rule (they keep their roomier look where they float over the Timeline and Groups canvases);
  - the title is 16px instead of 18px (21px instead of 24px in the Ink theme), and the icon 18px instead of 20px.
- Checked in the web build in the dark, light and ink themes. Buttons stay at the shared `--ctl-md` height.

### 1.5 Copyright notice
- **Status:** Done
- Settings → About shows "© 2026 Tommy Chan — all rights reserved." (`about.copyright` in all four locales).
- The landing-page footer reads "© 2026 Tommy Chan · Family Tree · …".
- `README.md` has a License section stating the code is proprietary.
- The holder string is `COPYRIGHT_HOLDER` in `lib/appInfo.ts`. The LICENSE *file* is still open (§10.6).

## 2. Graph view

### 2.1 Editable links with break points
- **Status:** Partial · **Effort:** M · **Source:** designDraft ("add breaking points so that the lines can curve and have angle"), design.md roadmap
- **Today:** under the *Bezier* line style, a link can be reshaped as **one cubic bezier**: two handles plus dragging the curve body (`GraphCanvas.vue` `applyCurves` / `curveEditLink` / `bendCurveAt`). The shape is saved per relationship in the scene's `curves` map and can be undone. The angled styles (elbow / trident / circuit, in `graph/linkRouting.js`) are global automatic routes.
- **Missing:**
  - adding and removing **break points** on a link;
  - links with **more than two control points**;
  - **angled (polyline) segments** the user places by hand;
  - per-point "sharp corner vs smooth" toggles;
  - reshaping under styles other than Bezier.
- **Notes:** store a `points: [{x, y, kind: 'smooth'|'corner'}]` array in the same `curves` map. Keep the path math pure in `linkHelpers.js`, and extend the ribbon tessellation in the link material. Undo already flows through `captureLayoutState`.

### 2.2 Special effect for persons with a given tag
- **Status:** Done (2026-10-19), for tags **and** traits, in the Graph and the Timeline · **Source:** designDraft ("special effect on a specific tag?")
- **What shipped ("auras"):** `Tag.aura` and `FieldDef.auras` (rules with a condition on the trait's value), resolved per person by `src/shared/auras.ts` with a priority order. Bearers wear an ornament (eight new ones — halo, flame, frost, sparkle, crown, shadow, storm, bloom — plus the five decor ornaments) on graph nodes and timeline pins, a line effect on their lifeline and on bonds between two bearers, and an optional tint. Edited in Style Studio → Whole app → Special effects, with a live preview and presets. Assigning an aura ignites it with a shockwave cascading down the generations. See CLAUDE.md → Auras.
- **Follow-ups:** the Space 3D view, the Groups view and the Directory don't show auras yet; aura line effects pause under the 水墨 brush look, like every line effect.

### 2.3 Gravestone theme
- **Status:** Done (2026-10-11) · **Source:** designDraft ("the characters are like gravestones, the ground in which they touches represents the birth year")
- **What shipped:**
  - **A `gravestone` node shape** (`NODE_SHAPES[8]`; ids and anchors in `graph/webgl/nodeShapes.js`). The shader's `stoneNode()` draws:
    - a round-arched granite headstone on a plinth, with grain and speckle and a bevel lit from the upper left;
    - a bronze-framed portrait cameo, showing the photo as an aged print or the silhouette;
    - two engraved inscription grooves and moss creeping up from the foot;
    - grass blades in front, an earth mound, and a long shadow cast across the ground.
  - **It stands on its point.** The stone's base sits on the person's position (`shapeAnchor().lift`), so in the **Birth layout each stone is planted on its own birth-year line**. Labels tuck just under the base, kinship pills float above the crown, and hit-testing targets the stone body.
  - **Graveyard theme preset** (`graveyard` in `graphThemes.js`): headstones, moss-green lineage paths, old-brass marriages and drifting mist.
  - **Stone palettes per app theme:** granite on dark, paler and warmer on light, ink-and-paper tones in 水墨. In the ink theme the stone keeps its carved look rather than the ink-wash disc.
  - Style panel: a shape tile with a CSS silhouette matching the shader. Strings are in all four locales.
- **Possible follow-ups:**
  - Weather living vs. deceased people differently (e.g. moss only on the dead), which needs a per-instance flag.
  - An engraved name/years plaque rendered as real text on the stone.

### 2.4 Tilted 3D viewing mode for the 2D layouts
- **Status:** Done (2026-10-11) · **Source:** designDraft ("3d viewing mode for 2d graphs")
- **What shipped:**
  - **Perspective tilt.** Any 2D layout (free / organic / birth / generations / spotlight) lies down like a board seen from above. Links, guides and a fading ground grid (`GroundGrid.js`) recede toward the horizon, while every node stands upright as a billboard that shrinks with distance. Far content softens into a depth haze.
  - **One homography, everywhere.** The tilt is a plane homography carried on the camera transform (`tl`, `vw`, `vh`). `coords.worldToScreen` / `screenToWorld` apply it, so the overlay, picking and dragging follow automatically, and `tiltProjection()` folds the same mapping into the GPU projection matrix. The atmosphere renders in a separate flat pass.
  - **Picking is exact:** `pickNodeOnScreen`, screen-space and depth-aware. Labels and spotlight rings are projected (rings become ground ellipses).
  - **Controls:**
    - the bottom-bar rotate-3d button or **T** toggles the tilt;
    - **Q / E** turn the board 30° (yaw about the view centre);
    - **Alt + drag** up/down sets the angle and left/right turns the board (nearly flat snaps flat);
    - Style → Perspective has an on/off switch, an angle slider (8–64°) and a turn slider (−180–180°).
  - **Depth order (2026-10-12):** standing nodes paint back to front: the one whose foot (pivot) is lower on screen is nearer and draws on top (`coords.depthOrder` + a draw-slot map in `NodeLayer`). Names covered by a nearer body are dimmed (`occlusion.js`).
  - **Exact pan / zoom (2026-10-12):** while tilted or turned, background drag and wheel zoom are solved by `translateToPin`, so the grabbed or hovered ground point stays exactly under the cursor.
  - The tilt glides in and out (~0.7 s, gentle overshoot; snaps under reduced motion), persists as `viewTilt` / `tiltAngle` / `tiltYaw`, and carries into image exports.
  - The Space (true 3D) layout keeps its own camera; the tilt button hides there.
  - Tests: `tests/graphTilt.test.js` covers the homography round trip, GPU/CPU agreement, depth behaviour and picking.
- **Known limits:**
  - Fit-to-view fits the flat (unturned) extent, so a tilted or turned fit leaves some margin.
  - The minimap's viewport box ignores the tilt and turn.

### 2.5 Directory: "show everyone" vs "show who's in this view"
- Listed under §3.3, since the right dock is shared by every view.

### 2.6 Physics sliders with explainers
- **Status:** Partial · **Effort:** S · **Source:** designDraft ("sliders for auto mode … gravity, stretchiness of lines, generational top to bottom alignment … question mark next to the sliders"), design.md, MID_DEVELOPMENT Phase C
- **Today:**
  - Style → Physics/layout has two sliders, *Link distance* and *Repulsion*, shown in Advanced mode only and without explainers;
  - the Relationships pane has a *Social gravity* ×1–4 slider with a tooltip;
  - per-type spring weight lives in `RelTypesPanel.vue`.
- **Missing:** centre-gravity, link-stretch/strength and generational-pull sliders; a "?" explainer popover per slider; and possibly a lighter version for Standard mode.

### 2.7 Image as graph background
- **Status:** Not started · **Effort:** M · **Source:** designDraft ("allow import image as background, maps or household, school maps etc"), design.md, MID_DEVELOPMENT Phase D
- **Today:** the only graph backdrop is the ink theme's painted one (`InkBackdrop.js`). The Map view draws only generated maps and can't import an image either.
- **To do:** a per-scene background image (an `images:*` record or a data URL on `scene.config`) with position, scale and opacity, drawn as a textured quad behind the nodes. It should be included in exports. The same feature fits the Map view as a custom base layer.

### 2.8 Mother and father links in different colours
- **Status:** Partial · **Effort:** S · **Source:** designDraft visuals ("different color for mother or father relationship")
- **Today:** father links turn blue and mother links pink only while Focus → Lineage is set to Paternal or Maternal, and only one side at a time (`linkHelpers.js` `getLinkStroke`).
- **Missing:** an always-on "colour by parent side" option showing both sides together, with Style-panel colour pickers. The colours should come from design tokens or settings, not literals.

### 2.9 Tag-type toggles that regroup the graph
- **Status:** Partial · **Effort:** L · **Source:** designDraft big feature ("tags can have type … types options will appear somewhere on screen … clicking tags in the auto mode can realign the persons according to tags"), design.md "bigger bets"
- **Today:** `Tag.type` exists but only shows as a chip label. Grouping by tag exists only in the separate Groups view.
- **Missing:**
  - an on-canvas strip of tag types and tags;
  - clicking a tag adds a clustering force in the organic layout, pulling members together around a tag centroid (a d3 `forceX`/`forceY` per tag or a custom cluster force);
  - convex-hull or halo drawing of tag clusters in the graph.

### 2.10 Constellation / night-sky skin
- **Status:** Done (2026-10-26) · **Source:** WILD_IDEAS D3
- **What shipped:** the `star` node shape (brightness/size by descendant count, departed twinkle, ink star atlas on light grounds), the `starline` line effect, the `nightsky` background, the `constellation` preset, and a star-chart poster (planisphere / atlas plate) in the Export dialog. See CLAUDE.md → Constellation skin.
- **Follow-ups:** couple lines keep the default line-effect scope (not star lines); the end gap is a fixed 15 units rather than per-star; no night sky in performance mode or on the Timeline's background list.

### 2.11 Fan chart as a graph layout type
- **Status:** Partial · **Effort:** M · **Source:** WILD_IDEAS D1
- **Today:** `kinship/FanChart.vue` exists, but only inside the profile's Kinship section.
- **Missing:** a `fan` graph layout type (an ego at the centre, ancestors on rings). It would be pure layout math like `spotlightLayout.ts`, plus ring guides in `TextGuideOverlay`, and would join the scene `layouts[type]` system.

### 2.12 "Trace connection" without Ctrl-click
- **Status:** Partial · **Effort:** S · **Source:** designDraft ("the controls for the display of the shortest connection between two people needs a button")
- **Today:** a Trace button exists in the action pane, and with two people selected there's a *Trace connection* button. But after pressing *Trace* on one person, the second still has to be **Ctrl-clicked**. There's no person picker, and the buttons are hidden in Space 3D.
- **Missing:** after *Trace*, open the existing `PersonPicker` combobox to choose the target. Show the trace buttons in Space 3D too.

### 2.13 Breathing highlight ring
- **Status:** Not started · **Effort:** S · **Source:** PERSON_FORM_REWORK ("a breathing ring stays a future polish")
- **Today:** the highlight slot draws a static border (`GraphCanvas.vue`, `hl`). Only the selection halo pulses.
- **To do:** drive the highlight border's alpha or width off `uTime` in `NodeMaterial.js`, the same way the selection halo works. It should respect reduced motion.

### 2.14 Action wheel outside the graph
- **Status:** Not started · **Effort:** M · **Source:** graph.md ("timeline/groups views can adopt it later with their own catalogs")
- **Today:** `ActionWheel` and `wheelModes` are imported only by `GraphCanvas.vue`.
- **To do:** move the Tab handling into a composable, and give the Timeline (which already has edit tools 1–6) and Groups their own mode catalogs.

---

## 3. Other views

### 3.1 Timeline: aging portraits
- Listed under §5.1.

### 3.2 Timeline/Groups: pinch-zoom and touch
- Listed under §13.

### 3.3 Directory dock: "everyone" vs "in this view"
- **Status:** Not started · **Effort:** S · **Source:** designDraft ("the right menu directory can toggle between showing all persons or showing all current persons in the graph/view")
- **Today:** `RightSidebar.vue` `filteredPersons` always lists all of `store.persons`, with search only.
- **To do:** a two-state toggle in the dock header. "In view" means the active graph scene's visible nodes (respecting Focus filters and time travel), the timeline's visible lanes, or the active Groups scene's members.

### 3.4 Groups generated from tag types
- **Status:** Not started · **Effort:** S–M · **Source:** PERSON_FORM_REWORK §5 ("groups-view generation by type comes later"), §8
- **Today:** groups are placed one tag at a time (`scene_tags:add`), and FactionsView never reads `tag.type`.
- **To do:** "New scene from tag type…" places every tag of that type in a new Groups scene, auto-arranged.

### 3.5 Map: animated migration flows from location data
- **Status:** Partial · **Effort:** L · **Source:** WILD_IDEAS B4, MID_DEVELOPMENT Phase D ("plot birth/death/location on a world map")
- **Today:** journeys come only from manually placed `MapToken` keys. `autoPlaceable` suggests one static spot by matching `person.location` to a named place.
- **Missing:** deriving journey keys automatically from dated location traits (birth place to residence to death place, using trait timeframes, §4.6), and animated diaspora ribbons as time plays.

### 3.6 Map: export through the shared Export modal
- **Status:** Partial · **Effort:** S
- **Today:** the map has its own PNG download (`MapView.vue` `exportPng`), but `captureViewImage` in `App.vue` only covers graph, timeline and groups, so the map misses the Export modal's framing, title and resolution presets.
- **To do:** expose `exportImage()` on MapView and register it in `captureViewImage`.

### 3.7 Map: maps in the global undo history
- **Status:** Not started (by design today) · **Effort:** M
- **Today:** the map keeps its own undo/redo stack, and maps aren't in `src/shared/history.ts`. So undo depends on which view is open, and the project-level journal never sees map edits.
- **Decide:** whether to fold map steps into the store's journal as arrangement-style steps.

---

## 4. People data

### 4.1 Custom calendars
- **Status:** Not started (reserved only) · **Effort:** L · **Source:** design.md, data-model.md, PERSON_FORM_REWORK §8
- **Today:** the `custom_date` / `custom_date_range` field types are declared and accepted by the birth/death slots, but can't be created, and `coerce`/`format` return `null`. `DateValue.calendar` is the literal type `'gregorian'`, and `assertCalendar` (`calendarMath.ts`) throws on anything else. The timeline shows a toast "a calendar the timeline can't move yet".
- **To do:**
  - a project-scoped `CalendarDef` (named units, e.g. *year ▸ 20 gex ▸ 100 days*, plus extra cycles and an epoch offset) with `calendars:*` channels;
  - `calendarMath.toOrdinal` / `format` / `duration` per calendar;
  - a date input for custom calendars;
  - Timeline axis labels in the project calendar;
  - conversion to and from Gregorian for mixed projects.

### 4.2 Derived (smart) tags
- **Status:** Partial · **Effort:** M · **Source:** design.md, data-model.md, client-structure.md §5.1, PERSON_FORM_REWORK §8
- **Today:** `Tag.source: 'manual'|'derived'` exists and `tags:create` accepts `'derived'`, but pickers filter derived tags out, and nothing defines or computes their members.
- **Missing:**
  - a rule on the tag (`{ fieldId, op, value }`, e.g. occupation = smith, birth decade = 1880s, location contains "Oslo");
  - a pure evaluator in `src/shared/` that computes membership on read (not stored in `entity_tags`);
  - UI to create and edit rules;
  - showing derived tags in chips, Groups and filters, read-only.

### 4.3 Sources and citations
- **Status:** Not started · **Effort:** M · **Source:** MID_DEVELOPMENT §5 (`person_sources`), §9; WILD_IDEAS H4
- **Today:** there is no source field on `FieldValue` or `Relationship`.
- **To do:** a project-scoped `Source` entity (title, URL, author, note) plus `source_ids` on `FieldValue` and `Relationship`. The profile and RelationshipsView show citation chips. Export/import and the hosted schema must carry it.

### 4.4 Person kind and canon flag
- **Status:** Not started · **Effort:** S · **Source:** MID_DEVELOPMENT §5 (`person.kind` real/fictional/historical + `canon`), §9 ("canon vs headcanon")
- **Notes:** this could be done with the trait system (a locked select trait) rather than new columns. A *Canon* lens would then dim headcanon people and edges.

### 4.5 Confidence and provenance shown visually
- **Status:** Not started · **Effort:** M · **Source:** WILD_IDEAS H4
- **Today:** dashed links mean an *ended* bond, not an uncertain one. `number_range`/`date_range` values carry date uncertainty only.
- **To do:** a `confidence` value (0..1) on relationships and values. Uncertain links render faded or dotted, using a dash style distinct from *ended*. It ties into sources (§4.3).

### 4.6 Trait timeframes actually used
- **Status:** Partial · **Effort:** M · **Source:** PERSON_FORM_REWORK §4
- **Today:** in Advanced mode, the trait menu can set or remove a timeframe, with year inputs saved via `coerceTimeframe`, but **nothing reads it**.
- **Missing:** the time slider, graph labels, profile and Sheet should show a trait's value *as of* the scrubbed year (e.g. occupation or location over time). It also feeds §3.5's migration flows.

### 4.7 Trait menu: "Change type"
- **Status:** Not started · **Effort:** S–M · **Source:** PERSON_FORM_REWORK §4 (deferred)
- **To do:** safe conversions (text↔select, number↔slider, date↔date_range) in `src/shared/fields.ts`, with a preview of values that can't convert before committing. It should be one undo step.

### 4.8 Trait menu: "Default value"
- **Status:** Not started · **Effort:** S · **Source:** PERSON_FORM_REWORK §4 (deferred)
- **To do:** a `default_value` on `FieldDef` for locked defs. `persons:create` / `createMany` pre-fill it, and the form shows it pre-filled for new people.

### 4.9 Drag to reorder name-slot chips
- **Status:** Not started · **Effort:** S · **Source:** PERSON_FORM_REWORK §3/§4 (`useDragList` was meant to be reused)
- **Today:** `SlotDock.vue` `reorderName(def, ±1)` uses ‹ › buttons only.

### 4.10 Time travel, rebirth, physical age vs birth age
- **Status:** Not started · **Effort:** L · **Source:** designDraft big fixes ("features to handle time travel, rebirth, physical age and birth age")
- **Today:** age is always calendar time since the birth `DateValue`. `CharacterDoc.age_from`/`age_to` only choose a look.
- **To do (design needed):**
  - an optional per-person **life segments** list (`[{from: DateValue, to: DateValue, ageAtStart}]`) or an "age offset" trait, so physical age can differ from elapsed calendar time;
  - **rebirth** as a linked person ("incarnation of") with a relationship type and a dashed continuation on the Timeline;
  - layout and age math in `layoutAge.js` / `timelineLayout.js` reading the physical age when present.

### 4.11 Media beyond photos
- **Status:** Not started · **Effort:** L · **Source:** WILD_IDEAS E1
- **Today:** `ImageRecord` is the only media type, and the file picker allows jpg/png/gif/webp only (`src/main/ipc.js`).
- **To do:** a generalized `MediaRecord` (audio, video, PDF/scanned letters) with a player in the profile. On desktop, files go next to `images/` under a new protocol path. On web, IndexedDB blobs, not data URLs, since the files are large. Plan quotas would apply.

### 4.12 Rich lore pages per person
- **Status:** Not started · **Effort:** M · **Source:** MID_DEVELOPMENT §9 ("story/lore attachments … link scenes/chapters")
- **Today:** a plain multiline Bio trait, plus Chronicle events with casts.
- **To do:** a rich-text (Markdown) trait type with internal links to people, events and eras.

---

## 5. Character view

### 5.1 Aging on the Timeline
- **Status:** Not started · **Effort:** M · **Source:** CHARACTER_VIEW_PROPOSAL "Still open", §8.2
- **Today:** looks can carry `age_from`/`age_to` (set in the Character view's "Age range" inputs), but nothing outside the Character view reads them. Timeline pins use `primary_image` only.
- **To do:**
  - rasterize each age-bound look to the avatar atlas;
  - the Timeline (and the graph under time travel) picks the look whose range contains the person's age at the scrubbed year;
  - cross-fade between neighbouring looks;
  - decide what happens when ranges overlap or leave gaps (an open question in the proposal).

### 5.2 Portrait studio: group photos
- **Status:** Not started · **Effort:** M · **Source:** CHARACTER_VIEW_PROPOSAL §8.3
- **Today:** `PhotoStudio.vue` handles one character at a time.
- **To do:** pick a tag or group, then lay members out by generation on a backdrop and export through the Export modal.

### 5.3 Trait-driven wardrobe
- **Status:** Partial · **Effort:** M · **Source:** CHARACTER_VIEW_PROPOSAL §8.7
- **Today:** "Wear group colors" (`wearTag`) manually applies a tag colour to the outfit, in 2D only.
- **Missing:** automatic mapping (occupation → garment or accessory, tag → outfit colour), and the same for the 3D wardrobe (`human3d/wardrobe.ts`).

### 5.4 3D look share codes
- **Status:** Not started · **Effort:** S–M · **Source:** CHARACTER_VIEW_PROPOSAL "Still open"
- **Today:** `encodeDNA` writes `FTC1.` codes for 2D docs only, and `model3d` isn't included.
- **To do:** an `FTC3.` (or versioned) code that serializes sanitized `Human3DState` (quantized sliders), with copy/paste in `Character3DEditor.vue`.

### 5.5 Poses that need IK
- **Status:** Not started · **Effort:** M · **Source:** CHARACTER_VIEW_PROPOSAL "Still open"
- **Today:** `human3d/poses.ts` has contrapposto, wave, thinking, heroic, shy and clasped.
- **To do:** arms-crossed and hands-on-hips need a two-bone IK solver so hands land on the body surface without clipping.

### 5.6 Side-by-side style comparison
- **Status:** Partial · **Effort:** S · **Source:** CHARACTER_VIEW_PROPOSAL §8.5
- **Today:** switching style plays a 620 ms snapshot cross-fade.
- **Missing:** rendering the same character in several styles side by side, for cover art and comparison.

### 5.7 Resemblance overlay
- **Status:** Not started · **Effort:** S · **Source:** CHARACTER_VIEW_PROPOSAL §8.8
- **To do:** ghost one relative's look at about 40% over the current one on the stage.

### 5.8 Crest / heraldry builder
- **Status:** Partial · **Effort:** L · **Source:** CHARACTER_VIEW_PROPOSAL §8.10, WILD_IDEAS C4 + "heraldry generator", MID_DEVELOPMENT §9
- **Today (2026-10-18):** the Medieval theme's pure heraldry in `lib/medievalArt.ts`: `blazonFor(id, gender)` gives each **person** a stable coat of arms (gender picks the tincture; the rule of tincture is kept), shown via `medievalAvatarBg` in that theme only. The `heraldry` graph preset draws shield nodes.
- **Missing:** arms per **tag** (the Groups view still has none), arms outside the Medieval theme, and any way to edit a blazon.
- **To do:**
  - step 1 (cheap, WILD_IDEAS C4): a deterministic sigil per tag, hashing label and colour into an emblem for the Groups view;
  - step 2: an editable crest pack reusing the slot and palette engine.

### 5.9 Hypothetical child from any two people
- **Status:** Partial · **Effort:** S · **Source:** CHARACTER_VIEW_PROPOSAL §8.1 ("descendant preview")
- **Today:** `inheritFromParents()` (2D) and `inherit` (3D) only use the person's own linked parents, and overwrite the current look.
- **Missing:** picking any two people, and a non-destructive preview.

### 5.10 More art styles
- **Status:** Not started · **Effort:** L each (art-heavy) · **Source:** CHARACTER_VIEW_PROPOSAL §4 table (ink-wash 水墨, renaissance)
- **Today:** the 2D packs are anime, realistic, simple and cartoon, plus the separate 3D style. 水墨 exists only as the app theme.
- **To do:** an ink-wash pack would fit the Ink theme and could reuse `lib/inkArt.ts` brush primitives. A renaissance pack would prove painterly raster sprites.

### 5.11 3D characters in the Space graph
- **Status:** Not started · **Effort:** L · **Source:** CHARACTER_VIEW_PROPOSAL §7
- **Today:** `Graph3DView.vue` draws nodes from `primary_image` only.
- **To do:** use the impostor atlas at population scale, with the live mesh only for the focused node (LOD).

### 5.12 Portrait vs photo preference
- **Status:** Partial · **Effort:** S · **Source:** CHARACTER_VIEW_PROPOSAL §10 (open question)
- **Today:** "Set as portrait" makes the character image primary, and the user can switch back via `images:setPrimary`. The last action wins.
- **Missing:** a saved per-person (or project) preference, "prefer photo" or "prefer character".

### 5.13 Expressions per surface or from data
- **Status:** Not started · **Effort:** M · **Source:** CHARACTER_VIEW_PROPOSAL §8.6
- **Today:** there is one `expression` per doc, and nothing outside the Character view reads it.
- **To do:** per-surface overrides (e.g. stern on graph nodes, warm in the inspector), and optional derivation from data.

---

## 6. App-wide UX

### 6.1 Onboarding tutorial / guided tour
- **Status:** Partial · **Effort:** M · **Source:** designDraft (twice), design.md, MID_DEVELOPMENT §8 Phase D, §11 ("Onboarding … matters far more on the web")
- **Today:** Settings → Help has static getting-started steps, view descriptions and shortcuts (opened by `?`). The 3D view has a hints card.
- **Missing:**
  - a first-run interactive tour with coach marks on the real UI (add person, link, switch view, scene, undo);
  - per-view "what's this?" tips;
  - a demo-project entry ("explore a sample tree" — the first-run seed exists).
- **Notes:** keep it dependency-free, as a small `TourHost.vue` with step anchors via `data-tour` attributes. Steps should be gated on Program Mode.

### 6.2 Right-click context menus
- **Status:** Partial · **Effort:** M · **Source:** designDraft big fixes ("right click")
- **Today:** only the Sheet view has one (`SheetView.vue` `onContextMenu`). Map and MiniMap just block the browser menu.
- **To do:** one shared `ContextMenu.vue` primitive. Graph node: edit, add relative, trace, tag, pin, style, delete. Canvas: add person here, paste, refresh layout. Timeline life, Groups zone and Directory card get their own menus. Action lists can come from the existing action-pane and wheel catalogs.

### 6.3 Select a random person
- **Status:** Not started · **Effort:** S · **Source:** designDraft big fixes
- **Today:** the only random pick is Browse's "Surprise me" (community trees).
- **To do:** a command-palette entry and dock button. It selects a random person (within current filters), centres the camera on them, and opens the action pane.

### 6.4 Responsive toolbars collapse to icons
- **Status:** Partial · **Effort:** M · **Source:** designDraft styles ("make the buttons of the bottom bar into icons so it become smaller. find and fix all similar problems")
- **Today:** some top-bar labels hide below 1100px / 900px, and `SceneTabs` hides hints. The graph's bottom bar (`.ctrl-btn-wide`) and `TimeSlider.vue` have no compact state.
- **To do:** container queries (`container-type: inline-size`) on each strip, with icon-only variants and tooltips. Then audit every view's header and bottom strip at 800px and 1024px widths.

### 6.5 Font settings and custom fonts
- **Status:** Partial · **Effort:** M · **Source:** designDraft styles ("a couple default ones, and allow the user to import their own font styles, font size, color")
- **Today:** the only control is the graph's *Label size* slider. The bundled fonts are tied to their themes: the brush fonts to Ink, the blackletter/Cinzel set to Medieval.
- **To do:**
  - an app font choice (a few bundled OFL fonts);
  - a UI scale (`--fs-*` multiplier);
  - user font import (a woff2 stored like an image, then a `FontFace` registration);
  - per-view label font and colour.
- **Notes:** canvas renderers must wait for fonts to load (there's an `inkFontsReady()` pattern to follow).

### 6.6 Per-view themes and backgrounds
- **Status:** Partial · **Effort:** L · **Source:** designDraft big fixes ("nodes are rectangular plates on water surface with ripple effect, the water reflects, connections are stone slabs or waterflow")
- **Today:** there are four app themes (light / dark / ink / medieval), 28 graph presets with atmospheres, and the Timeline's own style pane. The standing **`plate` / `flatplate`** node shapes exist (`nodeShapes.js`; names above the crown), which covers the "rectangular plates" half of the request.
- **Missing:** the water surface itself (ripples on drop, reflections, stone-slab or water-flow links), and a per-view background colour or image picker. Gravestone (§2.3) and constellation (§2.10) are siblings of this.
- **Medieval theme follow-ups:** the shell, the DOM views (through the shared hook classes), full-screen pages and the graph (`graph/MedievalBackdrop.js`, the `heraldry` / `illuminated` presets) are dressed. The canvas views (Timeline, Groups, Map) render as the plain light theme, where Ink has its own painters per view (`TimelineInk.js`, `FactionsInk.js`, the `shanshui` map style). There are no Medieval Directory card styles or map style either (Ink has `scroll` / `moonfan` and `handscroll`), and no CJK blackletter: Chinese falls back to the system serif.

### 6.7 Sound effects and music
- **Status:** Not started · **Effort:** M · **Source:** designDraft ("is adding music and sfx great for this program… give me a plan")
- **Today:** no audio anywhere.
- **Plan:**
  - Web Audio only. Short synthesized or tiny OGG cues (node drop, link made, delete, undo, scene switch), and an optional ambient bed per theme (ink theme: guqin or wind).
  - One `lib/sound.ts` with lazy `AudioContext` creation on first user gesture, a master mute toggle (off by default), a volume setting, and reduced-motion/quiet respect.
  - Performance cost is negligible if sounds are pre-decoded once and no per-frame work happens.
  - It could later host the sonification moonshot (§14).

### 6.8 Export formats and print
- **Status:** Partial · **Effort:** M · **Source:** MID_DEVELOPMENT Phase D, WILD_IDEAS G2, the `hiresExport` perk
- **Today:** the Export modal outputs PNG/JPEG/WebP; "Print A4 · 300dpi" is only a pixel-size preset. There's no `@media print` or `window.print`, and no PDF or SVG output except character SVG export.
- **Missing:** PDF export (multi-page wall chart), SVG export of the graph, and a print stylesheet. The `hiresExport` perk is shown as "Soon" on the pricing page.

### 6.9 AI chat assistant
- **Status:** Not started · **Blocked:** zero-cost (pay-per-use API) · **Effort:** L · **Source:** designDraft ("ai chat bot, asking questions, edit family tree, fetch data")
- **Notes:** it would sit behind a store-action tool layer (never calling channels directly), and could later be sold as credits (§14, P5).

### 6.10 Keyboard shortcut cheat sheet
- **Status:** Partial · **Effort:** S
- **Today:** shortcuts are listed in Settings → Help (`?` opens it). There is no dedicated overlay listing per-view keys (Tab wheel, Timeline 1–6, Shift+←/→, Ctrl+Z/X, Ctrl+S).

### 6.11 Localize the hardcoded views
- **Status:** Done (2026-10-11), except the legal text · **Source:** MID_DEVELOPMENT Phase E (i18n); surfaced while adding the Norwegian locale (§1.3)
- **Done:**
  - Every view and panel now translates through `t()` in all four locales: Graph (including the "Gen N" guide lines, Spotlight rings and other canvas text), Style panel, action pane and wheel, Timeline (canvas labels too), Time slider, Chronicle, Groups, Kinship, all Directory modes including the Sheet, Relationships, the person form and profile, the app shell, Export, sign-in screens and the landing page.
  - The locale files grew from about 1,530 to about 5,000 lines each.
  - Built-in data that is stored in English is translated at display time by `lib/dataLabels.ts`, but only while it still has its seeded default text. That covers relationship types, roles and statuses, the default traits, Male/Female, the "Person" noun, default names such as "Scene 1", "Timeline" and "Untitled era", and the guest account name.
  - `tests/i18n.test.js` guards it: identical keys in every locale, placeholders kept, and every literal `t('…')` key present in `en.js`.
  - Checked in the web build: an automated sweep of every view, pane, Directory mode, dialog and page in Simplified and Traditional Chinese finds no leftover English, apart from user data and mock community content.
- **Left on purpose:**
  - `LegalModal.vue`: Terms and Privacy stay English until they're reviewed (machine-translated legal text is risky).
  - Icon-picker tooltips, which come from Lucide icon names.
  - Error messages produced by `src/shared` (`res.error`, e.g. quota refusals) when the renderer has no mapping for them.
  - The Sheet's yes/no parser still accepts English words only.
  - Text generated into stored data, such as map feature names and "Scene N" / "Group N", is written in the language active when it's created.
- **Follow-ups:**
  - A native-speaker proofread of zh-Hans, zh-Hant and nb.
  - Translating `src/shared` error messages (return error codes, map them in the renderer).
  - Name labels overlap in the generation rows of the graph. This is a layout issue that predates this work.

---

## 7. Generation, storytelling and play

All client-side, zero-cost. Most come from WILD_IDEAS.

| # | Item | Status | Effort | What exists / what to build |
|---|---|---|---|---|
| 7.1 | **Family / dynasty generator** (designDraft "generate family base on a few user criteria", WILD_IDEAS C1) | Not started | L | Only the first-run `seedSampleData` and the map's "Generate a world". Build a seeded generator in `src/shared/` (generations, family size, mortality, era, culture, feud chance) that emits people + relationships + traits through `persons:createMany` as one undo step. |
| 7.2 | **Name generator** (C2) | Done (2026-10-26) | — | `lib/nameGen.ts` + `NameDice.vue` in the person form's Name slot: nine cultures, per-tag training, parent surnames. Left: the dice in `PersonPicker`'s inline create; multi-word surnames. Ready to feed 7.1. |
| 7.3 | **Trait inheritance simulator** (C3, designDraft "show genetic inheritance") | Not started | M | Only character-*look* inheritance exists. Model selected FieldDefs as genes (dominant/recessive alleles), predict a child from two parents, flag carriers across the tree, and show inherited traits flowing in the graph (a lens). |
| 7.4 | **Drama detector** (A4) | Partial | M | `romanceInsights` finds mutual/one-way likes, triangles and rival admirers over `likes` edges only. Missing: feuds (rival chains across families), forbidden romance across rival tags, black sheep, reconciliations, and any use of tags or other types. |
| 7.5 | **Sentiment / dynamics lens** (A3) | Done (2026-10-26) | — | `src/shared/sentiment.ts`; type + per-edge sentiment/intensity, graph Dynamics lens. Left: a feeling control in PersonForm's bond cards, a Timeline version, persisting the lens toggle. |
| 7.6 | **Living-census scrubber** (B2) | Done (2026-10-26) | — | `time/censusMath.ts` + `CensusPanel.vue` on the Time slider. Left: "divorced" status without an `ended` year still counts as a couple. |
| 7.7 | **Auto life story / obituary** (E4) | Not started | M | Templated (no AI) prose from structured data + kinship names. Doubles as a screen-reader narrative and the future SSR profile body. |
| 7.8 | **Completeness meter / quests** (F1) | Not started | S | RelationshipsView has an Issues filter for structural problems. Add missing-field counts (birth year, photo, parents), a progress ring and click-through to fix. |
| 7.9 | **Guess-who / twenty questions** (F3) | Not started | M | The Kinship quiz exists (name/who/hops). Add yes/no attribute questions narrowing to a mystery person. |
| 7.10 | **Family fingerprint** (D4) | Done (2026-10-26) | — | `src/shared/fingerprint.ts` + `projects:fingerprints`, `components/fingerprint/`: Projects/profile cover art, dialog with PNG/SVG download. |
| 7.11 | **What-if branch canons + diff** (B3) | Not started | L | Branch a project at a moment and diff people/relationships between branches. Could start from `projects:duplicate` plus a diff view. |
| 7.12 | **Dynasty simulator** (H2) | Not started | L | Evolve the tree forward by rules; depends on 7.1. |
| 7.13 | **Oral-history interview mode** (E2) | Not started | M | Guided prompts plus MediaRecorder, auto-attached to the person. Depends on 4.11. |
| 7.14 | **Time capsule** (E3) | Not started | S | A message sealed until a date. |
| 7.15 | **Cross-project person links** (G4) | Not started | L | One character across several projects ("shared universes"). |

---

## 8. Sharing, community and interop

### 8.1 GEDCOM import/export
- **Status:** Not started · **Effort:** L · **Source:** MID_DEVELOPMENT Phase C and Step 4, DEPLOYMENT_PLAN Phase 5, the pricing perk `gedcom` (shown as "Soon")
- **To do:**
  - a pure GEDCOM 5.5.1 parser and writer in `src/shared/`;
  - map INDI/FAM records to persons + `parent_child`/`spouse` relationships;
  - map dates to `DateValue` (ABT/BEF/BET to ranges), places to the location trait, and notes to bio;
  - import through the existing `projects:import` path, with a mapping report (what was skipped).
- **Notes:** it needs tests with real-world files.

### 8.2 Wikidata / Wikipedia / fandom import
- **Status:** Not started · **Effort:** M–L · **Source:** MID_DEVELOPMENT §9, Step 4
- **Notes:** fandom.com's API works (data + images, batch 50); awoiaf is Cloudflare-blocked. Wikidata's SPARQL endpoint is free. Import should go through `projects:import` and record sources (§4.3).

### 8.3 Serverless whole-tree share codes
- **Status:** Partial · **Effort:** M · **Source:** WILD_IDEAS G1
- **Today:** only character looks have codes (`FTC1.`). There is no `#data=` handling.
- **To do:** compress (CompressionStream + base64url) a small project file into a URL fragment, and open it read-only, with "Save a copy" going through `projects:import`. This gives sharing with no server.

### 8.4 Real share links, visibility and collaborators
- **Status:** Partial · **Blocked:** hosted · **Effort:** L · **Source:** MID_DEVELOPMENT Phase B, DEPLOYMENT_PLAN Phase 5, designDraft "share buttons?"
- **Today:**
  - `Project.visibility: 'private'|'public'` works locally (Projects page toggle);
  - `ProjectShare` / `ShareVisibility ('private'|'link'|'public')` are unused placeholder types (`types.ts`);
  - the UserPage Sharing card is a disabled "Soon" preview with mock data;
  - `tree_collaborators` + RLS exist only in `supabase/schema.sql`;
  - there's no `unlisted`/link visibility in app code, and no `navigator.share` or copy-link action.
- **To do:** implement `ProjectShare` (link tokens, roles viewer/editor) in dbCore and Supabase, then the Sharing card, a share button in the topbar, and copy-link and native share.

### 8.5 Browse / community on real data
- **Status:** Partial (mock) · **Blocked:** hosted · **Effort:** L · **Source:** MID_DEVELOPMENT Phase B/E, CLAUDE.md
- **Today:**
  - all community data is mock: `browse/browseData.ts` (profiles, projects, comments, activity) and `home/mockProjects.ts` (landing gallery, "coming soon");
  - the viewer's likes, saves, follows, grafts and own comments live in per-account localStorage (`browseSignals.ts`);
  - your own public projects aren't published anywhere.
- **Missing:** a published-projects query (RLS "public"), likes/saves/follows/comments tables, notifications, real creator profiles, search server-side, and the SSR/OG profile pages and SEO from §10.8.

### 8.6 Fork / remix ("graft") of real trees, and merge requests
- **Status:** Partial · **Blocked:** hosted · **Effort:** L · **Source:** MID_DEVELOPMENT Phase B, §9 ("pull-requestable")
- **Today:** graft works from mock projects (`toProjectFile` → `projects:import`). There's no `forked_from` in app code (only in the SQL schema), no upstream sync, and no pull-request-style merges.

### 8.7 Real-time co-editing ("grove")
- **Status:** Not started · **Blocked:** hosted · **Effort:** L · **Source:** MID_DEVELOPMENT Phase E, the `coEdit` perk
- **Today:** the Grove "join" request is simulated with a timeout (`BrowseDetail.vue`).
- **Notes:** Supabase Realtime or Yjs. Undo, the journal and checkpoints will need a multi-writer story.

### 8.8 Embeddable widget
- **Status:** Not started · **Effort:** M · **Source:** MID_DEVELOPMENT §9, WILD_IDEAS P9
- **Notes:** a read-only `?embed=1` mode of the web build (no chrome, one view, a "Made with FamilyTree" backlink). It could work on share codes (8.3) before hosting exists.

### 8.9 Reunion pack and QR codes
- **Status:** Not started · **Effort:** M · **Source:** WILD_IDEAS G2/G3
- **Notes:** a printable wall chart, name tags, a who's-who booklet and quiz sheet (needs the print support in §6.8). Per-person QR codes need a small QR encoder; only the `qr-code` icon is registered today.

### 8.10 Public API
- **Status:** Not started · **Blocked:** hosted · **Effort:** L · **Source:** MID_DEVELOPMENT §9, WILD_IDEAS P12

### 8.11 Persistent version history
- **Status:** Not started · **Effort:** L · **Source:** MID_DEVELOPMENT §9 ("undo across sessions, see this tree as of last year")
- **Today:** undo stacks are in memory only and reset with the process (`src/shared/history.ts`). The checkpoint is a single snapshot.
- **To do:** an append-only event log per project (persisted), a history browser, and "restore as copy".

---

## 9. Hosted backend (Supabase) gaps

`src/renderer/src/api/backends/supabase.ts` implements projects (getAll/overview/create/rename/delete/setActive), persons (incl. batch), fields (incl. batch), relTypes, relationships, tags, scenes, images, settings and globalSettings. Every other channel falls through to "not implemented yet". **Note:** the file's header comment lists only characters and history as pending, which understates the gap.

### 9.1 Missing channel families
- **Status:** Partial · **Blocked:** hosted · **Effort:** L total

| Channel family | Consequence on the hosted build |
|---|---|
| `projects:update` | **Bug-level:** Projects page edits (visibility, description, access mode) fail. |
| `projects:import` / `export` / `duplicate` | No project files, no graft, no duplicate. |
| `auth:*` (session, login, register, guest, logout, changePassword, updateProfile, usage) | The store signs in via Supabase Auth directly (`signUp`/`signIn`/`signOut`), but change password, profile edits and the usage bars fail. |
| `characters:*` | No Character view data (the schema has no characters table, and `importToSupabase.js` skips them). |
| `history:*` / `checkpoint:*` | No undo/redo, no Save/Revert checkpoint. |
| `eras:*` / `events:*` | No Chronicle (the store treats the failure as an empty chronicle). |
| `maps:*` | No Map view data. |
| `billing:*` | The pricing modal degrades to "Payments open soon" (see §11). |

**To do:** port each family, reusing the shared handlers over an in-memory slice the way fields and relTypes already do, add the missing tables to `supabase/schema.sql` (characters, eras, events, maps; history can stay client-side), and update the header comment.

### 9.2 Plan is hardcoded to free on hosted
- **Status:** Bug · **Effort:** S
- **Today:** `mirrorAuthUser` in the store sets `plan: 'free'` and never reads `profiles.plan`. Hosted users therefore always resolve as free, both in `caps` and in quota display.

### 9.3 Email verification and password reset
- **Status:** Not started · **Blocked:** hosted · **Effort:** S–M · **Source:** MID_DEVELOPMENT §11 ("email verification")
- **Today:** there's no `resetPasswordForEmail`, no "forgot password" screen, and no confirmation-link handling.
- **To do:** a Forgot-password flow in `SupabaseAuthGate.vue`, a reset page, and confirmation redirects (needs DEPLOYMENT_PLAN Step 3.4's Site URL).

### 9.4 Remaining deployment steps
- **Status:** Not started · **Blocked:** hosted (human steps) · **Source:** DEPLOYMENT_PLAN
- **Remaining steps:**
  - Step 3.2: run the importer (the script exists);
  - 3.3: Vercel project and env vars;
  - 3.4: Supabase Site and Redirect URLs;
  - Phase 4 in full (see §10).

---

## 10. Deployment, security, privacy and legal

### 10.1 Paid chunks served behind auth
- **Status:** Partial · **Blocked:** hosted + a paid tier · **Source:** DEPLOYMENT_PLAN 2.8, CODE_PROTECTION Phase 3
- **Today:** `paid/index.ts` `gated()` lazy-loads `Graph3DView` and `CharacterView` after a `caps` check, and the web build names them `paid-space3d-*` / `paid-character-*`. They are still public static files, so the gate is client-side only.
- **Missing:** an auth-checked serverless route serving `paid-*` chunks (deliberately deferred until a paid tier exists).

### 10.2 Obfuscation coverage
- **Status:** Partial · **Source:** DEPLOYMENT_PLAN 3.2b, CODE_PROTECTION Phase 4
- **Today:** `javascript-obfuscator` runs in the production web build on `src/shared/` only, because obfuscating Vue components broke the build. `sourcemap: false` and the copyright banner are in place.
- **Open:** widen the scope (e.g. to `api/`, `paid/`, `store/`) if feasible. Run the manual click-through (Step 3.2c) before the first deploy.

### 10.3 GDPR: export my data and delete my account
- **Status:** Not started · **Effort:** M · **Source:** DEPLOYMENT_PLAN 4.2, MID_DEVELOPMENT §11 (launch blocker)
- **Today:** no `auth:deleteAccount`, no "export all my data", no buttons on `UserPage.vue`.
- **To do:**
  - "Export my data": all projects as project files in a zip or one JSON file (per-project export already exists);
  - "Delete my account": cascade projects, images and sessions in dbCore, plus a Supabase function on hosted;
  - both behind `confirmDialog`.

### 10.4 Privacy Policy accuracy
- **Status:** Bug (hosted) · **Effort:** S · **Source:** DEPLOYMENT_PLAN 4.1, MONETIZATION §6
- **Today:** `LegalModal.vue` says, in effect, "a username… no email, no tracking". Supabase signup collects an email.
- **To do:** hosted-specific wording (email, the EU region, Supabase as sub-processor, retention). Payment-provider wording comes later (§11). The Terms must explicitly forbid re-hosting (CODE_PROTECTION Phase 5).

### 10.5 Living-person privacy and reporting
- **Status:** Not started · **Blocked:** hosted · **Effort:** M · **Source:** DEPLOYMENT_PLAN 4.3, MID_DEVELOPMENT §11
- **To do:**
  - new projects default private;
  - warn before making a project public if anyone lacks a death date (likely alive);
  - optionally redact living people in public views;
  - a **Report** button on public trees, plus an admin queue (moderation is a launch blocker for public sharing).

### 10.6 LICENSE and private repo
- **Status:** Not started · **Effort:** S · **Source:** DEPLOYMENT_PLAN 4.5, CODE_PROTECTION Phase 5
- **Today:** no `LICENSE` file, and no `license` field in `package.json`. The copyright line in the README, About panel and landing footer is done (§1.5).
- **To do:** a proprietary LICENSE file ("all rights reserved") and `"license": "UNLICENSED"` in package.json. Check that the GitHub repo is private (a human step).

### 10.7 Error tracking and analytics
- **Status:** Not started (stubs) · **Effort:** S · **Source:** MID_DEVELOPMENT §7, DEPLOYMENT_PLAN 4.4
- **Today:** `lib/observability.js` is entirely `TODO(web migration)` no-ops. Neither `@sentry/*` nor `posthog-js` is installed.
- **To do:** wire the real SDKs behind the existing API and env vars. The Sentry free tier needs no card.

### 10.8 SEO, server-rendered profile pages and Open Graph previews
- **Status:** Not started · **Blocked:** hosted · **Effort:** L · **Source:** MID_DEVELOPMENT §4.3, §11
- **To do:** prerendered or SSR public tree and person pages with OG/Twitter cards and schema.org `Person`, plus a sitemap. Consider Nuxt or prerendering only for the discovery pages.

### 10.9 Web Content-Security-Policy
- **Status:** Not started · **Effort:** S · **Source:** MID_DEVELOPMENT §11, MONETIZATION §5
- **Today:** Electron has a tight CSP. The web build has none: no meta tag in `index.html`, no `vercel.json` / `_headers`.
- **To do:** a CSP for the web build allowing Supabase and the bundled fonts.

### 10.10 Server-side validation and rate limiting
- **Status:** Not started · **Blocked:** hosted · **Effort:** M · **Source:** MID_DEVELOPMENT §10
- **Today:** there's no schema validation library. The only throttling is the login lockout (5 failures → 5 minutes).
- **To do:** Zod (or Valibot) schemas for channel payloads shared between client and server; rate limits on writes and auth.

### 10.11 Backups and accessibility
- **Source:** MID_DEVELOPMENT §11
- **Backups:** Not started · hosted. Verify Supabase backups and test a restore.
- **Accessibility:** Not started as a pass. ARIA and keyboard navigation for the DOM views (Directory, Relationships, Sheet), contrast checks of the tokens, and a text alternative for the WebGL views (the life-story idea in §7.7 helps).

---

## 11. Monetization

**Blocked:** zero-cost for everything below. The client is built; the money isn't. Full detail is in [`MONETIZATION.md`](./MONETIZATION.md).

| Item | Status | Notes |
|---|---|---|
| Pick a provider (Merchant of Record recommended) | Not started | A human decision; needs bank details. |
| Provider products/prices matching `PLAN_CATALOG`; `providerPriceId` on `PlanOffer` | Not started | Recreate the promo codes at the provider; delete `SANDBOX_COUPONS`. |
| Server-side `billing:createCheckout` (Edge Function) | Not started | No `supabase/functions/` folder exists yet. |
| Desktop checkout via `shell.openExternal` through a new explicit preload channel, plus a return deep link | Not started | Keep the sandbox: no widened renderer privileges. |
| Billing webhook + `billing_events` idempotency table | Not started | Missing tables: `subscriptions`, `invoices`, `billing_events`. |
| `billing:portal` + "Manage payment method" in `BillingPanel.vue` | Not started | |
| `past_due` status + grace-period banner | Not started | `SubscriptionStatus` is `'active' \| 'canceled'` only. |
| Remove `billing:completeSandboxCheckout` from hosted; CI check that `VITE_BILLING_SANDBOX` isn't set in production | Not started | |
| `billing:*` in `supabase.ts` | Not started | See §9.1. |
| Real `AdProvider` (`setAdProvider` is defined but never called), consent banner, web CSP for the ad network, impression/click measurement | Not started | House ads only today. |
| Legal: subscription Terms, EU/Norway withdrawal-right wording on the checkout checkbox, VAT-inclusive prices, Privacy Policy sub-processors, 5-year invoice retention | Not started | |
| Later: proration, local currencies, team/education plans, one-time purchases, AI credits, store in-app purchase adapter, desktop entitlement check | Not started | MONETIZATION §4.7. |
| Paid-exclusive features | Not started (by design) | `PLAN_FEATURES` gives every plan `['*']`; non-live perks (co-edit, hi-res export, GEDCOM, AI credits, priority support) show "Soon". |

---

## 12. Engineering and tooling

| Item | Status | Effort | Detail |
|---|---|---|---|
| **Pinia store to TypeScript** | Not started | L | `store/index.js` is about 2,300 lines of JS with a stub `index.d.ts` typing it as `any`. MID_DEVELOPMENT names it the next conversion. |
| **`vue-tsc` + `lang="ts"` components** | Not started | M | There are zero TS Vue components; `typecheck` covers `.ts` files only. |
| **Per-view code splitting / lazy Three.js** | Not started | M | `App.vue` statically imports every view, and Three.js ships in the main bundle via the graph, timeline and groups renderers. Only Space 3D and Character are lazy. Big first-load win for Browse/Home on the web. |
| **E2E tests (Playwright) in CI** | Not started | M | The verify skill drives the app by hand. CI runs lint, format, `tsc` and Vitest only. Cover: create person, link, switch views, undo, project import. |
| **CI build step + bundle-size budget / Lighthouse** | Not started | S | CI doesn't even build. |
| **Preview deploys per PR** | Not started · hosted | S | |
| **Dependabot/Renovate, CodeQL** | Not started | S | |
| **Packaging and releases**: electron-builder installers, auto-update, CHANGELOG, semver tags | Not started | M | Version fixed at 1.0.0 and no git tags. Code signing costs money (zero-cost), so ship unsigned at first. |
| **Automated rendering coverage** | Not started | L | CLAUDE.md: rendering and interaction have no automated tests (screenshot tests are possible via the Playwright harness). |

---

## 13. Mobile

- **Source:** MID_DEVELOPMENT §4.4, DEPLOYMENT_PLAN Phase 6, designDraft ("take a deep look at the whole program, make changes to the components, the placements, the icons, the menus")

| Stage | Status | Detail |
|---|---|---|
| **M1: responsive + touch** | Partial | About 30 `max-width` media queries (Home, Browse, Projects, PersonModal, Pricing…) and `touch-action: none` on canvases. Pinch-zoom is explicit only in the Map; the graph gets it via d3-zoom; Space via OrbitControls. **Missing:** a phone layout for the shell (rail → bottom nav, docks → sheets), pinch-zoom on Timeline and Groups, touch equivalents for Ctrl/Shift-click and the Tab wheel (long-press menus, §6.2), a coarse-pointer hit-slop, and an audit of every view at 375px width. |
| **M2: installable PWA** | Not started | No manifest, no service worker, no `public/` folder, empty favicon. The IndexedDB backend already works offline. Add a manifest + icons + a service worker that caches the static build. |
| **M3: Capacitor store apps** | Not started · zero-cost | Store fees ($25 / $99 a year). |

---

## 14. Moonshots and commercial bets

Not started. Listed so they stay on record; details are in [`WILD_IDEAS.md`](./WILD_IDEAS.md).

**Moonshots:**
- **H3, sonification**: Web Audio; pairs with §6.7.
- **H5, WebXR**: walk the Space graph in VR.
- **AI tree builder / photo-of-a-hand-drawn-tree import**: zero-cost blocked.

**Commercial ideas** (all zero-cost blocked unless noted):

| Code | Idea | Blocked by |
|---|---|---|
| P2 | Print-on-demand heirlooms | Pay-per-order partner |
| P3 | Legacy vault with heirs and dead-man's switch | Hosted; also a liability question |
| P4 | Style/content packs (one-time purchases) | Payments |
| P5 | AI credits | Payments + API |
| P6 | DNA-kit affiliate | Privacy risk; approach with care |
| P7 | Sponsored/verified canonical trees | Hosted + Explore |
| P8 | Creator marketplace | Needs an audience first |
| P9 | Embed backlink funnel | Nothing: can start now with §8.8 |
| P10 | Classroom edition | — |
| P11 | Estate-planning white-label | — |
| P12 | Paid API / data licensing | — |

---

## Appendix A: planned items that already shipped

These still appear as "planned", "likely next" or "possible future" in older docs, but they are **done in code**. Don't rebuild them; tidy the docs instead.

| Planned in | Item | Where it lives now |
|---|---|---|
| designDraft, design.md | Era for the Birth layout and the Timeline | Chronicle (`chronicle.ts`, `timeline/chronicleDraw.js`, `TextGuideOverlay._drawChronicle`) |
| designDraft | Main-character graph with rings, titles and centre stage | Spotlight layout (`spotlightLayout.ts`) |
| designDraft, MID_DEVELOPMENT, design.md | "Reveal info" in several languages; relationship path finder | Kinship engine + lens (EN/NO/简/繁), `shortestPath` trace |
| designDraft, design.md | Undo/redo of node moves | Store journal arrangement steps |
| designDraft | Map view | `MapView.vue` + `components/map/` |
| designDraft | Projects page instead of tabs | `ProjectsPage.vue` |
| designDraft | Consistent icon set | Lucide registry + `UiIcon`, no-emoji test |
| design.md, MID_DEVELOPMENT | JSON import ("currently a stub") | `projects:import` / `projects:export` |
| design.md, MID_DEVELOPMENT | Time-lapse playback | `TimeSlider.vue` (play, speeds, reverse, loop) |
| design.md, MID_DEVELOPMENT | Minimap, export styled image, 3D mode, multi-select drag, in-graph editing, self-defined relationship types, unknown name/age/gender, accounts, localization | `MiniMap.vue`, `ExportModal.vue`, Space layout, action wheel + action pane, `relTypes.ts`, trait system (all optional), `auth.ts`, `i18n/` |
| design.md | Editable link curvature | Bezier reshape (break points still open, §2.1) |
| designDraft | Divorced relationship rendering | `Relationship.ended` statuses → dashed ghosts |
| MID_DEVELOPMENT | Generalized relationship categories | Relationship-type registry with bands and weights |
| WILD_IDEAS | A1 kinship calculator, A2 bloodline meter, A5 linchpins, B1 story events, D2 bloodline flow, D5 POV lens, F2 quiz, F4 six degrees, H1 sentiment as physics (negative weights repel) | `components/kinship/`, Chronicle, rel-type `weight` in both simulations |
| CHARACTER_VIEW_PROPOSAL | Phases 1–4, gene-pool randomize, genetics from linked parents, FTC1 codes, undo/mirror/set-as-portrait, multiple age-bound looks | `components/character/` |
| DEPLOYMENT_PLAN | Step 2.7 plan switchboard, 2.8 paid chunks (client side), 3.1 importer script, 3.2b obfuscation (scoped) | `PLAN_FEATURES`, `paid/index.ts`, `scripts/importToSupabase.js`, `vite.config.web.js` |
| OVERHAUL_GUIDE | All phases 0–9 | Shipped; derived tags are the one leftover (§4.2) |
| designDraft, this doc §1 | Smaller view title bar; version from package.json; copyright notice; Norwegian UI locale; contact email in one place | `ViewHeader.vue`, `lib/appInfo.ts`, `i18n/locales/nb.js` (done 2026-10-11) |
| designDraft ("rectangular plates"), this doc §6.6 | Plate node shapes that stand on their point | `plate` / `flatplate` in `graph/webgl/nodeShapes.js` (2026-10-18; the water surface is still open) |
| — (new) | A fourth app theme: Medieval illuminated codex, with per-person coats of arms | `styles/medieval.css`, `lib/medievalArt.ts`, `graph/MedievalBackdrop.js`, `ui/MedievalBackdrop.vue` (2026-10-18; follow-ups in §6.6) |
| WILD_IDEAS | C2 name generator, D3 constellation skin, A3 dynamics lens, B2 census, D4 family fingerprint (2026-10-26) | `lib/nameGen.ts`, `graph/constellation.ts`, `src/shared/sentiment.ts`, `time/censusMath.ts`, `src/shared/fingerprint.ts` (see §7) |
| WILD_IDEAS §I | I1 household rivers, I5 tilted timeline with rising arcs, I7 time warp (2026-10-26) | `timeline/householdRivers.ts`, `timelineTilt.ts`, `timeWarp.ts` |

---

## Appendix B: stale statements in other docs

Worth correcting so the docs stop disagreeing with the code:

- **design.md → Roadmap:** "Likely next", "Bigger bets" and "Exploratory" are mostly shipped (Appendix A). It still says JSON import is a stub.
- **MID_DEVELOPMENT §2:** "three relationship types", "five views", "JSON import is a stub", "light mode needs polish". All of these are outdated.
- **DEPLOYMENT_PLAN → "What's still pending":**
  - lists 2.7–2.8, 3.1 and 3.2b as pending, but they're done (2.8 client-side only, 3.2b scoped to `src/shared/`);
  - omits that `projects:update`, chronicle, maps, billing and project files are missing on Supabase.
- **`supabase.ts` header comment:** lists only characters and history as pending (see §9.1).
- **CODE_PROTECTION_PLAN checklist:** every box is unticked, though P1 is done and P3/P4 are mostly done.
- **MONETIZATION §1** says strings exist "in all three locales". There are four now, since `nb` was added (§1.3).
- **WILD_IDEAS Part 1 → "Already planned":** lists many items that have since shipped (path finder, minimap, time-lapse, in-graph editing, curvature, map view, export image).

---

## Appendix C: in-code markers

`TODO` / "not implemented" / "coming soon" markers in `src/` (none in `tests/`) as of 2026-10-11, re-checked 2026-10-18 (unchanged):

| Location | Marker |
|---|---|
| `src/shared/types.ts` (Sharing types) | "Sharing (planned) … Not implemented yet" |
| `src/shared/types.ts` (Project visibility) | "nothing is actually published until the hosted backend lands" |
| `src/shared/types.ts` (`custom_date*`) | "Reserved for the custom-calendars feature … not creatable yet" |
| `src/shared/types.ts` (`Tag.source`) | "'derived' = computed (planned, not stored)" |
| `src/shared/fields.ts` (3×) | `custom_date*` reserved / not implemented / awaiting custom calendars |
| `src/shared/calendarMath.ts` | "Only the Gregorian calendar exists for now" |
| `src/shared/billing.ts` | perks `coEdit`, `hiresExport`, `gedcom`, `aiCredits`, `prioritySupport` are `live: false`; provider `'none'` = payments not live |
| `src/shared/dbCore.ts` (guest session) | "when the hosted backend lands this becomes an anonymous/ephemeral session" |
| `api/backends/supabase.ts` | header "Still pending: characters and history/checkpoint"; fallback "'<channel>' is not implemented yet" |
| `lib/observability.js` (6×) | `TODO(web migration)` for Sentry and PostHog init/capture/identify |
| `components/browse/browseData.ts`, `browseSignals.ts` | "Mock community … arrives with the hosted backend" |
| `components/browse/BrowseDetail.vue` | "Co-editing needs the hosted backend; the request/approval is simulated" |
| `components/billing/PricingModal.vue` | "Soon" badges; "Payments not live: remember the interest on this device only" |
| `components/UserPage.vue` | "Sharing (preview of the planned feature)" + "soon" badge |
| `components/home/HomePage.vue`, `CommunityGallery.vue` | "Community · coming soon", "community sync coming soon" |
| `components/TimelineView.vue` | "That date uses a calendar the timeline can't move yet" |
| `i18n/locales/*.js` | `soon`, `notLiveChip: 'Payments open soon'`, GEDCOM "as they land", "Live co-editing arrives with the hosted community" |

---

> When you pick something up from this list, update its entry here (or delete it once
> shipped) and fix the matching line in the source doc, so the backlog stays honest.
