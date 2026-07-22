# How to Deploy the Website — A Step-by-Step Plan for Vibe Coders

*Written 2026-07-10. This is the "just get it live" companion to
[`MID_DEVELOPMENT.md`](./MID_DEVELOPMENT.md). That document explains **why**; this one
is a checklist for **how**, written so you can hand each coding step straight to Claude
and do the few clicks Claude can't do yourself.*

---

## ⏸ Current status & ground rules (updated 2026-07-20)

**Deployment is deferred for now.** The current focus is building client-side features
in the local app. This plan stays valid — do it whenever you're ready — and the code
has already been restructured so that starting it later is cheap:

- The `api.js` seam is now a real backend-adapter module
  (`src/renderer/src/api/` — see the note above Step 2.2). The app picks its data
  backend automatically: Electron IPC on desktop, a browser-local IndexedDB store on
  the web. Adding the cloud backend later is one new file, not a rewrite.
- The business logic behind every API channel lives in one shared module
  (`src/shared/dbCore.ts`) used by both desktop and web, so the local app and the
  future website behave identically — that's the whole point: fewer surprises when
  migrating.
- The web build already exists: `npm run dev:web` runs the full app in a plain
  browser (data saved in the browser's IndexedDB, photos included), and
  `npm run build:web` produces the static `dist/` folder a host needs. Step 2.5 below
  is **done**. Use `dev:web` regularly while building features to make sure the app
  keeps working outside Electron.

**💸 The zero-cost rule:** in the short term this project uses **no paid services and
no service that asks for a credit card / bank details — not even for a "free" tier
that wants a card on file.** Every service this plan selects (GitHub, Supabase free
tier, Vercel Hobby) can be signed up for with just an email, no card. If any signup
ever asks for payment details: **stop, don't enter them**, and pick an alternative or
skip that step. Steps that inherently cost money (custom domain, mobile app store
fees) are explicitly marked **[PAID — deferred]** and are optional extras, not
requirements.

**📱 Mobile is on the roadmap** (see the new Phase 6): web-first and responsive, then
an installable PWA (free), and only later — if ever — native store apps (store fees
are paid, so deferred).

**🛡️ Code protection is built in (added 2026-07-20):** steps that make the website
hard to download and re-host, and that keep future paid features out of free users'
hands, are woven into the phases below and marked **(protection)**. They were chosen
to cost you almost no extra manual work and **zero performance** — the heavy tricks
that slow websites down are deliberately banned in the prompts. The full reasoning
(what works, what's snake oil, and why) lives in
[`CODE_PROTECTION_PLAN.md`](./CODE_PROTECTION_PLAN.md); you don't need to read it to
follow this plan.

---

## ▶ Resuming the website later (start here when you come back)

*Added 2026-07-22. Website work is paused so we can build client-side features in the
Electron app. This section is the single "pick up where we left off" entry point — read
it first, then drop back into the phases below only for the steps still marked pending.*

### What "paused" actually did (and how to un-pause)

Just **one line** in the git-ignored local `.env` was commented out:
`# VITE_API_BACKEND=supabase`. While it's commented, `npm run dev` uses the local JSON
file and `npm run dev:web` uses IndexedDB — no Supabase traffic. The Supabase URL + anon
key are still in `.env`, and `.env.production` (committed) is untouched, so the hosted
build config is intact.

**To develop against the hosted backend again:** uncomment that line in `.env` (or run
`VITE_API_BACKEND=supabase npm run dev:web`). Nothing else is needed to re-connect.

### How much is already built (as of the pause)

More than the original Phase 2 prose implies. The cloud backend
[`src/renderer/src/api/backends/supabase.ts`](../src/renderer/src/api/backends/supabase.ts)
already implements, against `supabase/schema.sql`:

- projects (trees), persons, relationships, tags (factions) + membership, scenes
  (scenarios) + placements, settings + global settings;
- **the full trait system (`fields:*`) and relationship-type registry (`relTypes:*`)** —
  by reusing the real shared handlers from `src/shared/` over an in-memory slice, so the
  trait/registry math has one source of truth with desktop;
- **images** — photos compressed to WebP and stored in the Supabase Storage `images`
  bucket, signed at read time.

### What's still pending before a real deploy

1. **`auth:*` channels** — the app's AuthGate flow (`auth:register` / `auth:login` /
   profile / password) is **not** routed in the Supabase backend yet; it needs wiring to
   Supabase Auth (`supabase.auth`). This is the biggest remaining piece (Step 2.3 in
   spirit, adapted to the channel seam).
2. **characters** and **history/checkpoint / undo-redo** channels — return a clear "not
   implemented" error today; decide whether the hosted build needs them at launch.
3. The protection + launch steps that were always deferred: **2.7–2.8** (paid
   switchboard + chunk splitting), **3.2b–3.2c** (obfuscation), **3.1–3.2** (data
   importer), **3.3–3.4** (Vercel deploy + Supabase URL config), and all of **Phase 4**
   (legal/privacy/deletion/error-tracking) before any real user.

### One prompt to hand Claude when you're ready to resume

> "We're resuming the website (see the 'Resuming the website later' section of
> `docs/DEPLOYMENT_PLAN.md`). Re-enable the Supabase backend, then implement the pending
> `auth:*` channels in `src/renderer/src/api/backends/supabase.ts` by wiring them to
> Supabase Auth, keeping the exact `{ success, data }` envelope the other backends return.
> Then walk me through the remaining pending items in that section in order. Verify each
> step with `npm run dev:web` before moving on, and stop for the 🧑 (human) steps."

