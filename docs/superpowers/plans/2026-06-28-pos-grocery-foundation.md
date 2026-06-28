# POS Grocery Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the project foundation for POS Grocery: aligned project rules, repository files, React frontend scaffold, Node/Express MVC backend scaffold, Prisma v6 with Turso/libSQL direction, baseline tests, and CI/CD.

**Architecture:** The project is split into `front-end/` and `back-end/` under `D:\ProjectAP\SecondBrain\projects\pos-grocery`. The frontend is a React + TypeScript Vite app deployed by Vercel. The backend is a Node.js + Express TypeScript app organized by MVC-style feature modules and prepared for Cloudflare deployment.

**Tech Stack:** React, TypeScript, Vite, Node.js, Express, Prisma ORM v6, Turso/libSQL, Vitest, ESLint, GitHub Actions, Vercel, Cloudflare.

---

## Cost Constraint

MVP services must be usable on free tiers without requiring a credit card. Product images should use Cloudinary Free for real image storage, while Turso/libSQL stores image URLs and metadata only. Avoid Cloudflare R2, Vercel Blob, or another object storage service that may require billing setup during MVP.

## Scope Check

`PRD.md` describes a full POS platform with multiple independent subsystems. This plan intentionally covers the foundation only, because Auth/Store, Product/Inventory, Sales/Receipt, and Reports/Dashboard/Excel export each deserve a focused plan with their own testable acceptance criteria.

Follow-up implementation plans should be created in this order:

1. `auth-store` - login, users, roles, store settings, protected routes.
2. `product-inventory` - products, categories, images, stock receiving, stock movements, inventory export.
3. `sales-receipt` - barcode checkout, sale transaction, stock deduction, receipt view, browser print.
4. `reports-dashboard-export` - sales reports, dashboard metrics/charts, styled Excel export.
5. `production-hardening` - responsive QA, access control review, deployment verification, regression tests.

## Current Project State

Existing files:

- `AGENTS.md` - project rules currently mention MSSQL, which conflicts with the approved PRD.
- `PRD.md` - approved product requirements for POS Grocery.
- Cost decision - MVP avoids services that require credit-card billing; product images use Cloudinary Free, while the database stores image metadata.

No package manager lockfile exists yet. Use `pnpm` for the new monorepo because it handles separate frontend/backend packages cleanly and keeps installs fast.

## File Structure To Create Or Modify

- Modify: `AGENTS.md` - align database rules with Turso/libSQL.
- Create: `README.md` - project overview and development commands.
- Create: `.gitignore` - ignore Node, build, environment, coverage, and local database artifacts.
- Create: `package.json` - workspace-level scripts for frontend/backend checks.
- Create: `pnpm-workspace.yaml` - workspace package list.
- Create: `.github/workflows/ci.yml` - PR/main CI for frontend and backend.
- Create: `front-end/package.json` - frontend package scripts and dependencies.
- Create: `front-end/index.html` - Vite entry HTML.
- Create: `front-end/src/main.tsx` - React app entry.
- Create: `front-end/src/App.tsx` - initial shell that lists planned POS modules.
- Create: `front-end/src/App.test.tsx` - baseline frontend test.
- Create: `front-end/src/styles.css` - responsive foundation styles.
- Create: `front-end/tsconfig.json` - frontend TypeScript config.
- Create: `front-end/vite.config.ts` - Vite + Vitest config.
- Create: `back-end/package.json` - backend package scripts and dependencies.
- Create: `back-end/src/server.ts` - local Express server entry.
- Create: `back-end/src/app.ts` - Express app composition.
- Create: `back-end/src/config/env.ts` - environment validation.
- Create: `back-end/src/shared/http/health.controller.ts` - health endpoint controller.
- Create: `back-end/src/shared/http/health.routes.ts` - health route.
- Create: `back-end/src/shared/errors/app-error.ts` - typed app error class.
- Create: `back-end/src/shared/errors/error.middleware.ts` - consistent API error responses.
- Create: `back-end/src/shared/middleware/not-found.middleware.ts` - API 404 response.
- Create: `back-end/src/shared/types/api-response.ts` - shared API response shape.
- Create: `back-end/src/__tests__/health.test.ts` - baseline backend API test.
- Create: `back-end/prisma/schema.prisma` - Prisma v6 schema baseline for Turso/libSQL direction.
- Create: `back-end/tsconfig.json` - backend TypeScript config.
- Create: `back-end/vitest.config.ts` - backend Vitest config.
- Create: `back-end/wrangler.toml` - Cloudflare deployment starter configuration with non-secret names.
- Create: `docs/superpowers/plans/2026-06-28-pos-grocery-foundation.md` - this plan.

