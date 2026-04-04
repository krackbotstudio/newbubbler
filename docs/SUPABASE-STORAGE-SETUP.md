# Supabase Storage Setup Guide

## Quick Start Checklist

### ✅ Step 1: Create Storage Bucket

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Click **Storage** in left sidebar
3. Click **New bucket**
4. Configure:
   - **Name:** `assets` (recommended) or `weyou-app`
   - **Public:** ✅ **ENABLE** (required for images to work without signed URLs)
5. Click **Create bucket**

---

### ✅ Step 2: Get API Credentials

1. In Supabase Dashboard, go to **Settings** (gear) → **API**
2. Copy these values:

   **Project URL:**
   ```
   https://YOUR_PROJECT_REF.supabase.co
   ```
   
   **service_role key:** (click reveal to see)
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

⚠️ **Important:** 
- Use the `service_role` key (NOT the `anon/public` key)
- Keep this key secret - never expose it in frontend code
- The service role has full access to all storage operations

---

### ✅ Step 3: Update `.env` File

Open `e:\Weyouprod\.env` and replace the placeholder values:

```env
# Comment out local storage
# STORAGE_DRIVER=local
# LOCAL_STORAGE_ROOT=./storage

# Supabase Storage Configuration
SUPABASE_URL="https://YOUR_ACTUAL_PROJECT_REF.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-actual-service-role-key-here"
SUPABASE_STORAGE_BUCKET="assets"
```

**Replace:**
- `YOUR_ACTUAL_PROJECT_REF` with your Supabase project reference
- `your-actual-service-role-key-here` with the actual key from Step 2
- Keep `assets` as the bucket name (or whatever you named it)

---

### ✅ Step 4: Restart API Server

Stop the running API server and restart it:

```bash
# Stop current API (Ctrl+C if running)
# Then restart
npm run dev:api
```

The API will now use Supabase Storage instead of local disk storage.

---

### ✅ Step 5: Verify Setup

1. **Check API logs** - You should see no errors related to storage
2. **Test upload** - Go to admin dashboard → Branding page
3. Upload a test logo
4. Check the response URL - it should be a full Supabase URL like:
   ```
   https://lgykizwycdkfkwxidpro.supabase.co/storage/v1/object/public/assets/branding/1711234567890-logo.png
   ```
   NOT a local path like `/api/assets/branding/...`

---

## How It Works

### Storage Adapter Logic

The application uses a **Storage Adapter Pattern**:

```typescript
// apps/api/src/infra/infra.module.ts
const storageAdapter = process.env.SUPABASE_SERVICE_ROLE_KEY &&
                       process.env.SUPABASE_URL &&
                       process.env.SUPABASE_STORAGE_BUCKET
  ? new SupabaseStorageAdapter(...)  // Cloud storage
  : new LocalStorageAdapter(...);    // Local disk storage
```

### Upload Flow with Supabase

1. **User uploads file** via admin dashboard
2. **Frontend** sends POST request with FormData
3. **Backend** receives file buffer
4. **Service** sanitizes filename and generates path:
   - Path: `branding/1711234567890-logo.png`
5. **SupabaseStorageAdapter.putObject()**:
   - Uploads to Supabase bucket
   - Returns public URL: `https://...supabase.co/assets/branding/...`
6. **Database** stores the full Supabase URL
7. **Images load directly from Supabase CDN** (fast, persistent)

---

## File Organization in Supabase

Files are organized by type:

```
assets/ (bucket root)
├── branding/
│   ├── 1711234567890-company-logo.png
│   ├── 1711234567891-app-icon.png
│   ├── 1711234567892-upi-qr.png
│   └── welcome-bg-1711234567893-bg.jpg
├── catalog-icons/
│   ├── icon-1711234567894-shirt.png
│   ├── icon-1711234567895-pants.png
│   └── icon-1711234567896-dress.png
├── carousel/
│   ├── 1711234567897-slide1.jpg
│   ├── 1711234567898-slide2.jpg
│   └── 1711234567899-slide3.jpg
└── branch-logos/
    └── 1711234567900-branch-logo.png
```

