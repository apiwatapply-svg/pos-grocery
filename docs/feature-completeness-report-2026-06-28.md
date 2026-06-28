# POS Grocery Feature Completeness Report

Date: 2026-06-28

## Executive Summary

Status: **ยังไม่ครบตาม production checklist**

The repository has a working MVP foundation, API tests, component tests, CI,
and many requested screens/endpoints. However, several requested items are only
implemented as local frontend state or in-memory backend behavior, not as a full
production system connected end-to-end to Turso/Prisma and Cloudinary.

Most important blockers:

- No E2E test suite exists yet.
- Frontend POS workspace does not call most backend APIs; it uses local
  `useState` demo data.
- Backend routes use the in-memory repository, not Turso/Prisma persistence.
- Production deploy is not complete. GitHub Deploy workflow currently fails
  because required secrets are missing, and the backend still needs a
  Cloudflare Worker-compatible runtime entry point.

## Verification Evidence

Fresh verification commands run on 2026-06-28:

- `npm.cmd run lint`: passed
- `npm.cmd run typecheck`: passed
- `npm.cmd test`: passed
  - Frontend: 3 files, 4 tests passed
  - Backend: 6 files, 16 tests passed
- `npm.cmd run build`: passed
- `npm.cmd run prisma:validate`: passed
- `npm.cmd run prisma:generate`: passed
- `npm.cmd --prefix front-end audit --omit=dev`: 0 vulnerabilities
- `npm.cmd --prefix back-end audit --omit=dev`: 0 vulnerabilities
- GitHub CI latest checked run: success
- GitHub Deploy latest checked run: failure
- `rg -n "playwright|e2e|cypress|@playwright/test|test:e2e" -S .`: no matches

## Feature Checklist

| Requirement | Status | Evidence | Gap |
|---|---:|---|---|
| CRUD ข้อมูลร้านแบบ UI เต็ม | Partial | UI fields in `front-end/src/App.tsx`; backend `GET/PATCH /api/store/current` in `back-end/src/modules/stores/store.routes.ts`; tests in `store.routes.test.ts` | No full create/delete store workflow. UI edits only local state and does not save to backend. |
| CRUD ผู้ใช้เต็มระบบ | Partial | Backend `GET/POST/PATCH/DELETE /api/users`; tests in `pos-mvp.routes.test.ts` | UI can add/deactivate local users only. No backend-connected user list, edit password, edit role/status form, delete confirmation, or E2E coverage. |
| CRUD สินค้า | Partial | Backend list/create/update in `product.routes.ts`; UI create form in `App.tsx`; tests in `pos-mvp.routes.test.ts` | No product delete/deactivate route. UI has no edit/delete action and does not call backend. |
| Upload รูปสินค้าไป Cloudinary | Partial | Backend upload endpoint and `cloudinary.service.ts`; API test checks Cloudinary metadata stub | UI file input is not wired to upload. No real Cloudinary integration test or E2E upload flow. |
| รับของเข้า store | Partial | Backend `/api/inventory/receive`; API test verifies stock increase | UI has local `รับ +1` button only and does not call backend. |
| ตรวจนับ stock | Partial | Backend `/api/inventory/count`; API test verifies stock count adjustment | UI only has fixed local `นับเป็น 20`, no counted quantity input or backend call. |
| Export inventory Excel | Partial | Backend `/api/inventory/export.xlsx`; custom styled XLSX helper in `shared/excel/workbook.ts`; API test verifies binary xlsx response | UI link does not attach auth token, so protected export will fail from real logged-in frontend until download auth is implemented. |
| POS checkout / scan barcode | Partial | Backend `/api/sales/checkout`; frontend scan/cart local flow; API and component tests cover happy path | Frontend checkout does not call backend. No scanner focus handling, duplicate barcode ergonomics, receipt persistence, or E2E. |
| ตัดสต็อกตอนขาย | Partial | Backend checkout calls inventory adjustment; API test verifies stock drops from 10 to 7 | Persistence is in-memory only. Frontend stock deduction is local state only. |
| ใบเสร็จ / print receipt | Partial | Backend `/api/sales/:id/receipt`; frontend receipt panel calls `window.print()` | No print layout E2E/PDF verification. Frontend receipt is from local sale, not backend sale. |
| รายงานยอดขาย | Partial | Backend `/api/reports/sales`; API test verifies summary by date range | Frontend date fields are not wired to backend report query. No daily/monthly presets. |
| Dashboard สินค้าขายดี / ช่วงเวลาขายดี | Partial | Backend `/api/reports/dashboard`; API test verifies best seller and hour slot | Frontend dashboard uses only last local sale and hardcoded time text. No real range filter. |
| Export report Excel แบบจัดหน้า | Partial | Backend `/api/reports/export.xlsx`; styled xlsx helper; API test verifies binary xlsx response | UI link does not attach auth token and is not wired to selected date range. |
| Deploy production จริง | Not complete | GitHub CI succeeds; `docs/deploy-status.md` records deploy failures | Missing GitHub Secrets. Backend Express `app.listen()` is not yet a Cloudflare Worker `fetch()` entry point. |
| Unit test ทุก feature | Partial | 20 total tests pass; backend MVP API flow covers many features | Tests are broad happy-path flows, not every feature/edge case. UI CRUD, upload, export auth, report filters, and print are under-tested. |
| E2E test ทุก feature | Not complete | No e2e/playwright/cypress files or scripts found | Need Playwright or equivalent e2e suite covering login, store, users, products, upload, inventory, POS, receipt, reports, dashboard, export, responsive behavior. |

