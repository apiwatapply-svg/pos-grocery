# แผนการพัฒนา: ซิงโครไนซ์สินค้าจาก Google Sheet → SQL (CLI Script)

## วันที่
2026-07-22 (ปรับปรุงครั้งที่ 3)

## เป้าหมาย

สร้าง **CLI script** ที่ดึงข้อมูลจาก Google Sheet แล้วบันทึกลงฐานข้อมูล SQL (Turso) โดยตรง
ผู้ใช้รัน script ผ่าน terminal เท่านั้น ไม่มี UI/web involvement

> **ขอบเขต**: Backend script เท่านั้น ไม่แก้ไข frontend, ไม่เพิ่ม API endpoint, ไม่มี button/modal

## ข้อกำหนด

| # | ข้อกำหนด | คำตอบ |
|---|---------|------|
| 1 | รูปภาพ | ไม่สนใจ |
| 2 | Sync mode | ลบทั้งหมดแล้ว insert ใหม่ |
| 3 | Stock quantity | ไม่แตะ stock เดิม (restore จาก snapshot) |
| 4 | UI/Web | ไม่ต้องยุ่ง — CLI script เท่านั้น |
| 5 | Trigger | ผู้ใช้รันคำสั่งเองผ่าน terminal |

## Google Sheet

- **URL**: `https://docs.google.com/spreadsheets/d/1e9FiLD6rCKgLRgYO1aXE1bzsP-yKt9sLu2BHqTJTXTI/edit?pli=1&gid=0`
- **Sheet name**: `รายการสินค้า`
- **Permission**: "Anyone with the link = Editor" (ตั้งไว้แล้ว)
- **CSV Export URL**: `https://docs.google.com/spreadsheets/d/1e9FiLD6rCKgLRgYO1aXE1bzsP-yKt9sLu2BHqTJTXTI/export?format=csv&gid=0`

## โครงสร้าง Sheet

| Col | Header | แมปไปยัง Product |
|-----|--------|------------------|
| C | สินค้า | `Product.name` |
| D | จำนวน | `Product.stockQuantity` (เริ่มต้น) |
| E | บาร์โค้ด | `Product.barcode` (unique key) |
| F | หน่วย | `Product.unit` |
| G | ต้นทูนต่อ 1 หน่วย | `Product.costPriceSatang` (× 100) |
| I | ราคาขายต่อ 1 หน่วย | `Product.salePriceSatang` (× 100) |

---

## Phase 1: Database Schema

### 1.1 เพิ่ม `deletedAt` ใน Product Model

**ไฟล์: `back-end/prisma/schema.prisma`**

```prisma
model Product {
  id              String    @id
  storeId         String
  name            String
  barcode         String
  unit            String
  costPriceSatang Int
  salePriceSatang Int
  stockQuantity   Int       @default(0)
  status          String    @default("active")
  deletedAt       DateTime? // <-- เพิ่มใหม่
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([storeId, deletedAt])
  @@unique([storeId, barcode])
  // ... relations เดิม
}
```

**Migration:**
```bash
cd back-end
npx prisma migrate dev --name add-product-deletedAt
```

### 1.2 Update queries ที่มีอยู่

เพิ่ม `deletedAt: null` filter ใน queries ที่ list/get products:

| ไฟล์ | Function | เปลี่ยนแปลง |
|------|----------|------------|
| `prisma-user.repository.ts` | `listProducts` | + `deletedAt: null` |
| `prisma-user.repository.ts` | `findProductById` | + `deletedAt: null` |
| `prisma-user.repository.ts` | `adjustInventory` | + `deletedAt: null` |
| `prisma-user.repository.ts` | `addProductImage` | + `deletedAt: null` |
| `prisma-user.repository.ts` | `updateProduct` | + `deletedAt: null` |
| `prisma-user.repository.ts` | `listSaleSummaries` | + `product: { deletedAt: null }` |
| `prisma-user.repository.ts` | อื่นๆ ที่เกี่ยวข้อง | + `deletedAt: null` |

