# How to Deploy the Website — A Step-by-Step Plan for Vibe Coders

*Written 2026-07-10. This is the "just get it live" companion to
[`MID_DEVELOPMENT.md`](./MID_DEVELOPMENT.md). That document explains **why**; this one
is a checklist for **how**, written so you can hand each coding step straight to Claude
and do the few clicks Claude can't do yourself.*

---

## 0. Read this first — how the plan works

Right now this app is a **desktop program** (Electron). It runs on one computer, saves
everything to a single file on that computer, and has no login and no internet. The goal
is a **website** anyone can sign up for, where trees live in the cloud and can be shared.

**The good news:** almost the entire app already runs in a web browser (Electron *is* a
browser inside). Only the bottom layer — the part that saves data — has to change. There
is one small file, [`api.js`](../src/renderer/src/api.js), that everything funnels
through. Swap what that file does (from "talk to the local file" to "talk to a cloud
database") and the whole app comes along for the ride.

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

---

## The tools we'll use (and why)

You'll create free accounts on three services. Here's what each one is, in plain terms:

| Service | What it is | Why | Cost |
|--------|-----------|-----|------|
| **GitHub** | Stores your code online | The host reads your code from here | Free |
| **Supabase** | The cloud "backend" — database + logins + photo storage, all in one | Replaces the local file. Its "Row Level Security" makes sharing safe with almost no code | Free tier is plenty to start |
| **Vercel** | The web host — turns your code into a live website | Connects to GitHub and auto-deploys. Easiest for beginners | Free tier is plenty to start |

You could swap Vercel for **Netlify** or **Cloudflare Pages** — they're equivalent for
this app. This plan uses Vercel because it's the smoothest with GitHub.

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
that we only change the bottom layer — [`api.js`](../src/renderer/src/api.js) — so the
rest of the app doesn't notice.*

### Step 2.1 🤖 CLAUDE — Add the Supabase library and a config file
> **Prompt to paste to Claude:**
> "Add `@supabase/supabase-js` to package.json dependencies and run npm install. Create a
> `.env` file (and add it to `.gitignore`) with two variables: `VITE_SUPABASE_URL` and
> `VITE_SUPABASE_ANON_KEY`. Create `src/renderer/src/supabaseClient.js` that reads those
> env vars and exports a configured Supabase client. Tell me exactly which two values to
> paste into `.env` — I'll get them from the Supabase dashboard."

Then: **🧑 YOU** — open the new `.env` file, paste the **Project URL** and **anon key**
from Step 0.3.

### Step 2.2 🤖 CLAUDE — Rewrite `api.js` to call the cloud instead of the desktop
This is the heart of the migration. `api.js` today just forwards a "channel" name to the
desktop. We make it recognize each channel and do the matching cloud operation instead.

> **Prompt to paste to Claude:**
> "Read `src/main/ipc.js` — it lists every channel the app uses (like `persons:getAll`,
> `persons:create`, `relationships:delete`, etc.). Rewrite `src/renderer/src/api.js` so
> `invoke(channel, data)` routes each of those channels to the equivalent Supabase query,
> returning the **exact same `{ success, data }` shape** the app already expects. Use the
> Supabase client from `supabaseClient.js`. Keep every method signature identical so the
> Pinia store and components don't change at all. For now, handle the person/relationship/
> tree/faction/scenario/settings channels; we'll do images and auth in the next steps.
> Where a channel used the 'active tree', read it from the store/current selection instead
> of the server. Add short comments mapping each channel to what it now does."

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
the web there are no local files — photos upload to Supabase Storage.

> **Prompt to paste to Claude:**
> "Replace the image handling for the web. The `images:openDialog` channel used an Electron
> file dialog — on web, use a normal `<input type=\"file\">` instead. The `images:add`
> channel copied a file on disk — on web, upload the chosen file to the Supabase Storage
> `images` bucket and save its path in the `images` table. Rewrite `getImageUrl` in
> `api.js` to return a Supabase Storage URL (signed URL for private buckets) instead of an
> `appimg://` link. Keep our existing renderer-side webp thumbnailing via
> `createImageBitmap` — it still works on the web (see the note in our memory about
> nativeImage not decoding webp)."

