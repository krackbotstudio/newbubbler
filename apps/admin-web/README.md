# Laundry Admin Web

Enterprise admin UI for the Laundry platform (Next.js 14 App Router).

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- ShadCN-style UI (CVA + Tailwind)
- TanStack Query
- Axios (JWT interceptor)
- Zod

## Setup

From repo root:

```bash
npm install
cp apps/admin-web/.env.local.example apps/admin-web/.env.local
# Edit .env.local: set NEXT_PUBLIC_API_URL=http://localhost:3003/api (see .env.local.example for Vercel)
```

## Run

Backend must be running on port 3000.

```bash
# From repo root
npm run dev:admin
```

App runs at [http://localhost:3001](http://localhost:3001).

## Login

Use seeded admin credentials (see `docs/run-local.md`):

- Email: `admin@laundry.local`
- Password: `dev-hash`

Or billing: `billing@laundry.local` / `dev-hash`.

## Structure

- `app/` – Routes (login, (protected)/dashboard, orders, catalog, etc.)
- `components/` – layout, ui, shared, forms
- `lib/` – api (axios), auth, query-client, format, utils
- `hooks/` – useOrders, useOrderSummary, useInvoice, usePayments, useAnalytics, useFeedback
- `types/` – order, invoice, payment, feedback