> ⚠️ ต้องตรวจสอบทุก query ที่อ่าน Product เพื่อไม่ให้กระทบระบบ POS

---

## Phase 2: Backend Service + Mapper

### 2.1 ไฟล์ใหม่

**ไฟล์: `back-end/src/modules/products/google-sheets.mapper.ts`**

```typescript
export type SheetsProductDraft = {
  rowNumber: number;
  name: string;
  barcode: string;
  unit: string;
  costPriceSatang: number;
  salePriceSatang: number;
  stockQuantity: number;
};

export function parseSheetsCsv(csvText: string): SheetsProductDraft[];
```

**ไฟล์: `back-end/src/modules/products/google-sheets.service.ts`**

```typescript
export async function fetchSheetsCsv(): Promise<string>;
export async function fetchSheetsDrafts(): Promise<SheetsProductDraft[]>;
```

### 2.2 ไฟล์ทดสอบ

- `back-end/src/modules/products/google-sheets.mapper.test.ts`
- `back-end/src/modules/products/google-sheets.service.test.ts`

---

## Phase 3: Repository Method

### 3.1 เพิ่มใน `UserRepository` interface

```typescript
googleSheetsSync(input: {
  storeId: string;
  userId: string;
  drafts: SheetsProductDraft[];
}): Promise<{
  total: number;
  deleted: number;
  created: number;
  results: Array<{
    rowNumber: number;
    barcode: string;
    name: string;
    status: 'created' | 'failed';
    error?: string;
  }>;
}>;
```

### 3.2 Implementation (Prisma)

```typescript
async googleSheetsSync(input) {
  return prisma.$transaction(async (tx) => {
    // Step 1: Snapshot existing stock by barcode
    const existing = await tx.product.findMany({
      where: { storeId: input.storeId, deletedAt: null },
      select: { barcode: true, stockQuantity: true },
    });
    const stockByBarcode = new Map(
      existing.map((p) => [p.barcode, p.stockQuantity]),
    );

    // Step 2: Soft delete all
    const deletedResult = await tx.product.updateMany({
      where: { storeId: input.storeId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Step 3: Insert from drafts
    let created = 0;
    let failed = 0;
    const results: SheetsSyncResultItem[] = [];

    for (const draft of input.drafts) {
      try {
        const stockQuantity = stockByBarcode.get(draft.barcode) ?? draft.stockQuantity;
        await tx.product.create({
          data: {
            storeId: input.storeId,
            name: draft.name,
            barcode: draft.barcode,
            unit: draft.unit,
            costPriceSatang: draft.costPriceSatang,
            salePriceSatang: draft.salePriceSatang,
            stockQuantity,
            status: 'active',
          },
        });
        created += 1;
        results.push({ ...draft, status: 'created' });
      } catch (error) {
        failed += 1;
        results.push({ ...draft, status: 'failed', error: error.message });
      }
    }

    return {
      total: input.drafts.length,
      deleted: deletedResult.count,
      created,
      results,
    };
  });
}
```

### 3.3 Implementation (In-Memory for tests)

เพิ่ม implementation ใน `createInMemoryUserRepository` ด้วย logic เดียวกัน

---

## Phase 4: CLI Script

### 4.1 ไฟล์: `back-end/scripts/sync-products-from-sheets.ts`