> **Note:** because the shared core in `src/shared/` powers both desktop and the
> browser-local (IndexedDB) backend, any client-side data feature you build during the
> pause automatically works on `npm run dev:web`. The *only* migration debt it creates is
> porting that channel into `supabase.ts` (which is why keeping new data logic in
> `src/shared/`, not bespoke IPC handlers, matters).

---

## 0. Read this first — how the plan works

Right now this app is a **desktop program** (Electron). It runs on one computer, saves
everything to a single file on that computer, and has no login and no internet. The goal
is a **website** anyone can sign up for, where trees live in the cloud and can be shared.

**The good news:** almost the entire app already runs in a web browser (Electron *is* a
browser inside). Only the bottom layer — the part that saves data — has to change. There
is one small module, [`src/renderer/src/api/`](../src/renderer/src/api/index.ts), that
everything funnels through. Swap what it talks to (the local file today, a cloud
database later) and the whole app comes along for the ride.

### The two kinds of steps

Every step below is tagged so you know who does it:

- **🤖 CLAUDE** — a coding task. Copy the prompt in the grey box and paste it to Claude.
  Claude writes the code, you review and test it.
- **🧑 YOU** — something Claude **cannot** do because it needs a human: creating an
  account, clicking buttons on a website, typing a password, entering a credit card,
  copying a secret key, buying a domain. These are always spelled out click-by-click.

> **Why can't Claude do the 🧑 steps?** Claude can write code and run commands on *your*
> computer, but it cannot log into websites as you, create accounts in your name, prove
> you're human (CAPTCHA), enter payment details, or read a one-time code from your email.
> Anything that happens *on a company's website while logged in as you* is a 🧑 step.

### How to work with Claude on this

1. Do the steps **in order**. Later steps depend on earlier ones.
2. For each 🤖 step, paste the prompt, then **run the app and check it works** before
   moving on. Don't batch three coding steps and hope.
3. When a 🧑 step gives you a **secret key or URL**, paste it back to Claude when the next
   prompt asks for it — Claude needs those values but can't fetch them itself.
4. If something breaks, paste the exact error message to Claude. "It doesn't work" is hard
   to fix; the red error text is easy.

### What "done" looks like

By the end of **Phase 3** you have a real website: people can sign up, log in, build a
tree, and it saves to the cloud. Phases 4–5 make it safe and shareable for the public.
**Do not invite real users before Phase 4** (the legal/privacy steps) — that part is not
optional if real people's data goes online.

### How the code protection works (in plain terms)

One honest fact first: **anything a browser can show, a visitor can save.** No
library or trick changes that — "disable right-click" scripts and DevTools blockers
stop nobody and annoy real users, so this plan skips them entirely. What actually
works is four layers, and they're already placed in the right steps below:

1. **Keep the valuable part in the cloud** (Phases 1–2). After the migration, the
   website's files are just the *screen* — all the data, accounts, and rules live in
   Supabase. Someone who copies the site's files gets an empty shell with no
   database: like stealing a TV remote without the TV. The plan limits are enforced
   *inside* the database (Step 1.2b) where nobody can edit them.
2. **Don't send paid code to free users** (Steps 2.7–2.8). Features get split into
   separate code files ("chunks") that the browser only downloads when allowed.
   Bonus: the first page load gets *faster*, because visitors download less.
3. **Scramble what you do send** (Steps 3.2b–3.2c). An "obfuscator" turns your
   readable code into working-but-unreadable gibberish, so a copied site is
   miserable to modify, rebrand, or maintain. Done with light settings only — zero
   speed difference for users.
4. **Own it on paper** (Steps 4.1 & 4.5). Private code repo, copyright notice, and
   Terms that forbid re-hosting. If someone clones your site anyway, this is what
   gets it taken down — you send their web host a standard takedown notice.

---

## The tools we'll use (and why)

You'll create free accounts on three services. Here's what each one is, in plain terms:

