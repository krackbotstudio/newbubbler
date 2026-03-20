# Build stage: from monorepo root context
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/admin-web ./apps/admin-web

# Install all dependencies (skip optional native binaries for linux)
RUN npm ci --ignore-scripts

# Build admin-web (Next.js standalone output)
RUN npm run build:admin

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Required: bind to all interfaces inside the container
ENV HOSTNAME=0.0.0.0

# Copy standalone output (preserves apps/admin-web/server.js path structure)
COPY --from=builder /app/apps/admin-web/.next/standalone ./
# Copy static assets into the expected location
COPY --from=builder /app/apps/admin-web/.next/static ./apps/admin-web/.next/static
# Copy public folder
COPY --from=builder /app/apps/admin-web/public ./apps/admin-web/public

WORKDIR /app/apps/admin-web

EXPOSE 3000

CMD ["node", "server.js"]
