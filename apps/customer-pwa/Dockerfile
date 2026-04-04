# Multi-stage build for Expo PWA
# Build from monorepo root: docker build -f apps/customer-pwa/Dockerfile .

# Stage 1: Build the PWA
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files for workspace
COPY package.json package-lock.json ./
COPY apps/customer-pwa/package.json ./apps/customer-pwa/
COPY apps/customer-mobile/package.json ./apps/customer-mobile/

# Install all dependencies
RUN npm ci --legacy-peer-deps

# Copy source code (customer-pwa needs customer-mobile for shared App)
COPY apps/customer-pwa ./apps/customer-pwa
COPY apps/customer-mobile ./apps/customer-mobile

# Copy nginx config to a known location for the production stage
COPY apps/customer-pwa/nginx.conf /app/nginx.conf

# Set build-time environment variables (override via --build-arg)
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_API_URL
ARG UPDATE_ICON_LOGO_URL
ARG SKIP_ICON_UPDATE=0

ENV EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY}
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
ENV UPDATE_ICON_LOGO_URL=${UPDATE_ICON_LOGO_URL}
ENV SKIP_ICON_UPDATE=${SKIP_ICON_UPDATE}

# Optional: Update icons from branding API (requires API to be accessible)
# Set SKIP_ICON_UPDATE=1 to skip, or UPDATE_ICON_LOGO_URL to use a direct URL
WORKDIR /app/apps/customer-mobile
RUN node scripts/update-icon-from-branding.js || echo "Icon update skipped (API not reachable or no logo configured)"

# Build the PWA
WORKDIR /app/apps/customer-pwa
RUN npx expo export --platform web && node scripts/postexport-pwa.js

# Stage 2: Serve with nginx
FROM nginx:alpine AS production

# Copy custom nginx config from builder stage
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built PWA files
COPY --from=builder /app/apps/customer-pwa/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