## Task 1: Align Project Rules With PRD

**Files:**

- Modify: `AGENTS.md`
- Read: `PRD.md`

- [ ] **Step 1: Verify the database decision in PRD**

Run:

```powershell
Select-String -Path .\PRD.md -Pattern "Turso/libSQL|Prisma ORM v6"
```

Expected: output includes both `Turso/libSQL` and `Prisma ORM v6`.

- [ ] **Step 2: Update `AGENTS.md` stack section**

Replace the existing stack bullets:

```markdown
- Database: Microsoft SQL Server (MSSQL)
- ORM: Prisma 6
```

With:

```markdown
- Database: Turso/libSQL
- ORM: Prisma ORM v6
```

- [ ] **Step 3: Update backend rules in `AGENTS.md`**

Replace:

```markdown
- Use MSSQL as the database.
- Use Prisma 6 as the ORM for database schema, migrations, and typed data access.
```

With:

```markdown
- Use Turso/libSQL as the database.
- Use Prisma ORM v6 for database schema, migrations, and typed data access.
```

- [ ] **Step 4: Verify no MSSQL references remain in project rules**

Run:

```powershell
Select-String -Path .\AGENTS.md -Pattern "MSSQL|Microsoft SQL Server"
```

Expected: no matches.

- [ ] **Step 5: Commit the rule alignment**

Run:

```powershell
git add AGENTS.md PRD.md docs/superpowers/plans/2026-06-28-pos-grocery-foundation.md
git commit -m "docs: align POS Grocery foundation plan"
```

Expected: commit succeeds with the documentation changes.

## Task 2: Create Workspace Metadata

**Files:**

- Create: `README.md`
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: Create `README.md`**

Use this content:

```markdown
# POS Grocery

POS Grocery is a grocery and mini-mart point-of-sale system for store setup, product and inventory management, barcode checkout, receipts, sales reporting, dashboard analytics, and styled Excel exports.

## Stack

- Frontend: React + TypeScript on Vercel
- Backend: Node.js + Express using MVC-style modules on Cloudflare
- Database: Turso/libSQL
- ORM: Prisma ORM v6
- Tests: Vitest
- CI/CD: GitHub Actions

## Project Structure

- `front-end/` - React POS client
- `back-end/` - Express API and Prisma schema
- `docs/` - planning and implementation notes

## Development

Install dependencies:

```powershell
pnpm install
```

Run all checks:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
```

- [ ] **Step 2: Create `.gitignore`**

Use this content:

```gitignore
node_modules/
dist/
build/
coverage/
.turbo/
.vite/
.next/

.env
.env.*
!.env.example

*.log
*.local

*.db
*.db-journal
*.sqlite
*.sqlite3

.wrangler/
.vercel/
```

- [ ] **Step 3: Create root `package.json`**

Use this content:

```json
{
  "name": "pos-grocery",
  "private": true,
  "version": "0.1.0",
  "description": "Grocery POS system with React frontend and Express backend.",
  "scripts": {
    "dev:front-end": "pnpm --dir front-end dev",
    "dev:back-end": "pnpm --dir back-end dev",
    "lint": "pnpm --dir front-end lint && pnpm --dir back-end lint",
    "typecheck": "pnpm --dir front-end typecheck && pnpm --dir back-end typecheck",
    "test": "pnpm --dir front-end test && pnpm --dir back-end test",
    "build": "pnpm --dir front-end build && pnpm --dir back-end build",
    "prisma:validate": "pnpm --dir back-end prisma validate",
    "prisma:generate": "pnpm --dir back-end prisma generate"
  },
  "packageManager": "pnpm@9.15.4"
}
```

- [ ] **Step 4: Create `pnpm-workspace.yaml`**

Use this content:

```yaml
packages:
  - front-end
  - back-end
```

- [ ] **Step 5: Verify root package scripts parse**

Run:

```powershell
node -e "const pkg=require('./package.json'); console.log(Object.keys(pkg.scripts).join(','))"
```

Expected: output includes `lint,typecheck,test,build`.

- [ ] **Step 6: Commit workspace metadata**

Run:

```powershell
git add README.md .gitignore package.json pnpm-workspace.yaml
git commit -m "chore: add POS Grocery workspace metadata"
```

Expected: commit succeeds.

## Task 3: Scaffold Frontend Foundation

**Files:**

- Create: `front-end/package.json`
- Create: `front-end/index.html`
- Create: `front-end/src/main.tsx`
- Create: `front-end/src/App.tsx`
- Create: `front-end/src/App.test.tsx`
- Create: `front-end/src/styles.css`
- Create: `front-end/tsconfig.json`
- Create: `front-end/vite.config.ts`

- [ ] **Step 1: Create `front-end/package.json`**

Use this content:

```json
{
  "name": "@pos-grocery/front-end",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsc --noEmit && vite build"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "eslint": "^9.17.0",
    "globals": "^15.14.0",
    "jsdom": "^25.0.1",
    "typescript-eslint": "^8.18.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `front-end/index.html`**

Use this content:

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>POS Grocery</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `front-end/src/main.tsx`**

Use this content:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Create `front-end/src/App.tsx`**

Use this content:

```tsx
const foundationItems = [
  "Store setup",
  "Product catalog",
  "Inventory receiving",
  "Barcode checkout",
  "Sales reports",
  "Excel export",
];

