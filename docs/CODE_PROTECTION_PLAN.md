# Code Protection Plan — making the website hard to steal or redeploy

*Written 2026-07-20. Companion to [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md): that
doc gets the site live; this one keeps other people from downloading it and running
their own copy, and keeps paid features out of the hands of free users. Same ground
rules apply — **zero cost** (no paid services, nothing that asks for a card) and
**the app must keep working exactly as it does today**.*

> **✅ Status (2026-07-20): integrated.** This plan is now woven into
> [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) as concrete, beginner-friendly steps —
> **follow that doc when deploying**; this one keeps the full reasoning. Mapping:
> Phase 1 → Step 2.7 · Phase 2 → deployment Phases 1–2 plus Step 1.2b (limits
> enforced inside the database) · Phase 3 → Step 2.8 (the auth-gated *serving* of
> paid chunks is deferred until a paid tier actually exists) · Phase 4 → Steps
> 3.2b–3.2c · Phase 5 → Steps 4.1 & 4.5.

---

## 0. Read this first — what is actually possible

Be honest with yourself about the physics of the web before spending effort here:

**Anything the browser can run, the visitor can save.** JavaScript, HTML, CSS, images
— the browser must download them to show the page, so a determined person can always
copy whatever you send. There is no library, trick, or setting that changes this.
"Disable right-click" scripts, DevTools blockers, and view-source traps stop nobody
who matters and annoy real users; this plan deliberately skips them.

What **does** work, in order of strength:

1. **Never send the valuable code at all.** Logic that runs on a *server* cannot be
   downloaded — the visitor only sees inputs and outputs. This is the only real
   protection, and it's Phase 2 below.
2. **Only send paid code to paying users.** Split the bundle so paid features live in
   separate chunks served from behind a login/plan check. A free user's browser never
   even receives that code. (A *paying* user can still save the chunk — this stops
   free-riders, not paying pirates. That residual risk is acceptable.)
3. **Make what you do send miserable to reuse.** Minify + obfuscate the shipped
   bundle so a copied `dist/` is hostile to modify, rebrand, or maintain. This is a
   deterrent, not a lock — it raises the cost of theft above the cost of just paying.
4. **Legal footing.** Copyright, Terms of Service, and a private source repo. Cheap,
   and it's what actually gets a stolen clone taken down (DMCA to their host).

> **⚠️ The single most important fact:** today the web build is *maximally*
> stealable, by design. `npm run build:web` packs the **entire** app — every feature,
> the auth logic, and even the plan quotas (`PLAN_LIMITS` in
> [`src/shared/auth.ts`](../src/shared/auth.ts)) — into a static `dist/` folder that
> runs fully in the visitor's browser against IndexedDB. Anyone can save that folder
> and rehost it, and "quotas" enforced in their own browser can be edited away in
> seconds. That's fine right now (local-first, deployment deferred), but it means
> **the protection work below is inseparable from the cloud-backend work** in
> `DEPLOYMENT_PLAN.md` — you cannot bolt real protection onto a purely static site.

---

## 1. Answer to "should I do this before I deploy?"

**Partly.** Split it like this:

| Do **before** first public deploy | Do **at deploy time** | Fine to do **after** |
|---|---|---|
| Phase 1 — decide the free/paid feature boundary (it shapes the backend API) | Phase 4 — build hardening (obfuscation, no sourcemaps) — it's a build-config flag, but flip it on for the very first public build so no clean copy is ever cached/archived | Tuning obfuscation strength |
| Phase 2 — server-side enforcement (part of the deployment plan itself) | Phase 5 — legal (Terms already exist in `LegalModal.vue`; add copyright + private repo check) | Adding more paid features behind the Phase 3 gate |
| Phase 3 — the paid-module split (much cheaper to structure now than to untangle later) | | |

Reasoning: once a clean, un-obfuscated build has been public even briefly, it can be
archived (Wayback Machine, caches) forever — so hardening belongs in the *first*
public build. But the heavy lifting (Phases 1–3) is architecture, not build config,
and doing it before deploy means the hosting choice in `DEPLOYMENT_PLAN.md` can be
made with "needs an auth-checked endpoint for paid chunks" as a requirement.

---

## 2. The phases

### Phase 1 — Decide the paid boundary (a decision, then a small code change)

Nothing can be gated until you've named what's paid. Candidates that already have
natural seams in the code:

- **Quota tiers** — `PLAN_LIMITS` in `src/shared/auth.ts` already keys limits by
  `user.plan`; today only `free` exists. Add e.g. `plus: { maxProjects: 50,
  maxPersons: 25000, maxImages: 5000 }`. The quota checks in
  `persons:create` / `projects:create` / `images:add` need no changes.
