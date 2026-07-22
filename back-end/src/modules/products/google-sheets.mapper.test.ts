import { describe, expect, it } from "vitest";
import {
  EXPECTED_HEADERS,
  mapRowToDraft,
  parseCsv,
  parseSheetsCsv,
  SheetsParseError,
  validateHeaders,
} from "./google-sheets.mapper.ts";

const HEADER_ROW = EXPECTED_HEADERS.join(",");

function buildRow(values: Array<string | number>): string {
  return values.map((value) => String(value)).join(",");
}

describe("parseCsv", () => {
  it("parses simple comma-separated rows", () => {
    const csv = "a,b,c\n1,2,3\n4,5,6\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("parses quoted fields containing commas", () => {
    const csv = 'name,note\n"hello, world",ok\n';
    expect(parseCsv(csv)).toEqual([
      ["name", "note"],
      ["hello, world", "ok"],
    ]);
  });

  it("parses quoted fields with escaped double quotes", () => {
    const csv = 'name,note\n"she said ""hi""",ok\n';
    expect(parseCsv(csv)).toEqual([
      ["name", "note"],
      ['she said "hi"', "ok"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const csv = "a,b\r\n1,2\r\n3,4\r\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("skips empty trailing rows", () => {
    const csv = "a,b\n1,2\n\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("validateHeaders", () => {
  it("accepts valid header row", () => {
    expect(() => validateHeaders([...EXPECTED_HEADERS])).not.toThrow();
  });

  it("rejects when a column is missing", () => {
    const headers = [...EXPECTED_HEADERS];
    headers[2] = "ชื่อสินค้า";
    expect(() => validateHeaders(headers)).toThrow(SheetsParseError);
  });

  it("rejects when order is wrong", () => {
    const headers = [...EXPECTED_HEADERS];
    [headers[0], headers[1]] = [headers[1], headers[0]];
    expect(() => validateHeaders(headers)).toThrow(/Header column 1/);
  });
});

describe("mapRowToDraft", () => {
  const fullRow = [
    "1",
    "",
    "น้ำตาลทรายขาว 1กก.",
    "5",
    "8850999000001",
    "ถุง",
    "52.5",
    "262.5",
    "63",
  ];

  it("maps a complete row to a draft with satang values", () => {
    const draft = mapRowToDraft(fullRow, 2);
    expect(draft).toEqual({
      rowNumber: 2,
      name: "น้ำตาลทรายขาว 1กก.",
      barcode: "8850999000001",
      unit: "ถุง",
      costPriceSatang: 5250,
      salePriceSatang: 6300,
      stockQuantity: 5,
    });
  });

  it("returns null for completely empty row", () => {
    expect(mapRowToDraft(["", "", "", "", "", "", "", "", ""], 3)).toBeNull();
  });

  it("returns null for row with no name and no barcode", () => {
    expect(mapRowToDraft(["", "", "", "", "", "", "", "", ""], 3)).toBeNull();
  });

  it("throws when name is empty but other fields exist", () => {
    const row = [...fullRow];
    row[2] = "";
    expect(() => mapRowToDraft(row, 4)).toThrow(/Product name is required/);
  });

  it("treats zero prices as valid", () => {
    const row = [...fullRow];
    row[6] = "0";
    row[8] = "0";
    const draft = mapRowToDraft(row, 5);
    expect(draft?.costPriceSatang).toBe(0);
    expect(draft?.salePriceSatang).toBe(0);
  });

  it("rounds baht to satang", () => {
    const row = [...fullRow];
    row[6] = "0.005";
    row[8] = "0.004";
    const draft = mapRowToDraft(row, 6);
    expect(draft?.costPriceSatang).toBe(1);
    expect(draft?.salePriceSatang).toBe(0);
  });

  it("parses numbers with thousand separators", () => {
    const row = [...fullRow];
    row[6] = "1,234.50";
    row[8] = "2,000";
    const draft = mapRowToDraft(row, 7);
    expect(draft?.costPriceSatang).toBe(123450);
    expect(draft?.salePriceSatang).toBe(200000);
  });

  it("throws when barcode is empty", () => {
    const row = [...fullRow];
    row[4] = "";
    expect(() => mapRowToDraft(row, 9)).toThrow(/Barcode is required/);
  });

  it("rounds fractional stock quantity down to integer", () => {
    const row = [...fullRow];
    row[3] = "5.7";
    const draft = mapRowToDraft(row, 8);
    expect(draft?.stockQuantity).toBe(5);
  });
});

describe("parseSheetsCsv", () => {
  it("parses a full sheet with header and data rows", () => {
    const csv = [
      HEADER_ROW,
      buildRow([1, "", "น้ำตาลทราย 1กก.", 5, "8850999000001", "ถุง", 52.5, 262.5, 63]),
      buildRow([2, "", "น้ำตาลทราย 1กก. (ลัง)", 1, "8850999000002", "ลัง", 630, 630, 744]),
    ].join("\n");

    const drafts = parseSheetsCsv(csv);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.rowNumber).toBe(2);
    expect(drafts[1]?.rowNumber).toBe(3);
  });

  it("skips empty rows in data", () => {
    const csv = [
      HEADER_ROW,
      buildRow([1, "", "Product A", 1, "111", "ชิ้น", 10, 10, 20]),
      ",,,,,,,,",
      buildRow([2, "", "Product B", 1, "222", "ชิ้น", 20, 20, 30]),
    ].join("\n");

    const drafts = parseSheetsCsv(csv);
    expect(drafts).toHaveLength(2);
  });

  it("throws EMPTY_SHEET for empty CSV", () => {
    expect(() => parseSheetsCsv("")).toThrow(SheetsParseError);
  });

  it("throws MISSING_HEADERS for invalid header", () => {
    const csv = "wrong,header,row\n1,2,3\n";
    expect(() => parseSheetsCsv(csv)).toThrow(SheetsParseError);
  });

  it("throws INVALID_ROW_DATA when name is missing but other fields exist", () => {
    const csv = [
      HEADER_ROW,
      buildRow([1, "", "", 5, "8850999000001", "ถุง", 52.5, 262.5, 63]),
    ].join("\n");
    expect(() => parseSheetsCsv(csv)).toThrow(/Row 2/);
  });

  it("skips rows with no name and no barcode", () => {
    const csv = [
      HEADER_ROW,
      buildRow([1, "", "", "", "", "", 0, 0, 0]),
    ].join("\n");
    expect(parseSheetsCsv(csv)).toEqual([]);
  });
});
