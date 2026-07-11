# Design

The design intent behind FamilyTree — product goals, UX principles, the visual
system, and the roadmap.

## Product vision

FamilyTree is a family-member organizer and family-tree generator. It is meant to
work not just for real families but for any set of related people — historical
figures, fictional casts, and so on. The guiding aim is a tool that is **easy,
intuitive, and competent**: approachable at first touch, yet powerful enough to
arrange large, complex trees.

## Design principles

These principles are applied throughout the codebase and should guide new work:

- **Easy & intuitive.** Common actions (add a person, link a relationship, rearrange
  the tree) should be discoverable and direct. Prefer inline, in-context editing over
  deep menus.
- **Competent.** Support real complexity — multiple trees, several relationship
  types, divorce, adoption, multi-generation layouts, and per-mode saved
  arrangements.
- **Responsive & fluid.** The UI should stay at 60fps during drag, zoom, and layout
  animation. This is why the graph steps outside Vue reactivity for its hot path
  (see [graph.md](./graph.md)).
- **Asynchronous.** All persistence is async through IPC; the UI updates optimistically
  and never blocks on disk.
- **Modular, single responsibility.** Layout math is pure and separated from
  rendering; data access is layered (store → api → IPC); each component owns one job.
- **Avoid race conditions.** State transitions (mode/state switching, tree switching,
  save-on-close) snapshot before they mutate and guard against overlapping animations.
- **Non-destructive exploration.** Highlights and filters change appearance only —
  they never alter data.

## Visual design system

The look is a modern, dark-first "glass" aesthetic with a calm indigo accent. All
visual values are **design tokens** defined as CSS variables in
[`styles/global.css`](../src/renderer/src/styles/global.css); components reference the
tokens rather than literal values so both themes work automatically.

### Themes

Two themes, switched via the `data-theme` attribute on `<html>` and persisted in
`globalSettings.theme`:

- **Dark** (default) — deep slate backgrounds, soft translucent surfaces, strong
  shadows.
- **Light** — bright neutrals with softer, more diffuse shadows.

### Token groups

| Group | Tokens |
|-------|--------|
| Surfaces | `--bg`, `--surface`, `--elevated`, `--hover`, `--glass-strong`, `--glass-soft` |
| Lines | `--border` |
| Accent | `--accent` (indigo `#6c8ef5`), `--adim` (dim accent wash) |
| Semantic | `--pink`, `--amber`, `--green` |
| Text | `--t1` (primary), `--t2` (secondary), `--t3` (muted) |
| Misc | `--shadow`, `--font`, `--radius` |

### Color language

Color carries meaning consistently across the graph, cards, chips, and legend:

- **Gender** — male blue, female pink/magenta, unknown indigo.
- **Relationships** — parent/child violet (solid line), spouse pink (dashed),
  adopted amber (dotted). Divorced spouses render faded and finely dashed.
- **Lineage emphasis** — paternal shifts toward blue, maternal toward pink.

### Motion

Transitions are quick and eased (cubic-bezier), used to make state changes legible
rather than decorative: modal spring-in, sidebar slide, tab transitions, cross-fades
between views, and D3-timed node/guide animations (~350–500ms) when layouts change.
The "unsaved layout" badge pulses to draw attention without nagging.

### Layout

A fixed application shell: a top bar of tree tabs, a resizable left sidebar
(navigation, stats, data actions, settings), the central workspace (one of five
views), and a resizable right sidebar (member list). **Clean Tree** mode slides the
graph's overlay panels out of the way for an unobstructed view.

## Roadmap {#roadmap}

Ideas and planned work are kept in [`designDraft.txt`](../designDraft.txt). Highlights
below; many "visuals" items (maternal/paternal emphasis, married-couple and divorced
highlighting, deceased highlighting, tree naming, multiple trees) are **already
shipped**.

**Client overhaul (planned — see [`client-structure.md`](./client-structure.md) &
[`OVERHAUL_GUIDE.md`](./OVERHAUL_GUIDE.md)):** rename tree→**Project**, faction→**Tag/Group**,
state+scenario→**Scene**; a **tags** system (manual now, derived/smart tags later); **Program
Modes** (Simple / Standard / Advanced feature tiers via progressive disclosure); a contextual
**Inspector** + draggable **Directory** dock; autosave + manual **Save/Revert** checkpoint.

**Custom calendars (future — Advanced mode):** let a project define its own date system —
Gregorian by default, but a fantasy project could use *year ▸ 20 gex ▸ 100 days* or add extra
cycles. The foundation is already reserved: dates are stored as a **structured, mutable
`DateValue`** (year/month/day + precision + calendar), and layout math sorts via a pure
`calendarMath.toOrdinal`, so adding calendars is a data-compatible change rather than a
migration. See [data-model.md](./data-model.md#datevalue--mutable-structured-dates).

**Likely next:**

- More graph styling options and auto-mode physics sliders (with inline explainers).
- Editable link curvature — drag a line to route it around other nodes.
- Import from the app's own JSON export (export exists; import is currently a stub).
- Allow age/name/gender to be unknown throughout.

**Bigger bets:**

- Person **tags / clusters** (e.g. family or category types) with tag-driven
  realignment in auto mode.
- A **time-lapse** mode: play the tree through time, with people appearing at their
  birth year and marriage links forming as they occur.
- "Reveal info" — click a person to surface how everyone else relates to them.
- A **minimap** for navigating large trees; an onboarding tutorial.
- Export the tree as a styled image; import a background image (map, floor plan).

**Exploratory:** 3D mode, multi-select drag, self-defined relationship types,
localization / multiple languages, a mobile version, and accounts/login.

> Roadmap items are aspirational, not commitments. See
> [contributing.md](./contributing.md) before starting on a large feature.
