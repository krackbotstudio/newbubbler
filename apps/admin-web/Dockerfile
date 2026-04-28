# Same build as `/Dockerfile` at repo root (many hosts only auto-detect ./Dockerfile).
# Build from monorepo root:
#   docker build -f apps/admin-web/Dockerfile .

FROM node:20-alpine AS builder
WORKDIR /app

# Install deps using only admin-web manifest (standalone app at /app)
COPY apps/admin-web/package.json ./package.json
RUN npm install --ignore-scripts --omit=optional

COPY apps/admin-web/ ./
RUN mkdir -p ./public

RUN npm run build

# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3002

CMD ["node", "server.js"]