### Step 2.5 🤖 CLAUDE — Make the app buildable as a plain website
Today the app is built with `electron-vite` (for desktop). We need a second build that
produces a normal static website.

> **Prompt to paste to Claude:**
> "Our build uses electron-vite, which is for the desktop app. Add a way to build just the
> Vue renderer (`src/renderer`) as a standalone static website with plain Vite. Create a
> `vite.config.web.js` (or equivalent) whose root is the renderer, and add npm scripts
> `dev:web` and `build:web`. The web build must NOT include any Electron or Node code. If
> `api.js` still imports anything Electron-specific, split it so the web build only uses
> the Supabase version. Confirm `npm run build:web` produces a `dist/` folder of static
> files."

### Step 2.6 🧑 YOU — Test the whole thing locally
1. In your terminal, run `npm run dev:web` (the script Claude just added).
2. It opens a browser at a local address (like `localhost:5173`).
3. Try to: **sign up** with a test email, **create a tree**, **add a person**, **add a
   relationship**, **switch between the five views**, **upload a photo**.
4. Anything broken → copy the browser's error (press F12 → Console tab → copy the red text)
   and paste it to Claude.

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
> and delete an account, and our contact email. Add them as pages in the app. Note clearly
> that this is a starting draft, not legal advice."

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

Then: **🧑 YOU** — make a free **sentry.io** account, create a project, copy the key Claude
asks for into your Vercel environment variables.

> ✅ **End of Phase 4.** You can now safely invite a small group ("invite-only alpha").

---

## Phase 5 — Optional next steps (do these whenever, in any order)

These are not needed to be "live." They make it better. See `MID_DEVELOPMENT.md` §8 for the
full roadmap.

- **🧑 Buy a real domain** (e.g. on Namecheap or Cloudflare, ~$10/year) and connect it in
  Vercel → Settings → Domains. Turns `familytree.vercel.app` into `yourname.com`.
- **🤖 Share links & public "Explore" page** — the growth engine (doc §8 Phase B).
- **🤖 Fork/remix public trees** — GitHub-style copying of a tree.
- **🤖 The AI tree-builder** — "describe your family in a paragraph" → generated tree, using
  the Claude API (doc §9). A signature feature.
- **🤖 GEDCOM import/export** — needed to attract genealogy users.
- **🤖 Set up automated checks (CI)** — GitHub Actions running tests on every push (doc §7).

---

## Quick reference: the whole thing in one glance

| Phase | Goal | Who does most of it | Time |
|-------|------|--------------------|------|
| 0 | Create accounts (GitHub, Supabase, Vercel) | 🧑 You | ~1 hr |
| 1 | Build the cloud database + security rules | 🤖 Claude writes, 🧑 you run SQL | ½ day |
| 2 | Rewire the app to use the cloud | 🤖 Claude | 1–2 weeks |
| 3 | Import data + deploy live | 🧑 You (clicks) + 🤖 Claude (script) | ½ day |
| 4 | Legal, privacy, error tracking (before real users) | 🤖 + 🧑 | 2–3 days |
| 5 | Sharing, AI features, domain, CI | 🤖 (mostly) | ongoing |

### The five things only YOU can do (Claude cannot)
1. **Create the accounts** on GitHub, Supabase, and Vercel (login, CAPTCHA, email codes).
2. **Copy secret keys** from dashboards and paste them into `.env` / Vercel.
3. **Click "Run" in Supabase's SQL editor** and **"Deploy" in Vercel**.
4. **Enter any payment info** (only if you upgrade past free tiers or buy a domain).
5. **Make the legal decisions** — what your privacy policy promises is your call.

Everything else — all the actual code — you can hand to Claude, one step at a time.
