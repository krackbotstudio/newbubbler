# Incremental changes log (one-by-one)

Use this file to track setup and code changes as you do them. Update the **Status** and **Notes** columns after each step.

| # | Area | Task | Status | Notes |
|---|------|------|--------|-------|
| 1 | Git | Checkout `development` (or target branch), `git pull` | ⬜ Pending | |
| 2 | Git | Confirm remote: `origin` → `weyoudev/Weyouprod` (or your URL) | ⬜ Pending | |
| 3 | Supabase | Create / select new dev project; copy URL + anon key + DB connection string | ⬜ Pending | Do not commit secrets |
| 4 | API (`apps/api`) | Set `DATABASE_URL` (and `DATABASE_DIRECT_URL` if used) to new Supabase Postgres | ⬜ Pending | |
| 5 | API | Run Prisma migrate / db push against new DB | ⬜ Pending | |
| 6 | API | Set `JWT_SECRET` and any other required vars locally | ✅ Done | Set in `apps/api/.env` (random hex; restart API after changes) |
| 7 | API | Start API locally; verify e.g. `GET /api/health` | ⬜ Pending | |
| 8 | Customer PWA / Mobile | Set `EXPO_PUBLIC_API_URL` to local API (e.g. `http://localhost:3009`) | ⬜ Pending | No leading space in `.env` |
| 9 | Customer PWA / Mobile | Set `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` for new project | ⬜ Pending | |
| 10 | Root / monorepo | Trim duplicate or obsolete entries in root `.env` if any | ✅ Done | Removed stray JSON block; dev-only placeholders. See `docs/DEV_SUPABASE_ENV.md` |
| 11 | Docploy / deploy | For PWA Docker: pass `EXPO_PUBLIC_API_URL` as **build-arg**, rebuild no-cache | ⬜ Pending | Runtime-only env won’t change baked bundle |
| 12 | Security | Ensure `.env` files stay gitignored; use `.env.example` with placeholders only | ✅ Done | Root `.gitignore` expanded (keys, credentials, Sentry, Terraform state, Playwright, local DBs, Supabase CLI temp, `.direnv/`); `apps/customer-mobile/.gitignore` aligned (`.env`, `credentials.json`) |
| 13 | API / Supabase | Storage bucket `assets` + one-shot create script | ✅ Done | `SUPABASE_STORAGE_BUCKET` defaults to `assets` when URL + service role set; `npm run supabase:ensure-assets-bucket`; see `docs/DEV_SUPABASE_ENV.md` §6 |
| 14 | Customer PWA + Mobile | Book Now → **Home linen** as 6th service tile | ✅ Done | `HOME_LINEN` in `apps/customer-mobile/src/types.ts`; PWA reuses `customer-mobile/App` |
| 15 | Customer PWA + Mobile | Add/Edit address — Google Maps UX | ✅ Done | PWA: hide “Open Google Maps to search”; optional Maps URL field only; URL not required on save (web). Removed **Use Google Maps link** button (all platforms). `apps/customer-mobile/App.tsx` |
| 16 | Admin web + API | **Orders** list: search + filter cleanup | ✅ Done | Search (debounced) on order id, customer name, phone; removed Status / Service / Pincode UI; `GET /admin/orders?search=…`. See `IMPLEMENTED_CHANGES_REFERENCE.md` |
| 17 | Customer PWA + Mobile | Final invoice — remove **Download** | ✅ Done | Order detail → Invoices: no Download CTA on Final invoice; removed HTML/PDF helper code path. Re-export PWA to refresh `customer-pwa/dist`. `apps/customer-mobile/App.tsx` |
| 18 | API + Admin web | **AGENT** role (branch-scoped staff) | ✅ Done | `AGENT_ROLE` in guards/controllers; branch filter locked for OPS/AGENT; dashboard KPIs/analytics banner behaviour for branch-scoped roles. Enum `AGENT` in DB — run migrate / `db:ensure-role-agent` if needed |
| 19 | Customer PWA | **Favicon + manifest icons** from Admin Branding **app icon** | ✅ Done | Build: `update-icon-from-branding` + `postexport-pwa.js` into `dist/`. **Runtime (web):** `getPublicBranding()` now returns **`appIconUrl`** (`api.ts`); `App.tsx` updates `link[rel=icon]` / `apple-touch-icon` after branding loads. `EXPO_PUBLIC_API_URL` → **API** (not admin port). See reference MD |

