# ✅ Supabase Storage Setup Checklist

Use this checklist to ensure a smooth setup of Supabase Storage.

---

## Pre-Setup (5 minutes)

- [ ] **Have Supabase project created**
  - Go to https://supabase.com/dashboard
  - Your project should be visible
  
- [ ] **Know your database password**
  - Settings → Database → Database password
  - Reset if needed (alphanumeric only for simplicity)

---

## Step 1: Create Storage Bucket ✅

- [ ] Navigate to **Storage** in left sidebar
- [ ] Click **New bucket**
- [ ] Set bucket name: `assets`
- [ ] Toggle **Public** to ✅ ENABLED
- [ ] Leave file size limit as default
- [ ] Click **Create bucket**
- [ ] Verify bucket appears in Storage list

**Verification:**
```
✅ Bucket named "assets" exists
✅ Bucket shows "Public" badge
✅ Can see bucket in Storage → All objects
```

---

## Step 2: Get API Credentials ✅

- [ ] Go to **Settings** (gear icon) → **API**
- [ ] Under **Project URL**, click copy
  - [ ] Paste it here for reference: _______________________
  
- [ ] Under **Project API keys**, find `service_role` key
- [ ] Click reveal icon (eye)
- [ ] Click copy button
  - [ ] Paste it here for reference: _______________________