```typescript
import { config } from "dotenv";
config({ path: ".env" });

import { fetchSheetsDrafts } from "../src/modules/products/google-sheets.service.ts";
import { createPrismaUserRepository } from "../src/modules/users/prisma-user.repository.ts";
import { env } from "../src/config/env.ts";

async function main() {
  console.log("🔄 Starting product sync from Google Sheet...\n");
  console.log(`📊 Sheet URL: ${env.GOOGLE_SHEETS_CSV_URL}\n`);

  // Step 1: Fetch + parse
  console.log("1️⃣  Fetching CSV from Google Sheet...");
  const drafts = await fetchSheetsDrafts();
  console.log(`   ✓ Parsed ${drafts.length} products\n`);

  if (drafts.length === 0) {
    console.log("⚠️  Sheet is empty. Nothing to sync.");
    return;
  }

  // Step 2: Sync to DB
  const repository = createPrismaUserRepository();
  const stores = await repository.listStores();
  
  if (stores.length === 0) {
    console.log("❌ No stores found in database");
    process.exit(1);
  }

  // Sync to all stores (or specific store from CLI arg)
  const targetStoreId = process.argv[2] ?? stores[0].id;
  console.log(`2️⃣  Syncing to store: ${targetStoreId}\n`);

  const summary = await repository.googleSheetsSync({
    storeId: targetStoreId,
    userId: "system", // system user
    drafts,
  });

  // Step 3: Print summary
  console.log("=" .repeat(50));
  console.log("📋 SYNC SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total rows in sheet:     ${summary.total}`);
  console.log(`Products soft-deleted:   ${summary.deleted}`);
  console.log(`Products created:        ${summary.created}`);
  console.log(`Failed:                  ${summary.total - summary.created}`);

  if (summary.results.some((r) => r.status === "failed")) {
    console.log("\n❌ FAILED ROWS:");
    summary.results
      .filter((r) => r.status === "failed")
      .forEach((r) => {
        console.log(`   Row ${r.rowNumber}: ${r.barcode} - ${r.error}`);
      });
  }

  console.log("\n✅ Sync completed successfully");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Sync failed:", error.message);
  process.exit(1);
});
```

### 4.2 เพิ่ม npm script

**ไฟล์: `back-end/package.json`**

```json
{
  "scripts": {
    "sync:sheets": "tsx scripts/sync-products-from-sheets.ts"
  }
}
```

### 4.3 วิธีใช้งาน

```bash
# Sync ไปยัง store แรก (default)
cd back-end
npm run sync:sheets

# Sync ไปยัง store ที่ระบุ
npm run sync:sheets store_abc123
```

### 4.4 Output ตัวอย่าง

```
🔄 Starting product sync from Google Sheet...

📊 Sheet URL: https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0

1️⃣  Fetching CSV from Google Sheet...
   ✓ Parsed 18 products

2️⃣  Syncing to store: store_abc123

==================================================
📋 SYNC SUMMARY
==================================================
Total rows in sheet:     18
Products soft-deleted:   15
Products created:        18
Failed:                  0

✅ Sync completed successfully
```

---

## Phase 5: Env Vars

**ไฟล์: `back-end/.env.example`** เพิ่ม:

```bash
# Google Sheets sync (run via `npm run sync:sheets`)
GOOGLE_SHEETS_CSV_URL=https://docs.google.com/spreadsheets/d/1e9FiLD6rCKgLRgYO1aXE1bzsP-yKt9sLu2BHqTJTXTI/export?format=csv&gid=0
```

**ไฟล์: `back-end/.env`** เพิ่ม (local only):

```bash
GOOGLE_SHEETS_CSV_URL=https://docs.google.com/spreadsheets/d/1e9FiLD6rCKgLRgYO1aXE1bzsP-yKt9sLu2BHqTJTXTI/export?format=csv&gid=0
```

**ไฟล์: `back-end/src/config/env.ts`** เพิ่ม field:

```typescript
GOOGLE_SHEETS_CSV_URL: z.string().optional(),
```

---

## Phase 6: Tests

### 6.1 Unit Tests

**`back-end/src/modules/products/google-sheets.mapper.test.ts`**
- ✅ parseSheetsCsv() — parse ครบทุก column
- ✅ parseSheetsCsv() — skip empty rows
- ✅ parseSheetsCsv() — throw error เมื่อ barcode ว่าง
- ✅ parseSheetsCsv() — แปลงบาท → satang
- ✅ parseSheetsCsv() — throw error เมื่อ header ผิด

**`back-end/src/modules/products/google-sheets.service.test.ts`**
- ✅ fetchSheetsCsv() — fetch สำเร็จ
- ✅ fetchSheetsCsv() — throw เมื่อ URL ไม่ตั้งค่า
- ✅ fetchSheetsCsv() — throw เมื่อ 403

### 6.2 Integration Tests (Repository)

**`back-end/src/modules/users/google-sheets-sync.test.ts`**
- ✅ googleSheetsSync() — soft delete + insert all
- ✅ googleSheetsSync() — preserve stockQuantity for matching barcode
- ✅ googleSheetsSync() — empty drafts → no change
- ✅ googleSheetsSync() — partial failure (1 row invalid) → others succeed

### 6.3 Manual Tests

```bash
# 1. Setup: เพิ่ม GOOGLE_SHEETS_CSV_URL ใน .env
# 2. Run migration
cd back-end
npx prisma migrate dev --name add-product-deletedAt

