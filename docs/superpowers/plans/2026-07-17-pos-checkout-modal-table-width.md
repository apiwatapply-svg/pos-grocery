# POS Checkout Confirmation & Sale Success Modal Column Wrapping

## Date
2026-07-17

## Problem

The SweetAlert2 modals for the POS checkout confirmation ("ยืนยันรับชำระเงิน")
and the post-sale success summary ("บันทึกการขายเรียบร้อย") both render a 4-column
table built by `buildConfirmationHtml` and `buildSaleSummaryHtml` in
`front-end/src/features/pos/PosCheckoutPage.tsx`. The tables use inline `style`
attributes only — no `table-layout`, no `<colgroup>`, no explicit column widths.

When the modal renders at narrower viewports (iPad 768 / iPad 10.9" / mobile
375) the browser splits the "จำนวน" column header character-by-character
(`จำ / น / น`) because the column is squeezed between the long "สินค้า"
column and the right-aligned numeric columns. On desktop 1280 the same header
splits to two lines (`จำน / น`) which is also ugly but less broken.

### Reproduction

Run `node front-end/scripts/verify-pos-checkout-modals.mjs` against the
running dev servers. The script:

1. Stubs `/api/store/current`, `/api/products`, `/api/sales`, and
   `/api/sales/checkout` so the test does not need a real database.
2. Adds 4 products with long Thai names + barcodes to the cart.
3. Clicks "ชำระเงิน" → triggers the checkout confirmation Swal.
4. Clicks "ยืนยันขาย" → triggers the post-sale success Swal.
5. Screenshots both at desktop-1280, desktop-1366, ipad-mini-768,
   ipad-820-portrait (iPad 10.9"), ipad-1180-landscape, and mobile-375.

Visual issues captured (see `screenshots/pos-checkout-confirm-*.png` and
`screenshots/pos-sale-success-*.png`):

- All viewports: "จำนวน" header is split into multiple lines.
- mobile-375: header breaks to 3 lines (`จำ / น / น`).
- iPad 768 / 820: header breaks to 2 lines.
- desktop-1280: header still breaks to 2 lines (`จำน / น`).

## Root Cause

`buildConfirmationHtml` and `buildSaleSummaryHtml` build their tables from
template strings with inline `style` attributes only:

```html
<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
  <thead>
    <tr style="background:#eef2ed;">
      <th style="text-align:left;padding:6px 8px;font-size:12px;color:#4a5a50;">สินค้า</th>
      <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">จำนวน</th>
      <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">ราคา</th>
      <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">รวม</th>
    </tr>
  </thead>
  <tbody>...</tbody>
</table>
```

Without `table-layout: fixed` and a `<colgroup>`, the browser auto-sizes
columns based on cell content. The long product names force the
"สินค้า" column to take most of the width, leaving the numeric columns
very narrow. The "จำนวน" header is the longest Thai word among the
numeric columns, so the browser chooses to wrap its characters instead
of keeping it on a single line.

## Fix

Apply the same approach that fixed the held-bills modal in commit
`6bf768dd`:

1. Add a `<colgroup>` with explicit percentage widths to both tables so
   the browser always reserves enough room for each column.
2. Set `table-layout: fixed` so the widths are honored.
3. Set `word-break: break-word` and `overflow-wrap: break-word` on cells
   so long product names wrap nicely instead of overflowing.
4. Set `white-space: normal` on the header cells (default is `normal` for
   `<th>`, but make it explicit for clarity).
5. Give the "สินค้า" column a `min-width` of `0` so it can shrink when
   needed, but the header always reserves at least 60px for "จำนวน".

### Column widths

Adopt the same proportions as the held-bills modal for consistency:

| Column   | Width | Reason                                   |
| -------- | ----- | ---------------------------------------- |
| สินค้า   | 48%   | Long product names need the most space.  |
| จำนวน    | 12%   | Short header / single digit quantities.  |
| ราคา     | 18%   | "189.00" / "1,000.00" need room.         |
| รวม      | 22%   | Same as ราคา.                            |

## Files to change

- `front-end/src/features/pos/PosCheckoutPage.tsx`
  - `buildConfirmationHtml` — replace the inline-styled table with the
    fixed-layout version.
  - `buildSaleSummaryHtml` — same change.

No changes to `styles.css` are required because the styles are inline on
the `<table>` and `<col>` elements. Adding a global `.swal2-popup table`
rule is unnecessary and would risk affecting other modals in the future.

## Verification

1. Re-run `node front-end/scripts/verify-pos-checkout-modals.mjs` and
   re-inspect the screenshots. The "จำนวน" header should fit on a single
   line at every viewport. The "สินค้า" cells should wrap multi-line
   product names without overflowing the modal.
2. Re-run `npm --prefix front-end test -- --run` to make sure the
   existing vitest suite still passes. The test file
   `front-end/src/features/pos/PosCheckoutPage.test.tsx` already exercises
   the checkout confirmation modal in jsdom — we should add one
   assertion that the rendered HTML contains the `<colgroup>` markup.
3. Manual smoke test on desktop and iPad 10.9" to confirm the modal
   looks identical to the held-bills modal after the fix.

## Rollout

The fix is contained to two HTML template strings in a single file and
is a no-op for any code that does not render those modals. After
verification, commit + push following the project's normal workflow
(no production deploy needed; this is a frontend-only change).