export function App() {
  return (
    <main className="app-shell">
      <section className="workspace-header">
        <p className="eyebrow">POS Grocery</p>
        <h1>ระบบขายหน้าร้านสำหรับร้านของชำ</h1>
        <p className="summary">
          Foundation build for a responsive grocery POS with React, Express, Turso/libSQL,
          Prisma ORM v6, CI/CD, and unit tests.
        </p>
      </section>

      <section className="module-grid" aria-label="Planned POS modules">
        {foundationItems.map((item) => (
          <article className="module-card" key={item}>
            <span>{item}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Create `front-end/src/App.test.tsx`**

Use this content:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the POS Grocery foundation shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "ระบบขายหน้าร้านสำหรับร้านของชำ" })).toBeInTheDocument();
    expect(screen.getByText("Barcode checkout")).toBeInTheDocument();
    expect(screen.getByText("Excel export")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Create `front-end/src/styles.css`**

Use this content:

```css
:root {
  color: #16201a;
  background: #f6f7f4;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}

.workspace-header {
  max-width: 920px;
}

.eyebrow {
  color: #286140;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 10px;
  text-transform: uppercase;
}

h1 {
  font-size: 42px;
  line-height: 1.12;
  margin: 0;
}

.summary {
  color: #4d5a52;
  font-size: 18px;
  line-height: 1.6;
  max-width: 760px;
}

.module-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 28px;
  max-width: 960px;
}

.module-card {
  align-items: center;
  background: #ffffff;
  border: 1px solid #d9ded7;
  border-radius: 8px;
  display: flex;
  min-height: 88px;
  padding: 18px;
}

.module-card span {
  font-size: 16px;
  font-weight: 700;
}

@media (max-width: 640px) {
  .app-shell {
    padding: 20px;
  }

  h1 {
    font-size: 30px;
  }

  .summary {
    font-size: 16px;
  }
}
```

- [ ] **Step 7: Create `front-end/tsconfig.json`**

Use this content:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 8: Create `front-end/vite.config.ts`**

Use this content:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 9: Add frontend ESLint config**

Create `front-end/eslint.config.js` with this content:

```js
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
```

- [ ] **Step 10: Install dependencies**

Run:

```powershell
pnpm install
```

Expected: `pnpm-lock.yaml` is created and install exits successfully.

- [ ] **Step 11: Verify frontend checks**

Run:

```powershell
pnpm --dir front-end lint
pnpm --dir front-end typecheck
pnpm --dir front-end test
pnpm --dir front-end build
```

Expected: all commands pass.

- [ ] **Step 12: Commit frontend foundation**

Run:

```powershell
git add front-end package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: scaffold React POS frontend"
```

Expected: commit succeeds.

## Task 4: Scaffold Backend Foundation

**Files:**

- Create: `back-end/package.json`
- Create: `back-end/src/server.ts`
- Create: `back-end/src/app.ts`
- Create: `back-end/src/config/env.ts`
- Create: `back-end/src/shared/http/health.controller.ts`
- Create: `back-end/src/shared/http/health.routes.ts`
- Create: `back-end/src/shared/errors/app-error.ts`
- Create: `back-end/src/shared/errors/error.middleware.ts`
- Create: `back-end/src/shared/middleware/not-found.middleware.ts`
- Create: `back-end/src/shared/types/api-response.ts`
- Create: `back-end/src/__tests__/health.test.ts`
- Create: `back-end/tsconfig.json`
- Create: `back-end/vitest.config.ts`
- Create: `back-end/eslint.config.js`

- [ ] **Step 1: Create `back-end/package.json`**

Use this content:

```json
{
  "name": "@pos-grocery/back-end",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsc --noEmit",
    "start": "node dist/server.js",
    "prisma": "prisma"
  },
  "dependencies": {
    "@prisma/client": "^6.1.0",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "helmet": "^8.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.17.0",
    "globals": "^15.14.0",
    "prisma": "^6.1.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `back-end/src/shared/types/api-response.ts`**

Use this content:

```ts
export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

- [ ] **Step 3: Create `back-end/src/shared/errors/app-error.ts`**

Use this content:

```ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
```

- [ ] **Step 4: Create `back-end/src/shared/errors/error.middleware.ts`**

Use this content:

```ts
import type { ErrorRequestHandler } from "express";
import { AppError } from "./app-error";

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error.",
    },
  });
};
```

- [ ] **Step 5: Create `back-end/src/shared/middleware/not-found.middleware.ts`**

Use this content:

```ts
import type { RequestHandler } from "express";

export const notFoundMiddleware: RequestHandler = (_request, response) => {
  response.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
  });
};
```

- [ ] **Step 6: Create `back-end/src/config/env.ts`**

Use this content:

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 7: Create `back-end/src/shared/http/health.controller.ts`**

Use this content:

```ts
import type { RequestHandler } from "express";

export const getHealth: RequestHandler = (_request, response) => {
  response.json({
    success: true,
    data: {
      service: "pos-grocery-api",
      status: "ok",
    },
  });
};
```

- [ ] **Step 8: Create `back-end/src/shared/http/health.routes.ts`**

Use this content:

```ts
import { Router } from "express";
import { getHealth } from "./health.controller";

export const healthRouter = Router();

healthRouter.get("/health", getHealth);
```

- [ ] **Step 9: Create `back-end/src/app.ts`**

Use this content:

```ts
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorMiddleware } from "./shared/errors/error.middleware";
import { healthRouter } from "./shared/http/health.routes";
import { notFoundMiddleware } from "./shared/middleware/not-found.middleware";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use("/api", healthRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
```

- [ ] **Step 10: Create `back-end/src/server.ts`**

Use this content:

```ts
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`POS Grocery API listening on port ${env.PORT}`);
});
```

- [ ] **Step 11: Create `back-end/src/__tests__/health.test.ts`**

Use this content:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("health endpoint", () => {
  it("returns service health", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        service: "pos-grocery-api",
        status: "ok",
      },
    });
  });

  it("returns a consistent not found response", async () => {
    const response = await request(createApp()).get("/api/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    });
  });
});
```

- [ ] **Step 12: Create `back-end/tsconfig.json`**

Use this content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

- [ ] **Step 13: Create `back-end/vitest.config.ts`**

Use this content:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 14: Create `back-end/eslint.config.js`**

Use this content:

```js
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "coverage"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
```

- [ ] **Step 15: Install backend dependencies**

Run:

```powershell
pnpm install
```

Expected: install exits successfully and updates `pnpm-lock.yaml`.

- [ ] **Step 16: Verify backend checks**

Run:

```powershell
pnpm --dir back-end lint
pnpm --dir back-end typecheck
pnpm --dir back-end test
pnpm --dir back-end build
```

Expected: all commands pass.

- [ ] **Step 17: Commit backend foundation**

Run:

```powershell
git add back-end pnpm-lock.yaml
git commit -m "feat: scaffold Express API foundation"
```

Expected: commit succeeds.

## Task 5: Add Prisma And Turso Direction

**Files:**

- Create: `back-end/prisma/schema.prisma`
- Create: `back-end/.env.example`
- Modify: `back-end/package.json`

- [ ] **Step 1: Create `back-end/prisma/schema.prisma`**

Use this content:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Store {
  id        String   @id @default(cuid())
  name      String
  phone     String
  address   String
  ownerName String
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users      User[]
  products   Product[]
  categories Category[]
  sales      Sale[]
}

model User {
  id           String   @id @default(cuid())
  storeId      String
  username     String
  passwordHash String
  displayName  String
  role         String
  status       String   @default("active")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  store Store @relation(fields: [storeId], references: [id])
  sales Sale[]

  @@unique([storeId, username])
}

model Category {
  id        String   @id @default(cuid())
  storeId   String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  store    Store     @relation(fields: [storeId], references: [id])
  products Product[]

  @@unique([storeId, name])
}

model Product {
  id              String   @id @default(cuid())
  storeId         String
  categoryId      String?
  name            String
  barcode         String
  sku             String?
  unit            String
  costPriceSatang Int
  salePriceSatang Int
  stockQuantity   Int      @default(0)
  status          String   @default("active")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  store                 Store                  @relation(fields: [storeId], references: [id])
  category              Category?              @relation(fields: [categoryId], references: [id])
  images                ProductImage[]
  inventoryTransactions InventoryTransaction[]
  saleItems             SaleItem[]

  @@unique([storeId, barcode])
}

model ProductImage {
  id        String   @id @default(cuid())
  productId String
  url       String
  altText   String?
  createdAt DateTime @default(now())

  product Product @relation(fields: [productId], references: [id])
}

model InventoryTransaction {
  id                 String   @id @default(cuid())
  productId          String
  type               String
  quantityChange     Int
  unitCostSatang     Int?
  balanceAfterChange Int
  note               String?
  createdByUserId    String?
  createdAt          DateTime @default(now())

  product Product @relation(fields: [productId], references: [id])
}

model Sale {
  id                  String   @id @default(cuid())
  storeId             String
  cashierUserId       String
  receiptNumber       String
  subtotalSatang      Int
  totalSatang         Int
  cashReceivedSatang  Int
  changeDueSatang     Int
  status              String   @default("completed")
  soldAt              DateTime @default(now())
  createdAt           DateTime @default(now())

  store   Store      @relation(fields: [storeId], references: [id])
  cashier User       @relation(fields: [cashierUserId], references: [id])
  items   SaleItem[]
  payment Payment?
  receipt Receipt?

  @@unique([storeId, receiptNumber])
}

model SaleItem {
  id              String @id @default(cuid())
  saleId          String
  productId       String
  productName     String
  quantity        Int
  unitPriceSatang Int
  totalSatang     Int

  sale    Sale    @relation(fields: [saleId], references: [id])
  product Product @relation(fields: [productId], references: [id])
}

model Payment {
  id          String   @id @default(cuid())
  saleId      String   @unique
  method      String
  amountSatang Int
  createdAt   DateTime @default(now())

  sale Sale @relation(fields: [saleId], references: [id])
}

model Receipt {
  id        String   @id @default(cuid())
  saleId    String   @unique
  content   String
  createdAt DateTime @default(now())

  sale Sale @relation(fields: [saleId], references: [id])
}
```