**Legend:** ⬜ Pending · 🔄 In progress · ✅ Done · ⏭️ Skipped

---

## Completed entries (append below as you finish steps)

- **2026-04-03** — Switched repo env story to **development Supabase only** (no live DB URLs in `.env.example`). Cleaned root `.env`, `apps/api/.env`, customer `.env` files to empty `DATABASE_URL` / Supabase keys until you paste dev values. Added `docs/DEV_SUPABASE_ENV.md`. **Action for you:** paste dev `DATABASE_URL`, `EXPO_PUBLIC_SUPABASE_*` from your new Supabase project, then run Prisma migrate.

- **2026-04-03** — **Supabase Storage (`assets`):** API uses bucket name `assets` by default (`SUPABASE_STORAGE_BUCKET` optional). Added `scripts/ensure-supabase-assets-bucket.ts` and `npm run supabase:ensure-assets-bucket` to create the public bucket once. Wired in `apps/api/src/infra/infra.module.ts`; updated `apps/api/src/infra/storage/supabase-storage.adapter.ts` comment; `apps/api/.env.example` documents `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / bucket.

- **2026-04-03** — **`JWT_SECRET`:** Documented (API-only; `apps/api/.env`). Generated value added to local `apps/api/.env` (not committed).

- **2026-04-03** — **`.gitignore`:** Hardened ignore rules for secrets and tooling (see table row 12). Mobile app folder updated so `.env` and EAS `credentials.json` are ignored with `.env.example` exceptions.

- **Earlier (same sprint)** — **`npm run prisma:seed`:** `scripts/seed.ts` imports Prisma from `apps/api/src/infra/generated/prisma-client` (generated output; root scripts have no `@prisma/client` alias).

- **2026-04-03** — **Select services:** Added sixth tile **Home linen** (`HOME_LINEN`) on the Book Now flow for **customer mobile** and **customer PWA** (shared `apps/customer-mobile` UI). Placed after Steam Iron in the 2-column grid.

- **2026-04-03** — **Add / Edit address (Google Maps):** On **customer PWA** (`Platform.OS === 'web'`), removed the in-app **“Open Google Maps to search”** row so map search/popup is not the primary flow. Kept **Google Maps link (optional)** for manual paste; link is **not mandatory** on save for web; `googleMapUrl` stored when provided. Removed the **“Use Google Maps link”** button under the form (was confusing)—**URL field only**; native users still use **Open Google Maps to search** + modal **Add to Address** to auto-fill. Implemented in `apps/customer-mobile/App.tsx`.

- **2026-04-04** — **Customer Home (mobile + PWA):** Removed carousel pagination dots; merged carousel, welcome card, and active orders into one vertical `ScrollView` with `nestedScrollEnabled`; tightened spacing. PWA uses the same `apps/customer-mobile/App.tsx`.

- **2026-04-04** — **Admin Catalog:** Client-side search (name, id, segment/service labels) on `apps/admin-web/app/(protected)/catalog/page.tsx`; branch filter unchanged; download still uses branch-filtered list.

- **2026-04-04** — **Admin sidebar:** Grouped nav with dividers (Dashboard/Orders/Walk-in/Customers → Final invoices/Subscriptions → catalog block → admin/analytics/feedback); removed API/DB/user status and Invalidate cache; Logout directly under Feedback inside scroll; sidebar `fixed` + main `md:pl-56` / `md:pl-14` in `ProtectedLayout.tsx`. Files: `Sidebar.tsx`, `ProtectedLayout.tsx`.

- **2026-04-04** — **Admin order detail — invoices & header:** Service types shown as chips beside order title; removed “Service: …” from Ack/Final invoice cards and `InvoicePrintView`. **Pickup** banner under title: `DD Month YYYY` + 24h window (`formatPickupDayDisplay`, `formatTimeWindow24h` in `lib/format.ts`); walk-in shows “Walk order”; removed duplicate pickup lines from invoice blocks. **Order details** label **bold**. Right column: **branding `businessName`** bold above PAN/GST (Ack, Final, `InvoicePrintView`). **Cancelled** timeline: third step after Picked up with `cancelledAt` / `updatedAt`; pill `bg-destructive text-white`. **Cancelled orders:** `InvoiceBuilder` `disableEditing` — read-only lines, disabled Add items / tax / discount, **comments** non-editable (`disabled` + guard + muted styling). Files: `orders/[id]/page.tsx`, `InvoicePrintView.tsx`, `InvoiceBuilder.tsx`.

- **2026-04-04** — **Add items to invoice dialog:** Search field; quantity draft supports decimals, min **0.1**, default 1, text `inputMode="decimal"`. **InvoiceBuilder** matrix row qty min **0.1** with `step="any"`. Files: `AddItemsToInvoiceDialog.tsx`, `InvoiceBuilder.tsx`.

- **2026-04-04** — **Admin invoices — discount before tax (UI + copy):** **InvoiceBuilder** — discount controls on the left, tax on the right (`justify-between`). **Order detail** ACK/Final summary line: `Subtotal · Discount … · Tax (%) …`. **`showPrepaidWhenZero`** (ACK) uses discount then tax on discounted base (`taxable = max(0, s - d)`). **InvoicePrintView** totals row: Discount before Tax. Files: `InvoiceBuilder.tsx`, `orders/[id]/page.tsx`, `InvoicePrintView.tsx`.

- **2026-04-04** — **Acknowledgement invoice UX (order detail):** Removed **Acknowledgment Invoice** tab; tabs are **Final Invoice** (+ **Record Payment** when applicable). ACK **builder** only while ACK not issued (`!ackSubmitted`). **Status** card: **Acknowledgement invoice** opens modal when ACK is **ISSUED**; **Cancel order** only before ACK (same header area). New **`AcknowledgementInvoiceDialog`** — scrollable `InvoicePrintView`, sticky footer: **Print**, **Download PDF**, **Share on WhatsApp**. Files: `components/admin/orders/AcknowledgementInvoiceDialog.tsx`, `orders/[id]/page.tsx`.

- **2026-04-04** — **Invoice print layout (`InvoicePrintView`):** Header is **logo only**, centered; removed business/branch text beside logo (branch + business name remain in the order-details block). Dialog content: header + scrollable invoice + **sticky** action bar.

- **2026-04-04** — **Branding + line icons for print/dialog:** **`lib/invoice-display-branding.ts`** — `mergeInvoiceDisplayBranding()` merges invoice snapshot with live admin branding; **fills `logoUrl` from global branding** when branch snapshot has no logo; `logoUrlCacheBuster` from live `updatedAt` when needed. **InvoicePrintView** — optional **`logoUrlCacheBuster`** on logo `src`; **CatalogItemIcon** beside item name when `catalogItemId` resolves in matrix (matrix + simple table). **CustomerOrdersTable** invoice modal uses the same merge + cache buster. **AcknowledgementInvoiceDialog** passes **`BrandingSettings`** for branding prop.

- **2026-04-04** — **WhatsApp from ACK dialog:** **`getOrderStatusLabel()`** exported from `StatusBadge.tsx`. **`phoneDigitsForWhatsApp()`** in `lib/format.ts` (10-digit → `91…`). Prefilled message: greeting, thanks, order id, status, ACK code, amount payable, **PWA** `https://customerweyou.krackbot.com/` — **no invoice PDF URL** in text. **Share on WhatsApp** is **primary** button; Print / Download **outline**. **Mobile:** `navigator.share` with **JPEG** (html2canvas) or PDF fallback, then text. **Desktop:** skip OS share sheet; **download JPEG** (or PDF) + open **`wa.me/{customerDigits}?text=…`**. Dependency: **`html2canvas`** in `apps/admin-web/package.json`.

