# Deploy Status

Updated: 2026-06-28

## Current Result

- GitHub repository: `https://github.com/apiwatapply-svg/pos-grocery.git`
- Branch pushed: `main`
- Latest local commit pushed:
  - `58735eb feat: build POS Grocery MVP`
  - `38c4c76 ci: fix deploy workflow paths`
- CI status: passed on GitHub Actions.
- Deploy status: failed because required GitHub Secrets are not configured yet.

## Missing GitHub Secrets

Setup guide: `docs/github-secrets-setup.md`

Frontend deploy to Vercel needs:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_API_BASE_URL`

Backend deploy to Cloudflare Workers needs:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Backend runtime also needs Cloudflare Worker secrets/vars:

- `JWT_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`

## Important Backend Blocker

The current backend is an Express API with `src/server.ts` using `app.listen()`.
That is correct for local Node.js development, but Cloudflare Workers production
needs a Worker-compatible `fetch(request, env, ctx)` entry point.

Before declaring backend production deploy complete, convert the backend runtime
to one of these:

- Hono/itty-router style Worker-native routing, or
- a verified Express-to-Workers adapter, or
- deploy the Express API to a Node-compatible host instead of Workers.

Do not mark backend production as complete until `/api/health` and the main POS
API routes are reachable from the deployed Worker URL.