## Test Coverage Inventory

Current unit/component/API tests:

- `front-end/src/App.test.tsx`
  - verifies requested module headings are visible
  - verifies local barcode checkout flow updates receipt and local stock
- `front-end/src/features/auth/LoginPage.test.tsx`
  - basic login page render/behavior
- `front-end/src/features/store/StoreSettingsPage.test.tsx`
  - static store settings field render
- `back-end/src/__tests__/health.test.ts`
  - health endpoint
- `back-end/src/modules/auth/*.test.ts`
  - password hashing, login success/failure
- `back-end/src/modules/stores/store.routes.test.ts`
  - auth/role behavior for reading/updating store
- `back-end/src/modules/users/seed-admin.test.ts`
  - initial admin seed
- `back-end/src/modules/pos-mvp.routes.test.ts`
  - broad API happy paths for users, products, image metadata, inventory,
    checkout, stock deduction, receipt, reports, dashboard, Excel export

Missing E2E tests:

- Login with `admin/admin`
- Store edit/save/reload
- User create/edit/password/status/delete
- Product create/edit/delete/image upload
- Inventory receive/count/export download
- POS scan/cart/checkout/stock deduction
- Receipt print view
- Sales report date/month range
- Dashboard range filters
- Report Excel download
- Mobile/tablet responsive workflow

## Production Readiness Gaps

1. Replace in-memory repository usage in API routes with Prisma/Turso-backed
   persistence.
2. Convert backend runtime to Cloudflare Workers:
   - add Worker-compatible `fetch(request, env, ctx)` entry point, or
   - switch backend deployment target to a Node-compatible host.
3. Configure GitHub Secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `VITE_API_BASE_URL`
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Configure Worker runtime secrets/vars:
   - `JWT_SECRET`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CLOUDINARY_UPLOAD_FOLDER`
5. Add frontend API client support for auth token, GET/PATCH/DELETE, binary
   downloads, and upload.
6. Replace local frontend state demo flows with backend-connected data loading
   and mutation flows.
7. Add full Playwright E2E suite and CI job.

## Recommended Next Slice

Next implementation slice should focus on making the system genuinely
end-to-end instead of adding more local UI behavior:

1. Add API client with auth token and binary download support.
2. Connect frontend Store/User/Product/Inventory/POS/Reports screens to backend.
3. Add Playwright E2E tests for the connected workflows.
4. Convert backend persistence from in-memory repository to Prisma/Turso.
5. Convert backend runtime to Cloudflare Worker-compatible handler.
6. Re-run deploy after GitHub Secrets are added.