**⚠️ Important:**
- [ ] Using `service_role` key (NOT anon/public key)
- [ ] Key starts with `eyJhbG...` (JWT format)
- [ ] Key is kept secret (don't share or commit)

**Verification:**
```
✅ Have Project URL (https://xxxxx.supabase.co)
✅ Have service_role key (eyJhbGciOiJIUzI1NiIs...)
✅ NOT using anon or public key
```

---

## Step 3: Update Environment File ✅

- [ ] Open `e:\Weyouprod\.env` in editor
- [ ] Find these lines:
  ```env
  STORAGE_DRIVER=local
  LOCAL_STORAGE_ROOT=./storage
  ```

- [ ] Comment them out:
  ```env
  # STORAGE_DRIVER=local
  # LOCAL_STORAGE_ROOT=./storage
  ```

- [ ] Add Supabase configuration:
  ```env
  SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
  SUPABASE_SERVICE_ROLE_KEY="your-actual-key-here"
  SUPABASE_STORAGE_BUCKET="assets"
  ```

- [ ] Replace placeholders:
  - [ ] `YOUR_PROJECT_REF` → actual project ref from Step 2
  - [ ] `your-actual-key-here` → actual service_role key from Step 2
  - [ ] Keep `assets` as bucket name

- [ ] Save the file

**Verification:**
```
✅ Three new lines added (SUPABASE_*)
✅ Old local storage lines commented out
✅ No placeholder text remaining (no angle brackets)
✅ Values enclosed in double quotes
✅ No extra spaces or typos
```

---

## Step 4: Restart API Server ✅

- [ ] Stop current API process
  - If running in terminal, press `Ctrl+C`
  
- [ ] Clear any cached processes (optional):
  ```bash
  # Windows PowerShell
  Get-Process node | Stop-Process -Force
  ```

- [ ] Start API server:
  ```bash
  npm run dev:api
  ```

- [ ] Wait for startup message:
  ```
  Nest application successfully started
  ```

- [ ] Check for any errors related to storage

**Verification:**
```
✅ API starts without errors
✅ No "Supabase storage upload failed" errors
✅ Console shows successful startup
```

---

## Step 5: Test Upload ✅

- [ ] Open admin dashboard in browser
  - http://localhost:3000 (or your admin URL)
  
- [ ] Navigate to **Branding** page

- [ ] Find the **Logo** section

- [ ] Click **Upload logo** button

- [ ] Select a test image (PNG or JPG)

- [ ] Wait for upload to complete

- [ ] Check for success toast notification

**Expected Result:**
```
✅ "Logo uploaded" success message
✅ Logo preview appears
✅ No error notifications
```

---

## Step 6: Verify Database ✅

- [ ] Open your database (via Supabase SQL Editor or table editor)

- [ ] Query the branding table:
  ```sql
  SELECT "logoUrl", "appIconUrl", "upiQrUrl" FROM branding LIMIT 1;
  ```

- [ ] Check the `logoUrl` value

**Expected Format (Supabase):**
```
✅ https://lgykizwycdkfkwxidpro.supabase.co/storage/v1/object/public/assets/branding/...
```

**Wrong Format (still local):**
```
❌ /api/assets/branding/...
```

**Verification:**
```
✅ URL starts with https://
✅ URL contains your Supabase project ref
✅ URL path includes /assets/branding/
✅ NOT a relative path starting with /api/
```

---

## Step 7: Test Image Loading ✅

- [ ] Copy the `logoUrl` from database

- [ ] Paste it into browser address bar

- [ ] Press Enter

**Expected Result:**
```
✅ Image loads and displays
✅ Loads from supabase.co domain
✅ Fast loading (< 1 second)
✅ No authentication required
```

**If image doesn't load:**
- [ ] Check bucket is Public (Storage → bucket → Settings)
- [ ] Verify URL is correct (no typos)
- [ ] Try removing cache (Ctrl+Shift+R)

---

## Step 8: Test Other Upload Types ✅

Test each upload type to ensure all work:

### App Icon
- [ ] Go to Branding → App Icon section
- [ ] Upload a square image (recommended 1024×1024)
- [ ] Verify success message
- [ ] Check preview appears

### UPI QR Code
- [ ] Go to Branding → UPI QR section  
- [ ] Upload QR code image
- [ ] Verify success message
- [ ] Check preview appears

### Welcome Background
- [ ] (If available in your version)
- [ ] Upload background image
- [ ] Verify success message

### Catalog Item Icon
- [ ] Go to Catalog page
- [ ] Edit any catalog item
- [ ] Upload custom icon
- [ ] Save item
- [ ] Verify icon appears

**Verification:**
```
✅ All upload types work
✅ All show success messages
✅ All previews display correctly
```

---

## Step 9: Verify in Supabase Dashboard ✅

- [ ] Go to Supabase Dashboard → Storage

- [ ] Click on `assets` bucket

- [ ] Navigate folders:
  - [ ] Open `branding/` folder
  - [ ] See your uploaded files (logo, app-icon, etc.)
  
- [ ] Check file sizes and upload dates

**Expected:**
```
✅ Files visible in bucket
✅ Organized in folders (branding/, catalog-icons/, etc.)
✅ Recent upload timestamps
✅ File sizes look reasonable
```

---

## Step 10: Performance Check ✅

- [ ] Open admin dashboard
- [ ] Load pages with images (Branding, Catalog)
- [ ] Notice loading speed

**Compare to before:**
- [ ] Images load faster (CDN caching)
- [ ] No delay when viewing logos/icons
- [ ] Smooth scrolling in catalog

**Optional: Browser DevTools**
- [ ] Open DevTools → Network tab
- [ ] Filter by "Img"
- [ ] Reload page
- [ ] Check image URLs source:
  - Should show `supabase.co` domain
  - Response times should be < 100ms (cached)

---

## Troubleshooting Section

### ❌ Upload fails with "Bucket not found"

**Fix:**
- [ ] Check `SUPABASE_STORAGE_BUCKET` in `.env` matches bucket name
- [ ] Bucket exists in Supabase Dashboard → Storage
- [ ] No typos in bucket name

---

### ❌ Upload fails with "Unauthorized" or "Invalid credentials"

**Fix:**
- [ ] Verify using `service_role` key (not anon key)
- [ ] Re-copy key from Settings → API
- [ ] Check key has no extra spaces
- [ ] Ensure key is in double quotes in `.env`

---

### ❌ Images don't load after upload

**Fix:**
- [ ] Go to Supabase Dashboard → Storage → assets bucket
- [ ] Click on a file
- [ ] Check if bucket is Public (should say "Public bucket")
- [ ] If Private, change to Public:
  - Storage → bucket → Settings → Privacy
  - Toggle to Public
  - Save changes

---

### ❌ Still getting local storage URLs

**Symptoms:**
- Database shows `/api/assets/...` instead of Supabase URL

**Fix:**
- [ ] Verify ALL three env vars are set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`  
  - `SUPABASE_STORAGE_BUCKET`
- [ ] Check for typos in variable names
- [ ] Ensure API server was restarted after .env changes
- [ ] Check API logs for startup errors

---

### ❌ API won't start after changes

**Fix:**
- [ ] Check `.env` syntax (no missing quotes)
- [ ] Verify no duplicate env var definitions
- [ ] Look for error message in console
- [ ] Temporarily revert to local storage to isolate issue

---

## Post-Setup Tasks

### Optional but Recommended

- [ ] **Backup existing local files** (if you have previous uploads):
  ```bash
  # Copy storage folder as backup
  xcopy /E /I storage storage-backup
  ```

- [ ] **Re-upload important assets**:
  - [ ] Brand logo
  - [ ] App icon
  - [ ] UPI QR code
  - [ ] Important catalog item icons

- [ ] **Update deployment configuration**:
  - [ ] Add Supabase env vars to production environment
  - [ ] Vercel: Settings → Environment Variables
  - [ ] Render: Environment tab
  - [ ] Other platforms: follow their docs

- [ ] **Test in production** (when ready):
  - [ ] Deploy to staging/production
  - [ ] Verify uploads work in production
  - [ ] Monitor Supabase Dashboard usage

---

## Success Criteria

You've successfully set up Supabase Storage when:

✅ **All uploads work:**
- Logo uploads
- App icon uploads  
- UPI QR uploads
- Catalog icon uploads

✅ **Database stores correct URLs:**
- All URLs are full Supabase URLs
- No relative `/api/assets/...` URLs from new uploads

✅ **Images load fast:**
- From Supabase CDN
- No delays or timeouts

✅ **Files persist:**
- Visible in Supabase Dashboard → Storage
- Survive API restarts
- Will survive deployments

✅ **No errors:**
- Clean API logs
- No storage-related errors in console

---

## Next Steps

After completing setup:

1. **Monitor usage** (first week):
   - Supabase Dashboard → Storage
   - Watch bandwidth usage
   - Check for any errors

2. **Clean up old local files** (optional):
   - Once confident everything works
   - Can delete `./storage` folder to save space

3. **Document for team**:
   - Share this checklist with team members
   - Ensure everyone knows the setup

4. **Plan for scale**:
   - Track storage growth
   - Upgrade plan if approaching free tier limits

---

## Resources

- **Full guide:** `docs/SUPABASE-STORAGE-SETUP.md`
- **Quick reference:** `docs/SUPABASE-QUICK-REFERENCE.md`  
- **Comparison:** `docs/STORAGE-COMPARISON.md`
- **Supabase docs:** https://supabase.com/docs/guides/storage

---

## Support

If you encounter issues not covered here:

1. Check API logs for specific error messages
2. Verify all checklist items are complete
3. Review troubleshooting section above
4. Consult Supabase documentation
5. Check Supabase status page for outages

---

**Completion Date:** _______________

**Notes:**
_______________________________________
_______________________________________
_______________________________________
