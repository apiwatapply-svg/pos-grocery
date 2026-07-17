# แก้ไข Modal "รายการบิลที่พัก" ปุ่ม "ลบ" ล้นออกนอก Modal (Desktop & iPad)

**Date**: 2026-07-16
**Scope**: `front-end/src/styles.css` (เท่านั้น)
**Severity**: Medium (UX — actions ออกนอกกรอบ modal, กดไม่ได้บางส่วน)

## 1. ปัญหา (Problem Statement)

จาก screenshot ของ user (modal `รายการบิลที่พัก (1)`):

- ปุ่ม "เรียก" อยู่ในกรอบ modal
- ปุ่ม "ลบ" **ล้นออกนอก modal ทางขวา** (เห็นเฉพาะขอบซ้ายของปุ่ม "ลบ")
- เกิดบนเบราว์เซอร์จริงที่ viewport ระหว่าง iPad mini 7.9" (~768px) — modal ใช้ max-width 720px + padding 24px → เหลือพื้นที่ตาราง 672px
- column "จัดการ" ไม่มี explicit width → cell แคบ → ปุ่ม 2 ปุ่ม (เรียก + ลบ) + `white-space: nowrap` ทำให้ล้น

## 2. Root Cause Analysis

### 2.1 DOM Structure (PosCheckoutPage.tsx line 1606)
```tsx
<table className="held-bills-table" aria-label="รายการบิลที่พัก">
  <thead>
    <tr>
      <th>พักเมื่อ</th>
      <th>ชื่อบิล</th>
      <th>จำนวน</th>
      <th>ยอดรวม</th>
      <th>จัดการ</th>  {/* ← column auto width แคบ */}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td className="held-bills-row-actions">  {/* ← display: flex + white-space: nowrap */}
        <button className="resume-bill-row-button">เรียก</button>
        <button className="delete-held-bill-button">ลบ</button>
      </td>
    </tr>
  </tbody>
</table>
```

### 2.2 CSS Rules (styles.css)

**`.held-bills-modal`** (line 3509-3518):
```css
.held-bills-modal {
  ...
  max-width: 720px;
  padding: 20px 24px;
  width: min(96vw, 720px);
}
```
→ modal กว้าง 720px, content area 672px

**`.held-bills-table`** (line 3548-3552):
```css
.held-bills-table {
  border-collapse: collapse;
  font-size: 14px;
  width: 100%;
}
```
→ table ไม่มี `table-layout: fixed` → column auto size ตาม content

**`.held-bills-table .held-bills-row-actions`** (line 3568-3573):
```css
.held-bills-table .held-bills-row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  white-space: nowrap;  /* ← ปัญหา: ปุ่มไม่ wrap */
}
```

**`.resume-bill-row-button, .delete-held-bill-button`** (line 3575-3583):
```css
.resume-bill-row-button,
.delete-held-bill-button {
  ...
  padding: 5px 10px;
}
```
→ ปุ่มกว้าง ~50px ต่อปุ่ม + border = ~52px, 2 ปุ่ม + gap 6px = ~110px

### 2.3 ปัญหา (Cascading)

1. table `width: 100%` + `table-layout: auto` (default)
2. columns "พักเมื่อ", "ชื่อบิล", "จำนวน", "ยอดรวม" ใช้ content width
3. column "จัดการ" (auto) = remaining space
4. เมื่อ viewport ~ 768px:
   - modal = 720px
   - content = 672px
   - columns 1-4 รวม ~520px (พักเมื่อ ~110, ชื่อบิล ~150, จำนวน ~80, ยอดรวม ~120)
   - column 5 = ~152px → OK
5. **เมื่อ viewport เล็กลง หรือ content ยาวขึ้น** (เช่น "ลูกค้าประจำ" ยาวกว่า "-"):
   - columns 1-4 ใช้พื้นที่มากขึ้น
   - column 5 แคบลง < 110px
   - ปุ่ม 2 ปุ่ม + nowrap ล้นออกนอก cell

**ตัวปัญหาหลัก**: column "จัดการ" ไม่มี explicit width + ไม่มี `table-layout: fixed` → cell แคบเมื่อ content อื่นยาว

## 3. แผนการแก้ไข (Plan)

### Task 1: เพิ่ม `table-layout: fixed` + explicit column widths

**ไฟล์**: `front-end/src/styles.css` (line 3548-3552)

**Before**:
```css
.held-bills-table {
  border-collapse: collapse;
  font-size: 14px;
  width: 100%;
}
```

**After**:
```css
.held-bills-table {
  border-collapse: collapse;
  font-size: 14px;
  table-layout: fixed;  /* columns ใช้ explicit width ไม่ขยายตาม content */
  width: 100%;
}
```

### Task 2: เพิ่ม explicit column widths

**ไฟล์**: `front-end/src/styles.css` (เพิ่มหลัง `.held-bills-table` rule)

