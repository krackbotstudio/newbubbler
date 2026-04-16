# Moving from Render to Vercel (Free Tier)

Keep both your **API** and **Admin UI** on Vercel’s free tier and stop using Render.

---

## Vercel free tier (Hobby) – enough for both

| Resource | Free tier |
|----------|-----------|
| **Serverless invocations** | 1M / month |
| **Bandwidth** | 100 GB Fast Data Transfer |
| **Projects** | 200 |
| **Builds** | 100 deployments / day |

One project for API + one for Admin (or one combined project) stays within these limits for typical usage.

**Note:** Hobby is for non-commercial use. For commercial use you need a Pro plan.

---

## Option 1: Two Vercel projects (recommended – simplest)

Two URLs: one for the API, one for the Admin UI. Both on free tier.

### Step 1: Deploy the API

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo.
2. **Project name:** e.g. `weyou-api`.
3. **Root Directory:** leave **empty** (repo root).
4. **Framework Preset:** **Other**.
5. **Settings → General → Configuration File:** leave **blank** (repo root **`vercel.json`** is API-only) **or** set **`vercel-api-only.json`** (same). Ensure **Build Command** is **not** overridden with `npm run vercel-build`.
6. **Environment variables** (Settings → Environment Variables), add:
   - `DATABASE_URL` – your PostgreSQL URL (e.g. Supabase; same as on Render).
   - `JWT_SECRET` – same value you use today.
   - Any others your API needs (e.g. Twilio, Supabase keys).
7. Deploy. Copy the project URL, e.g. **`https://weyou-api-xxxx.vercel.app`**.

**Check:** Open **`https://weyou-api-xxxx.vercel.app/api/health`** in a browser. You should see JSON like `{"status":"ok","source":"api/health.js"}`.

### Step 2: Deploy the Admin UI

1. **Add New Project** again → import the **same** repo.
2. **Project name:** e.g. `weyou-admin`.
3. **Root Directory:** **`apps/admin-web`**.
4. **Framework Preset:** **Next.js**.
5. **Build and Development Settings:** override **Build Command** to **`npm run build`** (so it doesn’t run root scripts).
6. **Environment variables:**
   - `NEXT_PUBLIC_API_URL` = **`https://weyou-api-xxxx.vercel.app/api`** (your API project URL + `/api`, no trailing slash).
7. Deploy. Your admin UI will be at e.g. **`https://weyou-admin-xxxx.vercel.app`**.

CORS already allows `*.vercel.app`, so the admin can call the API without extra config.

### Step 3: Point mobile app to the new API

Update the API URL used by the mobile app:

- **EAS / production builds:** In **apps/customer-mobile/eas.json**, set `EXPO_PUBLIC_API_URL` under the `production` (and optionally `preview`) profile to your Vercel API URL, e.g.  
  `https://weyou-api-xxxx.vercel.app`
- Or in [expo.dev](https://expo.dev) → your project → **Environment variables** for the production environment, set **`EXPO_PUBLIC_API_URL`** to the same URL (no `/api` suffix if your app appends it).

Redeploy or rebuild the mobile app so it uses the new API.

### Step 4: Turn off Render

After you’ve verified login, orders, and mobile app against the Vercel API and admin URLs, you can delete or pause the services on Render.

---

## Option 2: One Vercel project (one URL for API + Admin)

One URL: e.g. `https://weyou-app.vercel.app` for the UI and `https://weyou-app.vercel.app/api` for the API.

1. **Add New Project** → import this repo.
2. **Root Directory:** leave **empty**.
3. **Framework Preset:** **Other**.
4. **Configuration File:** set to **`vercel-combined.json`** (Admin + API on one deployment). The default **`vercel.json`** is API-only and will not serve the admin UI at `/`.
5. **Environment variables:**
   - `DATABASE_URL`, `JWT_SECRET`, and any other API env vars.
   - `NEXT_PUBLIC_API_URL` = **`/api`** (same origin).
6. Deploy.

If you get **404** on the root or login, follow the “Fix 404 on production URL” and “Get login and full UI working” sections in **VERCEL-DEPLOY.md** (Root Directory empty, Framework Preset Other, no `VERCEL_ADMIN_ONLY`).

---

## Summary

| Item | Action |
|------|--------|
| **API** | Root directory empty, **Configuration File** blank or **`vercel-api-only.json`**, **Framework Other**, no **`vercel-build`** override; add `DATABASE_URL` and `JWT_SECRET`. |
| **Admin UI** | Deploy from **`apps/admin-web`** with **`NEXT_PUBLIC_API_URL`** = your API URL + `/api`. |
| **Mobile app** | Set **`EXPO_PUBLIC_API_URL`** (in eas.json or EAS env) to your Vercel API base URL. |
| **Render** | After verification, pause or delete Render services. |

For more detail (404s, CORS, two-project vs one-project), see **VERCEL-DEPLOY.md**.
