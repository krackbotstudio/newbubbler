# Development Supabase only (no production DB)

Use a **separate Supabase project** for local development. Do not point `DATABASE_URL` at production.

## 1. Create or select a dev project

Supabase Dashboard → New project (or use an existing **dev/staging** project).

## 2. API / Prisma (`apps/api/.env` and/or repo root `.env`)

1. **Settings → Database → Connection string → URI** (direct connection, port `5432`).
2. Replace the password placeholder with your **database password** (not the Supabase account password).
3. Append `?sslmode=require` if it is not already in the string.

For **Supabase connection pooler** (host contains `pooler.supabase.com`), add **`&pgbouncer=true`** to the query string (Prisma + PgBouncer). Keep **`PRISMA_CLIENT_DISABLE_PREPARED_STATEMENTS=true`** in the same `.env` the API loads (`apps/api/.env`).
4. Set:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?sslmode=require"
```

Optionally set `DATABASE_DIRECT_URL` to the same value if Prisma migrations ask for it.

## 3. Customer PWA + Mobile (`apps/customer-pwa/.env`, `apps/customer-mobile/.env`)

1. **Settings → API**
2. Copy **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
3. Copy **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 4. Local API URL

Keep customer apps pointed at your local API during dev:

```env
EXPO_PUBLIC_API_URL=http://localhost:3009
```

(Physical phone: use your PC’s LAN IP and the same port as `PORT` in `apps/api`.)

## 5. Apply schema to the new database

From repo root (see `docs/run-local.md`):

```bash
npm run prisma:generate
npm run prisma:migrate
```

## 6. Storage bucket (`assets`)

The API uses Supabase Storage when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `apps/api/.env`. The bucket name defaults to **`assets`** (override with `SUPABASE_STORAGE_BUCKET`).

After setting those variables, create the public bucket once from the repo root:

```bash
npm run supabase:ensure-assets-bucket
```

## 7. Security

- Never commit real `.env` files.
- If a secret was ever pasted into a tracked file, **rotate** it in Supabase / GitHub / Twilio.

See also: `docs/supabase.md`.

---

## 8. Switching to a new Supabase project (change account / new org)

Do this when you create a **new** Supabase project or move the app to another Supabase account. Update **local** and **hosting** env vars; do not commit secrets.

### 8.1 Gather values from the new project (Dashboard → Settings → API / Database)

| Value | Where in Supabase |
|--------|-------------------|
| **Project URL** | Settings → API → Project URL (`https://<ref>.supabase.co`) |
| **anon public** key | Settings → API → Project API keys → `anon` `public` |
| **service_role** key | Settings → API → `service_role` **secret** (server only; never in client bundles) |
| **JWT Secret** | Settings → API → JWT Settings → **JWT Secret** (used by API to verify Supabase-issued JWTs, e.g. `SUPABASE_JWT_SECRET`) |
| **Database URI** | Settings → Database → Connection string (URI); use direct `db.<ref>.supabase.co:5432` or pooler per `docs/supabase.md` |

### 8.2 Files to edit on your machine (copy from `.env.example` where needed)

| File | Variables to replace with the **new** project |
|------|-----------------------------------------------|
| [`apps/api/.env`](../apps/api/.env) | `DATABASE_URL`, optional `DATABASE_DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `SUPABASE_STORAGE_BUCKET`, `SUPABASE_JWT_SECRET` (if you use Supabase Auth from the API) |
| [`apps/customer-mobile/.env`](../apps/customer-mobile/.env) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| [`apps/customer-pwa/.env`](../apps/customer-pwa/.env) | Same `EXPO_PUBLIC_SUPABASE_*` |
| [`apps/admin-web/.env`](../apps/admin-web/.env) or `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` only if admin uses Supabase in the browser |
| Repo root `.env` (if you use one) | Same keys if duplicated for tooling |

Keep **`EXPO_PUBLIC_API_URL` / `NEXT_PUBLIC_API_URL`** pointed at your **API** host; they are not Supabase URLs.

### 8.3 Database and Prisma on the new project

1. Point `DATABASE_URL` (and `DATABASE_DIRECT_URL` if you use it) at the **new** Postgres.
2. From repo root:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

3. If your schema uses the `AGENT` role enum, run once if docs say so: `npm run db:ensure-role-agent`

4. **Data:** new project starts empty. To move data from the old project, use **Supabase backups / pg_dump** from the old DB and restore into the new DB (outside this repo), or re-seed: `npm run prisma:seed` (dev only).

### 8.4 Storage bucket on the new project

1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env` for the **new** project.
2. Run: `npm run supabase:ensure-assets-bucket` (creates default **`assets`** bucket unless `SUPABASE_STORAGE_BUCKET` overrides).

Existing rows may still reference **old** public URLs; new uploads use the new project. Re-upload branding/assets in admin if needed.

### 8.5 Auth URL allowlist (if you use Supabase Auth in apps)

In the new project: **Authentication → URL configuration** — add your site URLs (e.g. `http://localhost:3004`, production admin/PWA origins).

### 8.6 Hosted deploys (Vercel, Render, EAS, Docker)

Update the same variable names in each provider’s environment UI. Redeploy after changing secrets.

### 8.7 Old project hygiene

In the **previous** Supabase project: rotate or revoke API keys if they were exposed; pause or delete the project when fully migrated.