- **Capability flags** — the store's `caps` computed (from `programMode`) already
  gates Advanced-mode features: 3D space view (`caps.space3d`), affinity tuning
  (`caps.tuneAffinity`), custom relationship types (`caps.customRelTypes`), the full
  relationship-type picker. Guests are already forced out of Advanced mode
  ([`store/index.js`](../src/renderer/src/store/index.js) ~line 360) — extend the
  same pattern so `caps` consults `authUser.plan`, not just `programMode`.
- **Future features** — sharing/collaboration (the `ProjectShare` placeholder in
  `types.ts`), export formats, extra themes.

Deliverable: a `features` list per plan next to `PLAN_LIMITS`
(e.g. `{ free: [], plus: ['space3d', 'customRelTypes', ...] }`) so both the server
(Phase 2) and the chunk gate (Phase 3) read plan entitlements from **one** place.

### Phase 2 — Server-side enforcement (the only real protection)

This is Phases 1–2 of `DEPLOYMENT_PLAN.md` viewed through a security lens, so do
them together:

1. The cloud backend runs `channelHandlers` (`src/shared/dbCore.ts`) **on the
   server** — the code was written platform-free for exactly this. The browser build
   then ships only UI: no `dbCore`, no `auth.ts` internals, no quota logic.
2. Quotas and plan checks execute server-side, where the user can't edit them. The
   session-token middleware (`unwrapRequest` → `resolveSession` → `AuthCtx`) already
   models this; the server version becomes authoritative.
3. Channels behind paid features check `features` from Phase 1 in the handler (e.g.
   a `space3d` scene save from a free account → rejected server-side), so even a
   user who somehow obtains the paid UI code gets nothing useful from it.
4. A rehosted copy of the static files is now mostly worthless: it has no database,
   no accounts, and no business logic — the thief would have to rebuild the entire
   backend themselves.

