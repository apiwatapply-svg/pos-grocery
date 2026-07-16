# POS: ล็อก scroll ทั้งหน้าบน iPad 10.9"/11"

Date: 2026-07-16

## Goal

บนหน้า POS เมื่อใช้บน iPad 10.9" (820×1180) และ iPad 11" (834×1190/1194) — ทั้ง
portrait และ landscape — ต้อง **ไม่สามารถเลื่อนขึ้น/ลงทั้งหน้าได้** แม้ iOS Safari
จะยัง momentum-scroll ได้แม้ `overflow: hidden` (ผู้ใช้เห็นว่าไม่มี scroll bar
แต่ยัง swipe ขึ้นลงได้) ขณะที่ **ช่องรายการสินค้า (`cart-table-wrap.pos-scroll-area`)
ยังเลื่อนขึ้นลงได้ปกติ** เพราะมี scroll ภายในของตัวเอง

## Constraints

- ล็อก **เฉพาะ iPad 10.9"-11"** (ทั้ง portrait และ landscape) — ไม่กระทบ:
  - Desktop (>= 1280px) — ใช้ mouse wheel ปกติ, ไม่ต้องล็อก
  - Mobile (<= 600px) — ปัจจุบัน page scroll ได้ตามธรรมชาติ
  - iPad Mini (744px CSS) และ iPad Pro 12.9" (>= 1024px portrait, 1366px landscape) —
    อยู่นอกขอบเขต
- ห้ามแตะ `cart-table-wrap.pos-scroll-area` — ต้องเลื่อนได้เหมือนเดิม
- ห้ามทำลาย modal (held-bills, receipt, clear-cart) — modal ต้อง scroll ภายใน
  ของมันเอง
- ห้ามทำลาย SearchableDropdown (สแกน dropdown) — dropdown เป็น
  `position: absolute` อยู่แล้ว
- ใช้ CSS-only approach — ไม่ต้องแก้ JSX/React state

## Current State

