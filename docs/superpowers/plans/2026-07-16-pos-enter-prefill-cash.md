# POS: Pre-fill "จ่ายพอดี" + select เมื่อ Enter จาก scan field

Date: 2026-07-16

## Goal

ทำให้ workflow "กด Enter ที่ scan → focus + pre-fill + select เงินที่รับ" ทำงาน
**เชื่อถือได้ 100%** ทุก browser (รวม iOS Safari และ `<input type="number">`)
และมี **visual feedback** ว่าตัวเลข "จ่ายพอดี" ถูกคลุม/เลือกไว้ พร้อมให้แคชเชียร์
พิมพ์ตัวเลขที่ลูกค้าจ่ายจริงทับได้ทันที

### Workflow ที่ต้องการ

1. แคชเชียร์สแกนสินค้าครบ
2. กด Enter ที่ scan field (ไม่สแกนอะไรเพิ่ม)
3. **Focus** ย้ายมาที่ input "จำนวนเงินที่รับ"
4. **Pre-fill** ด้วยยอดรวมตะกร้า (จ่ายพอดี)
5. **Text selected** ทั้งหมด พร้อม visual highlight เป็นสี/พื้นหลัง
6. แคชเชียร์พิมพ์ตัวเลขที่ลูกค้าจ่ายจริง → ตัวเลขที่ถูกเลือกถูกแทนที่
   (หรือกด Enter อีกครั้งเพื่อ checkout แบบจ่ายพอดี)

## Constraints

- ต้องไม่กระทบ scanner workflow ปัจจุบัน — scanner Enter ต้องถูก consume
  และ focus ต้องอยู่ที่ scan field เสมอ
- ต้องทำงานบนทั้ง desktop (mouse/keyboard) และ iPad/touch (number pad)
- ไม่เปลี่ยน behavior เมื่อ cart ว่าง — ให้ focus กลับมาที่ scan field
- ต้องไม่กระทบ "จ่ายพอดี" button click ที่มีอยู่แล้ว (เรียก `setCashReceived(cartTotal)`
  + `focusCashReceivedInput()` อยู่แล้ว)
- ไม่เปลี่ยน data flow / API

## Current State

โค้ดปัจจุบันแยก Enter ได้หลายกรณี แต่มีช่องโหว่ที่ต้องเสริม:

### Enter State Machine (4 กรณี)

โฟกัสและ behavior ขึ้นกับบริบทของ Enter:

| # | Trigger | ตอนนี้ | ต้องการ |
| --- | --- | --- | --- |
| 1 | **Scanner Enter** (barcode scanner ส่ง Enter ต่อท้าย) | consume, focus อยู่ที่ scan | consume, focus อยู่ที่ scan ✓ |
| 2 | **Dropdown Enter** (พิมพ์ชื่อ + Enter เพื่อเลือกสินค้าจาก dropdown) | focus อยู่ที่ scan (เพราะ `hasCartItemsRef` ยัง false ใน event tick เดียวกัน) | focus อยู่ที่ scan ✓ |
| 3 | **Manual Enter + cart มีสินค้า** (กด Enter บน scan field เปล่า) | `setCashReceived(cartTotal)` + `focusCashReceivedInput()` | `setCashReceived(cartTotal)` + `focus + select ทั้งหมด` + visual highlight |
| 4 | **Manual Enter + cart ว่าง** (กด Enter บน scan field เปล่า แต่ไม่มีสินค้า) | `selectProductQuery()` (focus อยู่ scan, select all) | เหมือนเดิม ✓ |

### ปัญหา 3 จุด

#### 1. Manual Enter on scan → pre-fill ทำงาน แต่ select ไม่เสถียร

