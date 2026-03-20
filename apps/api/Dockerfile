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

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy root package files for production install
COPY package.json package-lock.json ./

# Install production deps only + tsconfig-paths (required at runtime for @shared/* resolution)
RUN npm ci --omit=dev --ignore-scripts && npm install tsconfig-paths --ignore-scripts

# Copy compiled API output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma generated client
COPY --from=builder /app/apps/api/src/infra/generated ./apps/api/src/infra/generated

# Copy API tsconfig (needed by tsconfig-paths at runtime)
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json

# Copy shared package (tsconfig-paths resolves @shared/* to these JS files at runtime)
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/api

EXPOSE 8080

CMD ["node", "-r", "tsconfig-paths/register", "dist/apps/api/src/bootstrap/main.js"]
