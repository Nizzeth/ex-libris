# Biblioteca Personal — Phase 2 (web app)

A personal book library you can build, organize, and share. Phase 2 adds real accounts
(magic-link sign-in), a Postgres backend with row-level security, and public read-only
share links for your whole library or individual shelves.

**Stack:** React + Vite · Supabase (Postgres, Auth, RLS) · Open Library / Google Books for metadata.

---

## What you get

- **Magic-link sign-in** — enter your email, click the link, you're in. No passwords.
- **Two views** — a cover wall (drag-to-arrange) and a shelf/spine view showing titles + author surnames.
- **Shelves, tags, status** (To read / Reading / Read / Recommended), rating, and language, with **multi-select** to move many books onto a shelf at once (button or drag).
- **Two notebooks per book** — quick *Comments / Observations* plus a full-page *Reading Notes* panel for quotes and passages.
- **Custom covers** — upload your own (auto-shrunk to a small WebP), paste an image URL, or pick an alternate catalog cover.
- **Add books** by camera barcode scan, ISBN lookup (one or many), catalog search, Goodreads CSV import, or by hand — all staged in a tray and committed together.
- **Filters** by tag, status, and language; live search and sorting.
- **Sharing** — make your whole library public (one link) and/or any shelf public (its own link). Share pages are read-only and need no account.
- **CSV export** (`Title, Author, Year, ISBN, Language`) plus a full **JSON Backup / Restore** that captures everything (shelves, tags, notes, reading notes, loan status, ratings).

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm.
- A free [Supabase](https://supabase.com/) account.

---

## Setup, step by step

### 1. Create a Supabase project
1. Go to supabase.com → **New project**. Pick a name and a database password (you won't need the password for this app).
2. Wait for it to finish provisioning (~1–2 min).

### 2. Create the database schema
1. In your project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, paste the whole file in, and click **Run**.
   This creates the tables (`profiles`, `shelves`, `books`, `shelf_books`), a trigger that
   auto-creates a profile on sign-up, and all row-level-security policies.

### 2b. Enable custom book covers (storage)
In the **SQL Editor**, run `supabase/storage.sql`. It creates a public `covers` bucket and
the policies that let each user upload images only into their own folder. (Skip this only if you
don't want the upload-a-cover feature; pasting an image URL and picking catalog covers still work.)

### 2c. Apply migrations (existing databases only)
If you already ran `schema.sql` before these features existed, run the migration files in
`supabase/` once, in order, in the SQL Editor:
- `migration-002.sql` — adds the **Recommended** status and the **Reading Notes** field.
- `migration-003.sql` — adds **borrowed / lent** loan tracking.
- `migration-004.sql` — adds **reading dates** (started / finished).
- `migration-005.sql` — adds the per-account **theme** preference.
- `migration-006.sql` — adds the per-account **default language** for added books.
- `migration-007.sql` — adds **shelf colours** (rename & reorder need no migration).

Fresh installs get everything from `schema.sql` and can skip this.

### 3. Turn on magic-link auth
1. Go to **Authentication → Providers → Email**. Make sure **Email** is enabled.
   Magic links are on by default; you can leave "Confirm email" on.
2. Go to **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5173` (for local development).
   - **Redirect URLs:** add `http://localhost:5173` (and later your deployed URL, e.g. `https://your-app.vercel.app`).

### 4. Get your API keys
1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.

### 5. Configure and run the app
```bash
cd biblioteca-app
cp .env.example .env        # then edit .env with your values
npm install
npm run dev
```
Open http://localhost:5173, enter your email, and click the link in your inbox to sign in.

> Your `.env` should contain:
> ```
> VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
> VITE_SUPABASE_ANON_KEY=your-anon-public-key
> ```

---

## Bringing over your prototype data

The Phase-1 prototype lives in your browser's storage, so it can't transfer automatically.
Use the prototype's **Export CSV** button, then in the web app open **+ Add books → Goodreads CSV**
and select that file. Titles, authors, ISBN, year, and language come across; the importer also
reads Goodreads exports (which additionally carry shelves, status, rating, and reviews).

---

## Deploying (optional)

Any static host works since the frontend is a Vite build talking directly to Supabase.

**Vercel / Netlify:**
1. Push this folder to a Git repo and import it.
2. Build command `npm run build`, output directory `dist`.
3. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Add your deployed URL to Supabase **Authentication → URL Configuration** (Site URL + Redirect URLs).

**Routing note:** share links use real paths (`/share/library/...`, `/share/shelf/...`).
On Vercel/Netlify add a SPA rewrite so deep links resolve to `index.html`:
- *Netlify* — create `public/_redirects` containing: `/*  /index.html  200`
- *Vercel* — add a rewrite of `/(.*)` → `/index.html` (or use a `vercel.json` rewrite).

---

## How sharing & security work

Row-level security (defined in `schema.sql`) is the backbone:

- You can only read/write **your own** books, shelves, and shelf memberships (`auth.uid() = user_id`).
- Anonymous visitors can read a profile/shelf/book **only** when the owner has made the library public
  or placed the book on a public shelf. Everything else is invisible.
- "Public" is just a boolean plus an unguessable slug; flipping it off instantly revokes access.

The browser only ever holds the **anon public** key, which is safe to ship — RLS is what protects the data.

---

## Project layout

```
biblioteca-app/
  index.html
  package.json            vite + react + supabase-js + react-router
  .env.example            copy to .env and fill in
  supabase/schema.sql     run once in the Supabase SQL editor
  src/
    main.jsx              routes (app + public share pages)
    App.jsx               authed shell: loads data, wires everything
    styles.css
    lib/
      supabase.js         client
      books.js            framework-agnostic: APIs, CSV, languages, filtering
      db.js               all Supabase reads/writes
    context/AuthContext.jsx
    components/           Login, Sidebar, CoverWall, BookCard, AddModal, BookDetail, Toast
    pages/SharePage.jsx   read-only public view (library or shelf)
```

---

## Current limitations / next ideas

- Data model collapses "catalog book" and "your copy" into one `books` row per user (simpler for a
  personal app). If you later want shared catalog records across users, split them as in the Phase-1 spec.
- Drag-reordering writes positions based on the currently visible list; it's most predictable on **All books**.
- Manual barcode scanning loads the scanner library from a CDN on first use and needs camera permission
  (and a secure context — `localhost` or `https`).
- Polish pass (responsive/mobile layout, accessibility, light/dark, branded share pages) is Phase 3 in the spec.
