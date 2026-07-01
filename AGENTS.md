# POS Grocery Agent Rules

This project is the POS Grocery application. It is a code project under the
SecondBrain workspace for building a grocery point-of-sale system and should use
the workspace knowledge vault for context when needed.

## Paths

- Project root: `D:\ProjectAP\SecondBrain\projects\pos-grocery`
- Frontend: `D:\ProjectAP\SecondBrain\projects\pos-grocery\front-end`
- Backend: `D:\ProjectAP\SecondBrain\projects\pos-grocery\back-end`
- Knowledge vault: `D:\ProjectAP\SecondBrain\knowledge`

## File Map

Project-level files:

- `AGENTS.md` - rules for agents working in this project.
- `PRD.md` - product requirements and MVP scope.
- `README.md` - project overview and developer commands once scaffolded.
- `.gitignore` - ignored local secrets, dependencies, build outputs, and caches.
- `.env.example` - shared example variables for CI/deployment. This file may be
  committed.
- `package.json` - root workspace scripts once scaffolded.
- `pnpm-workspace.yaml` - frontend/backend workspace package list once
  scaffolded.

Planning and documentation:

- `docs/services-and-infrastructure.md` - service map for hosting, database,
  image storage, CI/CD, and required environment variables.
- `docs/superpowers/plans/` - implementation plans that should be followed
  task-by-task.

Frontend files:

- `front-end/` - React + TypeScript application.
- `front-end/.env.example` - frontend example environment variables. This file
  may be committed.
- `front-end/.env.local` - local frontend secrets/config. Do not commit.
- `front-end/src/` - frontend application source once scaffolded.
- `front-end/src/components/` - reusable UI components once scaffolded.
- `front-end/src/features/` - feature-focused frontend modules once scaffolded.
- `front-end/src/lib/` - frontend API clients and shared helpers once
  scaffolded.

Backend files:

- `back-end/` - Node.js + Express backend application.
- `back-end/.env.example` - backend example environment variables. This file may
  be committed.
- `back-end/.env` - local backend secrets/config. Do not commit.
- `back-end/.dev.vars.example` - Cloudflare local vars example. This file may be
  committed.
- `back-end/.dev.vars` - Cloudflare local vars/secrets. Do not commit.
- `back-end/src/` - backend TypeScript source once scaffolded.
- `back-end/src/modules/` - MVC-style feature modules once scaffolded.
- `back-end/src/shared/` - shared backend middleware, errors, types, and helpers
  once scaffolded.
- `back-end/prisma/schema.prisma` - Prisma ORM schema once scaffolded.
- `back-end/prisma/migrations/` - Prisma migrations once created.
- `back-end/wrangler.toml` - Cloudflare deployment configuration once
  scaffolded.

Image storage:

- Product image files are stored in Cloudinary Free.
- Turso/libSQL stores only image URL and metadata such as provider, public ID,
  secure URL, thumbnail URL, width, height, format, and byte size.
- Do not store real product image binaries in Turso/libSQL.

## Stack

- Frontend: React + TypeScript
- Backend: Node.js + Express using MVC-style modules
- Database: Turso/libSQL
- ORM: Prisma ORM v6
- Product image storage: Cloudinary Free
- Frontend hosting: Vercel Hobby
- Backend hosting: Cloudflare Workers Free
- CI: GitHub Actions
- Production deploy: manual GitHub Actions workflow only while the project is
  in local-first development

## Routing

- Frontend/UI work goes in `front-end/`.
- Backend/API/database work goes in `back-end/`.
- Prisma schema, migrations, and database access code belong under `back-end/`.
- Knowledge/wiki/source work goes in `D:\ProjectAP\SecondBrain\knowledge`, not
  inside this project.
- If the requested target is unclear, ask before editing.

## Knowledge Access

Before implementing features that depend on existing notes, business rules,
project decisions, source material, ingest behavior, or LLM Wiki conventions,
read:

1. `D:\ProjectAP\SecondBrain\knowledge\AGENTS.md`
2. `D:\ProjectAP\SecondBrain\knowledge\index.md`
3. Relevant files under `D:\ProjectAP\SecondBrain\knowledge\wiki/`
4. Relevant workflows under `D:\ProjectAP\SecondBrain\knowledge\operations/`

For grocery POS business logic, first look for related project notes, domain
rules, product/catalog notes, inventory rules, sales workflows, payment rules,
and reporting decisions in the knowledge vault. If no relevant notes exist, say
that clearly before making business-rule assumptions.

If the vault path is not accessible, stop and tell the user.

## Package Manager

Use the package manager already present in the relevant folder:

- `pnpm-lock.yaml` -> use `pnpm`
- `package-lock.json` -> use `npm`
- `yarn.lock` -> use `yarn`

If no package manager files exist, do not guess silently. Ask the user or follow
an explicit stack choice from the user.

## Frontend Rules

- Use React + TypeScript for frontend application code.
- Scaffold frontend code in `front-end/` when no app has been created yet.
- Keep reusable UI components focused and small.
- Keep API calls and data-access helpers separate from presentation components.
- Do not hardcode backend URLs when an environment variable is available.
- Load only the data needed for the currently visible screen state. Do not fetch
  hidden modal/detail payloads, full receipt items, full report detail, or the
  next page of data before the user asks for it unless the workflow has a clear
  performance reason.
- Visible page data should be usable within 1 second on the local development
  stack. Load the critical screen data first, then lazy-load secondary panels
  such as history lists, receipt detail, logos, modal content, and report drill
  downs after the main UI is interactive.
- Avoid duplicate GET requests from React effects. Shared API helpers should
  dedupe identical in-flight GET requests, and page components should avoid
  fetching the same endpoint separately when one lightweight response can serve
  the visible UI.
- List screens must use lightweight list endpoints. Receipt/history/report
  tables should show summary fields first, then fetch full detail only when the
  user opens a detail modal or print view.
- When a screen has pagination, request only the current page from the backend
  with `page`/`pageSize` or a cursor. Do not fetch all rows and slice/filter in
  React.
- Keep frontend state shaped to the UI. Avoid storing large nested API payloads
  when the page only renders counts, totals, names, status, or identifiers.
- POS screens should prioritize fast repeated operation, clear totals, readable
  product search, cart editing, checkout state, and error recovery.
- Frontend UI must support all practical POS device classes: desktop/laptop,
  iPad/tablet, and mobile phone. Every UI feature must be usable in both
  portrait and landscape orientation, including touch interaction, scanning
  workflows, modals, tables, sidebars, dashboards, reports, receipts, and
  checkout screens.
- For every frontend UI/layout change, verify responsiveness across desktop,
  tablet/iPad, and mobile breakpoints in both portrait and landscape. Capture
  screenshots for the checked sizes and inspect them carefully for overflow,
  clipped text, overlapping controls, unusable buttons, hidden table columns,
  broken modals, unreadable receipt layouts, and incorrect scroll behavior.
- Do not mark UI work complete until screenshots have been reviewed in detail.
  If a screenshot cannot be captured because a local browser tool is blocked,
  use the project UI audit script or an available Chrome/Playwright fallback and
  explain the verification limitation in the final response.
- The responsive audit target device list is maintained in
  `front-end/scripts/ui-audit.mjs` and includes iPhone SE, iPhone XR, iPhone 12
  Pro, iPhone 14 Pro Max, Pixel 7, Samsung Galaxy S8+, Samsung Galaxy S20
  Ultra, iPad Mini, iPad Air, iPad Pro, Surface Pro 7, and desktop, each in
  portrait and landscape orientation.

## Backend Rules

- Use Node.js for backend application code.
- Use Express and keep modules MVC-style.
- Use Turso/libSQL as the database.
- Use Prisma ORM v6 for database schema, migrations, and typed data access.
- Keep database credentials in environment variables, never in committed files.
- Keep Cloudinary credentials in environment variables, never in committed
  files.