[PosCheckoutPage.tsx#L702-L707](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.tsx#L702-L707):

```ts
if (hasCartItemsRef.current) {
  setCashReceived(cartTotalRef.current)
  focusCashReceivedInput()
} else {
  selectProductQuery()
}
```

`focusCashReceivedInput` ที่ [L527-L530](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.tsx#L527-L530):

```ts
function focusCashReceivedInput() {
  cashReceivedInputRef.current?.focus()
  cashReceivedInputRef.current?.select()
}
```

#### 2. ปัญหา: `.select()` timing บน `<input type="number">`

ใน Firefox/Safari และ iOS Safari โดยเฉพาะ การเรียก `.select()` ทันทีหลัง
`.focus()` มักจะไม่เลือกข้อความ — focus event ยังไม่ settle ทำให้ selection
ถูก override โดย default behavior ของ browser

**Fix มาตรฐาน:** ห่อด้วย `requestAnimationFrame` หรือ `setTimeout(0)`

#### 3. ไม่มี visual feedback

ปัจจุบัน input "จำนวนเงินที่รับ" ไม่มี class/attribute เพื่อบอกว่า "ตอนนี้ถูก pre-fill
ด้วยจ่ายพอดี" — แคชเชียร์ต้องเดาเองว่าตัวเลขนั้นคือยอดรวม หรือเป็น default 100

#### 4. Test coverage ไม่ครอบ pre-fill + select + dropdown Enter

[Test ที่ L534-L561](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.test.tsx#L534-L561)
ตรวจแค่ focus ย้ายไป cash input แต่ไม่ตรวจว่า:
- input value ตรงกับยอดรวมตะกร้า
- text ถูก select ทั้งหมด (selectionStart = 0, selectionEnd = length)
- **Dropdown Enter** ไม่ย้าย focus ไป cash (case #2)

## Approach

### Task 1: Strengthen `focusCashReceivedInput` ให้ select ทันที

ใช้ `requestAnimationFrame` ห่อ `.select()` เพื่อให้ browser settle focus ก่อน

```ts
function focusCashReceivedInput() {
  const input = cashReceivedInputRef.current
  if (!input) return
  input.focus()
  // requestAnimationFrame ช่วยให้ browser เสร็จสิ้น focus cycle
  // ก่อนเริ่ม select — แก้ปัญหา Firefox/Safari ไม่ select text
  // บน <input type="number"> เมื่อเรียก .select() ทันทีหลัง .focus()
  requestAnimationFrame(() => {
    if (cashReceivedInputRef.current) {
      cashReceivedInputRef.current.select()
    }
  })
}
```

### Task 2: เพิ่ม visual state "covered"

- เพิ่ม `data-cash-covered` attribute ใน input:
  - `"exact"` เมื่อ value = cart total (จ่ายพอดี)
  - `"none"` หรือ absent เมื่อ value เป็น default/manual entry
- เพิ่ม CSS class `.cash-received-input[data-cash-covered="exact"]`:
  - background tint (เช่น green-50) เพื่อบอกว่า "คลุมด้วยจ่ายพอดี"
  - ไม่กระทบ readability ของตัวเลข

### Task 3: เพิ่ม tests ครอบ pre-fill + select + dropdown Enter

```ts
it('pre-fills cash input with the exact cart total and selects the text when Enter is pressed on scan field', async () => {
  // ... add product to cart
  // ... press Enter on scan field
  // expect: cash input value = cart total
  // expect: cash input selectionStart = 0, selectionEnd = length
  // expect: cash input data-cash-covered = "exact"
})

it('keeps focus on the scan field when Enter is used to select a product from the dropdown (manual mode)', async () => {
  // ... type partial name → dropdown shows
  // ... press Enter to select from dropdown
  // expect: cash input NOT focused
  // expect: scan field focused (continues to next product)
  // expect: pre-fill NOT triggered (cart items added but Enter is for product select, not payment)
})
```

### Task 4: Document workflow

เพิ่ม comment ใน code อธิบาย workflow และ state machine ของ Enter key

## Files to Modify

- `front-end/src/features/pos/PosCheckoutPage.tsx`
  - แก้ `focusCashReceivedInput` ใช้ `requestAnimationFrame` สำหรับ `.select()`
  - เพิ่ม `data-cash-covered` attribute ตาม state (exact vs manual)
  - เพิ่ม useEffect หรือ inline logic คำนวณ `isCashExact` (value === cart total)
- `front-end/src/styles.css`
  - เพิ่ม `.cash-received-input[data-cash-covered="exact"]` พร้อม background tint
- `front-end/src/features/pos/PosCheckoutPage.test.tsx`
  - เพิ่ม test ครอบ pre-fill + select behavior
  - เพิ่ม test ครอบ dropdown Enter ไม่ trigger pre-fill (case #2)
  - เพิ่ม test ครอบ `data-cash-covered` attribute

## Files NOT to Modify

- Backend — ไม่เกี่ยว
- "จ่ายพอดี" button — ทำงานเหมือนเดิม (เรียก `setCashReceived` + `focusCashReceivedInput`)
- Scanner Enter handling — ยังคง consume เหมือนเดิม
- API endpoints

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| `requestAnimationFrame` ภายใน test (jsdom) อาจไม่ flush ทันใน `waitFor` | ใช้ `await waitFor(() => expect(...selectionStart...))` รอจนกว่า RAF callback ทำงาน — vitest/jsdom flush RAF อัตโนมัติ |
| `data-cash-covered` attribute เปลี่ยน visual อาจกระทบ readability | ใช้ background tint บางๆ (เช่น #ecfdf5) ไม่กระทบ contrast |
| Cart total เปลี่ยนหลังจาก pre-fill (เช่น เพิ่มสินค้า) — `data-cash-covered` ไม่ update | ใช้ inline expression `cashReceived === cartTotal ? 'exact' : 'none'` ใน JSX เพื่อให้ sync ทุก render |
| Mobile (iOS) number pad ไม่ auto-replace selected text | ทดสอบบน iPad — ถ้าไม่ทำงาน อาจต้องใช้ `onFocus` handler ที่ select ทันที |
| `requestAnimationFrame` ใน jsdom ไม่ trigger ใน synchronous tests | ใช้ `await waitFor` ครอบการตรวจ selection — RAF จะ flush ก่อน assertion run |

## Done Criteria

- [ ] **Case 1 (Scanner Enter):** สแกน barcode → Enter จาก scanner → focus อยู่ที่ scan
      (consume), cart total ไม่ถูก pre-fill
- [ ] **Case 2 (Dropdown Enter):** พิมพ์ชื่อสินค้า + Enter เลือกจาก dropdown → focus อยู่ที่ scan,
      cart total **ไม่ถูก pre-fill** (เพราะ Enter ใช้เลือกสินค้า ไม่ใช่ยืนยัน)
- [ ] **Case 3 (Manual Enter + cart มีสินค้า):** กด Enter ที่ scan field (เปล่า) → cash input:
      - **focus** ย้ายมาทันที
      - **value** เท่ากับ cart total (เป็น "จ่ายพอดี")
      - **text** ถูก select ทั้งหมด (selectionStart = 0, selectionEnd = value.length)
      - **data-cash-covered="exact"** ปรากฏ
- [ ] **Case 4 (Manual Enter + cart ว่าง):** กด Enter ที่ scan field (เปล่า) → focus อยู่ที่ scan (select all)
- [ ] Visual: cash input มี background tint เขียวอ่อนเมื่อ `data-cash-covered="exact"`
- [ ] พิมพ์ตัวเลขใหม่ใน cash input → ตัวเลข "จ่ายพอดี" ถูกแทนที่ทันที
- [ ] แก้ไข cart (เพิ่ม/ลดสินค้า) → cash input ที่ pre-fill ไว้ไม่ update อัตโนมัติ
      (แคชเชียร์ต้องกด Enter ที่ scan field อีกครั้งเพื่อ refresh)
- [ ] ไม่กระทบ "จ่ายพอดี" button (ยังคงทำงานเหมือนเดิม)
- [ ] Tests ผ่าน (vitest) — ครอบ pre-fill + select + data-attribute + dropdown Enter
- [ ] `npm --prefix front-end run lint && tsc --noEmit && npm test` ผ่าน
- [ ] `ui:audit` ถ้า Chrome พร้อม — เช็ค visual highlight บน iPad

## Out of Scope

- ไม่เปลี่ยน scanner Enter consumption logic
- ไม่เพิ่ม auto-prefill หลัง scan ครั้งสุดท้าย (cashier ต้องกด Enter เอง)
- ไม่เปลี่ยน keyboard shortcuts อื่นๆ
- ไม่เพิ่ม keyboard hint/visual cue บน scan field
- ไม่เปลี่ยน data flow / API