Zero-cost hosting that supports this (all card-free signup, per the deployment
plan's own vetting): Supabase free tier (Postgres + Edge Functions), Cloudflare
Pages + Workers free tier, Vercel Hobby.

**Note:** keep the IndexedDB local backend (`backends/local.ts`) for the desktop app
and `dev:web`, but the *deployed* site must default to the HTTP backend
(`VITE_API_BACKEND`) with the local backend excluded from the production web bundle
(conditional dynamic import so tree-shaking drops it).

### Phase 3 — Modularize: paid code in gated chunks

The request "only send over the functions that are paid [to paying users]" maps to
Vite code-splitting plus an authenticated chunk endpoint:

1. **Split points.** Convert paid-feature entry components to lazy dynamic imports —
   Vue's `defineAsyncComponent(() => import('./Graph3DView.vue'))` pattern. Vite
   automatically emits each as its own chunk. Group them with `build.rollupOptions.
   output.manualChunks` so all paid code lands in clearly named `paid-*.js` chunks.
2. **A gate module.** One small registry (`src/renderer/src/paid/index.ts`) is the
   only place that imports paid modules. It checks the session's entitlements
   (from `auth:login`'s response / `projects:overview`) before importing; UI that
   needs a paid feature asks the registry and shows an upgrade prompt on refusal.
3. **Serve chunks behind auth.** A static host serves every file to everyone, so on
   its own step 1 only *hides* paid code from free users' initial download. To truly
   withhold it, the `paid-*.js` files move out of the public static dir and are
   served by a tiny serverless function (same free host as Phase 2) that validates
   the bearer token + plan before streaming the file. The gate module fetches them
   with the token attached (dynamic `import()` of a blob/object URL, or configure
   Vite `experimental.renderBuiltUrl` to point paid chunks at the gated route).
4. **Server is still the backstop.** Phase 2's per-channel plan checks mean this
   phase is defense-in-depth, not the last line — don't agonize over its edges.

Effort control: start with the two or three highest-value paid features (3D view is
the natural first candidate — it's already an isolated subtree,
`components/graph/graph3d/` + `Graph3DView.vue`). Don't try to split every flag in
`caps` into a chunk; tiny features aren't worth a network round-trip.

### Phase 4 — Build hardening (deterrence layer)

All build-time, no runtime behavior change, so the app's functions stay identical:

1. **No sourcemaps in production** — already the Vite default
   ([`vite.config.web.js`](../vite.config.web.js) doesn't enable them). Just never
   turn them on for `build:web`, or set `build.sourcemap: false` explicitly as
   documentation.
2. **Minification** — already on (esbuild, Vite default).
3. **Obfuscation** — the "use a library" step. Use
   [`javascript-obfuscator`](https://github.com/javascript-obfuscator/javascript-obfuscator)
   via its Rollup/Vite wrapper (`rollup-obfuscator` or
   `vite-plugin-javascript-obfuscator`) — free, MIT, no service. **Configuration
   matters more than the library:**
   - Apply it **only to our own chunks**. Exclude `node_modules` / vendor chunks —
     Three.js, D3, and Vue are public code; obfuscating them adds bundle bloat and
     zero protection.
   - Use the moderate transforms: identifier renaming (`identifierNamesGenerator:
     'hexadecimal'`), `stringArray` + rotation/shuffling, `simplify`,
     `splitStrings` off or gentle.
   - **Do NOT enable** `controlFlowFlattening`, `deadCodeInjection`, or
     `debugProtection`. The first two can slow hot code 1.5–10× — fatal for the
     graph/timeline render loops and d3-force ticks — and `debugProtection` breaks
     your own debugging and can freeze legitimate users' browsers. If you want
     heavier transforms anywhere, scope them to the auth/gate modules only, never
     to `components/graph/`, `components/timeline/`, `components/webgl/`.
   - Wire it **only into `vite.config.web.js`'s production build** (guard on
     `command === 'build'`). Dev, desktop Electron build, tests, and typecheck stay
     untouched, so the day-to-day workflow doesn't slow down.
   - Expect the protected chunks to grow ~30–100%; check the bundle size after.
4. **Verification gate:** obfuscators occasionally break code (eval-like patterns,
   function-name reliance). After enabling, run `npm run build:web && npm run
   preview:web` and click through every view (graph incl. 3D, timeline, groups,
   directory, relationships, auth flows) in both themes. Add this to the deploy
   checklist — the obfuscation config must never change without this manual pass.
5. **Skip (deliberately):** right-click blockers, DevTools detectors, console
   traps, self-integrity checks, and domain-lock snippets. They break accessibility
   and legitimate use, are removed by a thief in minutes, and signal amateurism.
   The one cheap exception you *may* add: a copyright banner comment at the top of
   each built chunk (`build.rollupOptions.output.banner`) — useful as DMCA evidence.

### Phase 5 — Legal & operational (cheap, high leverage)

1. **Private repo.** Confirm the GitHub repository is private — obfuscating the
   bundle is pointless if the clean source is publicly cloneable. If it must be
   public for CI reasons, it must not be (free private repos exist; keep it private).
2. **Copyright + license.** Add a `LICENSE`/copyright notice stating the code is
   proprietary (the repo currently has no license file, which legally defaults to
   all-rights-reserved, but say it explicitly). Footer notice in the app UI.
3. **Terms of Service.** `LegalModal.vue` already exists — make sure the Terms
   forbid redistribution/rehosting explicitly. This is the basis for takedowns.
4. **Takedown readiness.** If a clone appears: DMCA notice to its host/registrar.
   The obfuscated-bundle banner + your git history are the ownership evidence.

---

## 3. What this plan does NOT promise

- A paying user can still save the paid chunks their browser legitimately received.
- The UI (HTML/CSS, layout, design) is always copyable by hand — protection there is
  legal, not technical.
- Obfuscation is reversible with enough effort; its job is making theft cost more
  than a subscription.

The combined posture — no business logic in the bundle, paid code withheld from free
sessions, hostile-to-reuse output, and legal standing — is what real SaaS products
ship. Beyond it lies snake oil.

---

## 4. Checklist (condensed)

- [ ] **P1** Define paid tiers: extend `PLAN_LIMITS`, add a per-plan `features` map in `src/shared/auth.ts`
- [ ] **P1** Make `caps` consult `authUser.plan` (pattern already exists for guests)
- [ ] **P2** Deploy backend running `channelHandlers` server-side (with `DEPLOYMENT_PLAN.md` Steps 3–4)
- [ ] **P2** Server-side plan/feature checks in paid channels; production web bundle excludes `backends/local.ts` + `dbCore`
- [ ] **P3** Lazy-import paid features (start: `Graph3DView.vue`); `manualChunks` → `paid-*.js`
- [ ] **P3** Gate module + auth-checked serverless route serving paid chunks
- [ ] **P4** `build.sourcemap: false`; obfuscator plugin in `vite.config.web.js` prod build only, moderate settings, vendor + hot render paths excluded
- [ ] **P4** Manual click-through of the obfuscated `preview:web` build (all views, both themes) — repeat whenever the obfuscation config changes
- [ ] **P4** Copyright banner on built chunks
- [ ] **P5** Repo private; proprietary LICENSE + UI copyright notice; Terms forbid rehosting
