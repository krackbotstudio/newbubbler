# Deploy API + Admin on Vercel

You can use **one project** (Admin + API on the same domain) or **two projects** (separate domains).

## Fix 404 on production URL (one project)

If deployment succeeds but visiting the production URL shows **404: NOT_FOUND**:

1. **Root Directory must be empty**  
   **Project → Settings → General → Root Directory**: leave **blank**. If set to `apps/admin-web` or anything else, Vercel uses that as the project root and **ignores** the repo root `vercel.json`. The API and routing from the root config are then not applied, and the root `/` may 404.

2. **Framework Preset: Other**  
   **Settings → General → Framework Preset**: set to **Other**. If set to Next.js, Vercel may use its own build and ignore the root `vercel.json` `buildCommand` and `builds`, so the Next.js app from the monorepo might not be the one serving `/`.

3. **Do not use API-only config for the main URL**  
   If **Configuration File** is set to `vercel-api-only.json`, the project builds only the API; there is no Next.js app, so `/` returns 404. Use that only for a separate API-only project. For one URL with login and UI, leave Configuration File blank (use root `vercel.json`).

4. **Redeploy**  
   After changing any of the above, **Deployments → … → Redeploy** (or push a new commit).

---

## Get login and full UI working (one URL)

To have **one URL** where you can log in and use all admin screens (dashboard, orders, customers, etc.):

1. **Use a single Vercel project** (e.g. `weyouapp-v-01-admin-web-1xhg`) with **Root Directory** = **empty**.
2. **Do not set** the env var **`VERCEL_ADMIN_ONLY`** in this project (so the full build runs: Prisma + API + Next).
3. **Environment variables** (Settings → Environment Variables):
   - **`DATABASE_URL`** – your PostgreSQL connection string (e.g. Supabase).
   - **`JWT_SECRET`** – a secret string for JWT signing.
   - **`NEXT_PUBLIC_API_URL`** – set to **`/api`** (same origin; the admin app will call your deployment’s `/api`).
4. **Redeploy** (Deployments → ⋯ → Redeploy).

Then open **`https://your-project.vercel.app`** → you should see the login page. Sign in; the app will call `/api` on the same domain, so login and all data/UI screens work. If you had created a second “Admin-only” project, use this **one** project’s URL for daily use.

---

## Option A: One project (Admin + API on same domain)

**Best if:** You want a single URL like `weyouapp-v-01-admin-web-1xhg.vercel.app` for both the app and the API.

1. **Create one project** in Vercel and import this repo.
2. **Root Directory:** leave **empty** (repo root). If you set it to `apps/admin-web`, the build will fail with "Missing script: prisma:generate" because that script lives in the root.
3. **Framework Preset:** Other.
4. The repo’s **`vercel.json`** already configures:
   - Build: conditional (if `VERCEL_ADMIN_ONLY` is not set: Prisma + API + Next.js). Do not set `VERCEL_ADMIN_ONLY` for this project.
   - All `/api/*` requests → Nest API (serverless). Everything else → Next.js admin.

**Environment variables:**

- `DATABASE_URL` – PostgreSQL (e.g. Supabase).
- `JWT_SECRET` – your JWT secret.
- `NEXT_PUBLIC_API_URL` – set to **`/api`** (same origin; admin will call `https://your-project.vercel.app/api`).

After deploy:

- **Admin:** `https://your-project.vercel.app`
- **API:** `https://your-project.vercel.app/api` (e.g. `/api/health`, `/api/admin/...`)

No CORS issues because both are on the same domain.

---

## Option B: Two projects (Admin and API on different domains)

**Best if:** You want to deploy or scale API and Admin separately.

### 1. API project (e.g. `weyou-api`)

- Import this repo, **Root Directory:** empty, **Framework:** Other.
- In **Settings → General**, set **Configuration File** to **`vercel-api-only.json`** (so only the API is built).
- **Env vars:** `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, etc.
- Copy the deployed URL (e.g. `https://weyou-api-xxx.vercel.app`).

### 2. Admin project (e.g. `weyou-admin`)

- Import the **same** repo again.
- **Root Directory:** `apps/admin-web`.
- **Env:** `NEXT_PUBLIC_API_URL=https://weyou-api-xxx.vercel.app/api`.

---

## 404 NOT_FOUND – what it means

Vercel returns **404 NOT_FOUND** when the request path does not match any resource: no static file and no serverless function at that path (and no rewrite sending the request to a function). For the **API-only** project, only paths rewritten to `/api/index` in `vercel-api-only.json` are handled (`/`, `/api`, `/api/:path*`). If you see 404, check the URL, that **Configuration File** is `vercel-api-only.json`, and that you redeployed after changing config.

### 404 on the API-only project – checklist

1. **Use the API project URL**  
   You must open the **API** project’s URL (e.g. `https://weyou-api-xxx.vercel.app`), not the Admin project’s URL. The Admin project only serves the UI and has no `/api` routes.

2. **Test `/api/health` first**  
   Open **`https://<your-api-project>.vercel.app/api/health`** in a browser. You should get JSON: `{"status":"ok","source":"api/health.js"}`.  
   - If you get that → the API project and config are correct; use this base URL for the Admin’s `NEXT_PUBLIC_API_URL` (e.g. `https://weyou-api-xxx.vercel.app/api`).  
   - If you still get 404 → the project is not using the API config or the repo root.