# 3. Run sync
npm run sync:sheets

# 4. ตรวจสอบ
# - ดู product list บนหน้า Product
# - ตรวจสอบ stock เดิมถูกรักษาไว้
# - ตรวจสอบ Sales history ยังอยู่ครบ
```

---

## ไฟล์ที่ต้องสร้าง/แก้ไข

### Backend (ใหม่)
- `back-end/src/modules/products/google-sheets.mapper.ts`
- `back-end/src/modules/products/google-sheets.service.ts`
- `back-end/scripts/sync-products-from-sheets.ts`
- Tests: `google-sheets.{mapper,service}.test.ts`, `google-sheets-sync.test.ts`

### Backend (แก้ไข)
- `back-end/prisma/schema.prisma` — เพิ่ม `deletedAt` field
- `back-end/src/modules/users/user.repository.ts` — เพิ่ม `googleSheetsSync()` interface
- `back-end/src/modules/users/prisma-user.repository.ts` — implementation + เพิ่ม `deletedAt: null` filter
- `back-end/src/config/env.ts` — เพิ่ม `GOOGLE_SHEETS_CSV_URL`
- `back-end/.env.example` — document env var
- `back-end/package.json` — เพิ่ม script `sync:sheets`

### Migration
- `back-end/prisma/migrations/xxx_add_product_deletedAt/migration.sql`

### Frontend
- **ไม่แก้ไขใดๆ** — ตามที่ผู้ใช้ต้องการ

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| ลบ product เดิมโดยไม่ตั้งใจ | ผู้ใช้สูญเสียข้อมูล | ใช้ soft delete (`deletedAt`) แทน hard delete |
| Sales records มี FK ไป product เก่า | ถ้า hard delete → broken FK | Soft delete รักษา FK |
| Stock เดิมหาย | ผู้ใช้สูญเสียข้อมูล | Snapshot ก่อน soft delete + restore หลัง insert |
| Sheet มี duplicate barcode | Insert ซ้ำ → unique violation | Validate + log error |
| Google เปลี่ยน CSV URL | fetch ล้มเหลว | แสดง error ที่ user เข้าใจ |
| Google Sheet โดนแก้ระหว่าง sync | ข้อมูลไม่ consistent | ดึง CSV 1 ครั้งก่อน insert |
| Script crash กลางทาง | Partial state | ใช้ `prisma.$transaction` |

---

## Next Steps

1. ✅ ผู้ใช้ยืนยันแผน: CLI script เท่านั้น ไม่แตะ web
2. → Phase 1: เพิ่ม `deletedAt` + migration
3. → Phase 2: สร้าง service + mapper
4. → Phase 3: Repository method
5. → Phase 4: CLI script
6. → Phase 5: Env vars
7. → Phase 6: Tests
8. → Commit + push

## สิ่งที่ต้องเตรียมก่อน Production

| รายการ | สถานะ |
|-------|-------|
| Google Sheet "รายการสินค้า" | ✅ พร้อมแล้ว |
| `GOOGLE_SHEETS_CSV_URL` ใน `.env` | ต้องเพิ่มก่อนรัน |
| Prisma migration สำหรับ `deletedAt` | ต้อง run |
| ตรวจสอบ product queries อื่นๆ ที่อาจกระทบ | ต้องตรวจสอบ |