| Service | What it is | Why | Cost | Card needed? |
|--------|-----------|-----|------|--------------|
| **GitHub** | Stores your code online | The host reads your code from here | Free | **No** |
| **Supabase** | The cloud "backend" — database + logins + photo storage, all in one | Replaces the local file. Its "Row Level Security" makes sharing safe with almost no code | Free tier is plenty to start | **No** — email/GitHub signup only |
| **Vercel** | The web host — turns your code into a live website | Connects to GitHub and auto-deploys. Easiest for beginners | Free "Hobby" tier is plenty to start | **No** — GitHub signup only |

All three satisfy the zero-cost rule: sign up with email/GitHub, no payment details.
Their free tiers don't auto-upgrade — if you ever hit a limit, things pause or slow
down rather than charging you (there's nothing to charge). If any of them changes its
signup to require a card, use an alternative instead.

You could swap Vercel for **Netlify** or **Cloudflare Pages** — they're equivalent for
this app and also card-free on their free tiers. This plan uses Vercel because it's
the smoothest with GitHub.

---

## Phase 0 — Get your accounts and tools ready (about 1 hour)

*Nothing is coded here. This is all account setup so the later steps have somewhere to go.*

### Step 0.1 🧑 YOU — Make a GitHub account and put your code on it
1. Go to **github.com** and sign up (free). Verify your email.
2. Install **GitHub Desktop** (desktop.github.com) — the simplest way to upload code
   without the command line. Sign in.
3. In GitHub Desktop: **File → Add Local Repository**, choose your project folder
   (`newFamilyTree`). It's already a git repo, so it'll be recognized.
4. Click **Publish repository**. **Uncheck "Keep this code private"** only if you're okay
   with the code being public — otherwise leave it private (you can still deploy a private
   repo). Click Publish.

> ✅ You now have your code online. From now on, when Claude makes changes, you'll
> "Commit" and "Push" them in GitHub Desktop so the website updates.

### Step 0.2 🧑 YOU — Make a Supabase account and project
1. Go to **supabase.com**, click **Start your project**, sign in with GitHub (easiest).
2. Click **New project**.
3. Fill in:
   - **Name:** `familytree` (anything you like)
   - **Database Password:** click Generate, then **save it somewhere safe** (a password
     manager). You'll rarely need it, but you can't recover it easily.
   - **Region:** choose **an EU region** (e.g. "Central EU (Frankfurt)"). You're in
     Norway and will store data about real people, so EU hosting keeps you on the right
     side of GDPR later.
4. Click **Create new project** and wait ~2 minutes while it sets up.

### Step 0.3 🧑 YOU — Copy your Supabase keys and give them to Claude
Once the project is ready:
1. In the Supabase dashboard, click the **gear icon (Project Settings)** → **API**.
2. You'll see three things. Copy them into a note:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public key** (a long string — this one is *safe* to put in the website)
   - **service_role key** (another long string — this one is a **SECRET**, used only once
     for the data import, never on the website)

> ⚠️ **Secret handling in one sentence:** the **anon** key is fine to share and ends up in
> the website's code; the **service_role** key is like a master password — only paste it
> into a local script Claude runs on your machine, never into the website.

### Step 0.4 🧑 YOU — Make a Vercel account
1. Go to **vercel.com**, click **Sign Up**, choose **Continue with GitHub**.
2. Authorize Vercel to see your GitHub. That's it for now — you'll connect the actual
   project in Phase 3.

> ✅ **End of Phase 0.** You have GitHub (code), Supabase (backend), and Vercel (host)
> accounts. Everything from here is coding + a handful of clicks.

---

## Phase 1 — Design the cloud database (about half a day)

*We tell Supabase what the data looks like. Claude writes the instructions; you paste
them into Supabase's built-in SQL editor and click Run.*

### Step 1.1 🤖 CLAUDE — Write the database schema
> **Prompt to paste to Claude:**
> "Read `docs/MID_DEVELOPMENT.md` section 5 and `src/main/db.js`. Write a single SQL file
> at `supabase/schema.sql` that creates Postgres tables matching our current data:
> `users` (handled by Supabase Auth — reference `auth.users`), `trees`, `persons`,
> `relationships`, `factions`, `scenarios`, `images`, and `settings`. Add the new columns
> the doc recommends: `trees.visibility` (private/unlisted/public), `trees.forked_from`,
> and a `tree_collaborators` table (tree_id, user_id, role). Add an `owner_id` column to
> `trees` pointing at the logged-in user. Use foreign keys with ON DELETE CASCADE so
> deleting a person deletes its relationships and images. Add indexes on `tree_id`.
> Keep it simple and heavily commented so I can read it."

### Step 1.2 🤖 CLAUDE — Write the security rules (who can see what)
> **Prompt to paste to Claude:**
> "In the same `supabase/schema.sql`, add Row Level Security (RLS) policies. The rule for
> reading a tree and its contents: allowed if the tree is `public`, OR the current user is
> the owner, OR the current user is in `tree_collaborators` for that tree. The rule for
> writing: only the owner or a collaborator with role `editor`/`owner`. Enable RLS on
> every table. Explain each policy in a comment above it."

### Step 1.2b 🤖 CLAUDE — Put the plan limits inside the database (protection)

**Why:** the free-tier limits (max trees, people, photos) currently live in the
app's own code — and on a website, that code runs in the *visitor's* browser, where
a cheater can simply edit it. A rule that lives in the database can't be touched by
anyone but you. This costs you no extra clicks — it goes into the same
`schema.sql` file you paste in Step 1.3.

> **Prompt to paste to Claude:**
> "In `supabase/schema.sql`, add a `profiles` table (id referencing `auth.users`,
> plus a `plan` text column defaulting to `'free'`) with a trigger that creates a
> profile row automatically when a user signs up. Add a `plan_limits` table keyed by
> plan name with columns for max trees, max persons, and max images per user, and
> insert the free tier using the numbers from `PLAN_LIMITS` in `src/shared/auth.ts`.
> Then write BEFORE INSERT triggers on `trees`, `persons`, and `images` that count
> the user's existing rows and raise a clear error when the plan's limit is reached.
> Read the limit from `plan_limits` so a paid tier can later be added by inserting
> one row — no code change. Comment everything so I can read it."