3. **API project settings (must match)**  
   - **Root Directory:** leave **empty** (repo root). **`vercel-api-only.json` expects repo root:** the `api/` folder (serverless entry) and `npm run build:api` live at the monorepo root. If Root Directory is `apps/api`, `apps/admin-web`, or `apps/customer-pwa`, installs/builds break or the URL shows **404: NOT_FOUND** for every path.  
   - **Configuration File:** set to **`vercel-api-only.json`** (Settings → General).  
   - **Framework Preset:** **Other** (so Vercel uses your config, not Next.js auto-detect).  
   - **Build Command:** leave default from `vercel-api-only.json` unless you know you need an override. A wrong override (e.g. `npm run prisma:generate && npm run build:api` resolved from a workspace that has no `build:api`) causes a **failed deployment**; failed deploys also surface as this same Vercel 404 page.

4. **Redeploy after any change**  
   Change config or env → Save → **Deployments → … → Redeploy** (or push a new commit).

---

## 404 on root or “can’t see any UI”

If you get **404: NOT_FOUND** when opening the deployment URL:

1. **Root Directory must be empty**  
   In Vercel: **Project → Settings → General → Root Directory**. Leave it **blank**. If it’s set to `apps/admin-web`, the root `vercel.json` is not used and `/` won’t be served by the Next app.

2. **Framework Preset: Other**  
   In **Settings → General → Framework Preset**, choose **Other** so Vercel uses `vercel.json` (buildCommand + builds) instead of auto-detecting Next only.

3. **Redeploy after changing settings**  
   Use **Deployments → … on latest → Redeploy** (or push a new commit) so the new settings apply.

4. **Try /login**  
   Open `https://your-project.vercel.app/login`. If that works but `/` doesn’t, the app is deployed; the root page may be cached. If `/login` also 404s, Root Directory or Framework Preset is still wrong.

### Still 404? Use two projects (recommended fix)

When the single-project setup keeps returning 404, use **two Vercel projects**: one for the API (current), one for the Admin UI. The Admin project will serve the UI at `/` with no 404.

**Step 1 – Keep current project as API (optional)**  
In the **current** project (e.g. `weyouapp-v-01-admin-web-1xhg`): **Settings → General → Configuration File** set to **`vercel-api-only.json`**, then Save and Redeploy. That project will then only build and serve the API at `https://your-project.vercel.app/api`.

**Step 2 – Create a new project for the Admin UI**  
1. In Vercel: **Add New Project** → import the **same** repo (`weyoudev/Weyouapp-V.01`).  
2. **Project name:** e.g. `weyou-admin`.  
3. **Root Directory:** set to **`apps/admin-web`**.  
4. **Framework Preset:** **Next.js**.  
5. **Build Command (required):** Vercel may still use the root repo’s build. In this project go to **Settings → General**. Under **Build and Development Settings**, turn **Override** ON for **Build Command** and set it to **`npm run build`**. Save. (Otherwise you’ll see "Missing script: prisma:generate".)  
6. **Environment variables:** add **`NEXT_PUBLIC_API_URL`** = your API project URL + `/api`. Also add **`VERCEL_ADMIN_ONLY`** = **`1`** (so the build runs only the Next app, not Prisma/API). Save.  
7. Deploy.

**Step 3 – Use the new URL**  
Open the **new** project's URL (e.g. `https://weyou-admin-xxx.vercel.app`). You should see the Admin UI. The admin app will call the API at the URL you set. CORS already allows `*.vercel.app`.

### Still not working? (API-only + separate Admin)

If login fails or you see “Cannot reach the API” with the two-project setup:

1. **Check the API is up**  
   Open **`https://your-api-project.vercel.app/api/health`** in a browser (use your real API project URL). You should get JSON like `{"status":"ok"}`. If you get 404 or an error, the API project is not serving correctly (confirm **Configuration File** is **`vercel-api-only.json`** and redeploy).

2. **Set Admin env exactly**  
   In the **Admin** project: **Settings → Environment Variables** set **`NEXT_PUBLIC_API_URL`** = **`https://your-api-project.vercel.app/api`** (your API project URL + `/api`, no trailing slash). No typos, and no `/api/api`.

3. **Redeploy the Admin project**  
   **`NEXT_PUBLIC_*`** is baked in at **build** time. After changing it you must **Redeploy** (Deployments → ⋯ → Redeploy) or push a new commit. Otherwise the app still uses the old URL.

4. **Verify what the app is using**  
   On the login page, after a failed request the app shows **“Using API: …”**. That value must be your API project URL (e.g. `https://weyou-api-xxx.vercel.app/api`). If it shows something else, fix the env and redeploy.

---

## CORS

The API allows:

- `https://weyou-admin.onrender.com`
- `https://*.vercel.app`
- `http://localhost:*` and `http://127.0.0.1:*`

To add another admin domain, edit `apps/api/src/bootstrap/create-app.ts` (`allowedOrigins`).

---

## Customer PWA (`apps/customer-pwa`)

Use a **separate Vercel project** from the API. Recommended:

- **Root Directory:** `apps/customer-pwa` (or repo root; see below).
- **Framework preset:** Expo (or Other if you override the build).
- **Build Command:** `npm run build`  
  If you copied the API template (`npm run prisma:generate && npm run build:api`), that still works: this package defines `build:api` to run the same Expo web export as `npm run build`.
- **Install Command:** from **repo root**, `npm ci` (so workspaces resolve). If Root Directory is `apps/customer-pwa`, set Install Command to `cd ../.. && npm ci` unless Vercel already installs from the monorepo root.
- **Output directory:** Expo web export output (see `apps/customer-pwa/scripts/postexport-pwa.js` / Expo docs for the folder name, often `dist`).

---

## Summary

| Setup   | Root Directory   | Result |
|--------|-------------------|--------|
| **One project** | (empty) | One URL: app at `/`, API at `/api`. Set `NEXT_PUBLIC_API_URL=/api`. |
| **Two projects** | (empty) for API, `apps/admin-web` for Admin | Two URLs; set admin’s `NEXT_PUBLIC_API_URL` to the API project URL + `/api`. |