**After (Task 1+2)**:
```css
.held-bills-table {
  border-collapse: collapse;
  font-size: 14px;
  table-layout: fixed;
  width: 100%;
}

/* Column widths (table-layout: fixed requires explicit widths to allocate
   space predictably so the action buttons never overflow the modal). */
.held-bills-table colgroup col:nth-child(1) { width: 22%; }  /* พักเมื่อ */
.held-bills-table colgroup col:nth-child(2) { width: 28%; }  /* ชื่อบิล */
.held-bills-table colgroup col:nth-child(3) { width: 12%; }  /* จำนวน */
.held-bills-table colgroup col:nth-child(4) { width: 16%; }  /* ยอดรวม */
.held-bills-table colgroup col:nth-child(5) { width: 22%; }  /* จัดการ */
```

### Task 3: Force action cell to size correctly

**ไฟล์**: `front-end/src/styles.css` (line 3568-3573)

**Before**:
```css
.held-bills-table .held-bills-row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  white-space: nowrap;
}
```

**After**:
```css
.held-bills-table .held-bills-row-actions {
  display: flex;
  flex-wrap: wrap;  /* กันปุ่ม wrap ถ้า column แคบจริงๆ */
  gap: 6px;
  justify-content: flex-end;
  white-space: nowrap;
}
```

**ผลที่คาดหวัง**:
- columns ใช้ explicit width 22/28/12/16/22 = 100% → cell 5 ได้ 22% ของ 672px = ~148px > 110px (ปุ่ม 2 ปุ่ม)
- ถ้า content ยาวมาก (เช่น ชื่อบิลยาว) → text wrap ใน cell แต่ column width ไม่เปลี่ยน
- ปุ่ม "ลบ" ไม่ล้นออกนอก modal

### Task 4: Regression check

**ตรวจสอบ**:
- `.held-bills-table` ไม่ share กับ class อื่น (Grep ยืนยัน)
- `table-layout: fixed` ไม่กระทบ `.held-bills-table` ที่อื่น (class เฉพาะ)
- การเปลี่ยน column widths ไม่กระทบ mobile (mobile มี own rules)

### Task 5: ทดสอบ Responsive

ใช้ Playwright + screenshots:
1. **Desktop 1280px**: ปุ่ม "เรียก" + "ลบ" อยู่ในกรอบ
2. **Desktop 1366px**: ปุ่มอยู่ในกรอบ
3. **iPad 820 portrait**: ปุ่มอยู่ในกรอบ
4. **iPad 1180 landscape**: ปุ่มอยู่ในกรอบ
5. **Browser ~ 768px (iPad mini)**: ปุ่มอยู่ในกรอบ (เคสที่ user เจอ)

### Task 6: ทดสอบในเบราว์เซอร์

ใช้ Playwright script:
- `front-end/scripts/verify-held-bills-modal.mjs` (สร้างไว้แล้ว)
- เพิ่ม iPad mini 768x1024 viewport

### Task 7: Regression test

```bash
npx tsc --noEmit   # ต้องผ่าน (CSS ไม่กระทบ TS)
npx vitest run src/features/pos/   # ตรวจ PosCheckoutPage.test.tsx ผ่าน 37/37
```

### Task 8: Commit + Push

```bash
git add front-end/src/styles.css front-end/scripts/verify-held-bills-modal.mjs \
        docs/superpowers/plans/2026-07-16-held-bills-modal-overflow.md
git commit -F "commit_msg.txt"
git push origin main
```

## 4. ความเสี่ยง (Risk Assessment)

| ความเสี่ยง | ระดับ | การลดความเสี่ยง |
|------------|--------|------------------|
| กระทบ layout ตารางอื่น | Very Low | `.held-bills-table` เป็น class เฉพาะของ modal นี้ |
| column widths ไม่พอดี | Low | ใช้ % 22/28/12/16/22 ที่รวม 100% และ action column 22% = ~148px > 110px |
| Mobile (≤ 720px) | Very Low | mobile rules ใช้ grid-template-columns: 1fr แยก — table ไม่ใช้ |
| Test regression | Very Low | ไม่มี test ที่ assert table widths |

## 5. การยืนยัน (Verification Checklist)

- [ ] Desktop 1280: ปุ่ม "ลบ" อยู่ในกรอบ modal
- [ ] Desktop 1366: ปุ่ม "ลบ" อยู่ในกรอบ modal
- [ ] iPad 820 portrait: ปุ่มอยู่ในกรอบ
- [ ] iPad 1180 landscape: ปุ่มอยู่ในกรอบ
- [ ] iPad mini 768x1024: ปุ่มอยู่ในกรอบ (เคส user เจอ)
- [ ] tsc --noEmit ผ่าน
- [ ] vitest PosCheckoutPage ผ่าน 37/37
- [ ] vitest ทั้ง suite ไม่เพิ่ม failure
- [ ] Commit + push สำเร็จ