### Step 1.3 🧑 YOU — Run the schema in Supabase
1. In the Supabase dashboard, click **SQL Editor** in the left sidebar → **New query**.
2. Open the `supabase/schema.sql` file Claude created, copy **all** of it, paste into the
   editor.
3. Click **Run**. You should see "Success." If you see a red error, copy it and paste it
   back to Claude to fix, then run again.

### Step 1.4 🧑 YOU — Create the photo storage bucket
1. In Supabase, click **Storage** in the sidebar → **New bucket**.
2. Name it `images`. Leave it **Private** for now (we'll use signed links). Click Save.

### Step 1.5 🧑 YOU — Turn on email logins
1. In Supabase, click **Authentication** → **Providers**.
2. **Email** is usually on by default. Confirm it's enabled.
3. (Optional, nicer for users) Enable **Google** — but that needs extra setup on Google's
   side, so skip it for now and add it later if you want.

> ✅ **End of Phase 1.** The cloud now has an empty, secure database and a place for photos.

---

## Phase 2 — Rewire the app to talk to the cloud (the main coding phase, ~1–2 weeks)

*This is where the app stops using the local file and starts using Supabase. The trick is
that we only change the bottom layer — the backend adapters in
[`src/renderer/src/api/`](../src/renderer/src/api/index.ts) — so the rest of the app
doesn't notice.*

> **Structure note (2026-07-10):** this seam was formalized ahead of time. The api
> module already has two working backends — `backends/ipc.ts` (Electron desktop) and
> `backends/local.ts` (browser IndexedDB, what `npm run dev:web` uses) — both driven
> by the shared channel handlers in `src/shared/dbCore.ts`. The cloud migration adds a
> third backend beside them; nothing above the seam changes.

### Step 2.1 🤖 CLAUDE — Add the Supabase library and a config file
> **Prompt to paste to Claude:**
> "Add `@supabase/supabase-js` to package.json dependencies and run npm install. Create a
> `.env` file (and add it to `.gitignore`) with two variables: `VITE_SUPABASE_URL` and
> `VITE_SUPABASE_ANON_KEY`. Create `src/renderer/src/supabaseClient.js` that reads those
> env vars and exports a configured Supabase client. Tell me exactly which two values to
> paste into `.env` — I'll get them from the Supabase dashboard."

Then: **🧑 YOU** — open the new `.env` file, paste the **Project URL** and **anon key**
from Step 0.3.

### Step 2.2 🤖 CLAUDE — Add a Supabase backend behind the existing seam
This is the heart of the migration — and it's now an *add*, not a rewrite. The channel
contract already lives in one place (`src/shared/dbCore.ts`, mirrored by
`src/main/ipc.js`); the new backend implements the same channels against Supabase.

> **Prompt to paste to Claude:**
> "Read `src/shared/dbCore.ts` — its `channelHandlers` object lists every channel the
> app uses (like `persons:getAll`, `persons:create`, `relationships:delete`) and is the
> reference implementation of what each one does. Create
> `src/renderer/src/api/backends/supabase.ts` implementing the `ApiBackend` interface
> from `src/renderer/src/api/types.ts`: route each channel to the equivalent Supabase
> query, returning the **exact same `{ success, data }` shape**. Use the Supabase client
> from `supabaseClient.js`. Then update the backend selection in
> `src/renderer/src/api/index.ts` to pick the Supabase backend when
> `import.meta.env.VITE_API_BACKEND === 'supabase'`. Nothing above the seam (store,
> components) may change. For now, handle the person/relationship/tree/faction/scenario/
> settings channels; we'll do images and auth in the next steps. Where a channel used
> the 'active tree', read it from the store/current selection instead of the server.
> Add short comments mapping each channel to what it now does."

> **Note for you:** this is the biggest single step. Test after it — see Step 2.6.

### Step 2.3 🤖 CLAUDE — Add login / signup to the app
> **Prompt to paste to Claude:**
> "Add authentication using Supabase Auth. In the Pinia store (`src/renderer/src/store/
> index.js`) add `user` and `session` state and actions `signUp`, `signIn`, `signOut`,
> and a listener that keeps them in sync with Supabase. Create a simple login screen
> component (email + password, with a 'sign up' toggle) that shows when nobody is logged
> in, styled with our existing CSS design tokens so it matches dark/light themes. When
> logged in, show the normal app. New trees must be tagged with the logged-in user's id as
> `owner_id`."

### Step 2.4 🤖 CLAUDE — Move photos from local files to cloud storage
On desktop, photos are copied into a folder and shown via a special `appimg://` link. On
the web there are no local files — photos upload to Supabase Storage. (The browser-local
backend already does the `<input type="file">` half — reuse it.)

> **Prompt to paste to Claude:**
> "Add image handling to the Supabase backend. Reuse the `<input type=\"file\">` picker
> from `src/renderer/src/api/backends/local.ts` for `images:openDialog`. For
> `images:add`, upload the chosen file to the Supabase Storage `images` bucket and save
> its path in the `images` table. Implement `getImageUrl` in the Supabase backend to
> return a Supabase Storage URL (signed URL for private buckets). Keep our existing
> renderer-side webp thumbnailing via `createImageBitmap` — it still works on the web
> (see the note in our memory about nativeImage not decoding webp)."

### Step 2.5 ✅ DONE (2026-07-10) — Make the app buildable as a plain website
Already in place: `vite.config.web.js` builds just the Vue renderer as a static site.
`npm run dev:web` serves it locally (on the browser-local IndexedDB backend),
`npm run build:web` produces the static `dist/` folder, `npm run preview:web` serves
that build. No Electron or Node code is included — the renderer never imports Electron
(only the preload bridge, which simply doesn't exist in a browser).

### Step 2.6 🧑 YOU — Test the whole thing locally
1. In your terminal, run `npm run dev:web` (the script Claude just added).
2. It opens a browser at a local address (like `localhost:5173`).
3. Try to: **sign up** with a test email, **create a tree**, **add a person**, **add a
   relationship**, **switch between the five views**, **upload a photo**.
4. Anything broken → copy the browser's error (press F12 → Console tab → copy the red text)
   and paste it to Claude.

### Step 2.7 🤖 CLAUDE — Create the free/paid switchboard (protection)

**Why:** today everything is free, but the *switch* deciding who gets what should
exist before launch — retrofitting it later means touching every feature. This step
changes **nothing** users can see; it just creates one central place that future
paid features will ask for permission.

> **Prompt to paste to Claude:**
> "In `src/shared/auth.ts`, next to `PLAN_LIMITS`, add a `PLAN_FEATURES` map listing
> which capability flags each plan gets (the `free` plan keeps everything it has
> today; add an empty `plus` placeholder for later). In the Pinia store
> (`src/renderer/src/store/index.js`), make the `caps` computed consult the
> logged-in user's plan through `PLAN_FEATURES` — the same pattern that already
> forces guest accounts out of Advanced mode. Behavior must not change for anyone
> today; this is only the single switchboard future paid features will read.
> Update the auth tests to cover it."

**🧑 YOU:** nothing to do — no visible change. Takes Claude a few minutes.

### Step 2.8 🤖 CLAUDE — Split big gated features into separate chunks (protection + speed)

**Why:** right now the whole app is one big bundle of code every visitor downloads.
Splitting the largest gated features into separate files ("chunks") means the
browser only fetches them when someone actually opens that feature — so a future
free user's browser **never even receives** the paid code. Side benefit: the first
page load gets *faster*. There is no performance downside.

> **Prompt to paste to Claude:**
> "In the web build, convert the biggest capability-gated features to lazy-loaded
> chunks, starting with the 3D space view (`Graph3DView.vue` +
> `components/graph/graph3d/`): load it with `defineAsyncComponent` / dynamic
> `import()` only when the user opens it, and use
> `build.rollupOptions.output.manualChunks` in `vite.config.web.js` so those files
> land in chunks named `paid-*`. Create one small gate module (e.g.
> `src/renderer/src/paid/index.ts`) as the **only** place that imports these chunks;
> it checks the `caps`/plan switchboard from Step 2.7 before loading and shows a
> friendly 'this needs a higher plan' message when refused. Current behavior must
> not change for anyone. Afterwards run `npm run build:web` and show me the output
> proving the `paid-*` chunk is a separate file."

**🧑 YOU:** repeat the Step 2.6 checks once, especially opening the 3D space view
(Advanced mode + 🧪 Labs) — it should appear after a barely-noticeable loading beat
the first time, then instantly.

> **Deferred on purpose (keep it simple):** truly *withholding* the paid chunks on
> the server (an endpoint that checks the login before handing the file over) only
> matters once a paid tier actually exists. Skip it for now — when you launch a paid
> plan, ask Claude: *"Serve the `paid-*` chunks through an auth-checked serverless
> function instead of the public folder, per `CODE_PROTECTION_PLAN.md` Phase 3."*

> ✅ **End of Phase 2.** The app now works as a website on your own computer, backed by the
> cloud. It's not public yet, but it's real.

---

## Phase 3 — Move your existing data and put it online (about half a day)

### Step 3.1 🤖 CLAUDE — Write a one-time importer for your desktop data
> **Prompt to paste to Claude:**
> "Write a standalone Node script `scripts/importToSupabase.js` that reads a desktop
> `familytree.json` file and inserts everything into Supabase using the **service_role**
> key (read from an env var, never hard-coded). It should reuse the migration logic in
> `src/main/db.js` and map every tree/person/relationship/faction/scenario/image/setting
> into the new tables, assigning them to a user id I provide. Print a summary of how many
> rows it created. This is also the basis for a future 'import my desktop data' feature."

### Step 3.2 🧑 YOU — Run the importer (optional — only if you want your existing trees online)
1. Find your desktop data file. On Windows it's usually at
   `C:\Users\tommy\AppData\Roaming\family-tree\db\familytree.json`.
   **Close the desktop app first** (it overwrites the file on close — see project memory).
2. Ask Claude for the exact command, which will look like:
   `SUPABASE_SERVICE_KEY=... node scripts/importToSupabase.js path/to/familytree.json`
3. Paste your **service_role** key when the command needs it. Run it. Check the summary.

### Step 3.2b 🤖 CLAUDE — Scramble the shipped code (protection) — BEFORE your first deploy

**Why now and not later:** the moment a clean, readable build is on the internet —
even for an hour — caches and archive sites can keep a copy forever. So the very
first public build should already be scrambled. After this step it's automatic on
every deploy; you never think about it again.

**Will it slow the site down? No.** The prompt below uses only the *light*
scrambling options (renaming things, hiding text strings) and explicitly **bans**
the heavy ones (control-flow flattening, dead-code injection, debug traps) — those
can slow the graph engine up to 10× and break browsers, which is why they're
forbidden here. It also leaves the performance-critical drawing code and the
public libraries (Three.js, D3, Vue) untouched — scrambling public code protects
nothing and just bloats the download.

> **Prompt to paste to Claude:**
> "Add code obfuscation to the production web build only. Install
> `javascript-obfuscator` with a Vite/Rollup wrapper plugin (e.g.
> `rollup-obfuscator`) and wire it into `vite.config.web.js` so it runs **only**
> during `npm run build:web` — never in dev, never in the Electron build, never in
> tests. Apply it only to our own code: exclude everything under `node_modules`,
> and exclude the hot render modules (`components/graph/`, `components/timeline/`,
> `components/webgl/`, `components/factions/webgl/`) so performance cannot regress.
> Use only light transforms: `identifierNamesGenerator: 'hexadecimal'`,
> `stringArray: true` with rotation and shuffling, `simplify: true`. Explicitly set
> `controlFlowFlattening: false`, `deadCodeInjection: false`,
> `debugProtection: false`, `selfDefending: false`. Also set
> `build.sourcemap: false`, and add a copyright banner comment to every built chunk
> via `build.rollupOptions.output.banner` (© 2026 [my name] — all rights reserved,
> unauthorized copying or re-hosting prohibited). Then run `npm run build:web`,
> confirm it succeeds, and tell me how much the bundle size changed."

### Step 3.2c 🧑 YOU — Check the scrambled build still works (5–10 minutes)

Obfuscators very occasionally break code, so this one manual pass is not optional —
you're the only one who can judge "it feels exactly the same."

1. In your terminal: `npm run build:web`, then `npm run preview:web`. Open the local
   address it prints.
2. Click through this checklist:
   - sign up / sign in
   - all five views (graph, timeline, groups, directory, relationships)
   - the 3D space view (Advanced mode + 🧪 Labs)
   - drag some nodes around the graph — it should feel exactly as smooth as before
   - upload a photo
   - switch between dark and light theme
3. Press **F12 → Console tab**. Any red errors → copy and paste them to Claude.
4. (Fun check) Right-click the page → View Page Source, or open a `.js` file in
   `dist/assets/` — you should see unreadable gibberish with your copyright line on
   top. That's what a thief gets now.
5. **Repeat this checklist any time the obfuscation settings change.** Otherwise
   it's automatic from here on.

### Step 3.3 🧑 YOU — Connect the project to Vercel and go live
1. Go to **vercel.com** → **Add New… → Project**.
2. Find your `newFamilyTree` repo in the list, click **Import**.
3. Vercel asks about build settings:
   - **Build Command:** `npm run build:web`
   - **Output Directory:** `dist`
   - (If unsure, ask Claude to confirm these match what it set up in Step 2.5.)
4. Click **Environment Variables** and add the two from your `.env`:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy**. Wait ~2 minutes.
6. Vercel gives you a live link like `familytree.vercel.app`. Open it — your website is
   on the internet. 🎉

### Step 3.4 🧑 YOU — Tell Supabase to trust your live website
1. In Supabase → **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel link (`https://familytree.vercel.app`).
3. Add the same link under **Redirect URLs**. Save. (This makes email confirmation links
   point back to your real site instead of localhost.)

> ✅ **End of Phase 3.** You have a live website where you and anyone with the link can sign
> up and build trees. From now on, every time you push code to GitHub, Vercel
> re-deploys automatically.

---

## Phase 4 — Before you let real people in (DO NOT SKIP)

*The moment strangers store data about real, living relatives, you have legal duties. These
are launch blockers, from `MID_DEVELOPMENT.md` §11. Most are quick.*

### Step 4.1 🧑 YOU — Decide and write the legal basics
You need a **Privacy Policy** and **Terms of Service**. You don't need a lawyer to start —
free generators exist (e.g. search "privacy policy generator"), but read what they produce.

> **Prompt to paste to Claude (after you've picked the key facts):**
> "Draft a plain-language Privacy Policy and Terms of Service for a family-tree website
> hosted in the EU (Supabase, Frankfurt) that stores data about real people. Cover: what we
> store, that users must not upload data about living people without a basis, how to export
> and delete an account, and our contact email. The Terms must also explicitly forbid
> copying, scraping, redistributing, or re-hosting the website or its code — this is the
> legal basis for takedowns if someone clones the site. Add them as pages in the app. Note
> clearly that this is a starting draft, not legal advice."

### Step 4.2 🤖 CLAUDE — Add account & data deletion and export (GDPR "right to be forgotten")
> **Prompt to paste to Claude:**
> "Add a Settings/Account page with two buttons: **Export my data** (downloads all the
> user's trees as JSON — we already have JSON export logic to reuse) and **Delete my
> account** (removes the user and all their trees/persons/images from Supabase after a
> confirmation). Wire deletion through a Supabase function so it fully cascades."

### Step 4.3 🤖 CLAUDE — Default real-people data to private
> **Prompt to paste to Claude:**
> "Make new trees default to `visibility = private`. If a person has no death year (likely
> alive), keep their tree private by default and warn before making it public. Add a simple
> **Report** button on public trees that records a report for later review."

### Step 4.4 🤖 CLAUDE — Add crash/error tracking before the public sees bugs
> **Prompt to paste to Claude:**
> "Add Sentry for error tracking (client-side) behind an env var so it's off in
> development. Tell me what to create in the Sentry dashboard and which key to paste."

Then: **🧑 YOU** — make a free **sentry.io** account (the free "Developer" tier needs no
card — zero-cost rule holds), create a project, copy the key Claude asks for into your
Vercel environment variables.

### Step 4.5 🧑 YOU + 🤖 CLAUDE — Own your code on paper (protection, ~10 minutes)

Scrambling the website is pointless if the clean source code is one click away on
GitHub. Two quick things:

1. **🧑 Check your repo is private.** Go to **github.com → your `newFamilyTree`
   repo → Settings** (the tab on the repo itself, not your account) → scroll to the
   bottom **"Danger Zone"** → look at **"Change repository visibility"**:
   - If it offers *"Change to private"* → your code is currently **public**. Click
     it, choose **Private**, type the repo name to confirm. Vercel keeps deploying
     fine — it's already authorized to read your private repos.
   - If it offers *"Change to public"* → you're already private. Do nothing.
2. **🤖 Prompt to paste to Claude:**
   > "Add a proprietary `LICENSE` file stating the code is copyright [my name], all
   > rights reserved, not open source, and may not be copied, redistributed, or
   > re-hosted. Add a matching one-line copyright notice to the app's About/legal
   > area and to `README.md`."

**Why this matters:** if someone clones your site anyway, you don't fight them with
technology — you email their web host a standard **DMCA takedown notice** pointing
at your copyright, your git history, and the banner inside the scrambled files
(Step 3.2b). Hosts comply with these routinely. That's the whole game.

> ✅ **End of Phase 4.** You can now safely invite a small group ("invite-only alpha").

---

## Phase 5 — Optional next steps (do these whenever, in any order)

These are not needed to be "live." They make it better. See `MID_DEVELOPMENT.md` §8 for the
full roadmap.

- **🧑 Buy a real domain** **[PAID — deferred]** (e.g. on Namecheap or Cloudflare,
  ~$10/year) and connect it in Vercel → Settings → Domains. Turns
  `familytree.vercel.app` into `yourname.com`. The free `*.vercel.app` address works
  fine until you decide the project deserves spending money — skip under the zero-cost
  rule.
- **🤖 Share links & public "Explore" page** — the growth engine (doc §8 Phase B).
- **🤖 Fork/remix public trees** — GitHub-style copying of a tree.
- **🤖 The AI tree-builder** — "describe your family in a paragraph" → generated tree, using
  the Claude API (doc §9). A signature feature. **[PAID — deferred]**: the Claude API is
  pay-per-use and needs payment details, so this waits until the zero-cost rule is lifted.
- **🤖 GEDCOM import/export** — needed to attract genealogy users.
- ~~**🤖 Set up automated checks (CI)**~~ — already done (GitHub Actions runs lint,
  format, typecheck, and tests on every push — free for public and private repos at
  this scale).

---

## Phase 6 — Mobile app (planned, after the website is stable)

The goal is a phone app without maintaining a separate codebase. Three stages, in
order of increasing cost and effort — stop at whichever stage feels good enough:

### Stage M1 🤖 CLAUDE — Make the website work well on phones (free)
Responsive layout + touch input for the five views. This is a prerequisite for
everything below and benefits normal browser users too. Do this as part of regular
feature work — test with the browser's device-emulation mode (F12 → device toolbar)
against `npm run dev:web`.

### Stage M2 🤖 CLAUDE — Installable PWA (free, no store, no card)
A Progressive Web App: a manifest + service worker on top of the existing web build.
Users tap "Add to Home Screen" and get an icon, full-screen launch, and offline
support (the browser-local IndexedDB backend is *already* an offline data store —
that's most of the work done). No app store, no fees, no review process. **This is the
zero-cost mobile app** and the recommended stopping point until the project outgrows it.

### Stage M3 — Native store apps via Capacitor **[PAID — deferred]**
Capacitor wraps the same Vue app in a real iOS/Android shell (the WebGL views run fine
in system webviews). The wrapper is free and open source, but **publishing is not**:
Google Play charges a **$25 one-time** fee and Apple's App Store **$99/year** — both
need payment details, so this stage is out of scope under the zero-cost rule. Decide
later, only if PWA installability turns out not to be enough (e.g. you want push
notifications on iOS or store visibility).

---

## Quick reference: the whole thing in one glance

| Phase | Goal | Who does most of it | Time | Cost |
|-------|------|--------------------|------|------|
| 0 | Create accounts (GitHub, Supabase, Vercel) | 🧑 You | ~1 hr | Free, no card |
| 1 | Build the cloud database + security rules | 🤖 Claude writes, 🧑 you run SQL | ½ day | Free |
| 2 | Rewire the app to use the cloud (seam prep ✅ done) | 🤖 Claude | ~1 week | Free |
| 3 | Import data + deploy live | 🧑 You (clicks) + 🤖 Claude (script) | ½ day | Free |
| 4 | Legal, privacy, error tracking (before real users) | 🤖 + 🧑 | 2–3 days | Free |
| 5 | Sharing, GEDCOM; domain & AI marked [PAID — deferred] | 🤖 (mostly) | ongoing | Mixed |
| 6 | Mobile: responsive → PWA (free) → stores [PAID — deferred] | 🤖 (mostly) | ongoing | Free until M3 |

**🛡️ Protection steps woven in above** (all free, all near-zero manual work):
Step 1.2b (limits enforced inside the database) · Steps 2.7–2.8 (free/paid
switchboard + paid code in separate chunks) · Steps 3.2b–3.2c (scramble the shipped
code before the first deploy + one manual click-through) · Steps 4.1 & 4.5 (Terms
forbid re-hosting; private repo + copyright). Deferred until a paid tier exists:
auth-gated *serving* of the paid chunks (see the note in Step 2.8).

### The six things only YOU can do (Claude cannot)
1. **Create the accounts** on GitHub, Supabase, and Vercel (login, CAPTCHA, email codes).
2. **Copy secret keys** from dashboards and paste them into `.env` / Vercel.
3. **Click "Run" in Supabase's SQL editor** and **"Deploy" in Vercel**.
4. **Enter any payment info** — which, under the zero-cost rule, you simply **don't**:
   every required step here works without a card. Paid items are marked
   **[PAID — deferred]** and skipped.
5. **Make the legal decisions** — what your privacy policy promises is your call.
6. **Click through the scrambled build once** (Step 3.2c) before the first deploy —
   only you can judge "it looks and feels exactly the same."

Everything else — all the actual code — you can hand to Claude, one step at a time.
