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
