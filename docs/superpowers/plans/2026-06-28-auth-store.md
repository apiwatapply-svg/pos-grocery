# Auth Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement initial store setup, admin seed, password hashing, login, role-aware protected API middleware, and frontend login/store settings shells.

**Architecture:** Backend auth logic lives in focused MVC-style modules under `back-end/src/modules/auth`, `back-end/src/modules/users`, and `back-end/src/modules/stores`. Frontend login and store settings screens live under `front-end/src/features/auth` and `front-end/src/features/store`, with API calls isolated in `front-end/src/lib/api`.

**Tech Stack:** React, TypeScript, Express, Prisma ORM v6, Turso/libSQL, Vitest, Testing Library, bcrypt or argon2, JWT or signed session token.

---

## File Structure

- Create: `back-end/src/modules/auth/auth.service.ts` - password verification and token creation.
- Create: `back-end/src/modules/auth/auth.controller.ts` - login endpoint handler.
- Create: `back-end/src/modules/auth/auth.routes.ts` - auth routes.
- Create: `back-end/src/modules/auth/auth.schemas.ts` - login request validation.
- Create: `back-end/src/modules/auth/auth.middleware.ts` - authenticated request and role guard.
- Create: `back-end/src/modules/auth/auth.service.test.ts` - service unit tests.
- Create: `back-end/src/modules/users/user.repository.ts` - user data access.
- Create: `back-end/src/modules/users/seed-admin.ts` - initial admin seed helper.
- Create: `back-end/src/modules/stores/store.controller.ts` - current store read/update handlers.
- Create: `back-end/src/modules/stores/store.routes.ts` - store routes.
- Create: `back-end/src/modules/stores/store.schemas.ts` - store validation.
- Create: `front-end/src/lib/api/client.ts` - API client helper.
- Create: `front-end/src/features/auth/LoginPage.tsx` - login screen.
- Create: `front-end/src/features/store/StoreSettingsPage.tsx` - store settings shell.
- Modify: `back-end/src/app.ts` - mount auth and store routes.
- Modify: `front-end/src/App.tsx` - route between login and store shell.

## Task 1: Auth Service Tests

**Files:**

- Create: `back-end/src/modules/auth/auth.service.test.ts`
- Create: `back-end/src/modules/auth/auth.service.ts`

- [ ] **Step 1: Write failing tests**

Create tests for these behaviors:

```ts
import { describe, expect, it } from "vitest";
import { comparePassword, hashPassword, requireActiveUser } from "./auth.service.js";

describe("auth service", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("admin");

    expect(hash).not.toBe("admin");
    await expect(comparePassword("admin", hash)).resolves.toBe(true);
    await expect(comparePassword("wrong", hash)).resolves.toBe(false);
  });

  it("rejects inactive users", () => {
    expect(() => requireActiveUser({ status: "inactive" })).toThrow("User is inactive.");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm.cmd --prefix back-end test -- auth.service.test.ts
```

Expected: fails because `auth.service.ts` does not exist.

- [ ] **Step 3: Implement the service**

Use `bcrypt` or `argon2`; pick one dependency and add it to `back-end/package.json`.
Export:

```ts
export async function hashPassword(password: string): Promise<string>;
export async function comparePassword(password: string, hash: string): Promise<boolean>;
export function requireActiveUser(user: { status: string }): void;
```

- [ ] **Step 4: Verify tests pass**

Run:

```powershell
npm.cmd --prefix back-end test -- auth.service.test.ts
```

Expected: password and inactive-user tests pass.

## Task 2: Admin Seed

**Files:**

- Create: `back-end/src/modules/users/seed-admin.ts`
- Test: `back-end/src/modules/users/seed-admin.test.ts`

- [ ] **Step 1: Write seed tests**

Test that the seed helper:

