# Mid-Development Strategy & Roadmap

*Written 2026-07-10. A step-back look at the whole program: where it is, where it's
going, and how to get there. This is a living planning document — pair it with the
aspirational list in [`designDraft.txt`](../designDraft.txt) and the shipped-feature
notes in [`design.md`](./design.md).*

---

## 1. The one thing that matters most

**Today:** a single-user **Electron desktop app**. Data is one JSON file on disk, the
"server" is the Electron main process, there is no account, no network, no sharing.

**The goal:** a **multi-user website** where people build, browse, fork and share trees
of *any* related people — real families, historical dynasties, novel casts, their own
story characters — with relationships beyond blood (friends, colleagues, rivals,
mentors).

These are different products. But you are much closer than the gap suggests, because of
one decision you already made well: **the strict data-access chain.**

```
component → Pinia store action → api.invoke(channel) → [ boundary ] → db mutate + save
```

Everything above the boundary is a normal Vue 3 + Three.js SPA that *already runs in a
browser* (Electron's renderer is Chromium). Everything below it — the JSON file and the
IPC handlers — is the only part that has to change. Your `api.js` façade is the seam.
Swap it from "invoke IPC" to "call HTTP API," reimplement the ~30 IPC handlers as server
endpoints over a real database, and **the entire renderer comes along for free.**

> **Strategic takeaway:** don't rewrite the app. Cut it at the `api.js` seam, keep the
> top, replace the bottom. Optionally keep the Electron shell too (see §4.4) so you ship
> *both* a web app and a desktop app from one codebase.

---

## 2. Progress so far (what's shipped)

A genuinely substantial, high-quality core. This is well past prototype.

**Data & platform**
- Electron + Vue 3 (Composition API) + Pinia + electron-vite build for main/preload/renderer.
- JSON file datastore with idempotent, self-migrating schema (single-tree → multi-tree,
  scenario adoption, first-run seed) — covered by `tests/db.test.js`.
- Clean IPC API (`domain:action`, uniform `{success, data|error}` envelope), context
  isolation on, node integration off. Local image storage via the privileged `appimg://`
  protocol.

**Features**
- Multiple named trees (tabbed), persons with photos/bio/occupation/location, three
  relationship types (parent/child, spouse w/ divorce, adopted).
- **Five views**, all engineered for thousands of people:
  - **Tree** — d3-force simulation drawn in Three.js/WebGL (instanced draw calls, on-demand
    frame loop idling at 0% CPU, tweened style changes). Four layout modes
    (custom/auto/age/generation) each with saved position "states," serialized per tree.
  - **Timeline** — WebGL lifelines, marriage/birth ribbons, avatar pins, viewport-culled labels.
  - **Factions** — drag-and-drop clustering into switchable per-tree "scenarios."
  - **People** / **Relationships** — virtualized DOM (only near-viewport rows exist), with
    relationship-integrity issue detection.
- Non-destructive highlights (lineage, gender, marriage, deceased), dark/light themed
  design-token system, search / zoom / pan / fit-all, JSON export.

**Engineering discipline**
- Pure, testable layout math separated from rendering; renderers release their GL context
  on unmount; ambient animation off a `uTime` uniform (no per-frame buffer writes).
- Real docs (`docs/`), a Vitest suite for the data layer and view math.

**Honest gaps (all expected at this stage)**
- No packaging/installer, no auth, no server, no sharing, no network at all.
- No TypeScript yet (adoption decided — see Step 0). ~~No linter/formatter, no CI, no
  error tracking~~ — ESLint + Prettier + GitHub Actions CI and Sentry/PostHog stubs added
  2026-07-10 (Step 0).
- JSON import is a stub; export is one-way. No GEDCOM.
- Rendering/interaction has no automated coverage. Light mode needs polish (per draft).
- ~~Unused `sql.js` dependency lingering in `package.json`.~~ Removed 2026-07-10.

---

## 3. Product north star (sharpen the vision)

Three distinct audiences, one engine:

1. **Genealogists / real families** — care about accuracy, GEDCOM interop, privacy,
   sources/citations, living-person protection.
2. **Writers / worldbuilders** — care about fictional casts, custom relationship types,
   "canon vs headcanon," attaching lore, non-family graphs (factions already serve this).
3. **Readers / learners / fans** — care about *browsing* — the Habsburgs, the House of
   Atreides, the Targaryens — discovering and forking public trees.

Audience 3 is your **growth engine**: public, SEO-indexed, forkable trees turn the tool
into a destination, not just an editor. It also reframes the app from "a tree editor" to
"**a graph database of related people/characters that anyone can build, browse, and
remix**." Keep that framing — it justifies half the features below.

---

## 4. The desktop → web migration (the central decision)

### 4.1 Recommended backend: Supabase

For a solo/small team shipping a social web app, **Supabase** is the strongest fit and
collapses four of your hardest problems into one managed service:

| Your need | Supabase primitive |
|-----------|--------------------|
| Real multi-user database | Managed **Postgres** |
| Accounts / login (draft item) | **Auth** (email, OAuth, magic link) |
| Per-user & sharing permissions | **Row Level Security** — the killer feature here |
| Photo storage (replaces `images/`) | **Storage** + CDN + image transforms/thumbnails |
| Real-time collaboration (later) | **Realtime** subscriptions |

Row Level Security is the reason this is *so* much less work than a hand-rolled backend:
"a tree is readable if it's public OR you own it OR you're a collaborator" becomes a
declarative SQL policy instead of auth middleware sprinkled across 30 endpoints.

**Alternatives, and when to prefer them:**
- **Custom Node API** (Fastify or Hono) + Postgres via **Drizzle** or **Prisma**, hosted on
  **Railway / Render / Fly.io.** Choose this only if you outgrow RLS or want total control.
  More power, much more to build and secure.
- **Nuxt** (Vue-native full-stack framework) as the app itself — gives you SSR/SSG for the
  public discovery pages (see §4.3) plus server routes in one framework. Strong option;
  bigger refactor of the shell. See §4.4.

> **Recommendation:** Start on **Supabase + your existing Vue SPA**, deployed as a static
> site on **Cloudflare Pages / Vercel / Netlify**. Reach for a Nuxt migration only when
> SEO on public pages becomes a priority (Phase 4), and only for the *shell/discovery*
> pages — never for the interactive WebGL graph.

### 4.2 What actually changes in the code

- **`api.js`** — becomes an HTTP client (Supabase JS client or `fetch`). This is the seam.
  Keep the *exact same method signatures* the store already calls so store/components don't
  change.
- **`src/main/ipc.js`** — its ~30 handlers become the contract for your API. With RLS, many
  become thin table reads/writes; only compound operations (cascade delete, migrations)
  need server logic (Postgres functions or Edge Functions).
- **`src/main/db.js`** — retires. Its migration logic becomes a one-time **JSON→Postgres
  importer** (also your users' "import my desktop data" feature — do not throw it away).
- **Images** — `appimg://` → Supabase Storage public/signed URLs. Your existing renderer-side
  webp thumbnailing (see memory: `nativeImage` can't decode webp) is *still correct* on web;
  keep decoding via `createImageBitmap` client-side or use Storage's transform params.
- **Auth-aware store** — add `user`, `session`, and per-tree permission state to Pinia.

### 4.3 Rendering strategy for the web

The interactive graph is client-side WebGL — that does **not** change and does **not** want
SSR. But two new public surfaces do want server-rendering for SEO and share previews:

- **Discovery/browse pages** ("Explore trees," category pages) → SSG/ISR, indexable.
- **Person & tree profile pages** → SSR with Open Graph meta so a shared link unfurls a
  real preview card on Discord/Twitter/etc. This is free marketing.

Practical shape: a lightweight SSR/SSG shell (Nuxt, or Vite SSR, or even prerendered static
pages hitting the API) for discovery + profiles, and the heavy WebGL editor loaded
client-only. Lazy-load Three.js so browse pages don't pay for it.

### 4.4 Keep desktop *and* web from one codebase (optional but cheap)

Because the split is clean, you can retain the Electron app as an **offline-capable desktop
client** that talks to the same API (or works offline against a local store and syncs). The
`api.js` seam picks its implementation at build time: IPC for desktop, HTTP for web. This is
a real differentiator for the genealogy audience, who value owning their data offline.

A local-first sync engine (e.g. an IndexedDB store that reconciles with the server) is the
"cool but not required" version of this — file under exploratory (§9).

---

## 5. Data model evolution (JSON maps → relational)

Your current object-maps translate cleanly to tables. The migration is also the chance to
generalize from *families* to *any related people*.

**Tables (Postgres):** `users`, `trees`, `persons`, `relationships`, `factions`,
`scenarios`, `images`, `settings` — mostly your existing entities with FKs and indexes on
`tree_id`, plus:

- **`tree_collaborators`** `(tree_id, user_id, role)` — role ∈ owner/editor/viewer. Powers
  sharing + the "log in?" draft item.
- **`trees.visibility`** — `private | unlisted | public`. Foundation for discovery & sharing.
- **`trees.forked_from`** — enables fork/remix (§8).
- **Generalized relationships** — today `type ∈ {parent_child, spouse, adopted}`. Add a
  broader category system so friends/colleagues/rivals/mentors fit the north star:
  - `category` (`familial | romantic | social | professional | custom`) + a free-text
    `label`, or a small `relationship_types` table per tree for the "self-defined
    relationships" draft item. Keep parent_child/spouse special-cased for layout math.
- **Sources/citations** (`person_sources`) — for the genealogy & historical audience:
  cite Wikipedia/Wikidata/a book/a URL per fact. Also the honesty layer for "is this canon?"
- **Social** (Phase 4+): `tree_likes`, `tree_comments`, `follows`.
- **`characters` framing** — you may not need a new table; a `person.kind`
  (`real | fictional | historical`) flag + `canon` boolean covers the writer audience
  without a schema fork.

**Referential integrity:** you currently *don't* enforce it at write time (the Relationships
view surfaces issues instead — a good UX choice). In Postgres, use FKs with
`ON DELETE CASCADE` for the hard invariants (delete person → delete its relationships/images)
but keep the *soft* issue-detection (self-links, >2 parents, temporal conflicts) as UI
warnings. Don't let the DB reject a half-entered tree.

---

## 6. Performance strategy

The client rendering is already excellent — the work now is (a) not regressing it on the
web and (b) making the *server* side scale to many users and large trees.

**Client (protect what you have):**
- **Code-split per view** and lazy-load Three.js — browse/profile pages must not download
  the WebGL engine. Big first-load win on the web.
- **Image pipeline:** thumbnails via Storage transforms or `createImageBitmap`; never ship
  full-res into the graph. Serve webp/avif from CDN.
- Keep the hot path outside Vue reactivity (already done); keep the on-demand frame loop.
- Add a **performance budget** to CI (bundle size ceiling; optionally a Lighthouse check).

**Server (new):**
- **Never load a whole user's data to answer one request** — the JSON-rewrite-everything
  model does *not* survive multi-user. Query by `tree_id`, paginate person lists, index FKs.
- **Cursor pagination** for People/Relationships (your virtualized views already only render
  near-viewport rows — feed them pages).
- For very large public trees, consider a **materialized/precomputed layout** cached per tree
  so a cold browse doesn't run a force sim from scratch (you already serialize `graphState`;
  serve it as the initial paint).
- Cache public/read-heavy pages at the CDN edge (ISR).

**Scale test** you already have infrastructure for: the memory note about injecting an
in-memory store for scale tests + driving Electron via Playwright — reuse that harness
against the web build.

---

## 7. Continuous integration & development

None exists yet; this is the highest-leverage infra investment. Recommended **GitHub
Actions** pipeline:

1. **Lint & format** — add **ESLint + Prettier** (none configured today). Gate PRs.
2. **Type check** — see §10 on adopting **TypeScript** gradually; run `vue-tsc`.
3. **Unit tests** — `vitest run` (you have this; expand it).
4. **E2E** — **Playwright** against the built web app (you already use `_electron`; port the
   harness to the browser build). Cover: create person, link relationship, switch views,
   share a tree, fork a tree.
5. **Build** — fail on bundle-size regression (performance budget).
6. **Preview deploys** — Vercel/Cloudflare/Netlify per-PR preview URLs (huge for reviewing
   visual/graph changes — the thing your tests *can't* cover).
7. **Dependabot / Renovate** for dependency hygiene; **CodeQL** or the built-in
   `/security-review` for security.

**Observability** (ship before/with public launch): **Sentry** (error tracking, client +
server) and **PostHog** (product analytics + session replay + feature flags). You are flying
blind on a public app without these.

**Release:** semantic versioning, a `CHANGELOG`, tagged releases; if you keep desktop,
`electron-builder` for signed installers + auto-update.

---

## 8. Feature roadmap (from the draft, phased)

Reconciled `designDraft.txt` × `design.md` × the north star. Roughly dependency-ordered.

### Phase A — Web foundation (unblocks everything social)
- Supabase backend; `api.js` → HTTP; JSON→Postgres importer (also user-facing "import").
- **Accounts / login** (draft: "log in?").
- **Save graph state to the database** per tree/user (draft "must later" — trivially falls
  out of the migration).
- Static-site deploy + CI + Sentry/PostHog.
- Fix light mode; finish the settings panel (general, more style settings) (draft).

### Phase B — Sharing & discovery (the growth engine)
- Tree visibility (private/unlisted/public) + **share buttons** (draft).
- Public **Explore** page: browse by category (real families / historical / novels /
  original fiction), search, featured trees. SSR profile pages with OG previews.
- **Fork & remix** a public tree (GitHub-style) via `forked_from`.
- Read-only embed / shareable link.

### Phase C — Editor depth (make power users stay)
- **In-graph editing** (draft): click a node then ctrl-click another to create a
  relationship; **multi-select and move together**.
- **Editable link curvature** — drag a line to route it around nodes (draft "must later").
- **Auto-mode physics sliders** (gravity, link stretch, generational pull) with inline "?"
  explainers (draft).
- **Tags / clusters** with types (family type, elemental power, etc.); tag-driven
  realignment in auto mode (draft "big feature"). Note: your **Factions** view already
  delivers much of this — decide whether tags are a lighter-weight complement or fold in.
- **Self-defined relationship types** + friend/colleague/rival categories (north star).
- Allow age/name/gender **unknown** throughout (draft).
- **GEDCOM import/export** — table-stakes for the genealogy audience; bridges to
  Ancestry/FamilySearch.

### Phase D — Exploration & storytelling
- **Time-lapse mode** — play the tree through time; people appear at birth year, marriage
  links form as they occur (draft "possible future" — your Timeline engine is the seed).
- **"Reveal info"** — click a person, surface how everyone relates to them; **relationship
  path finder** ("how is A related to B").
- **Genetic/trait inheritance** visualization (draft).
- **Minimap** for large trees (draft "big feature").
- **Onboarding tutorial** (draft).
- **Export as styled image** with tree name/placement; **import background image**
  (map/floor plan/school map) (draft small features).
- **Map view** — plot birth/death/`location` on a world map.

### Phase E — Social & scale
- Likes, comments, follows, notifications; user profiles; collections.
- **Real-time collaborative editing** (Supabase Realtime / Yjs CRDT).
- **Localization / multiple languages** (draft) — the "different languages" reveal-info idea
  generalizes to full i18n. The user base is international; the author is in Norway (EU).
- **Mobile** — web is responsive first; then **Capacitor** to wrap the same Vue app as
  iOS/Android (draft "mobile version").

---

## 9. Wild-but-cool suggestions

Ordered roughly by "impact per unit weirdness."

- **AI tree-builder (Claude API).** "Describe your family / cast in a paragraph" → generated
  persons + relationships you can accept/edit. For writers: "generate a noble house with
  three feuding branches." For genealogists: extract a tree from a **photo of a hand-drawn
  family tree** (vision). This is a *signature* feature and directly on-goal. Use the latest
  Claude models via the Anthropic API — see the `claude-api` skill for model IDs/params.
- **Import from Wikidata/Wikipedia.** Type "House of Habsburg" → seed a historical tree from
  structured data, with citations. Turns the "browse famous families" dream into
  one-click reality and seeds your public gallery.
- **Fork culture (GitHub for trees).** Public trees are forkable, diffable, and "pull
  requestable" — a fan corrects the Targaryen tree, the owner merges it. Community-maintained
  canonical trees for big fandoms become a moat.
- **Embeddable widget.** An `<iframe>` a novelist drops on their website or a fandom wiki —
  live, interactive, branded. Distribution engine.
- **"Six degrees" / relationship path finder** as a shareable party trick ("You and Charlemagne
  are 40th cousins").
- **Version history / time-travel** of a tree's edits (append-only event log) — undo across
  sessions, "see this tree as of last year," audit for collaboration.
- **Story/lore attachments** — each person gets a rich wiki page; link scenes/chapters;
  "canon vs headcanon" toggle for fiction.
- **3D mode** (draft) — the same graph in Three.js 3D; genuinely impressive for large dynasties,
  and you already own the WebGL stack.
- **Trait/heraldry generator** — procedural coats of arms or genetic trait cards per person.
- **Public API** — let others build on your graph data; feeds the embed/integration story.

---

## 10. Refactoring, migration & tooling debt

Do these *around* the web migration, not as a separate stop-the-world project.

- **Adopt TypeScript gradually.** At ~14k LOC and growing into a networked multi-user app,
  the type safety pays for itself — especially across the new client↔server contract. Start
  by generating types from the Postgres schema (Supabase can emit them) and typing `api.js` +
  the store; let it spread. Vue `<script setup lang="ts">` + `vue-tsc`.
- **ESLint + Prettier.** None today. Add before CI so the gate means something.
- **Remove `sql.js`** — listed but unused; delete to avoid confusion.
- **Formalize the `api.js` seam** into a repository interface with two implementations
  (IPC / HTTP) so desktop and web coexist (§4.4).
- **Extract shared code** into a workspace package if you split repos: the pure layout math
  (`layoutAge`, `layoutGeneration`, `linkHelpers`, `timelineLayout`, `factionLayout`) and the
  data types are 100% reusable client/server and desktop/web. Consider a monorepo
  (pnpm/turborepo) with `packages/core`, `apps/web`, `apps/desktop`.
- **Server-side validation** — you currently trust the client (fine for single-user). On the
  web, validate every write server-side (Zod schemas shared client/server) and rely on RLS
  for authz. Never trust `tree_id`/ownership from the client.
- **Rate limiting & abuse controls** on write and AI endpoints.

---

## 11. Things you didn't ask about but will bite you

These are the "you don't know what you're missing" items. Several are **launch blockers**,
not nice-to-haves, the moment real-people data goes on a server.

- **Privacy / GDPR (blocker).** You're in Norway (EU) and will store data about *real, living
  people* (users' relatives who never consented). You need: a **privacy policy** + **terms of
  service**, data export & **account/data deletion** ("right to be forgotten"), a lawful basis,
  and a hard default that **living-person data is private**. Consider auto-privacy for anyone
  without a death year. This is legal exposure, not a feature.
- **Content moderation (blocker for public sharing).** Public user-generated content →
  reporting, takedown, and a policy for harassment / doxxing / fabricated info about real
  people. Even a lightweight report button + admin queue at launch.
- **IP / fan-content licensing.** Trees of copyrighted fictional universes (ASOIAF, Marvel)
  are fan content in a legal grey zone. A clear ToS stance + DMCA process. Usually fine, but
  decide deliberately.
- **Accessibility (WCAG).** A WebGL canvas is invisible to screen readers. Your DOM People/
  Relationships views are the accessible alternative — treat them as first-class, add proper
  ARIA/keyboard nav, ensure token colors meet contrast. Also broadens your audience.
- **Backups & disaster recovery.** The JSON file had none and it didn't matter (it was the
  user's file). A hosted DB holding *everyone's* trees needs automated backups + a tested
  restore. Supabase does daily backups; verify the tier and test a restore.
- **Auth security basics** — rate limiting, email verification, session handling, secrets
  management, CSP for the web build (you already run a tight CSP in Electron — carry the
  discipline over).
- **SEO** — for a discovery-driven product this *is* growth: sitemaps, OG/Twitter cards,
  structured data (schema.org `Person`), fast SSR profile pages. Don't bolt it on late.
- **Onboarding** — the tutorial (draft) matters far more on the web, where you get one cold
  visit with no install commitment. First-run "explore a demo tree" + guided create.
- **Monetization (decide early, build hooks even if free at launch).** Natural fit: free for
  public/limited trees, **Pro** for private trees, large trees, collaborators, GEDCOM,
  AI-builder, exports. PostHog feature flags let you gate without redeploys.
- **Analytics of *what people build*** — informs the roadmap (are people making family trees or
  fiction? that changes priorities).

---

## 12. Step-by-step plan

A pragmatic sequence. Each phase ends shippable; don't let the migration become a
year-long branch.

**Step 0 — Tooling & hygiene (days)** — ✅ **done 2026-07-10**
1. ~~Add ESLint + Prettier; remove `sql.js`; set up GitHub Actions running lint + vitest.~~
   Done: flat-config ESLint (`eslint.config.js`) + Prettier (matching the existing
   no-semi/single-quote style, one-time whole-repo reformat applied), `npm run lint` /
   `format` scripts, CI at `.github/workflows/ci.yml` (lint + format check + vitest).
2. ~~Add Sentry + PostHog stubs (no-op in dev).~~ Done:
   `src/renderer/src/lib/observability.js` — `sentry` / `posthog` stub objects plus
   `initObservability(app)` wired in `main.js` (Vue `errorHandler`, `window` error +
   unhandledrejection). No-ops until `VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` are set in a
   prod build; swap real SDKs in behind the same API during Phase A.
3. ~~Decide: TypeScript adoption start point.~~ **Decided (2026-07-10): gradual adoption,
   new files in TS.** Convert `api.js` + the Pinia store first — but *during* Step 2 (the
   seam cut), when their signatures become the client↔server contract and types can be
   generated from the Supabase schema. Add `vue-tsc` to CI at that point. No big-bang
   conversion of existing files.

**Step 1 — Backend spike (1–2 weeks)**
4. Stand up Supabase: schema (§5), RLS policies, Auth, Storage bucket.
5. Write the **JSON→Postgres importer** from your `db.js` migration logic.
6. Build a throwaway script that round-trips your seed data in and back out — proves the model.

**Step 2 — Cut the seam (2–4 weeks)**
7. Reimplement `api.js` against Supabase, *same signatures*. Add auth state to the store.
8. Get the app running in a plain browser (Vite web build) end-to-end for a logged-in user:
   create/edit persons + relationships, all five views, save graph state to DB.
9. Port the Playwright harness to the web build; add E2E for the core loop. Wire preview deploys.

**Step 3 — Public alpha (2–3 weeks)**
10. Tree visibility + share links + SSR profile/OG previews. Basic **Explore** page.
11. **Ship the legal/privacy blockers** (§11): ToS, privacy policy, data export/delete,
    living-person default-private. Report button.
12. Fix light mode; finish settings. Onboarding demo tree. → **Invite-only public alpha.**

**Step 4 — Differentiate (ongoing)**
13. Fork/remix + GEDCOM import/export. In-graph editing, multi-select, physics sliders.
14. The **AI tree-builder** and **Wikidata import** (the wow features + gallery seed).
15. Time-lapse mode, relationship path finder, minimap, map view.

**Step 5 — Social & scale (ongoing)**
16. Likes/comments/follows, real-time collaboration, i18n, Capacitor mobile, monetization tiers.

---

## 13. Open decisions for you

- **Desktop: keep or drop?** — **Decided (2026-07-10): keep both.** Web-first, but retain
  Electron as an offline desktop client from the same codebase via the `api.js` seam (§4.4).
  This makes formalizing the seam into a repository interface with IPC + HTTP implementations
  (§10) a firm requirement, not optional.
- **SPA + Supabase now, or Nuxt full-stack from the start?** SPA + Supabase ships fastest and
  reuses everything; Nuxt front-loads SSR/SEO. *Recommendation: SPA now, Nuxt for discovery
  pages in Phase B if SEO proves to be the growth lever.*
- **Free vs paid, and where the line sits** — decide before public alpha so you build the
  gate, even if everything's free at launch.
- **How much fiction vs real-family focus** — steers relationship-type generalization, canon
  toggles, and moderation/privacy weight. Let early analytics inform it.
