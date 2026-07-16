# แก้ไขตำแหน่งหัวคอลัมน์ตาราง "ตรวจนับ stock" (Stock Counting) — Desktop & iPad

**Date**: 2026-07-16
**Scope**: `front-end/src/features/inventory/StockCountingPage.tsx` + `front-end/src/styles.css`
**Severity**: Medium (UX issue — table headers ไม่กระจายเต็มความกว้าง container)

## 1. ปัญหา (Problem Statement)

จาก screenshot ของ user ที่ `/inventory/counting` (desktop 1280px):

- หัวคอลัมน์ตาราง "ตรวจนับ stock" อยู่ทางขวาของ container
- พื้นที่ซ้ายของตารางว่างเปล่า
- แสดง "ยังคอลัมน์: อันดับ สินค้า BARCODE หน่วย คงเหลือในระบบ นับได้ ผลต่าง จัดการ" แต่เริ่มที่ ~50% ของความกว้าง
- iPad (744-1366px) น่าจะเจอปัญหาเดียวกันเพราะใช้ CSS rules ชุดเดียวกัน (มี `align-self: start` ที่ไม่ขึ้นกับ viewport)

## 2. Root Cause Analysis

### 2.1 DOM Structure (StockCountingPage.tsx)
```tsx
<div className="stock-counting-workspace">   {/* flex column, width: 100% */}
  <div className="stock-counting-page-header">...</div>
  <div className="stock-counting-summary-grid">...</div>
  <div className="stock-counting-tabs">...</div>
  <div className="receiving-queue-panel-full stock-counting-queue-panel">  {/* ← ปัญหา */}
    <div className="receiving-table-wrap receiving-table-wrap-full stock-counting-queue-table-wrap">
      <table className="receiving-table">...</table>
    </div>
  </div>
  <div className="receiving-history-panel stock-counting-history-panel">...</div>
</div>
```

### 2.2 CSS Rules ที่เกี่ยวข้อง (styles.css)

**Rule A** — `.stock-counting-workspace` (line 1586-1591):
```css
.stock-counting-workspace {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}
```

**Rule B** — `.stock-counting-queue-panel` (line 1598-1601):
```css
.stock-counting-workspace .stock-counting-queue-panel {
  align-content: start;
  align-self: start;   /* ← ปัญหาหลัก */
}
```

**Rule C** — `.receiving-table` base (line 1275-1276):
```css
.receiving-table {
  min-width: 760px;
}
```

**Rule D** — `.stock-counting-workspace .receiving-table-wrap-full .receiving-table` (line 1652-1655):
```css
.stock-counting-workspace .receiving-table-wrap-full .receiving-table {
  table-layout: fixed;
  width: 100%;
}
```

**Rule E** — Media query `max-width: 1280px` (line 4294-4296):
```css
@media (max-width: 1280px) {
  table {
    min-width: 0;   /* ← override min-width: 760px */
  }
  /* ... + column-specific overrides for stock counting */
}
```

### 2.3 ปัญหา (Cascading Effects)

1. **`.stock-counting-workspace`** เป็น flex column
   - default `align-items: stretch` → children stretch เต็ม cross axis (horizontal)
2. **`.stock-counting-queue-panel`** มี `align-self: start` (Rule B)
   - override default stretch → **panel ไม่ stretch**
   - panel width = max(content widths) = max child width
3. **`.receiving-table-wrap-full`** มี `width: 100%`
   - แต่ parent (panel) ไม่ stretch → wrap ก็ไม่ stretch
4. **`.receiving-table`** มี `width: 100%` + `table-layout: fixed`
   - table ใช้ width เท่ากับ wrap (ซึ่งแคบ)
5. **Column (1) "อันดับ"** ไม่มี width fix → เป็น `auto`
   - เมื่อ table layout fixed: auto column = remaining space
   - แต่ wrap แคบ (เพราะ panel ไม่ stretch) → remaining space น้อย
6. **ผลรวม**: table ดูเล็ก + อยู่ฝั่งซ้ายของ panel — แต่เนื่องจาก panel align-self: start = left, table เริ่มจาก left edge ของ panel

**ตัวปัญหาหลัก**: `align-self: start` (Rule B) → cascade ทำให้ table ไม่เต็ม container

## 3. แผนการแก้ไข (Plan)

### Task 1: ลบ `align-self: start` ออกจาก `.stock-counting-queue-panel`

**ไฟล์**: `front-end/src/styles.css` (line 1598-1601)

