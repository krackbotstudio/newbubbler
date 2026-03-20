# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies (skip optional win32 native binaries)
RUN npm install --ignore-scripts --omit=optional

# Copy the rest of the app source
COPY . .

# Build Next.js (standalone output is configured in next.config.js)
RUN npx next build

# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone server bundle
COPY --from=builder /app/.next/standalone ./
# Copy static assets into the standalone's expected location
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
