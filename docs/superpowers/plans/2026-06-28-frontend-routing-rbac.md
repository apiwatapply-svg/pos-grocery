# Frontend Routing and RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current one-page POS prototype into clear pages with sidebar navigation, top navbar, and role-based page access for owner, admin, cashier, and stock users.

**Architecture:** Build an authenticated app shell that owns the sidebar, navbar, route guard, and current user session state. Move each feature out of `front-end/src/App.tsx` into focused route pages under `front-end/src/features/*`, with shared layout/navigation code under `front-end/src/app/*` and shared permission helpers under `front-end/src/lib/auth/*`.

**Tech Stack:** React + TypeScript, Vite, Vitest, Testing Library, CSS modules or existing `styles.css` conventions, `react-router-dom` for client-side routing.

---

## Current State

- `front-end/src/App.tsx` currently renders most POS modules on one page.
- `front-end/src/features/auth/LoginPage.tsx` already exists.
- `front-end/src/features/store/StoreSettingsPage.tsx` already exists.
- Backend roles already exist in concept: `owner`, `admin`, `cashier`, `stock`.
- Customer display was recently added and should remain accessible from the POS checkout page only.

## Target Page Count

The MVP should have **16 clear pages**, plus one customer display popup window.

| No. | Route | Page | Purpose |
| --- | --- | --- | --- |
| 1 | `/login` | Login | Username/password login |
| 2 | `/dashboard` | Dashboard | Sales summary, best sellers, peak sales time, low stock |
| 3 | `/pos` | POS Checkout | Barcode scan, cart, payment, stock deduction trigger |
| 4 | `/customer-display` | Customer Display Preview | Local preview/settings for second-screen customer display |
| 5 | `/receipts` | Receipt History | Search and open historical receipts |
| 6 | `/receipts/:receiptId` | Receipt Detail | Receipt view and browser print |
| 7 | `/products` | Product List | Product CRUD list/search/status |
| 8 | `/products/new` | Product Create | Create product with Cloudinary image upload |
| 9 | `/products/:productId/edit` | Product Edit | Edit product, prices, barcode, image |
| 10 | `/inventory` | Inventory List | Stock on hand, filters, export inventory Excel |
| 11 | `/inventory/receiving` | Receive Stock | Receive goods into store |
| 12 | `/inventory/counting` | Stock Counting | Count/adjust stock |
| 13 | `/reports/sales` | Sales Report | Daily/monthly/custom sales report and Excel export |
| 14 | `/reports/best-sellers` | Best Sellers Report | Best-selling products by selected period |
| 15 | `/settings/store` | Store Settings | Store name, phone, address, owner |
| 16 | `/settings/users` | User Management | User CRUD, roles, active/inactive |

Customer popup:

- Opened from `/pos` or `/customer-display`.
- Uses `window.open('', 'pos-grocery-customer-display', 'popup,width=900,height=700')`.
- Enabled only when `window.screen.isExtended === true`.
- Stores `pos-grocery:customer-display-enabled` only when a second screen is detected.

## Role Access Matrix

| Page | owner | admin | cashier | stock |
| --- | --- | --- | --- | --- |
| Login | public | public | public | public |
| Dashboard | yes | yes | no | stock summary only |
| POS Checkout | yes | yes | yes | no |
| Customer Display | yes | yes | yes | no |
| Receipt History | yes | yes | own shift only | no |
| Receipt Detail | yes | yes | own shift only | no |
| Product List | yes | yes | read only | read only |
| Product Create | yes | yes | no | no |
| Product Edit | yes | yes | no | no |
| Inventory List | yes | yes | no | yes |
| Receive Stock | yes | yes | no | yes |
| Stock Counting | yes | yes | no | yes |
| Sales Report | yes | yes | no | no |
| Best Sellers Report | yes | yes | no | no |
| Store Settings | yes | yes | no | no |
| User Management | yes | yes | no | no |

Important rule:

- Hiding sidebar links is not enough. Every route must use a route guard.
- Backend endpoints must still enforce role permissions. Frontend RBAC is UX, not security.

## Navigation Groups

Sidebar groups:

- **ขายหน้าร้าน:** POS Checkout, Customer Display, Receipts
- **สินค้าและสต็อก:** Products, Inventory, Receive Stock, Stock Counting
- **รายงาน:** Dashboard, Sales Report, Best Sellers
- **ตั้งค่า:** Store Settings, User Management

Navbar content:

- Current store name
- Current user display name and role
- Quick link to POS
- Logout button
- Mobile sidebar toggle

## File Structure

Create:

- `front-end/src/app/AppShell.tsx` - Authenticated layout with sidebar, navbar, and outlet area.
- `front-end/src/app/AppShell.test.tsx` - Sidebar/nav rendering and mobile toggle tests.
- `front-end/src/app/routes.tsx` - Route definitions and role metadata.
- `front-end/src/app/routes.test.tsx` - Route metadata and permission tests.
- `front-end/src/lib/auth/session.ts` - Current session type, local session helpers, logout helper.
- `front-end/src/lib/auth/permissions.ts` - Role permission helper.
- `front-end/src/lib/auth/permissions.test.ts` - Role matrix unit tests.
- `front-end/src/features/auth/RequireAuth.tsx` - Auth guard.
- `front-end/src/features/auth/RequireAuth.test.tsx` - Redirect and access-denied tests.
- `front-end/src/features/dashboard/DashboardPage.tsx`
- `front-end/src/features/pos/PosCheckoutPage.tsx`
- `front-end/src/features/pos/CustomerDisplayPage.tsx`
- `front-end/src/features/receipts/ReceiptListPage.tsx`
- `front-end/src/features/receipts/ReceiptDetailPage.tsx`
- `front-end/src/features/products/ProductListPage.tsx`
- `front-end/src/features/products/ProductFormPage.tsx`
- `front-end/src/features/inventory/InventoryListPage.tsx`
- `front-end/src/features/inventory/InventoryReceivingPage.tsx`
- `front-end/src/features/inventory/StockCountingPage.tsx`
- `front-end/src/features/reports/SalesReportPage.tsx`
- `front-end/src/features/reports/BestSellersReportPage.tsx`
- `front-end/src/features/users/UserManagementPage.tsx`
- `front-end/src/features/shared/AccessDeniedPage.tsx`
- `front-end/src/features/shared/NotFoundPage.tsx`

Modify:

- `front-end/package.json` - add `react-router-dom`.
- `front-end/src/main.tsx` - mount `BrowserRouter`.
- `front-end/src/App.tsx` - replace one-page module rendering with route tree.
- `front-end/src/styles.css` - add app shell, sidebar, navbar, route page, mobile nav styles.
- `front-end/src/features/auth/LoginPage.tsx` - save session and redirect by role after login.
- `front-end/src/features/store/StoreSettingsPage.tsx` - mount as `/settings/store`.
- `front-end/src/App.test.tsx` - replace old one-page assertions with route-level smoke tests.

## Redirect Rules After Login

- `owner` -> `/dashboard`
- `admin` -> `/dashboard`
- `cashier` -> `/pos`
- `stock` -> `/inventory`

## Task 1: Add Permission Model

**Files:**

- Create: `front-end/src/lib/auth/permissions.ts`
- Create: `front-end/src/lib/auth/permissions.test.ts`

- [ ] Write tests for all route permissions in the matrix above.
- [ ] Implement `Role`, `AppRouteId`, `routePermissions`, and `canAccessRoute(role, routeId)`.
- [ ] Run `npm.cmd --prefix front-end test -- src/lib/auth/permissions.test.ts`.
- [ ] Commit: `feat: add frontend route permissions`.

Expected permission API:

```ts
export type Role = 'owner' | 'admin' | 'cashier' | 'stock'

export type AppRouteId =
  | 'dashboard'
  | 'pos'
  | 'customer-display'
  | 'receipts'
  | 'receipt-detail'
  | 'products'
  | 'product-create'
  | 'product-edit'
  | 'inventory'
  | 'inventory-receiving'
  | 'stock-counting'
  | 'sales-report'
  | 'best-sellers-report'
  | 'store-settings'
  | 'user-management'

export function canAccessRoute(role: Role, routeId: AppRouteId) {
  return routePermissions[routeId].includes(role)
}
```

## Task 2: Add Session Helpers

**Files:**

- Create: `front-end/src/lib/auth/session.ts`
- Create: `front-end/src/lib/auth/session.test.ts`

- [ ] Test reading an empty session returns `null`.
- [ ] Test saving a session stores user id, display name, role, and token.
- [ ] Test clearing a session removes it.
- [ ] Implement localStorage-backed helpers using key `pos-grocery:session`.
- [ ] Run `npm.cmd --prefix front-end test -- src/lib/auth/session.test.ts`.
- [ ] Commit: `feat: add frontend session helpers`.

Session shape:

```ts
export type CurrentUser = {
  id: string
  username: string
  displayName: string
  role: Role
}

export type Session = {
  token: string
  user: CurrentUser
}
```

## Task 3: Install Router and Define Routes

**Files:**

- Modify: `front-end/package.json`
- Create: `front-end/src/app/routes.tsx`
- Create: `front-end/src/app/routes.test.tsx`
- Modify: `front-end/src/main.tsx`

- [ ] Install `react-router-dom`.
- [ ] Write tests that every protected route has a `routeId`, `path`, `label`, and `navGroup`.
- [ ] Create route metadata for all 16 pages.
- [ ] Wrap the app with `BrowserRouter`.
- [ ] Run `npm.cmd --prefix front-end test -- src/app/routes.test.tsx`.
- [ ] Commit: `feat: add frontend route metadata`.

