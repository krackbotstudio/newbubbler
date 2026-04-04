# Customer PWA Deployment Guide (Dokploy)

This guide covers deploying the Customer PWA to Dokploy.

## Prerequisites

1. **Dokploy** server running and accessible
2. **Environment variables** ready:
   - `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `EXPO_PUBLIC_API_URL` - Your backend API URL (e.g., `https://api.yourdomain.com`)

## Option 1: Deploy via Dokploy Git Integration (Recommended)

### Step 1: Push to Git Repository

Ensure your code is pushed to a Git repository (GitHub, GitLab, etc.).

### Step 2: Create Application in Dokploy

1. Log in to your Dokploy dashboard
2. Click **Create Project** → **Application**
3. Select your Git provider and repository
4. Configure:
   - **Source Path**: `/` (repository root - required for monorepo)
   - **Dockerfile Path**: `apps/customer-pwa/Dockerfile`
   - **Build Context**: `.` (repository root)

### Step 3: Set Environment Variables (Build Args)

In Dokploy's application settings, add these **Build Arguments**:

| Name | Value |
|------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |
| `EXPO_PUBLIC_API_URL` | `https://api.yourdomain.com` |
| `SKIP_ICON_UPDATE` | `1` (optional, set to skip icon fetch) |
| `UPDATE_ICON_LOGO_URL` | Direct URL to logo (optional) |

### Step 4: Configure Domain

1. In Dokploy, go to **Domains**
2. Add your domain (e.g., `app.yourdomain.com`)
3. Enable **HTTPS** (required for PWA installation)

### Step 5: Deploy

Click **Deploy** and wait for the build to complete.

---

## Option 2: Deploy via Docker Image

### Step 1: Build Locally

From the **repository root**, run:

```bash
# Build the Docker image
docker build \
  -f apps/customer-pwa/Dockerfile \
  --build-arg EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg EXPO_PUBLIC_API_URL=https://api.yourdomain.com \
  -t customer-pwa:latest .
```

### Step 2: Push to Registry

```bash
# Tag for your registry
docker tag customer-pwa:latest your-registry.com/customer-pwa:latest

# Push
docker push your-registry.com/customer-pwa:latest
```

### Step 3: Deploy in Dokploy

1. Create Application → **Docker Image**
2. Enter your image: `your-registry.com/customer-pwa:latest`
3. Configure domain and deploy

---

## Option 3: Local Testing with Docker Compose

Create a `.env` file in the repository root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3009
```

Then run:

```bash
docker-compose -f docker-compose.customer-pwa.yml up --build
```

Access the PWA at: http://localhost:3080

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `EXPO_PUBLIC_API_URL` | Yes | Backend API URL (without `/api` suffix) |
| `SKIP_ICON_UPDATE` | No | Set to `1` to skip icon download from branding |
| `UPDATE_ICON_LOGO_URL` | No | Direct URL to logo image for app icon |

---

## Troubleshooting

### Build fails with "Cannot find module '../customer-mobile/App'"

Ensure you're building from the **repository root** with the full context:
```bash
docker build -f apps/customer-pwa/Dockerfile .
```

### Icons not showing / blank favicon

1. Ensure logo is uploaded in Admin → Branding
2. Or set `UPDATE_ICON_LOGO_URL` build arg with direct image URL
3. Or set `SKIP_ICON_UPDATE=1` to use default assets

### PWA not installable

- HTTPS is **required** for PWA installation
- Ensure domain is configured with SSL in Dokploy

### API connection errors

- Verify `EXPO_PUBLIC_API_URL` is correct and accessible
- For local testing, use your machine's IP, not `localhost` (if API runs on host)

### Build takes too long

The first build downloads all npm dependencies. Subsequent builds use Docker layer caching.

---

## Health Check

The nginx server exposes a health endpoint:

```
GET /health → 200 OK
```

Dokploy uses this automatically for health monitoring.

---

## Updating the Deployment

1. Push changes to Git (or build new Docker image)
2. In Dokploy, click **Redeploy** or enable auto-deploy on push