---

## Migration Notes

### Existing Local Files

If you have existing images in local storage (`./storage`):

- **Old database records** with `/api/assets/branding/...` URLs will continue working
- The API serves these from local disk when Supabase is not configured
- **After switching to Supabase**, old relative URLs still work but point to local files
- **New uploads** get full Supabase URLs and persist across deploys

### Recommended Migration Steps

1. **Backup local files** (optional):
   ```bash
   # Copy existing storage folder
   cp -r ./storage ./storage-backup
   ```

2. **Switch to Supabase** (follow Steps 1-4 above)

3. **Re-upload important assets**:
   - Go to admin dashboard → Branding
   - Re-upload logo, app icon, UPI QR
   - Go to Catalog
   - Re-upload catalog item icons
   
   This ensures all active assets are on Supabase

4. **Verify everything works**:
   - Check that new uploads show Supabase URLs in database
   - Test mobile app loads images correctly
   - Verify admin dashboard displays all images

---

## Troubleshooting

### ❌ Error: "Supabase storage upload failed"

**Possible causes:**
1. Bucket doesn't exist or wrong name
2. Bucket is set to Private (should be Public)
3. Invalid service_role key

**Solution:**
- Double-check bucket name matches `SUPABASE_STORAGE_BUCKET`
- Verify bucket is Public in Supabase Dashboard → Storage → Your bucket → Settings
- Regenerate service_role key if needed (Settings → API)

---

### ❌ Images not loading after upload

**Check:**
1. Is the bucket Public? (required for images to load without signed URLs)
2. Is the URL in database a full Supabase URL?
3. Can you access the image URL directly in browser?

**Fix:**
- If bucket is Private, either:
  - Change it to Public (recommended), OR
  - Implement signed URL generation (more complex)

---

### ❌ Still using local storage

**Symptoms:**
- Upload URLs are `/api/assets/branding/...` instead of Supabase URLs
- Files appearing in `./storage` folder

**Check:**
1. Are all three env vars set?
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`
2. Did you restart the API server after changing `.env`?

**Solution:**
- Ensure all three variables are set (no typos)
- Restart API: `npm run dev:api`

---

## Benefits of Supabase Storage

| Feature | Local Storage | Supabase Storage |
|---------|--------------|------------------|
| **Persistence** | ❌ Lost on deploy | ✅ Permanent |
| **Scalability** | Limited by disk | Unlimited |
| **CDN** | ❌ No | ✅ Yes (fast) |
| **Backups** | Manual | ✅ Automatic |
| **Multi-server** | ❌ No | ✅ Yes |
| **Setup** | None | 5 minutes |

---

## Security Notes

✅ **Safe practices:**
- Store `SUPABASE_SERVICE_ROLE_KEY` only in `.env` (backend)
- Never commit `.env` to git (it's in `.gitignore`)
- Use environment-specific keys for production

❌ **Don't:**
- Expose service_role key in frontend code
- Use anon/public key for server operations (insufficient permissions)
- Commit credentials to version control

---

## Cost

Supabase Free Tier includes:
- ✅ 1 GB file storage
- ✅ 2 GB/month bandwidth
- ✅ Unlimited API requests

For most small-medium apps, the free tier is sufficient. Paid plans start at $25/month.

---

## Next Steps

After setup:
1. ✅ Test all image uploads (logo, catalog icons, carousel)
2. ✅ Verify mobile app loads images from Supabase
3. ✅ Update deployment scripts to include Supabase env vars
4. ✅ Monitor usage in Supabase Dashboard → Storage

---

**Questions?** Check the main documentation:
- Database setup: `docs/supabase.md`
- Local deployment: `docs/run-local.md`
- API routes: `docs/routes.md`
