# Dokploy Deployment Guide - Prisma Schema Sync Fix

## What Was Fixed

The Dockerfile has been updated to automatically run Prisma database migrations before starting the API server. This prevents the `SCHEMA_OUT_OF_DATE` error from occurring in production.

## Changes Made

### 1. Updated `apps/api/Dockerfile`

**Added (lines 35-37):**
- Copy Prisma CLI and @prisma modules from builder stage to production container
- This is necessary because Prisma is in devDependencies but needed for runtime migrations

**Added (lines 52-53):**
- Copy Prisma schema and migrations directory to production container

**Modified CMD (line 65-66):**
- Changed from: `CMD ["node", "-r", "tsconfig-paths/register", "dist/apps/api/src/bootstrap/main.js"]`
- Changed to: `CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=src/infra/prisma/schema.prisma && node -r tsconfig-paths/register dist/apps/api/src/bootstrap/main.js"]`
- Uses direct binary path instead of `npx` since Prisma is copied manually

## How to Deploy in Dokploy

### Step 1: Commit and Push Changes

```bash
git add apps/api/Dockerfile
git commit -m "fix: run Prisma migrations on container startup to prevent SCHEMA_OUT_OF_DATE"
git push origin main
```

### Step 2: Redeploy in Dokploy

1. Open your **Dokploy dashboard**
2. Navigate to your **API service/application**
3. Trigger a **new deployment** (this may happen automatically if you have auto-deploy enabled)
4. Wait for the deployment to complete

### Step 3: Verify the Deployment

1. Check the **container logs** in Dokploy
2. You should see output similar to:
   ```
   Prisma schema loaded from src/infra/prisma/schema.prisma
   Datasource "db": PostgreSQL database
   1 migration found in prisma/migrations
   Applying migration...
   Database is now up to date
   ```
3. After migrations complete, the API server will start

### Step 4: Test Login

Try logging in again. The `SCHEMA_OUT_OF_DATE` error should be resolved.

## How It Works Now

**Every time the container starts:**
1. Runs `npx prisma migrate deploy` to apply any pending migrations
2. Only after migrations succeed, starts the API server
3. This ensures the database schema is always in sync with the code

## Benefits

✅ **No more schema sync errors** - Migrations run automatically on every deployment  
✅ **Production-safe** - `prisma migrate deploy` is designed for production use  
✅ **Zero manual intervention** - No need to manually run migrations via shell  
✅ **Safe rollbacks** - If migrations fail, the container won't start (preventing broken state)

## Troubleshooting

### If you see Bad Gateway (502) error:

1. **Check container logs** in Dokploy - the container may be crashing
2. **Verify Prisma CLI is available** - ensure the COPY commands for prisma and @prisma are present
3. **Check DATABASE_URL** environment variable is correctly set in Dokploy
4. **Test database connectivity** from the container to your PostgreSQL database

### If deployment fails:

1. **Check container logs** in Dokploy for migration errors
2. **Verify DATABASE_URL** environment variable is correctly set
3. **Check database connectivity** from the container to your PostgreSQL database

### If migrations fail:

```bash
# Access container shell via Dokploy
# Then run manually to see detailed errors:
cd /app/apps/api
npx prisma migrate status --schema=src/infra/prisma/schema.prisma
```

### To check migration status:

```bash
# In container shell:
npx prisma migrate status --schema=src/infra/prisma/schema.prisma
```

## Important Notes

- **Backup your database** before major deployments (best practice)
- The `prisma migrate deploy` command only applies **pending** migrations (safe to run multiple times)
- If you need to create new migrations, do it locally with `npm run prisma:migrate:dev` and commit the migration files
- Never run `prisma migrate dev` in production - only use `prisma migrate deploy`

## Future Deployments

From now on, every deployment will automatically:
1. Apply any new migrations
2. Start the API server with the updated schema
3. Prevent schema mismatch errors

No additional steps needed! 🎉

## Subdomain Setup For Partial Admin Portals

To support shareable customer links like `https://{slug}.bubbler.krackbot.com`, configure:

1. DNS wildcard record:
   - `*.bubbler.krackbot.com` -> customer-web ingress/load balancer.
2. TLS wildcard certificate:
   - certificate covering `*.bubbler.krackbot.com`.
3. Reverse proxy host forwarding:
   - preserve `Host` and `X-Forwarded-Host` headers to API/customer-web.
4. Route behavior:
   - all wildcard subdomains should serve `apps/customer-web`.
   - API remains on your normal API domain/base path.

Portal resolution logic reads host to identify tenant, so wildcard DNS/TLS and forwarded host headers are required.