- **2026-04-04** — **Print preview fixes:** **Order page** (`orders/[id]/page.tsx`) — print CSS no longer depends on `body.print-final-invoice`; **both** `.ack-invoice-print-area` and `.final-invoice-print-area` (and descendants) get `visibility: visible` in print; **`main { overflow: visible !important }`**; Final **Print** = `window.print()` only. **Ack dialog + customer orders invoice modal** — injected print styles add **`body #…-print-root, body #…-print-root * { visibility: visible !important }`** so clones are not hidden by the page rule `body * { visibility: hidden }`. Files: `AcknowledgementInvoiceDialog.tsx`, `CustomerOrdersTable.tsx`, `orders/[id]/page.tsx`.

- **2026-04-04** — **Admin Orders (list):** Replaced Status / Pincode / Service filters with a single **Search** field (400ms debounce): partial match on **order id**, **customer name**, or **customer phone** (API also matches digit-only phone substring when the query mixes text and numbers). **Date range** and **Branch** filters unchanged. **API:** `AdminListOrdersQueryDto.search`, `AdminOrdersFilters.search`, `prisma-orders-repo.adminList` OR on `id` / `user.name` / `user.phone`. **Admin web:** `apps/admin-web/app/(protected)/orders/page.tsx`, `hooks/useOrders.ts`, `types/order.ts`. Other consumers (walk-in, dashboard, analytics, `CustomerOrdersTable`) still pass legacy filters where used.

