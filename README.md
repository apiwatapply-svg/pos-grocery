# POS Grocery

POS Grocery is a grocery and mini-mart point-of-sale system for store setup,
product and inventory management, barcode checkout, receipts, sales reporting,
dashboard analytics, and styled Excel exports.

## Stack

- Frontend: React + TypeScript on Vercel
- Backend: Node.js + Express using MVC-style modules on Cloudflare
- Database: Turso/libSQL
- ORM: Prisma ORM v6
- Product images: Cloudinary Free
- Tests: Vitest
- CI: GitHub Actions
- Production deploy: manual only while the project is in local-first development

## Project Structure

- `front-end/` - React POS client
- `back-end/` - Express API and Prisma schema
- `docs/` - planning and implementation notes

## Development

Install dependencies:

```powershell
npm --prefix front-end install
npm --prefix back-end install
```

Run all checks:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Run locally:

```powershell
npm run dev:back-end
npm run dev:front-end
```

Local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:8787/api/health`

## Deployment

Production deployment is intentionally manual for now. Pushes to `main` run CI
only; they do not deploy to Vercel or Cloudflare until the Deploy workflow is
started manually from GitHub Actions.

Frontend deployment target: Vercel Hobby.

Backend deployment target: Cloudflare Workers Free.

Required production environment variables:

- `VITE_API_BASE_URL` for the frontend API URL
- `DATABASE_URL` and `TURSO_AUTH_TOKEN` for Turso/libSQL access
- `PRISMA_DATABASE_URL` for Prisma schema validation and local SQLite migration
  workflows
- `JWT_SECRET` for backend auth
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
  for product image uploads
- `NODE_ENV=production` for backend runtime behavior

GitHub Actions deploy secrets:

- `VITE_API_BASE_URL`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Backend runtime secrets still need to be configured in Cloudflare using Worker
secrets before a production deploy can serve authenticated API requests.