- Do not commit generated databases, local dumps, or secret `.env` files.
- Backend responses must include only the fields the frontend needs for the
  current screen or workflow. Do not send extra data "just in case"; add fields
  only when a frontend feature explicitly uses them.
- Treat API payload size as part of backend correctness. Large optional fields
  such as images, logos, receipt content, and nested detail records must be
  omitted from list/current endpoints unless the request explicitly asks for
  them.
- Repository and Prisma queries must use explicit `select` projections for list
  endpoints. Avoid broad `include` trees on pages that only need summary rows.
- List endpoints must support server-side pagination or explicit limits and
  apply those limits in the database query (`take`/`skip`, cursor, or equivalent)
  before returning results.
- Detail endpoints should be separate from list endpoints. For example, receipt
  lists return receipt number, time, status, totals, and counts; receipt items,
  payment detail, printable receipt content, and full product data are loaded by
  a detail endpoint only when requested.
- Report endpoints should aggregate in the backend/database and return the
  already summarized rows required by the report UI. Do not send raw sales with
  nested items to the frontend for client-side aggregation unless the UI is
  explicitly a detail view.
- Before adding data to any API response, confirm which component renders it.
  If no current UI reads the field, do not send it.
- For performance work, measure endpoint timings and payload sizes before and
  after changes. Inspect whether slowness comes from duplicate frontend calls,
  over-fetching, missing database indexes, sequential database round trips, or
  remote database latency.
- For hot POS write paths such as checkout, cancel receipt, receiving, and stock
  adjustment, avoid many sequential ORM calls. Measure the route first, then use
  a single transaction with batched database statements when it reduces Turso
  round trips and keeps the response under the visible UI target.
- API endpoints used by visible pages should target sub-1-second responses on
  the local development stack. If a route is slower, identify whether the cause
  is remote database latency, concurrent query queueing, over-fetching, missing
  projections, missing limits, or frontend duplicate calls before changing UI.
- Authentication tokens are session tokens for this local POS app and should
  remain valid until logout. Do not introduce short automatic expiry unless the
  user explicitly requests expiring sessions.
- Keep sales, inventory, product catalog, customer, payment, and reporting logic
  explicit and covered by tests when behavior is non-trivial.

## Boundaries

- Do not place app source code inside `D:\ProjectAP\SecondBrain\knowledge`.
- Do not duplicate knowledge vault markdown inside this project.
- Do not commit `.env`, `.env.local`, `.dev.vars`, `node_modules`, build
  outputs, coverage output, local database files, or generated caches.
- Keep frontend and backend concerns separated unless the user explicitly asks
  for shared packages or monorepo tooling.

## Verification

After code changes, run the available checks for the touched side:

- Frontend: lint, test, typecheck, and build when configured.
- Frontend UI/layout changes: also run `npm --prefix front-end run ui:audit`
  when Chrome or Edge is available locally. This audit checks route access,
  important screenshots, responsive device/orientation coverage, and horizontal
  overflow.
- UI screenshot verification must include at least one desktop viewport, one
  iPad/tablet portrait viewport, one iPad/tablet landscape viewport, one mobile
  portrait viewport, and one mobile landscape viewport. Use the broader
  `front-end/scripts/ui-audit.mjs` device matrix whenever the change can affect
  shared layout, navigation, tables, modals, charts, receipts, or POS checkout.
- Rendered localhost QA: if the Browser runtime refuses `localhost:5173` due to
  tool policy, do not treat that as an app failure. Use Chrome runtime through
  the Codex Chrome extension, or the project `ui:audit` script, to verify
  `http://localhost:5173` routes instead. Record the Browser-runtime policy
  rejection and the Chrome/Playwright fallback in the final QA notes.
- Backend: lint, test, typecheck, Prisma validation/generation, and start/build
  checks when configured.

If checks are not configured yet, say that clearly in the final response.