- [ ] **Step 2: Create `back-end/.env.example`**

Use this content:

```dotenv
NODE_ENV=development
PORT=8787
DATABASE_URL=file:./dev.db
```

- [ ] **Step 3: Validate Prisma schema**

Run:

```powershell
pnpm --dir back-end prisma validate
```

Expected: output includes `The schema at prisma\schema.prisma is valid`.

- [ ] **Step 4: Generate Prisma client**

Run:

```powershell
pnpm --dir back-end prisma generate
```

Expected: Prisma Client is generated successfully.

- [ ] **Step 5: Commit Prisma foundation**

Run:

```powershell
git add back-end/prisma back-end/.env.example back-end/package.json pnpm-lock.yaml
git commit -m "feat: add Prisma schema foundation"
```

Expected: commit succeeds.

## Task 6: Add CI Pipeline

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

Use this content:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  checks:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Prisma validate
        run: pnpm prisma:validate

      - name: Prisma generate
        run: pnpm prisma:generate

      - name: Build
        run: pnpm build
```

- [ ] **Step 2: Run the local equivalent of CI**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm prisma:generate
pnpm build
```

Expected: all commands pass.

- [ ] **Step 3: Commit CI**

Run:

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: add frontend and backend checks"
```

Expected: commit succeeds.

## Task 7: Prepare Deployment Configuration Notes

**Files:**

- Create: `front-end/.env.example`
- Create: `back-end/wrangler.toml`
- Modify: `README.md`

- [ ] **Step 1: Create `front-end/.env.example`**

Use this content:

```dotenv
VITE_API_BASE_URL=http://localhost:8787/api
```

- [ ] **Step 2: Create `back-end/wrangler.toml`**

Use this content:

```toml
name = "pos-grocery-api"
main = "src/server.ts"
compatibility_date = "2026-06-28"

