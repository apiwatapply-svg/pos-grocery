/**
 * CSV parser และ validator สำหรับ Google Sheets export
 *
 * โครงสร้าง Sheet "รายการสินค้า":
 * - Row 1: headers
 * - Row 2+: data
 * - Column A: No (row number, ไม่ใช้)
 * - Column B: Picture (ไม่ใช้)
 * - Column C: สินค้า (product name)
 * - Column D: จำนวน (stock quantity)
 * - Column E: บาร์โค้ด (barcode)
 * - Column F: หน่วย (unit)
 * - Column G: ต้นทุนต่อ 1 หน่วย (cost price in baht)
 * - Column H: ราคาต้นทุนต่อรายการ (cost × quantity — ไม่บันทึก)
 * - Column I: ราคาขายต่อ 1 หน่วย (sale price in baht)
 */

export const EXPECTED_HEADERS = [
  "No",
  "Picture",
  "สินค้า",
  "จำนวน",
  "บาร์โค้ด",
  "หน่วย",
  "ต้นทุนต่อ 1 หน่วย",
  "ราคาต้นทุนต่อรายการ",
  "ราคาขายต่อ 1 หน่วย",
] as const;

export type SheetsProductDraft = {
  /** 1-based row ใน Sheet (รวม header) */
  rowNumber: number;
  name: string;
  barcode: string;
  unit: string;
  costPriceSatang: number;
  salePriceSatang: number;
  stockQuantity: number;
};

export class SheetsParseError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CSV"
      | "MISSING_HEADERS"
      | "INVALID_ROW_DATA"
      | "EMPTY_SHEET",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Parse CSV text เป็น array of raw row arrays
 * รองรับ quoted fields ที่มี comma ภายใน
 */
export function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      if (currentRow.some((field) => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((field) => field.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseNumber(rawValue: string): number {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return 0;
  }
  const normalized = trimmed.replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function roundToSatang(baht: number): number {
  return Math.max(0, Math.round(baht * 100));
}

function rowCellsContainAll(row: string[], expectedLength: number) {
  while (row.length < expectedLength) {
    row.push("");
  }
}

function validateRowData(
  name: string,
  barcode: string,
  unit: string,
  costPriceSatang: number,
  salePriceSatang: number,
  stockQuantity: number,
  rowNumber: number,
): void {
  if (!name) {
    throw new SheetsParseError(
      "INVALID_ROW_DATA",
      `Row ${rowNumber}: Product name is required`,
    );
  }
  if (!barcode) {
    throw new SheetsParseError(
      "INVALID_ROW_DATA",
      `Row ${rowNumber}: Barcode is required`,
    );
  }
  if (!unit) {
    throw new SheetsParseError(
      "INVALID_ROW_DATA",
      `Row ${rowNumber}: Unit is required`,
    );
  }
  if (costPriceSatang < 0) {
    throw new SheetsParseError(
      "INVALID_ROW_DATA",
      `Row ${rowNumber}: Cost price must be >= 0`,
    );
  }
  if (salePriceSatang < 0) {
    throw new SheetsParseError(
      "INVALID_ROW_DATA",
      `Row ${rowNumber}: Sale price must be >= 0`,
    );
  }
  if (stockQuantity < 0) {
    throw new SheetsParseError(
      "INVALID_ROW_DATA",
      `Row ${rowNumber}: Stock quantity must be >= 0`,
    );
  }
}

/**
 * Validate header row เทียบกับ EXPECTED_HEADERS
 */
export function validateHeaders(headerRow: string[]): void {
  for (let index = 0; index < EXPECTED_HEADERS.length; index += 1) {
    const expected = EXPECTED_HEADERS[index];
    const actual = (headerRow[index] ?? "").trim();
    if (actual !== expected) {
      throw new SheetsParseError(
        "MISSING_HEADERS",
        `Header column ${index + 1} expected "${expected}" but got "${actual || "(empty)"}"`,
      );
    }
  }
}

/**
 * แปลง row ของ Sheet เป็น SheetsProductDraft
 * คืน null ถ้า row ว่าง
 * throw SheetsParseError ถ้าข้อมูลไม่ถูกต้อง
 */
export function mapRowToDraft(
  row: string[],
  rowNumber: number,
): SheetsProductDraft | null {
  rowCellsContainAll(row, EXPECTED_HEADERS.length);

  // Column mapping: A=No, B=Picture, C=name, D=quantity, E=barcode, F=unit,
  // G=costPriceRaw, H=totalCost, I=salePriceRaw
  const [noValue, , name, quantity, barcode, unit, costPriceRaw, , salePriceRaw] = row;

  // Skip rows where the No column AND name AND barcode are all empty
  if (!noValue?.trim() && !name?.trim() && !barcode?.trim()) {
    return null;
  }

  // Skip rows where name AND barcode are both empty
  if (!name?.trim() && !barcode?.trim()) {
    return null;
  }

  const trimmedName = name.trim();
  const trimmedBarcode = barcode.trim();
  const trimmedUnit = unit.trim();
  const costPriceSatang = roundToSatang(parseNumber(costPriceRaw));
  const salePriceSatang = roundToSatang(parseNumber(salePriceRaw));
  const stockQuantity = Math.max(0, Math.floor(parseNumber(quantity)));

  validateRowData(
    trimmedName,
    trimmedBarcode,
    trimmedUnit,
    costPriceSatang,
    salePriceSatang,
    stockQuantity,
    rowNumber,
  );

  return {
    rowNumber,
    name: trimmedName,
    barcode: trimmedBarcode,
    unit: trimmedUnit,
    costPriceSatang,
    salePriceSatang,
    stockQuantity,
  };
}

/**
 * แปลง CSV text เป็น array of SheetsProductDraft
 */
export function parseSheetsCsv(csvText: string): SheetsProductDraft[] {
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    throw new SheetsParseError("EMPTY_SHEET", "Sheet is empty");
  }

  const [headerRow, ...dataRows] = rows;
  validateHeaders(headerRow);

  const drafts: SheetsProductDraft[] = [];
  for (let index = 0; index < dataRows.length; index += 1) {
    const draft = mapRowToDraft(dataRows[index], index + 2);
    if (draft) {
      drafts.push(draft);
    }
  }

  return drafts;
}
