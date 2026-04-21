# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package files (lock file lives at monorepo root)
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./

# Copy shared packages and API source
COPY packages ./packages
COPY apps/api ./apps/api

# Install all dependencies
RUN npm ci --ignore-scripts

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/src/infra/prisma/schema.prisma

# Compile TypeScript
RUN npm run build:api

# ─── Stage 1.5: Migration runner (uses full deps including Prisma)
FROM node:20-alpine AS migrator
WORKDIR /app

# Copy all dependencies (including devDependencies for Prisma)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy Prisma schema and migrations
COPY apps/api/src/infra/prisma ./apps/api/src/infra/prisma

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy root package files for production install
COPY package.json package-lock.json ./

# Install production deps only
RUN npm ci --omit=dev --ignore-scripts

# Copy tsconfig-paths + all its dependencies from builder
# (tsconfig-paths is a devDep; re-installing via npm fails in workspace monorepos)
COPY --from=builder /app/node_modules/tsconfig-paths ./node_modules/tsconfig-paths
COPY --from=builder /app/node_modules/json5 ./node_modules/json5
COPY --from=builder /app/node_modules/strip-bom ./node_modules/strip-bom
COPY --from=builder /app/node_modules/minimist ./node_modules/minimist

# Copy compiled API output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma generated client
COPY --from=builder /app/apps/api/src/infra/generated ./apps/api/src/infra/generated

# Copy Prisma schema and migrations (needed for running migrations in production)
COPY --from=migrator /app/apps/api/src/infra/prisma ./apps/api/src/infra/prisma

# Copy Prisma CLI from migrator stage (needed to run migrations in container)
COPY --from=migrator /app/node_modules/prisma ./node_modules/prisma
COPY --from=migrator /app/node_modules/@prisma ./node_modules/@prisma

# Copy API tsconfig (needed by tsconfig-paths at runtime)
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json

# Copy shared package (tsconfig-paths resolves @shared/* to these JS files at runtime)
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/api

COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "-r", "tsconfig-paths/register", "dist/apps/api/src/bootstrap/main.js"]

# Manual migrations without RUN_MIGRATIONS: npx prisma migrate deploy --schema=src/infra/prisma/schema.prisma