**Before**:
```css
.stock-counting-workspace .stock-counting-queue-panel {
  align-content: start;
  align-self: start;   /* ← ลบ */
}
```

**After**:
```css
.stock-counting-workspace .stock-counting-queue-panel {
  align-content: start;
  /* align-self: stretch เป็น default ของ flex children ใน column flex
     ทำให้ panel ขยายเต็มความกว้างของ .stock-counting-workspace */
}
```

**ผลที่คาดหวัง**:
- Panel ขยายเต็ม flex parent width (default `align-self: stretch`)
- Wrap ขยายเต็ม panel (width: 100%)
- Table ขยายเต็ม wrap (width: 100% + table-layout: fixed)
- Column (1) "อันดับ" (auto) ขยายเต็ม remaining space
- หัวคอลัมน์กระจายเต็มความกว้าง container

### Task 2: ตรวจสอบไม่ให้กระทบส่วนอื่น (Regression)

**ตรวจสอบ**:
1. `.stock-counting-history-panel` ไม่มี `align-self: start` → ไม่กระทบ
2. `.receiving-queue-panel` (parent class) ไม่มี align-self → ไม่กระทบ
3. หน้าอื่นๆ (InventoryReceivingPage, etc.) ไม่ใช้ `.stock-counting-queue-panel` class → ไม่กระทบ

### Task 3: ทดสอบ Responsive (iPad 744-1366px + Desktop > 1280px)

**Test Cases**:
1. **Desktop 1280px**: เปิด `/inventory/counting` → ตรวจ table headers กระจายเต็ม
2. **Desktop 1440px**: เปิด `/inventory/counting` → ตรวจ table headers กระจายเต็ม
3. **iPad 820px portrait** (iPad 10.9"): เปิด `/inventory/counting` → ตรวจ table headers กระจายเต็ม (column 3, 4 ถูกซ่อน)
4. **iPad 1180px landscape** (iPad 10.9"): เปิด `/inventory/counting` → ตรวจ table headers กระจายเต็ม
5. **Mobile 375px**: ตรวจ table ใช้ horizontal scroll ได้ปกติ

### Task 4: ทดสอบในเบราว์เซอร์ (Verification)

ใช้ Chrome DevTools:
1. เปิด `http://localhost:5173/inventory/counting`
2. Resize viewport ตาม test cases
3. Screenshot ทุกขนาด
4. ตรวจ horizontal overflow, column alignment

### Task 5: Regression Test

```bash
npx tsc --noEmit   # ต้องผ่าน
npx eslint src/features/inventory/StockCountingPage.tsx   # ต้องผ่าน
npx vitest run src/features/inventory/   # ตรวจ test เดิมยังผ่าน (3 Tabs tests เป็น pre-existing failure)
```

### Task 6: Commit + Push

```bash
git add front-end/src/styles.css
git commit -F "commit_msg.txt"
git push origin main
```

## 4. ความเสี่ยง (Risk Assessment)

| ความเสี่ยง | ระดับ | การลดความเสี่ยง |
|------------|--------|------------------|
| กระทบ layout อื่นใน `.stock-counting-workspace` | Low | `.stock-counting-queue-panel` เป็น class เฉพาะ, ไม่ share กับ element อื่น |
| กระทบ iPad layout (744-1366px) | Low | iPad ใช้ column widths fix + hide (3, 4) — `align-self: stretch` ไม่กระทบ column widths |
| กระทบ mobile layout (≤ 720px) | Very Low | mobile ใช้ grid-template-columns: 1fr ทั้งหมด — ไม่มี flex column |
| Regression ใน tests | Low | ไม่มี test ที่ assert panel width; pre-existing 3 Tabs failures ไม่เกี่ยว |

## 5. การยืนยัน (Verification Checklist)

- [ ] Desktop 1280px: หัวคอลัมน์กระจายเต็ม
- [ ] Desktop 1440px: หัวคอลัมน์กระจายเต็ม
- [ ] iPad 820px portrait: หัวคอลัมน์กระจายเต็ม (column 3, 4 ซ่อน)
- [ ] iPad 1180px landscape: หัวคอลัมน์กระจายเต็ม
- [ ] Mobile 375px: ตาราง scroll แนวนอนได้ปกติ
- [ ] tsc --noEmit ผ่าน
- [ ] vitest PosCheckoutPage ผ่าน 37/37
- [ ] vitest ทั้ง suite ไม่เพิ่ม failure ใหม่ (3 inventory Tabs + 1 App pre-existing)
- [ ] Commit + push สำเร็จ
