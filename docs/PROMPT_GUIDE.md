# Prompt guide — how to ask an AI agent for great visuals and bug-free code

*A convention for writing prompts to Claude (or any coding agent) on this project. It is
a vocabulary bank and a set of copy-paste templates. Pick the words that fit the task,
add the project rules from [§6](#6-project-rules-to-mention), and say how the result
will be checked.*

---

## Contents

1. [How prompt words actually work](#1-how-prompt-words-actually-work)
2. [The anatomy of a good prompt](#2-the-anatomy-of-a-good-prompt)
3. [The ambition dial](#3-the-ambition-dial)
4. [Design vocabulary](#4-design-vocabulary)
5. [Coding vocabulary](#5-coding-vocabulary)
6. [Project rules to mention](#6-project-rules-to-mention)
7. [Words that backfire, and what to say instead](#7-words-that-backfire-and-what-to-say-instead)
8. [Copy-paste templates](#8-copy-paste-templates)
9. [Power phrases](#9-power-phrases)
10. [Pre-send checklist](#10-pre-send-checklist)

---

## 1. How prompt words actually work

Words in a prompt do three different jobs. A strong prompt uses all three.

| Job | Example words | What they do | On their own |
|---|---|---|---|
| **Ambition**: how far to push | beautiful, amazing, wow, out of the box, be as creative as possible, go overboard | Raise the bar; permit bold choices instead of the safe default | Vague. The agent has to guess *what* makes it amazing. |
| **Specifics**: what "good" looks like | soft layered shadow, spring easing, staggered entrance, rim light, particle trail, 8px grid, transform-only animation | Name concrete techniques, so the result is predictable | Can feel mechanical without ambition behind them. |
| **Guardrails**: what must stay true | consistency, design tokens, both themes, 60fps, no regressions, run the tests, web parity | Keep bold work from breaking the app or its look | A safe but dull result without the other two. |

**The formula:** *ambition + specifics + guardrails + how it will be checked.*

> "Make the projects page **amazing and wow the user** — think **out of the box**.
> Use **3D card tilt with a moving specular highlight**, a **staggered entrance**, and
> **soft layered shadows**. Keep it **consistent with the design tokens**, working in
> **dark, light, ink and medieval themes**, **transform/opacity-only animation**, honouring
> **prefers-reduced-motion**. **Verify** in `npm run dev:web` and screenshot all four themes."

A prompt that is only superlatives ("make it beautiful, cool, amazing, wow") gets the
agent's generic idea of beautiful. A prompt that names even two or three concrete
techniques gets *your* idea of beautiful.

---

## 2. The anatomy of a good prompt

Use these headings, or just these ideas in this order. Skip the ones that don't apply.

1. **Goal**: one sentence on what should exist or change when the task is done.
2. **Why / who**: the user moment it serves ("a genealogist opening a 2,000-person tree for the first time").
3. **Context**: the files, views or docs involved ("see `components/timeline/`, `docs/graph.md`").
4. **Ambition**: the dial setting ([§3](#3-the-ambition-dial)).
5. **Visual direction**: words from [§4](#4-design-vocabulary), plus a reference or mood ("like a museum exhibit label", "like a game's character-select screen").
6. **Behaviour and edge cases**: empty, huge, unknown, deleted, offline, narrow window ([§5.1](#51-correctness-and-robustness)).
7. **Guardrails**: the project rules from [§6](#6-project-rules-to-mention) and anything that must not change.
8. **Definition of done**: tests to add or run, what to verify and where, and in which themes.
9. **Output shape**: "plan first, then wait for my OK", "show 3 options", "just do it", "local HTML mockup first", "write a commit message, don't commit".

**One task per prompt.** "Redesign the timeline, add sound, and fix the export bug"
produces three half-finished things. Chain them as separate prompts.

---

## 3. The ambition dial

Say where on the dial you want the agent. The same words mean different things at each level.

| Level | When | Phrases to use |
|---|---|---|
| **1 · Polish** | Fixing or tidying something that already works | "refine", "tighten", "make it feel finished", "small, careful changes", "keep the current design, just make it cleaner", "match the surrounding UI exactly" |
| **2 · Elevate** | A feature that should feel premium but fit in | "modern", "beautiful", "polished", "delightful details", "smooth animation", "premium feel", "creative within the design system", "one signature moment" |
| **3 · Bold** | Hero surfaces: home page, projects page, a new view, a showcase mode | "cool", "impressive", "out of the box", "be as creative as possible", "wow the user", "cinematic", "use 3D effects, lighting, particles", "surprise me" |
| **4 · Wild** | Brainstorms, prototypes, Labs features | "wild ideas", "never-seen-before", "go overboard", "no idea is too strange", "break the conventions of family-tree apps", "give me 10 ideas ranked by wow vs effort" |

**Tips:**
- Level 3–4 visuals still need guardrails: "go overboard **on the hero only**; the editor stays calm".
- Ask for **options at level 3–4**: "give me 3 distinct directions (calm / playful / cinematic) as local HTML mockups before building".
- Name the **signature moment**: "the one thing people should screenshot is ___".
- The editor views (graph, timeline, groups, map) are working tools. Ambient motion there should be subtle and **never cost frames**. Discovery surfaces (home, projects, browse) can go further.

---

## 4. Design vocabulary

Mix and match. Words in **bold** tend to have the biggest effect.

### 4.1 Overall feel

**beautiful** · **modern** · **clean** · **cool** · **polished** · **premium** · **cohesive** ·
**consistent** · simple · minimal · elegant · refined · sleek · crisp · airy · calm ·
confident · bold · striking · playful · whimsical · cinematic · editorial · tactile ·
luxurious · handcrafted · timeless · futuristic · organic · cozy · magical · dreamy ·
atmospheric · immersive · delightful · joyful · **wow** · jaw-dropping · memorable ·
screenshot-worthy · "feels alive" · "feels expensive" · "feels like a game, not a form"

**Mood references** (often more effective than adjectives):
museum exhibit · luxury watch site · Apple product page · Pixar title card ·
JRPG menu · sci-fi HUD · botanical illustration · old atlas · Chinese ink painting (水墨) ·
illuminated manuscript · portolan sea chart · heraldic roll of arms · trading card ·
constellation map · stained glass ·
paper cut-out diorama · night sky · aquarium · library card catalog

### 4.2 Creativity

- "be **as creative as possible**"
- "think **out of the box**"
- "**wild ideas** welcome"
- "something **never seen before** in a family-tree app"
- "surprise me"
- "don't give me the obvious version first"
- "**3 distinct directions**, then recommend one"
- "borrow from games / film / print / physical objects"
- "make the data the decoration" (the visual comes from the actual tree)
- "what would make someone say **wow**?"
- "invent a signature interaction"
- "turn this chore into a delight"
- "reimagine it from scratch, ignoring the current version"
- "be bold, but every effect must earn its place"

### 4.3 Layout and composition

visual hierarchy · focal point · whitespace / breathing room · rhythm · alignment ·
**8px spacing grid** · balance · asymmetry · density (compact vs comfortable) ·
progressive disclosure · grouping · card layout · bento grid · masonry ·
split view · two-panel sheet · sticky header · floating toolbar · docked panel ·
centred contents · consistent gutters · edge-to-edge hero · safe areas ·
z-index layering · overflow handling · truncation with tooltip ·
"one primary action per screen" · "nothing feels cramped at 1024px"

### 4.4 Colour

palette harmony · **accent colour** (the user-chosen one) · monochrome + one accent ·
tints and shades · **contrast** (WCAG AA) · semantic colours (danger, success, muted) ·
colour temperature (warm/cool) · gradient · mesh gradient · duotone · subtle noise grain ·
glow · tinted shadows · colour-coded categories · desaturated secondary info ·
heraldic tinctures (metal on colour) · gold leaf ·
"colour carries meaning, not decoration" · "works in dark, light, ink **and** medieval themes"

### 4.5 Typography

type scale (`--fs-xs…xl`) · weight contrast · letter-spacing / tracking · tabular numbers ·
line length · line height · small caps / eyebrow labels · truncation · readable ≥ 11px ·
text hierarchy (`--t1` / `--t2` / `--t3`) · brush/calligraphy font (ink theme only) ·
blackletter headings, Roman-capital rubrics, illuminated initials (medieval theme only) ·
"headings that feel editorial" · "numbers that don't jitter while counting"

### 4.6 Depth, light and material

| Area | Words |
|---|---|
| **Shadow** | soft shadow · **layered shadow** (`--shadow-sm` / `--shadow-lg`) · contact shadow · drop shadow · ambient occlusion · long shadow · inner shadow · tinted shadow · shadow that grows on hover/lift |
| **Lighting** | **rim light** · key + fill light · glow · bloom · halo · specular highlight · sheen / shine sweep · god rays · spotlight · vignette · caustics · light that follows the cursor · day/night lighting |
| **3D effects** | **perspective tilt** · parallax layers · depth of field / blur · isometric · extrusion · card flip · rotate-in · 3D carousel · floating objects · camera dolly / orbit · z-depth on hover |
| **Material** | glass / frosted (`--glass-soft`, `--glass-strong`) · paper · rice paper · ink wash · parchment · vellum · gold leaf · tooled leather · sealing wax · metal · holographic / iridescent · enamel · velvet · neon · water surface · stone · wood grain · film grain |

### 4.7 Motion and animation

- **Easing and physics:**
  - **spring easing** (`--ease-spring`), ease-out (`--ease-out`), standard ease (`--ease-std`);
  - overshoot, bounce, damping, inertia, momentum, magnetic snap.
- **Choreography:**
  - **staggered entrance**, cascade, sequence, orchestrated reveal;
  - shared-element transition, **FLIP** reorder, morph, cross-fade;
  - page/view transition, iris wipe, ink-blot reveal, page-burn reveal, page turn.
- **Character** (the classic animation principles):
  - anticipation, follow-through, squash and stretch, secondary motion;
  - arcs (not straight lines), slow-in/slow-out.
- **Micro-interactions:**
  - hover lift, press-down, ripple, focus glow;
  - toggle flip, checkbox pop, count-up numbers, typewriter text;
  - shake on error, success burst.
- **Ambient:**
  - idle breathing, floating, shimmer, drifting particles;
  - dash flow, marching ants, pulsing dot;
  - all driven by one `uTime` uniform, never per-frame buffer writes.
- **Timing:**
  - "UI feedback < 100ms";
  - "transitions 150–300ms (`--dur-fast` / `--dur` / `--dur-slow`)";
  - "entrances ≤ 600ms";
  - "nothing blocks input while animating".
- **Rules to state:**
  - **transform + opacity only**;
  - **respect prefers-reduced-motion**;
  - **60fps**;
  - **0% CPU when idle** (on-demand frame loop);
  - "honour the app's motion toggle".

### 4.8 Particles and effects

**particles** · sparkles · confetti · embers · fireflies · stars · snow · petals · bokeh ·
dust motes · mist · rain · trails · comet tail · **ripples** · shockwave · burst ·
dissolve · shatter · ink bleed / ink drop · brush stroke reveal · glitch · scanlines ·
holographic shimmer · aurora · lightning · energy flow along lines · line effects
(Bloodstream, River, Neon, Helix, Ember, Aurora, Storm, Starlight, Gilded) ·
shader effects · noise-driven motion ·
"particles are GPU-instanced and capped" · "effects pause when off-screen"

### 4.9 Interaction and feedback

affordance · discoverability · direct manipulation · drag and drop · snapping · magnetism ·
**undo everything** · optimistic UI · instant feedback · hover preview · tooltip ·
keyboard shortcuts · command palette · right-click / context menu · long-press (touch) ·
multi-select · marquee/lasso · inline editing · **empty state** that invites action ·
**loading state** (skeleton / shimmer, not a frozen screen) · **error state** that says how
to recover · confirmation for destructive actions · toast with Undo · focus ring ·
"every button has a visible pressed state" · "no dead clicks"

### 4.10 Responsive, touch and accessibility

container queries · breakpoints · collapse labels to icons when narrow ·
touch targets ≥ 40px · pinch-zoom · no horizontal scroll · safe areas ·
**WCAG AA contrast** · keyboard navigation · visible focus · ARIA labels · screen-reader text ·
prefers-reduced-motion · prefers-color-scheme · "test at 375px, 1024px and 1440px"

### 4.11 Consistency

- **design tokens only** (no hard-coded colours, radii or durations);
- **reuse existing primitives** (`.btn`, `.chip`, `.seg`, `.card`, `UiIcon`, `SearchField`, `IconPicker`);
- **one control height per toolbar** (`--ctl-xs/sm/md/lg`);
- the same icon set (Lucide via `UiIcon`), the same spacing scale, the same radius scale (`--r-*`);
- "match the neighbouring views"; "follow the patterns in ___.vue";
- "it should look like it was always part of the app";
- "consistent naming between UI, code and docs".

### 4.12 Data visualisation (graph / timeline / groups / map)

encoding (position, size, colour, shape) · legend · labels with collision avoidance ·
level of detail (LOD) · viewport culling · clustering · focus + context · highlight vs dim ·
lens / overlay · minimap · annotations · guides and gridlines · "readable at 5,000 people" ·
"the eye goes to the important thing first"

---

## 5. Coding vocabulary

### 5.1 Correctness and robustness

- **edge cases** — then list them:
  - empty, one, many;
  - **unknown / null** (unknown birth year, missing name);
  - deleted while open, duplicate, circular relationship, huge numbers.
- boundaries, off-by-one, inclusive vs exclusive ranges.
- **idempotent** (safe to run twice), **atomic** (all or nothing), transactional.
- **one undo step** per user action.
- race conditions, stale state, re-entrancy.
- debounce / throttle, cancellation, cleanup on unmount, no memory leaks.
- invariants, input validation, sanitize at the boundary.
- fail loudly in dev, gracefully for the user; never swallow errors silently.
- backwards compatible with saved data; self-migrating; no data loss.

### 5.2 Architecture and maintainability

single source of truth · separation of concerns · **pure functions** for logic and layout
math · small focused functions · clear names · **reuse existing helpers before writing
new ones** · no duplicated logic · no dead code · no speculative abstraction ·
"match the surrounding code style" · comments explain *why*, not *what* ·
"keep the diff small and focused" · "don't touch unrelated files"

### 5.3 Performance

**60fps** · 16ms frame budget · O(n) not O(n²) · **virtualization** · **viewport culling** ·
GPU instancing · batching draw calls · memoize / cache · lazy load / code-split ·
debounce expensive work · **keep the hot path outside Vue reactivity** ·
no per-frame allocations · release GL contexts and dispose GPU resources on unmount ·
"measure before and after" · "test with 1,000 and 5,000 people"

### 5.4 Testing and verification

- **write a failing test first**, then fix it (regression test);
- unit-test pure math (`tests/*.test.js`);
- **run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`**;
- **verify in the running app** (`npm run dev`) **and the web build** (`npm run dev:web`);
- **screenshot in dark, light, ink and medieval themes**;
- "show me the evidence"; "report exactly what you verified and what you didn't".

### 5.5 Debugging

- **reproduce first**;
- isolate, then find the **root cause, not the symptom**;
- **minimal fix**;
- explain why it broke;
- check for the same bug elsewhere ("grep for similar patterns");
- add a test that would have caught it;
- "don't guess — read the code / logs".

### 5.6 Process

- **plan first and wait for my OK** (big changes);
- ask before anything destructive;
- **small steps, verify each one**;
- **don't commit** (or: "write a commit message, don't commit");
- update the docs and `CLAUDE.md` when behaviour changes;
- "list what you're unsure about";
- "if something is out of scope, note it instead of doing it".

---

## 6. Project rules to mention

Agents read `CLAUDE.md`, but naming the relevant rule in the prompt makes it far more
likely to be followed. Paste the lines that apply.

| Rule | Phrase to include |
|---|---|
| Data-access chain | "Follow the data-access chain: component → store action → `api.invoke` → `channelHandlers` in `src/shared/dbCore.ts`. No direct `api.invoke` from components." |
| Web parity | "It must work identically in `npm run dev` and `npm run dev:web`." |
| Zero cost | "Zero cost: no paid services, nothing that needs card details, no new paid APIs." |
| Plain JSON over IPC | "Payloads to `api.invoke` must be plain JSON (no Vue reactive proxies)." |
| Themes | "Works in dark, light, ink (水墨) **and** medieval themes; use `store.isLightTheme` for renderers, `store.isInk` / `store.isMedieval` for themed dress. Modals wear the `.ink-mount ink-unroll ink-veil` hook classes so both ornate themes dress them." |
| Tokens and accent | "Colours only from CSS tokens; use `var(--accent)` / `rgba(var(--accent-rgb), a)`, never the literal blue." |
| Icons | "No emoji anywhere. Icons are Lucide names via `UiIcon` / `drawIcon` (add to `ui/lucideIcons.js` if needed)." |
| Dialogs | "No native `alert`/`confirm`: use `confirmDialog` / `toast`, and `undoToast` after undoable deletes." |
| Undo | "Every edit is undoable as one step (journal / `UNDOABLE_CHANNELS`)." |
| i18n | "All UI text goes through `t()`, with keys added to `en`, `zh-Hans`, `zh-Hant` and `nb`." |
| Program modes | "Respect Simple/Standard/Advanced via `store.caps`; experimental things go behind Labs." |
| User's noun | "UI labels use `store.noun`, not a hard-coded 'person'." |
| Pure layout math | "Layout math stays pure and tested under `components/<view>/`; drawing stays in the renderer modules." |
| Vue templates | "No multi-statement inline handlers (`@click=\"a; b()\"`); use a named function. Never commit edits on `@blur`." |
| Toolbars | "Every control in one strip shares one `--ctl-*` height; contents centred; readable text ≥ 11px; dim with `--t2/--t3`, not opacity." |
| Security | "Keep the sandbox: no widening renderer privileges; never return password/salt fields." |
| Mockups | "Show the mockup as a self-contained local HTML file I can open in the browser." |

---

## 7. Words that backfire, and what to say instead

| Instead of… | Say… | Why |
|---|---|---|
| "Make it look good" | "Modern and calm: more whitespace, one accent colour, soft layered shadows, a staggered entrance" | Names the target |
| "Make it amazing" (alone) | "Make it amazing: the signature moment is ___" | Ambition needs a direction |
| "Use as much animation as possible" | "Bold animation on the hero; subtle in the editor; transform/opacity only; reduced-motion respected" | Unlimited animation hurts usability and frame rate |
| "Minimal **and** go overboard" | Pick one per surface: "minimal chrome, overboard hero" | Contradictions get averaged into mush |
| "Fix the bug" | "Reproduce: steps ___. Expected ___, got ___. Find the root cause, add a regression test" | Gives a target and a check |
| "Fix everything" / "clean up the code" | "Fix ___ in ___; don't touch unrelated files" | Unbounded scope means unbounded risk |
| "Don't break anything" | "Run the tests, typecheck and lint, and verify ___ in both builds" | Checks are concrete; the wish isn't |
| "Rewrite it" | "Refactor ___ with no behaviour change; same tests pass" | Rewrites lose hidden fixes |
| "Make it faster" | "Dragging stutters with 2,000 people; target 60fps; profile first" | Measurable |
| "Add all the features" | One feature per prompt, in order | Quality drops with breadth |
| "Like other apps do" | Name the app and the specific behaviour | "Other apps" is a guess |
| "Use emoji icons" | "Use Lucide icons via `UiIcon`" | Emoji fail `tests/uiIcons.test.js` and render off-centre |
| "Use red / #4a90d9" | "Use `var(--danger)` / `var(--accent)`" | Hard-coded colours break themes and the accent picker |
| "Quick hack is fine" | "Smallest correct fix" | Hacks become permanent |

---

## 8. Copy-paste templates

Fill in the blanks. Delete the lines that don't apply.

### 8.1 New feature

> **Goal:** add ___ to the ___ view so that ___.
> **Context:** read `CLAUDE.md` and ___ first. Similar existing code: ___.
> **Design:** modern, consistent with the surrounding UI, ___ (feel words). Signature
> moment: ___. Smooth animation (spring easing, staggered entrance), transform/opacity
> only, reduced-motion respected.
> **Behaviour:** handle empty / one / thousands; unknown dates and names; deleted while open;
> undo as one step.
> **Rules:** data-access chain + shared core; web parity; tokens + accent; no emoji
> (UiIcon); strings via `t()` in all four locales; gate by `caps` if advanced.
> **Done when:** tests for the pure logic, `npm test` + typecheck + lint pass, verified in
> `dev` and `dev:web`, screenshots in dark / light / ink.
> **Plan first** and wait for my OK.

### 8.2 "Wow" visual pass (bold)

> Redesign ___ to **wow** the user. Be **as creative as possible** and think **out of the
> box**: use **3D effects** (perspective tilt, parallax), **lighting** (rim light,
> specular sheen that follows the cursor), **layered shadows**, **particle effects**
> (___), and **choreographed animation** (staggered entrance, spring physics,
> shared-element transitions). Make the data itself the decoration.
> Give me **3 distinct directions** as self-contained local HTML mockups first, and say
> which you'd pick and why.
> Guardrails: still **consistent** with the app's tokens, icons and control sizes; works in
> all four themes; 60fps; GPU-cheap; reduced-motion fallback; no new dependencies
> unless free and small.

### 8.3 Polish pass (careful)

> Polish ___: tighten alignment and spacing to the 8px grid, unify control heights,
> centre icon contents, improve contrast of secondary text, add hover/press states and
> a subtle entrance. **No layout or behaviour changes.** Screenshot before and after in
> all four themes.

### 8.4 Bug fix

> **Bug:** ___. **Steps:** 1. ___ 2. ___. **Expected:** ___. **Actual:** ___ (error text: ___).
> Reproduce it first, find the **root cause** (not the symptom), make the **minimal fix**,
> add a **regression test** that fails before and passes after, and check whether the
> same pattern exists elsewhere. Run tests + typecheck + lint, verify in both builds.
> Tell me what caused it.

### 8.5 Performance

> ___ is slow: ___ (what, with how many people, on which build). Target: 60fps /
> under ___ms. **Profile first** and tell me the bottleneck before changing code. Prefer
> culling, instancing, memoization and keeping work out of Vue reactivity. Measure
> before and after with ___ people.

### 8.6 Refactor

> Refactor ___ for ___ (readability / reuse / TS conversion). **No behaviour change.**
> Small steps; tests green after each. Match the surrounding style. Reuse existing
> helpers. Don't touch unrelated files.

### 8.7 Brainstorm (wild)

> Give me **wild ideas** for ___. No idea is too strange: things **never seen before** in a
> family-tree / worldbuilding app. For each: one-line pitch, why it's cool, what existing
> system it reuses, effort (S/M/L), and a wow score from 1 to 5. Then pick your top 3.
> Respect the zero-cost rule (flag anything that would need a paid service).

### 8.8 Code review

> Review the current diff for **bugs first** (correctness, edge cases, race conditions,
> undo/atomicity, web parity, plain-JSON payloads), then consistency with `CLAUDE.md`
> rules, then simplification. Only report issues you're confident about, most severe first.

### 8.9 Docs

> Update ___ (doc) to match the code as of today. Verify each claim against the code;
> don't trust the old text. Concise, scannable, with file links.

---

## 9. Power phrases

Short phrases worth reusing.

**For visuals**
- "Make it feel **alive**, not decorated."
- "Every effect must **earn its place**."
- "**Bold on the hero, calm in the editor.**"
- "It should look like it was **always part of the app**."
- "Make the **data the decoration**."
- "Design the **empty state** as carefully as the full one."
- "One **signature moment** people will screenshot."
- "**Smooth, cool animation** — spring easing, staggered, transform-only, reduced-motion safe."
- "Use **shadow, shine, lighting, particles, 3D and optical illusion** where they add depth, not noise."
- "Show me **3 directions** before building."

**For code**
- "**Root cause, minimal fix, regression test.**"
- "**Plan first; small steps; verify each.**"
- "**Reuse before you write.**"
- "**Same behaviour on desktop and web.**"
- "**Undoable as one step.**"
- "**Unknown is a valid value**" (dates, names, gender).
- "**Test with 0, 1 and 5,000 people.**"
- "**Report what you verified and what you didn't.**"
- "**Don't commit.**"

---

## 10. Pre-send checklist

Before sending a prompt, check:

- [ ] **One task**, with a one-sentence goal.
- [ ] **Ambition level** stated (polish / elevate / bold / wild).
- [ ] At least **two concrete design or technique words**, not only adjectives.
- [ ] **Edge cases** named (empty, unknown, huge, deleted).
- [ ] The relevant **project rules** pasted from [§6](#6-project-rules-to-mention).
- [ ] **Definition of done**: tests, builds, themes, screenshots.
- [ ] **Output shape**: plan first? options? mockup? commit or not?
- [ ] No contradictions ("minimal" and "overboard" on the same surface).

> Keep this guide in step with `CLAUDE.md`: when a convention changes there (a new
> theme, a new locale, a new rule), update [§6](#6-project-rules-to-mention) here too.
