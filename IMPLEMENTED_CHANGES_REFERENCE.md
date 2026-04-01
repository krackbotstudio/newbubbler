# Implemented Changes Reference

Date: 2026-03-30  
Project: Weyouprod monorepo

## Customer app (PWA + Mobile)

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

