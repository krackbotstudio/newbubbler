# Implemented Changes Reference

Date: 2026-03-30 (updated 2026-04-04)  
Project: Weyouprod monorepo

## Customer app (PWA + Mobile)

- **Customer PWA — favicon & manifest icons (Admin Branding app icon):** The browser tab icon and PWA manifest icons use **branding `appIconUrl`**, falling back to **`logoUrl`**, via `GET /api/branding/public` (same priority as `apps/customer-mobile/scripts/update-icon-from-branding.js` for native launcher icons).
  - **`apps/customer-mobile/src/api.ts`:** `PublicBrandingResponse` and **`getPublicBranding()`** must include **`appIconUrl`** in the parsed return value (the API already returns it; the client previously omitted it, so the app icon never reached the UI layer).
  - **`apps/customer-mobile/App.tsx` (web only):** After **`welcomeBranding`** loads, a **`useEffect`** sets **`document`** **`link[rel="icon"]`**, **`link[rel="shortcut icon"]`**, and **`apple-touch-icon`** to **`brandingLogoFullUrl(appIconUrl || logoUrl)`**, so **`expo start --web`** shows the Admin **App icon** without relying only on a static exported favicon. **`EXPO_PUBLIC_API_URL`** must point at the **API** (e.g. port for Nest), not only the admin web app.
  - **`apps/customer-pwa/package.json`:** `npm run build` runs `update-icon-from-branding.js` (updates `customer-mobile/assets` icon/favicon used by Expo) → `expo export --platform web` → `node scripts/postexport-pwa.js`.
  - **`apps/customer-pwa/scripts/postexport-pwa.js`:** Downloads the image again into **`dist/icon-192.png`**, **`dist/icon-512.png`**, **`dist/favicon.png`**; rewrites **`index.html`** to `<link rel="icon" type="image/png" href="/favicon.png" />` and adds **`apple-touch-icon`**; updates **`manifest.json`** to reference the PNG favicon when present. If the API is unreachable, falls back to copied **`customer-mobile/assets`** files.
  - **`npm run sync-icons`** (in `customer-pwa`): runs only the branding download into `customer-mobile/assets` — useful before **`expo start --web`** so static assets match branding.
  - **Configuration:** `EXPO_PUBLIC_API_URL` must point at a running API during build and at dev runtime (or set in Docker **build-arg** / CI env). Documented in **`apps/customer-pwa/.env.example`**.

- **Order detail — Final invoice:** Removed the **Download** action from the **Final** invoice card (under line items / total). Customers still see the full on-screen invoice; subscription plan **invoice preview** still offers Download / Print / Share where applicable. Implementation: `apps/customer-mobile/App.tsx` (removed `openInvoice` download path for FINAL, `buildFinalInvoiceHtml`, `escapeHtml`, `imageToDataUri` + cache, static `expo-print` import). **Customer PWA** uses the same bundle — **rebuild/export** `apps/customer-pwa` after pulling so `dist/` is current.

- **Auth / layout (earlier):** Login and full-bleed purple background on mobile/PWA (safe areas, `100dvh`, viewport-fit) — see `App.tsx`, `customer-pwa` post-export script / `dist` assets when redeployed.

- **Book Now — Select services:** Added **Home linen** as the sixth service tile (`HOME_LINEN`), after Steam Iron, in `apps/customer-mobile/src/types.ts` (`SERVICE_TYPES` + `ServiceTypeId`). Applies to **native** and **customer PWA** (PWA imports `../customer-mobile/App`).

- **Add / Edit address — Google Maps (`App.tsx`):**
  - **PWA (web):** Hides **“Search location on Google Maps”** / **“Open Google Maps to search”** (`hideGoogleMapsSearchRow`). Optional **Google Maps link** text field remains for paste; **not required** on save (`Platform.OS === 'web'`). Empty `googleMapUrl` sent as `null`.
  - **All platforms:** Removed the **“Use Google Maps link”** button under the form; only the optional URL input remains (less confusing). Native still has the top **Open Google Maps to search** flow and map modal **Add to Address** for auto-fill.

- Updated customer order confirmation/details UI to highlight key info for readability:
  - Date format like `01 APRIL 2026`
  - Time format like `11:00 AM`
  - Magenta-highlighted date/time rows
  - Cleaner address and services presentation
- Applied the same `Order Detail` summary style in shared customer app flow.
- Added walk-in handling in order detail:
  - Address title shows `Walk in Address`
  - Address content shows `Walk in`
  - Time shows `Walk in`

## Admin Branding / Branch settings

- Fixed optional branch/branding fields so cleared values are saved as empty (null), not silently restored:
  - PAN
  - GST
  - UPI ID
  - UPI payee name
  - UPI link
  - footer note
  - optional email
- Root cause fixed by sending explicit `null` instead of `undefined` on update payloads.
- **App icon (`appIconUrl`):** Used for native launcher icons (via `update-icon-from-branding`), for **customer PWA** static **`dist/`** icons at build time, and (via **`getPublicBranding()`** + web **`document`** links in **`App.tsx`**) for the **live browser tab** icon in dev and production when the customer app can call the API.

## Admin Catalog

- Fixed duplicate segment/service options in Edit Item modal after creating new segment/service:
  - Added unique merge logic for option lists
  - Avoided duplicate local insert by id
- Improved `Add price line` CTA in Edit Item modal:
  - Moved below pricing table
  - Full-width primary button
  - Cancel/Save remain on next row (footer)
- Top catalog actions updated:
  - Removed `Download sample`
  - Removed `Upload CSV`
  - Added `Download catalog` Excel export (`.xlsx`) with columns:
    - Item name
    - Segment
    - Service
    - Cost
    - Active / Inactive