โครงสร้างปัจจุบัน (จาก [PosCheckoutPage.tsx#L1273-L1447](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/features/pos/PosCheckoutPage.tsx#L1273-L1447)):

```
section.route-page
  └ div.pos-workspace (overflow: hidden)
      └ section.pos-panel.pos-panel-large (overflow: hidden)
          ├ div.pos-panel-header
          ├ div.pos-scan-bar
          ├ div.cart-table-wrap.pos-scroll-area (overflow: auto, overscroll-behavior: contain)  ← scroll ได้
          └ div.pos-checkout-footer
```

CSS ที่ล็อกอยู่แล้ว:
- `body { height: 100%; overflow: hidden; }` ([styles.css#L14-L18](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/styles.css#L14-L18))
- `.app-layout { height: 100vh; overflow: hidden; }` ([styles.css#L5305-L5313](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/styles.css#L5305-L5313))
- `.route-content:has(> .route-page > .pos-workspace) { overflow: hidden; }`
  ([styles.css#L5576-L5580](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/styles.css#L5576-L5580))
- `.pos-workspace { overflow: hidden; }` ([styles.css#L844-L852](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/styles.css#L844-L852))
- `.pos-panel-large { overflow: hidden; }` ([styles.css#L876-L886](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/styles.css#L876-L886))
- `.cart-table-wrap { overflow: auto; overscroll-behavior: contain; }`
  ([styles.css#L2962-L2967](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/styles.css#L2962-L2967))

**ปัญหา:** iOS Safari มี 2 พฤติกรรมที่ทำให้ `overflow: hidden` ไม่พอ:
1. **`100vh` บน iOS = ความสูง "largest viewport"** (รวม URL bar) ไม่ใช่ "visible
   area" — เมื่อ URL bar collapse ทำให้ content สูงเกิน viewport → scroll ได้
2. **Momentum scroll ทะลุ `overflow: hidden`** — iOS Safari อนุญาตให้ swipe
   บน body แม้ body จะ `overflow: hidden` เพราะจัดการ rubber-band ที่ root

## Approach

CSS-only fix สำหรับ iPad range เท่านั้น:

1. **ใช้ `100dvh` (dynamic viewport height)** แทน `100vh` — ปรับตาม
   visible area จริงเมื่อ URL bar collapse
2. **เพิ่ม `overscroll-behavior: none` บน html, body, .app-layout** —
   ป้องกัน rubber-band/momentum ทะลุจาก root
3. **เพิ่ม `touch-action: pan-y` บน `.cart-table-wrap.pos-scroll-area`**
   — อนุญาตให้ touch scroll เฉพาะใน cart เท่านั้น
4. **ล็อกเฉพาะ media query ของ iPad 10.9"-11"** — ไม่กระทบ desktop/mobile

### Media query range

ใช้ `(width >= 744px) and (width <= 1366px)` ครอบคลุม **iPad ทุกขนาด**
ตามที่ผู้ใช้เลือก "ทั้งหมด":

- iPad Mini 7.9"/8.3" portrait: 744-768px ✓
- iPad 10.9" portrait: 820px ✓
- iPad 10.9" landscape: 1180px ✓
- iPad 11" portrait: 834px ✓
- iPad 11" / iPad Pro 11" landscape: 1190-1194px ✓
- iPad Pro 12.9" / iPad Air 13" portrait: 1024px ✓
- iPad Pro 12.9" landscape: 1366px ✓

**ตัดออก:**
- iPhone (375-430px) — นอก range
- Desktop (>= 1367px) — นอก range, ใช้ mouse wheel ปกติ
- Android tablet ขนาดเล็ก (< 744px) — นอก range

**หมายเหตุ:** media query นี้จะครอบ Android tablet ในช่วง 744-1366px ด้วย
โดยตั้งใจ — เป็นพฤติกรรมเดียวกันกับ iPad (หน้าจอ tablet แนวตั้งที่ content
อาจสูงเกิน viewport)

## Tasks

1. เพิ่ม `@media (min-width: 744px) and (max-width: 1366px)` block ใน
   [styles.css](file:///d:/ProjectAP/SecondBrain/projects/pos-grocery/front-end/src/styles.css)
   - Override `html, body` ให้ `height: 100%; overflow: hidden;
     overscroll-behavior: none;`
   - Override `.app-layout` ให้ `height: 100dvh; height: 100vh;
     overscroll-behavior: none; touch-action: none;`
   - Override `.route-content` และ `.route-page` ให้ยืนยัน `overflow: hidden`
   - ยืนยัน `.cart-table-wrap.pos-scroll-area` ยัง scroll ได้
     (`overflow: auto; overscroll-behavior: contain; touch-action: pan-y;`)
2. ตรวจสอบไม่กระทบ `.modal-content` และ `.searchable-dropdown-panel` —
   ทั้งคู่ `position: absolute/fixed` อยู่แล้ว ไม่ได้รับผลกระทบ
3. รัน lint + typecheck + tests
4. ถ้า Chrome/Playwright พร้อม — รัน `ui:audit` ตรวจ iPad portrait/landscape

## Files to Modify

- `front-end/src/styles.css`
  - เพิ่ม media query block ใหม่ (ประมาณ 25-30 บรรทัด) ไม่ลบ/แก้ของเดิม

## Files NOT to Modify

- `front-end/src/features/pos/PosCheckoutPage.tsx` — ไม่ต้องแก้ JSX
- Backend — ไม่เกี่ยว
- Tests — ไม่ต้องเพิ่ม unit test (visual/CSS test ไม่ครอบคลุม iOS Safari behavior;
  ใช้ manual QA + ui:audit แทน)

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| `100dvh` ไม่ support ใน iOS < 15.4 | fallback `100vh` ก่อน (CSS cascade) |
| `overscroll-behavior: none` ถูก ignore ใน iOS Safari < 16 | เพิ่ม `touch-action: none` บน `.app-layout` เป็น fallback |
| `touch-action: none` บน `.app-layout` อาจ block scroll ในทุก child | override `touch-action: pan-y` บน `.cart-table-wrap.pos-scroll-area` เพื่อให้ scroll ได้ |
| Modal/dropdown ไม่ scroll ได้ | ตรวจสอบ CSS: `.modal-content` ใช้ `overflow: auto` ของตัวเอง, `.searchable-dropdown-panel` ใช้ `position: absolute` — ไม่ได้รับผลกระทบจาก `touch-action: none` บน parent เพราะ override ได้ |
| ล็อกเฉพาะ iPad range อาจไม่ครอบ Android tablet | เจตนา: range 744-1366px ครอบ Android tablet ในช่วงเดียวกัน (พฤติกรรม iPad-like เหมือนกัน) |

## Done Criteria

- [ ] เปิด dev server, เปิด `http://localhost:5173/pos` บน iPad ทุกขนาด
      (Mini 744-768px, 10.9" 820-1180px, 11" 834-1190px, Pro 11" 834-1194px,
      Pro 12.9" 1024-1366px) → swipe ขึ้น/ลงที่ header/footer/พื้นที่ว่าง
      → **ไม่ scroll** ทั้งหน้า
- [ ] Cart มีสินค้า >= 8 รายการ → swipe ที่ cart → **scroll ได้** ภายใน cart เท่านั้น
- [ ] เปิด held-bills modal → modal แสดง + scroll ภายใน modal ได้
- [ ] เปิด SearchableDropdown (พิมพ์ใน scan field) → dropdown แสดง + scroll ได้
- [ ] Desktop (>= 1367px) → ทำงานเหมือนเดิม (mouse wheel scroll ตามปกติ)
- [ ] Mobile (375-743px) → ทำงานเหมือนเดิม (page scroll ได้)
- [ ] `npm --prefix front-end run lint && tsc --noEmit && npm test` ผ่าน
- [ ] `npm --prefix front-end run ui:audit` ถ้า Chrome พร้อม — เพิ่ม iPad
      ทุกขนาดเข้า device list ถ้ายังไม่มี

## Out of Scope

- ไม่แก้ desktop scroll behavior (>= 1367px)
- ไม่แก้ mobile scroll behavior (<= 743px)
- ไม่เปลี่ยน JSX ของ PosCheckoutPage
- ไม่เพิ่ม JavaScript scroll handler (pure CSS only)
- ไม่เปลี่ยน cart inner scroll behavior
- ไม่ล็อก receipt modal/held-bill modal (พวกนี้ `position: fixed` อยู่แล้ว)