[vars]
NODE_ENV = "production"
```

- [ ] **Step 3: Append deployment notes to `README.md`**

Add this section:

```markdown
## Deployment

Frontend deployment target: Vercel.

Backend deployment target: Cloudflare.

Required production environment variables:

- `VITE_API_BASE_URL` for the frontend API URL
- `DATABASE_URL` for Turso/libSQL access
- `NODE_ENV=production` for backend runtime behavior
```

- [ ] **Step 4: Verify env examples do not include secrets**

Run:

```powershell
Select-String -Path .\front-end\.env.example,.\back-end\.env.example -Pattern "password|secret|token|key" -CaseSensitive:$false
```

Expected: no real secret values are present. The word `DATABASE_URL` is acceptable because it is a variable name, not a credential.

- [ ] **Step 5: Commit deployment notes**

Run:

```powershell
git add README.md front-end/.env.example back-end/wrangler.toml
git commit -m "docs: add deployment configuration notes"
```

Expected: commit succeeds.

## Task 8: Final Foundation Verification

**Files:**

- Read: all created foundation files

- [ ] **Step 1: Run all checks**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm prisma:generate
pnpm build
```

Expected: all commands pass.

- [ ] **Step 2: Confirm expected files exist**

Run:

```powershell
Test-Path .\front-end\src\App.tsx
Test-Path .\back-end\src\app.ts
Test-Path .\back-end\prisma\schema.prisma
Test-Path .\.github\workflows\ci.yml
```

Expected: four `True` outputs.

- [ ] **Step 3: Review git status**

Run:

```powershell
git status --short
```

Expected: no uncommitted changes from this foundation plan, unless the agent intentionally leaves `PRD.md` or plan files unstaged for user review.

- [ ] **Step 4: Write the next focused plan**

Create the next plan at:

```text
docs/superpowers/plans/2026-06-28-auth-store.md
```

The next plan must implement:

- store schema completion and seed strategy
- user model service tests
- password hashing
- login endpoint
- role guard middleware
- frontend login screen
- store settings screen
- protected frontend route shell

Expected: the next plan starts with the required `# Auth Store Implementation Plan` header and includes executable tasks with tests.

## Self-Review

- Spec coverage: This plan covers PRD Phase 0 and prepares the architecture for all MVP modules. It does not implement Auth/Store, Product/Inventory, Sales/Receipt, Reports/Dashboard, or Excel export because those are separate subsystems listed as follow-up plans.
- Placeholder scan: No incomplete-marker text or empty implementation steps are intentionally present.
- Type consistency: The plan uses `Store`, `User`, `Product`, `InventoryTransaction`, `Sale`, `SaleItem`, `Payment`, and `Receipt` consistently with `PRD.md`.
- Risk note: The backend Cloudflare runtime for Express may need an adapter or Cloudflare Worker-specific entry during the deployment plan. This foundation keeps local Express API structure first and defers runtime adaptation to the production-hardening plan after API modules exist.
