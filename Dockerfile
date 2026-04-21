# Admin Web (Next.js) — default image when `docker build` runs from repo root (e.g. Dokploy).
# API image: docker build -f apps/api/Dockerfile .
#
# Build context must be the monorepo root.

FROM node:20-alpine AS builder
WORKDIR /app

COPY apps/admin-web/package.json ./package.json
RUN npm install --ignore-scripts --omit=optional

COPY apps/admin-web/ ./
RUN mkdir -p ./public

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
