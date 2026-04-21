# Bubbler Customer PWA

Web-only Expo app that **ships the same UI and logic as `apps/customer-mobile`**.

## Source of truth

- **Entry:** `index.js` → `registerRootComponent` wraps **`../customer-mobile/App`** with a small **error boundary** and **web #root layout** (avoids a blank viewport in dev).
- **All customer features** (branch picker, primary/secondary theme, branch-scoped carousel & price list, orders filter, etc.) live in **`apps/customer-mobile`**. Implement product changes there only; this package adds **PWA/web shell** (Metro, optional vector-icons dep for resolution, post-export manifest/SW).

## Blank or white page in the browser

1. **Use the same `.env` as `customer-mobile`** — at minimum `EXPO_PUBLIC_API_URL` (and Supabase keys if your backend expects them). Restart dev after editing `.env`.
2. Open **devtools → Console** for red errors. If the bundle throws (e.g. missing module), the in-app error boundary shows a short message.
3. Confirm the URL printed by `npm run dev` (port may be **8096+** if **8095** is busy). Hard-refresh (**Ctrl+Shift+R**) after a failed load.
4. Ensure **`npm install`** has been run so `@expo/vector-icons` is present (declared in this package for Metro when resolving `MaterialIcons` from `customer-mobile`).

## Commands

| Command | Purpose |
|--------|---------|
| `npm run dev` | Expo web via `scripts/expo-dev-web.cjs`: picks the first free port from **8095** upward (override with `EXPO_CUSTOMER_PWA_PORT`) so it never blocks on “port in use” prompts when **8081** is taken by `customer-mobile` or another Metro. Open the **http://localhost:…** URL printed in the terminal. |
| `npm run build` | Icon script + `expo export --web` + `scripts/postexport-pwa.js` |
| `npm run sync-icons` | Runs `../customer-mobile/scripts/update-icon-from-branding.js` |

## Environment

Use the same variables as **`customer-mobile`** (see `../customer-mobile/.env` or `.env.example`), especially:

- `EXPO_PUBLIC_API_URL` — required at **runtime** and during **`npm run build`** (branding fetch for icons / manifest).

Copy `apps/customer-pwa/.env.example` → `.env` and set `EXPO_PUBLIC_API_URL` for local PWA builds.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md). Docker build copies **both** `customer-pwa` and `customer-mobile` into the image.
