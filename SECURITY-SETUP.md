# Ex Libris — security setup

Four hardening steps. The code for all of them already ships; this guide covers the
dashboard/console configuration each one needs.

| Step | Code shipped? | You need to configure |
|------|---------------|-----------------------|
| 1. Security headers | ✅ `vercel.json` | Nothing — auto-applies on deploy |
| 2. Storage limits | ✅ `supabase/storage-limits.sql` | Run the SQL once |
| 3. CAPTCHA on login | ✅ Login widget | Cloudflare Turnstile + Supabase Auth |
| 4. Google sign-in | ✅ login button | Google Cloud + Supabase Auth |

---

## 1. Security headers (automatic)

`vercel.json` now sends a Content-Security-Policy, HSTS, `X-Frame-Options: DENY`,
`Referrer-Policy`, `X-Content-Type-Options`, and a `Permissions-Policy`. They apply to every
response after you `git push`.

**After deploying, sanity-check the live site:** open the app, sign in, add a book by ISBN,
run a catalog search, open the barcode scanner, and load a book cover. If anything is blank or
broken, open the browser console and look for a red **"Content Security Policy"** violation — the
message names the blocked resource. Tell me the domain it names and I'll add it to the policy
(the CSP is the only header that can break things; the rest are always safe).

You can verify headers at https://securityheaders.com after deploy.

---

## 2. Storage limits (one SQL run)

Run `supabase/storage-limits.sql` in the Supabase SQL editor. It caps the `covers` bucket at
**2 MB per file** and restricts uploads to **image types only**, so the bucket can't be used to
host arbitrary files off your domain.

---

## 3. CAPTCHA on the login form (Cloudflare Turnstile)

This blocks bots from abusing the magic-link endpoint (which protects your email reputation and cost).

1. **Cloudflare → Turnstile** (free, no Cloudflare-hosted site required): **Add widget**.
   - Domain: `ex-libris.com.ar` (add `localhost` too for local dev).
   - Widget mode: **Managed** (invisible most of the time).
   - Copy the **Site Key** and the **Secret Key**.
2. **Frontend:** put the Site Key in your `.env` (and in Vercel's env vars):
   ```
   VITE_TURNSTILE_SITE_KEY=0xAAAA...
   ```
   The login form shows the widget automatically when this is set; leave it blank to disable.
3. **Supabase → Authentication → Settings → Bot and Abuse Protection**: enable **CAPTCHA
   protection**, choose **Turnstile**, and paste the **Secret Key**. Save.

Both halves must be on together: the frontend sends the token, Supabase verifies it with the secret.
If you enable it in Supabase but forget the env var (or vice-versa), sign-in will fail.

---

## 4. Google sign-in (one-click, no email round-trip)

1. **Google Cloud Console** (console.cloud.google.com) → create/select a project →
   **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - If prompted, configure the **OAuth consent screen** first (External, app name "Ex Libris",
     your support email; you can leave it in "Testing" while you trial it).
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** `https://ex-libris.com.ar` (and `http://localhost:5173`).
   - **Authorized redirect URIs:** your Supabase callback —
     `https://YOUR-PROJECT-ref.supabase.co/auth/v1/callback`
     (find the exact URL in Supabase → Authentication → Providers → Google).
   - Copy the **Client ID** and **Client Secret**.
2. **Supabase → Authentication → Providers → Google:** enable it, paste the Client ID and Secret, save.
3. **Supabase → Authentication → URL Configuration:** make sure `https://ex-libris.com.ar` is in
   the Site URL / Redirect URLs (you already did this for magic links).

That's it — the **"Continue with Google"** button on the login screen will then work. Magic link
still works alongside it; users pick whichever they prefer.

---

## Not done here (optional, larger)

- **Self-serve account deletion** (privacy). Deleting a Supabase auth user cascades to that user's
  books/shelves via the existing foreign keys, but it needs a small server-side function since
  deletion requires admin rights. Ask if you want it.
- Keep `@supabase/supabase-js` and Vite updated; run `npm audit` periodically.