Route metadata shape:

```ts
export type NavGroup = 'sales' | 'inventory' | 'reports' | 'settings'

export type AppRoute = {
  id: AppRouteId
  path: string
  label: string
  navGroup: NavGroup
  roles: Role[]
}
```

## Task 4: Build Auth Guard

**Files:**

- Create: `front-end/src/features/auth/RequireAuth.tsx`
- Create: `front-end/src/features/auth/RequireAuth.test.tsx`
- Create: `front-end/src/features/shared/AccessDeniedPage.tsx`
- Create: `front-end/src/features/shared/NotFoundPage.tsx`

- [ ] Test unauthenticated users redirect to `/login`.
- [ ] Test authenticated users without permission see access denied.
- [ ] Test authenticated users with permission see the route content.
- [ ] Implement `RequireAuth`.
- [ ] Run `npm.cmd --prefix front-end test -- src/features/auth/RequireAuth.test.tsx`.
- [ ] Commit: `feat: guard frontend routes by role`.

Guard behavior:

```tsx
<RequireAuth routeId="sales-report">
  <SalesReportPage />
</RequireAuth>
```

## Task 5: Build App Shell

**Files:**

- Create: `front-end/src/app/AppShell.tsx`
- Create: `front-end/src/app/AppShell.test.tsx`
- Modify: `front-end/src/styles.css`

- [ ] Test sidebar only shows links allowed for the current role.
- [ ] Test navbar shows store name, user name, role, POS shortcut, and logout.
- [ ] Test mobile sidebar toggle opens and closes navigation.
- [ ] Implement desktop sidebar and top navbar.
- [ ] Add responsive CSS for desktop, tablet, and mobile.
- [ ] Run `npm.cmd --prefix front-end test -- src/app/AppShell.test.tsx`.
- [ ] Commit: `feat: add responsive app shell`.

Layout rules:

- Desktop: fixed sidebar + top navbar + scrollable content area.
- Tablet: sidebar remains visible if width allows; content cards/tables compact.
- Mobile: sidebar collapses behind menu button.
- Sidebar must not show forbidden links for the current role.

## Task 6: Split Feature Pages

**Files:**

- Create all feature page files listed in File Structure.
- Modify: `front-end/src/App.tsx`
- Modify: `front-end/src/App.test.tsx`

- [ ] Move dashboard content from `App.tsx` to `DashboardPage.tsx`.
- [ ] Move POS checkout and receipt state from `App.tsx` to `PosCheckoutPage.tsx`.
- [ ] Move customer-display controls to `CustomerDisplayPage.tsx` and keep popup support.
- [ ] Move product table/form into products pages.
- [ ] Move inventory receiving/counting into inventory pages.
- [ ] Move report blocks into report pages.
- [ ] Mount existing `StoreSettingsPage.tsx` at `/settings/store`.
- [ ] Move user table/form into `UserManagementPage.tsx`.
- [ ] Replace `App.tsx` with route tree and layout only.
- [ ] Run `npm.cmd --prefix front-end test`.
- [ ] Commit: `feat: split pos features into routed pages`.

## Task 7: Login Redirects by Role

**Files:**

- Modify: `front-end/src/features/auth/LoginPage.tsx`
- Modify: `front-end/src/features/auth/LoginPage.test.tsx`

- [ ] Test owner login redirects to `/dashboard`.
- [ ] Test admin login redirects to `/dashboard`.
- [ ] Test cashier login redirects to `/pos`.
- [ ] Test stock login redirects to `/inventory`.
- [ ] Save session with role after login.
- [ ] Run `npm.cmd --prefix front-end test -- src/features/auth/LoginPage.test.tsx`.
- [ ] Commit: `feat: redirect users by role after login`.

## Task 8: Full Verification

**Files:**

- No new files.

- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Start frontend and backend dev servers.
- [ ] Manually verify owner/admin/cashier/stock navigation.
- [ ] Verify forbidden page access by entering URLs directly.
- [ ] Verify `/pos` still supports barcode cart and customer display popup.
- [ ] Commit any final fixes.
- [ ] Push and verify GitHub CI.

## Acceptance Checklist

- [ ] The app is no longer a single page of all modules.
- [ ] Sidebar and navbar exist on authenticated pages.
- [ ] Every feature has its own page or a clearly paired create/edit/detail route.
- [ ] Every route has explicit role access.
- [ ] Forbidden direct URL access is blocked in the frontend.
- [ ] Login redirects users to the right starting page for their role.
- [ ] Customer display remains second-screen gated.
- [ ] Tests cover permissions, session, auth guard, app shell, and login redirects.
- [ ] CI passes.
