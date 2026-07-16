# POS: แจ้งเตือนเมื่อสแกนสินค้าที่หมด stock

Date: 2026-07-16

## Goal

ทำให้หน้า POS แจ้งเตือนทันทีเมื่อแคชเชียร์สแกน barcode ของสินค้าที่ `stockQuantity <= 0`
โดย **ไม่บล็อก flow การสแกน** (ไม่ต้องคลิก OK ก่อนสแกนต่อ), รักษากฎ
"scan field ต้องถูก focus เสมอ" และไม่ทำลายจังหวะการทำงานของแคชเชียร์

## Constraints

- ต้องไม่ขัดกับ POS Focus rule ใน project memory: scan field ต้องถูก focus
  เสมอ หาก focus หลุดไปยังจุดที่ไม่อนุญาตต้องดึงกลับมาทันที
- ห้ามใช้ blocking modal ทั้งใน scan และ manual path
- ใช้ SweetAlert2 (มีอยู่แล้วใน dependency) ใน `toast: true` mode สำหรับ
  non-blocking notification
- ใช้ Web Audio API สำหรับ beep (ไม่ต้องเพิ่ม asset) — ต้อง init `AudioContext`
  หลัง user gesture ครั้งแรก (autoplay policy) โดย init ตอน focus scan field
- ใช้สี/ข้อความภาษาไทยให้สอดคล้องกับ UI เดิมของ POS
- ไม่เพิ่ม API ใหม่ — ใช้ข้อมูลจาก `GET /products?view=operation` ที่มี `stockQuantity`
  อยู่แล้ว
- คงพฤติกรรมเดิมของ cart stock-check เช่น
  `product.stockQuantity < existingQuantity + 1` (เพิ่มของในตะกร้าเกิน stock)

## Current State

