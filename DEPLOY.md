# Deploying Ex Libris

This puts your app on the public internet so **share links actually work for other people**
(right now they only resolve on your own `localhost`). The frontend is a static Vite build that
talks directly to your existing Supabase project — there's no separate server to run.

Pick **one** host below. Vercel is the simplest; Netlify is equally fine. Both free tiers are plenty.

> Two config files are already included for you:
> - `vercel.json` — SPA rewrite for Vercel
> - `public/_redirects` — SPA rewrite for Netlify
>
> These make deep links like `/share/library/abc123` load the app instead of 404ing.

---

## 0. One-time prep: put the code on GitHub

Both hosts deploy from a Git repo.

1. Create a new **empty** repo on github.com (private is fine).
2. In a terminal inside the `biblioteca-app` folder:
   ```bash
   git init
   git add .
   git commit -m "Ex Libris"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/ex-libris.git
   git push -u origin main
   ```
   `.gitignore` already excludes `node_modules` and `.env`, so your secrets won't be pushed.

---

## Option A — Vercel

1. Go to **vercel.com** → sign in with GitHub → **Add New… → Project** → import your repo.
2. Vercel auto-detects Vite. Confirm:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Expand **Environment Variables** and add the two from your `.env`:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Click **Deploy**. You'll get a URL like `https://ex-libris-xyz.vercel.app`.

The included `vercel.json` handles share-link routing automatically.

---

## Option B — Netlify

1. Go to **netlify.com** → sign in with GitHub → **Add new site → Import an existing project** → pick your repo.
2. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. **Site configuration → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy site.** You'll get a URL like `https://ex-libris-xyz.netlify.app`.

The included `public/_redirects` handles share-link routing automatically.

---

## 1. Point Supabase at your live URL  (required — magic links break without this)

Magic-link sign-in only redirects to URLs Supabase trusts. In your Supabase dashboard:

**Authentication → URL Configuration**
- **Site URL:** your deployed URL, e.g. `https://ex-libris-xyz.vercel.app`
- **Redirect URLs:** add the deployed URL too (keep `http://localhost:5173` if you still develop locally).

Save. Now the magic-link email will return people to the live site instead of localhost.

---

## 2. Smoke-test the live site

1. Open your deployed URL in a normal window → request a magic link → confirm you can sign in.
2. Add a book or two if the account is empty.
3. Make a shelf (or your whole library) **public** from the sidebar and copy the link.
4. Open that share link in an **incognito/private window** (logged out). You should see the
   read-only collection. This confirms both the SPA routing and the public RLS policies work end to end.

---

## Updating after you change code

Every `git push` to `main` triggers an automatic redeploy on both hosts. No manual step.

---

## Custom domain (optional)

Both hosts let you attach a domain under the project's **Domains** settings. After adding one,
update the Supabase **Site URL / Redirect URLs** again to match the new domain.

---

## Troubleshooting

- **Blank page / 404 on a share link** → the SPA rewrite file for your host is missing or wasn't deployed.
  Confirm `vercel.json` (Vercel) or `public/_redirects` (Netlify) is in the repo and redeploy.
- **"Supabase isn't configured" banner** → the two `VITE_…` env vars aren't set on the host (or you set
  them after the build — redeploy so they're baked in).
- **Magic link sends you to localhost** → you missed step 1; fix the Supabase Site URL / Redirect URLs.
- **Covers don't upload in production** → make sure `supabase/storage.sql` was run (the `covers` bucket).
- **Env vars not taking effect** → Vite only reads them at build time, so trigger a fresh deploy after changing them.
