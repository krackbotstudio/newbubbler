# 🚀 Supabase Storage - Quick Reference Card

## ⚡ 3-Minute Setup

### 1️⃣ Create Bucket (2 min)
```
Supabase Dashboard → Storage → New bucket
Name: assets
Public: ✅ ENABLE
```

### 2️⃣ Get Credentials (1 min)
```
Settings → API
→ Copy Project URL: https://xxxxx.supabase.co
→ Copy service_role key: eyJhbGc...
```

### 3️⃣ Update .env (30 sec)
Edit `e:\Weyouprod\.env`:

**REPLACE:**
```env
STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=./storage
```

**WITH:**
```env
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-actual-key-here"
SUPABASE_STORAGE_BUCKET="assets"
```

### 4️⃣ Restart API
```bash
# Stop API (Ctrl+C)
npm run dev:api
```

✅ **Done!** Upload a test logo to verify.

---

## 📝 What Changes?

| Before (Local) | After (Supabase) |
|----------------|------------------|
| Files in `./storage/` | Files in Supabase cloud |
| URLs: `/api/assets/...` | URLs: `https://...supabase.co/...` |
| Lost on deploy | ✅ Permanent |
| No CDN | ✅ Fast CDN |

---

## 🎯 File Paths

All uploads go to Supabase bucket `assets/`:

```
assets/
├── branding/           # Logo, app icon, UPI QR, welcome BG
├── catalog-icons/      # Catalog item icons  
├── carousel/           # Home page carousel images
└── branch-logos/       # Branch logos
```

---

## 🔍 How to Verify

After uploading a logo in admin dashboard:

**✅ Correct (Supabase):**
```json
{
  "logoUrl": "https://lgykizwycdkfkwxidpro.supabase.co/storage/v1/object/public/assets/branding/1711234567890-logo.png"
}
```

**❌ Still Local:**
```json
{
  "logoUrl": "/api/assets/branding/1711234567890-logo.png"
}
```

---

## 🐛 Common Issues

### "Bucket not found"
- Check `SUPABASE_STORAGE_BUCKET` matches your bucket name
- Bucket must exist in Supabase Dashboard → Storage

### "Unauthorized" or "Invalid credentials"
- Use `service_role` key (NOT anon/public key)
- Found at: Settings → API → Project API keys

### Images not loading
- Bucket must be **Public** (Storage → Your bucket → Settings)
- Test URL directly in browser

---

## 📊 Free Tier Limits

- ✅ 1 GB storage
- ✅ 2 GB/month bandwidth  
- ✅ Unlimited requests

**Paid:** $25/month for 100 GB storage

---

## 🔐 Security

**DO:**
- ✅ Store key only in `.env` (backend)
- ✅ Use different keys for dev/prod
- ✅ Keep `.env` in `.gitignore`

**DON'T:**
- ❌ Expose service_role in frontend code
- ❌ Commit `.env` to git
- ❌ Use anon key for server uploads

---

## 📖 Full Guide

See: `docs/SUPABASE-STORAGE-SETUP.md`

---

**Need help?** 

1. Check API logs for errors
2. Verify all 3 env vars are set
3. Confirm bucket is Public
4. Restart API after .env changes