`addProductToCart` ใน
[PosCheckoutPage.tsx#L737-L753](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.tsx#L737-L753)
ทำงานเป็น **shared** สำหรับทั้ง scan และ manual:

- เมื่อ `product.stockQuantity <= 0`:
  - ตั้ง status pill เป็นข้อความ "สินค้า ... หมด stock"
  - เรียก `Swal.fire` แบบ modal ที่บล็อก
    (`allowEscapeKey: false, allowOutsideClick: false`)
  - รอให้ผู้ใช้คลิก OK แล้วค่อย refocus scan field
- ปัญหา:
  - ทุกครั้งที่สแกนสินค้าหมด แคชเชียร์ต้องคลิก OK ก่อนสแกนต่อ → เสียจังหวะ
  - Modal ทำให้ scanner ตัวถัดไปอาจถูกกลืนโดย focus handler
  - status pill ขนาดเล็ก ไม่เด่นชัดเท่าที่ควร

## Approach

เปลี่ยน notification เมื่อสินค้าหมดให้เป็น non-blocking ทั้ง **scan** และ
**manual** path ใช้กลไกร่วมกัน:

1. เพิ่มพารามิเตอร์ `source: 'scan' | 'manual'` ใน `addProductToCart`
2. จาก [handleProductQueryChange](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.tsx#L788-L806)
   เมื่อ match แบบ `barcode` exact match = ส่ง `'scan'`
3. จาก [handleProductSelect](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.tsx#L808-L822)
   (คลิกจาก dropdown) = ส่ง `'manual'`
4. เมื่อสินค้าหมด (ทั้งสอง path):
   - แสดง SweetAlert2 `toast: true` ที่มุมขวาบน หายเอง 2.5s
   - เพิ่ม class `pos-scan-bar-out-of-stock` ให้ scan bar 1.5s แล้วเอาออก
   - เปลี่ยน `status-pill` class เป็น `status-pill-error` (พื้นแดง ตัวขาว)
   - เล่นเสียง beep สั้นๆ (Web Audio API)
   - ไม่เรียก `await` → focus กลับมาที่ scan field ทันที
5. AudioContext init แบบ lazy ครั้งแรกที่ user focus scan field
   (ตอน `focusProductQuery` ใน click/keydown handler) เพื่อผ่าน autoplay policy

## Tasks

1. เพิ่ม `beepController` (AudioContext + OscillatorNode) ในไฟล์เดียวกัน
   พร้อม lazy init เมื่อ user focus scan field ครั้งแรก
2. เพิ่ม helper `notifyOutOfStock(product)` ที่:
   - `Swal.fire({ toast: true, position: 'top-end', timer: 2500, ... })`
   - trigger `beepController.play()`
   - ตั้ง state เพื่อใส่ class บน scan bar + status pill
3. แก้ `addProductToCart` ให้รับ `source` และเรียก `notifyOutOfStock`
   แทน `Swal.fire` blocking modal (ทั้ง scan และ manual branch)
4. อัปเดต callers ใน `handleProductQueryChange` และ `handleProductSelect`
5. เพิ่ม state `outOfStockFlash` + `useEffect` clear หลัง 1.5s
6. เพิ่ม CSS:
   - `.pos-scan-bar-out-of-stock` — แดง highlight + animation
   - `.status-pill.status-pill-error` — พื้นแดง ตัวขาว อ่านได้ทุก breakpoint
7. เขียน tests ใน [PosCheckoutPage.test.tsx](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.test.tsx)
8. ตรวจ responsive ด้วย `npm --prefix front-end run ui:audit` (ถ้า Chrome พร้อม)

## Files to Modify

- `front-end/src/features/pos/PosCheckoutPage.tsx`
  - เพิ่ม `beepController` (AudioContext + OscillatorNode)
  - เพิ่ม helper `notifyOutOfStock(product)` (toast + beep + flash)
  - เพิ่มพารามิเตอร์ `source` ใน `addProductToCart`
  - เพิ่ม state และ effect สำหรับ scan bar / status pill flash
  - แทน blocking `Swal.fire` ด้วย `notifyOutOfStock`
- `front-end/src/styles.css`
  - เพิ่ม `.pos-scan-bar-out-of-stock`
  - เพิ่ม `.status-pill.status-pill-error`
- `front-end/src/features/pos/PosCheckoutPage.test.tsx`
  - test: scan barcode สินค้า stock=0 → toast ถูกเรียก ไม่ใช่ modal block
  - test: scan แล้ว focus กลับมาที่ scan field ทันที
  - test: manual select สินค้า stock=0 → toast + beep, ไม่มี modal block
  - test: status pill แสดงข้อความ + เปลี่ยน class เป็น error
  - test: scan field flash class ถูกใส่และ clear หลัง 1.5s
  - test: beepController.play() ถูกเรียก (mock AudioContext)

## Files NOT to Modify

- Backend: scan ใช้ `GET /products?view=operation` ที่มี `stockQuantity` อยู่แล้ว
- `customerDisplay.ts` — ไม่ส่ง out-of-stock state ไป customer display
- Hold-bill / checkout flow — ไม่เกี่ยว

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| SweetAlert2 toast อาจถูก hold-bill modal บัง | ทดสอบร่วมกับ hold-bill flow, ปรับ `position` ถ้าจำเป็น |
| Status pill ขนาดเล็กบน mobile portrait อ่านยาก | ใช้ class `status-pill-error` ที่มีพื้นหลังเด่นชัด + font ใหญ่ขึ้นใน mobile |
| การ toggle class อาจ race กับ cart update | ใช้ `useEffect` ตาม `notice` แทน manual setTimeout ตรงๆ |
| Toast อาจ trigger focus handler กลับมาที่ scan field ซ้ำซ้อน | `Swal.fire({ toast: true })` ไม่ steal focus เหมือน modal |
| AudioContext autoplay policy block เสียง | init AudioContext แบบ lazy ครั้งแรกที่ user focus scan field (ผ่าน user gesture) |
| Oscillator ไม่ทำงานใน jsdom | ใช้ `vi.stubGlobal('AudioContext', ...)` ใน test และตรวจ `play()` ถูกเรียก |
| ผู้ใช้บางคนอาจปิดเสียงไว้ | เสียงเป็น feedback เสริม — ยังมี visual (toast + flash + status pill) ครบ |

## Done Criteria

- [ ] สแกน barcode สินค้าที่ stock=0 → toast แสดง 2.5s, scan field highlight แดง 1.5s,
      status pill เป็นสีแดง, เล่นเสียง beep, focus กลับมาที่ scan field ทันที
- [ ] คลิกสินค้าจาก dropdown (manual) ที่ stock=0 → toast + beep + flash เหมือน scan,
      ไม่มี modal block
- [ ] สแกน barcode สินค้าที่ stock=0 ซ้ำ 5 ครั้งติดกัน → แคชเชียร์สแกนต่อได้โดยไม่ต้องคลิก
- [ ] Tests ผ่าน (vitest) — ครอบทั้ง scan/manual, flash class, beep call
- [ ] `npm --prefix front-end run lint && npm --prefix front-end run typecheck && npm --prefix front-end test`
      ผ่านทั้งหมด
- [ ] `npm --prefix front-end run ui:audit` ผ่าน (ถ้า Chrome/Edge พร้อม) — เน้น
      iPad portrait/landscape, mobile portrait/landscape, desktop
- [ ] ไม่กระทบ responsive: status pill error อ่านได้ทุก breakpoint, toast ไม่ทับ scan field,
      เสียง beep ไม่ถูก block โดย autoplay policy (init หลัง first user gesture)

## Out of Scope

- ไม่เพิ่ม "ประวัติสินค้าหมดที่สแกนวันนี้" ในหน้า POS
- ไม่ใช้ไฟล์เสียง asset (พึ่ง Web Audio oscillator อย่างเดียว)
- ไม่เปลี่ยน API หรือ schema ฝั่ง backend