- Added `xlsx` dependency in `apps/admin-web` for Excel generation.
- Catalog branch dropdown changed to Orders-style single-select:
  - `All branches` + one branch choice
  - Native select control matching Orders UI

## Admin Users

- Protected super user `weyou@admin.com`:
  - Cannot be edited
  - Cannot be deleted
  - Password cannot be reset
  - UI hides Edit/Delete/Reset actions for this user
- Protection enforced in backend service too (not only UI).
- Split user password actions for other users:
  - `Show password` (toggle show/hide + copy when visible)
  - `Reset password` (rare action to generate new credential)

## Service Areas

- Added bulk pincode creation support in Add Pincode modal:
  - Accepts comma-separated pincodes in one input
  - Validates 6-digit format per pincode
  - Deduplicates input values
  - Creates all valid entries in one submit
  - Shows partial success and failure summary

## Admin Orders (list page)

- **Search:** Single field (debounced ~400ms) filters by **order id**, **customer name**, or **customer phone** (partial, case-insensitive on text fields; phone also tries a **digits-only** substring when the query is mixed, e.g. `+91 …`).
- **Removed filters** from the main Orders UI: **Status**, **Pincode**, **Service** (API still accepts those query params for other callers).
- **Unchanged:** date range (initiated / pickup / delivered window), branch selector (locked for branch-scoped staff).
- **Order ID column:** Shared `AdminOrderListOrderIdCell` on main Orders and walk-in lists for consistent truncation/wrapping.
- **Files:** `apps/admin-web/app/(protected)/orders/page.tsx`, `apps/admin-web/hooks/useOrders.ts`, `apps/admin-web/types/order.ts`, `components/shared/AdminOrderListOrderIdCell.tsx`.
- **API:** `GET /admin/orders?search=…` — `AdminListOrdersQueryDto.search` (max 120 chars), `AdminOrdersFilters.search`, implemented in `apps/api/src/infra/prisma/repos/prisma-orders-repo.ts` (`adminList` adds an `AND` + `OR` on order `id`, related `user.name`, `user.phone`). Controller: `admin-orders.controller.ts`. Port: `application/ports/orders-repo.port.ts`. In-memory fake filters by id substring for tests.

## Admin — AGENT role (branch-scoped staff)

- **`AGENT`** admin user type (e.g. branch head): shared literal `AGENT_ROLE` in `apps/api/src/api/common/agent-role.ts` so decorator metadata matches the Prisma/TS `Role` enum (avoids stale `undefined` role bugs).
- **Branch scope:** `effectiveBranchIdForAdminQuery` / `isBranchScopedStaffRole` — **OPS** and **AGENT** with an assigned `branchId` are limited to that branch on list endpoints.
- **Controllers** using `@Roles(..., AGENT_ROLE)` include admin orders, walk-in, invoices, payments, feedback, analytics reads, catalog read, etc. (see codebase for full set).
- **Admin web:** `isBranchScopedStaff` / `isBranchFilterLocked` in `lib/auth.ts`; locked branch UI on relevant pages; **dashboard** avoids `useDashboardKpis` when branch-scoped and adjusts KPI visibility.
- **Database:** Postgres enum `Role` must include `AGENT` — use migration or `npm run db:ensure-role-agent` / `scripts/ensure-role-agent-enum.ts` (direct DB URL often required for `ALTER TYPE`).

## Admin Orders (detail page + invoice)

- Removed upper info cards to reduce scroll:
  - Removed `Customer & address` card
  - Removed `Subscription` card
- Removed header line:
  - `Scheduled pickup ... Service ...`
- Invoice header adjustments (ACK + Final):
  - Removed brand name text
  - Removed branch name text
  - Centered logo at top
- Invoice branch info:
  - Added branch phone under branch address in invoice right block
- Invoice comments default:
  - Default changed to `Thank you`
  - Removed auto-appending of `Bill may change at delivery`
  - Placeholder updated to `Thank you`
- Invoice footer source changed:
  - Removed branch address + branding phone/email footer line
  - Footer now uses only branch `footerNote` from Branch settings

## Order status simplification (Admin)

- Simplified order flow UI in order detail timeline and bottom action bar:
  - Keep only:
    - Order initiated
    - Picked up
    - Out for delivery
    - Delivered
  - Removed:
    - In progress
    - Ready
- Updated related gating logic accordingly.

## Dashboard

- Updated status chips and logic to match simplified status flow:
  - Removed `In progress`, `Ready`
  - Added/kept:
    - Confirmed Orders
    - Picked up
    - Out for delivery
    - Delivered
- Updated date grouping logic for status buckets.
- Updated Dashboard branch dropdown UI to match Orders-style native single-select.

## Analytics

- Added new analytics section: `Completed catalog quantities`
  - Uses selected date range and branch filter
  - Includes only completed orders (delivered flow)
  - Displays:
    - Item
    - Segment
    - Service
    - Quantity
- Added backend endpoint:
  - `GET /admin/analytics/completed-catalog-items`
- Improved segment/service resolution:
  - Resolves labels from category ids when labels are missing
  - Prevents collapsing too many rows under `-`
  - Produces unique item + segment + service lines more accurately

## Login page (Admin web)

- Cleaned login screen by removing the bottom helper/info note block below the Sign in button.

## Notes

- All implemented changes were lint-checked on touched files during implementation.
- This file is intended as a practical future reference for what was changed in this cycle.
- **Changelog-style steps** (setup checklist + dated bullets): see `INCREMENTAL_CHANGES_LOG.md`.

