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
- CI/CD: GitHub Actions

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
- POS screens should prioritize fast repeated operation, clear totals, readable
  product search, cart editing, checkout state, and error recovery.

## Backend Rules

- Use Node.js for backend application code.
- Use Express and keep modules MVC-style.
- Use Turso/libSQL as the database.
- Use Prisma ORM v6 for database schema, migrations, and typed data access.
- Keep database credentials in environment variables, never in committed files.
- Keep Cloudinary credentials in environment variables, never in committed
  files.
- Do not commit generated databases, local dumps, or secret `.env` files.
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
- Backend: lint, test, typecheck, Prisma validation/generation, and start/build
  checks when configured.

If checks are not configured yet, say that clearly in the final response.