- creates the first store when none exists.
- creates an owner user from `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- does not duplicate the admin when run twice.

- [ ] **Step 2: Implement seed helper**

Export:

```ts
export async function seedInitialAdmin(deps: {
  adminUsername: string;
  adminPassword: string;
  storeName: string;
}): Promise<void>;
```

- [ ] **Step 3: Verify seed tests**

Run:

```powershell
npm.cmd --prefix back-end test -- seed-admin.test.ts
```

Expected: seed tests pass.

## Task 3: Login Endpoint

**Files:**

- Create: `back-end/src/modules/auth/auth.schemas.ts`
- Create: `back-end/src/modules/auth/auth.controller.ts`
- Create: `back-end/src/modules/auth/auth.routes.ts`
- Modify: `back-end/src/app.ts`
- Test: `back-end/src/modules/auth/auth.routes.test.ts`

- [ ] **Step 1: Write route tests**

Test:

- `POST /api/auth/login` returns 400 for missing username/password.
- returns 401 for invalid credentials.
- returns user profile and token for valid credentials.

- [ ] **Step 2: Implement validation schema**

Use zod:

```ts
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
```

- [ ] **Step 3: Implement controller and route**

Mount:

```ts
app.use("/api/auth", authRouter);
```

- [ ] **Step 4: Verify route tests**

Run:

```powershell
npm.cmd --prefix back-end test -- auth.routes.test.ts
```

Expected: all login route tests pass.

## Task 4: Protected Store API

**Files:**

- Create: `back-end/src/modules/auth/auth.middleware.ts`
- Create: `back-end/src/modules/stores/store.schemas.ts`
- Create: `back-end/src/modules/stores/store.controller.ts`
- Create: `back-end/src/modules/stores/store.routes.ts`
- Modify: `back-end/src/app.ts`
- Test: `back-end/src/modules/stores/store.routes.test.ts`

- [ ] **Step 1: Write route tests**

Test:

- unauthenticated `GET /api/store/current` returns 401.
- authenticated cashier can read current store.
- cashier cannot update store settings.
- owner can update store settings.

- [ ] **Step 2: Implement auth middleware**

Export:

```ts
export function requireAuth(): RequestHandler;
export function requireRole(roles: string[]): RequestHandler;
```

- [ ] **Step 3: Implement store routes**

Mount:

```ts
app.use("/api/store", storeRouter);
```

- [ ] **Step 4: Verify store tests**

Run:

```powershell
npm.cmd --prefix back-end test -- store.routes.test.ts
```

Expected: protected store tests pass.

## Task 5: Frontend Login Shell

**Files:**

- Create: `front-end/src/lib/api/client.ts`
- Create: `front-end/src/features/auth/LoginPage.tsx`
- Test: `front-end/src/features/auth/LoginPage.test.tsx`
- Modify: `front-end/src/App.tsx`

- [ ] **Step 1: Write UI test**

Test that login screen renders username, password, and submit controls.

- [ ] **Step 2: Implement API client**

Export:

```ts
export async function apiPost<T>(path: string, body: unknown): Promise<T>;
```

- [ ] **Step 3: Implement login page**

Use controlled inputs for username/password and call `POST /auth/login`.

- [ ] **Step 4: Verify frontend auth tests**

Run:

```powershell
npm.cmd --prefix front-end test -- LoginPage.test.tsx
```

Expected: login UI tests pass.

## Task 6: Store Settings Shell

**Files:**

- Create: `front-end/src/features/store/StoreSettingsPage.tsx`
- Test: `front-end/src/features/store/StoreSettingsPage.test.tsx`
- Modify: `front-end/src/App.tsx`

- [ ] **Step 1: Write UI test**

Test that store settings renders store name, phone, address, and owner fields.

- [ ] **Step 2: Implement store settings shell**

The shell may use mocked data until the data-fetching task is implemented.

- [ ] **Step 3: Verify frontend store tests**

Run:

```powershell
npm.cmd --prefix front-end test -- StoreSettingsPage.test.tsx
```

Expected: store settings UI tests pass.

## Task 7: Full Verification

- [ ] **Step 1: Run all checks**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run build
```

Expected: all checks pass.

- [ ] **Step 2: Confirm no secrets are staged**

Run:

```powershell
git diff --cached --name-only
```

Expected: does not include `back-end/.env`, `back-end/.dev.vars`, or `front-end/.env.local`.