- **2026-04-04** — **Customer Final invoice (mobile + PWA):** Removed the **Download** button under the Final invoice card on order detail. Removed `openInvoice('download')` for FINAL, `buildFinalInvoiceHtml`, `escapeHtml`, `imageToDataUri` / cache ref, and `expo-print` static import (subscription invoice preview still uses dynamic `expo-print` for Print). **PWA:** rebuild/export `apps/customer-pwa` so `dist` matches.

- **2026-04-04** — **Admin AGENT role:** Backend uses `apps/api/src/api/common/agent-role.ts` (`AGENT_ROLE`) so Nest metadata keeps the enum reference; `@Roles` updated across admin/customer-facing staff endpoints. `effectiveBranchIdForAdminQuery` / `isBranchScopedStaffRole` treat **OPS** and **AGENT** as branch-scoped. **Admin web:** `isBranchScopedStaff`, locked branch select on orders/walk-in/feedback/etc.; **dashboard** skips `useDashboardKpis` (and related empty-state noise) for branch-scoped staff and hides extra KPIs as designed. **Postgres:** ensure enum value `AGENT` exists (`db:ensure-role-agent` / migration) before assigning the role.

- **2026-04-04** — **Customer PWA favicon / install icons:** Tab favicon and PWA manifest icons use the **Admin Branding app icon** (`appIconUrl` from `GET /api/branding/public`, else `logoUrl`). **`apps/customer-pwa/package.json`:** `build` runs `../customer-mobile/scripts/update-icon-from-branding.js` before `expo export`, then `scripts/postexport-pwa.js`. **Post-export** re-fetches the same image into `dist/icon-192.png`, `dist/icon-512.png`, `dist/favicon.png`, sets `<link rel="icon" type="image/png" href="/favicon.png">`, **`apple-touch-icon`** → `/icon-192.png`, and updates `manifest.json`. **`npm run sync-icons`** in `customer-pwa` refreshes `customer-mobile/assets` for `expo start --web` without a full build. Env: `EXPO_PUBLIC_API_URL` in `customer-mobile` / `customer-pwa` / root `.env` or process env (Docker build-arg). **`apps/customer-pwa/.env.example`** documents build-time use.

- **2026-04-04** — **PWA tab icon not updating (fix):** `getPublicBranding()` in **`apps/customer-mobile/src/api.ts`** was dropping **`appIconUrl`** from the JSON response (only `logoUrl` was mapped), so the client never applied the Admin **App icon**. **Fix:** `PublicBrandingResponse` includes **`appIconUrl`**; response mapping passes it through. **`App.tsx`** (`Platform.OS === 'web'`): `useEffect` sets **`document`** favicon links to **`brandingLogoFullUrl(appIconUrl || logoUrl)`**, updating all **`link[rel="icon"]`** and **`shortcut icon`** (avoids stale bundled `favicon.ico`) plus **`apple-touch-icon`**. Ensures **`expo start --web`** shows the branding app icon after public branding loads; **`EXPO_PUBLIC_API_URL`** must target the **API** host.

---

## Ideas / follow-ups (optional)

- [ ] Align production API URL in Docploy with deployed backend version
- [ ] Document exact `npm` scripts for `apps/api`, `apps/admin-web`, `apps/customer-pwa`

---

*Last updated: 2026-04-04 — PWA favicon: build pipeline (row 19) + `appIconUrl` client + web `document` favicon effect; see latest “2026-04-04” bullets.*
