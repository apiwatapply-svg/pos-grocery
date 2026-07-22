import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.ts";
import {
  fetchSheetsCsv,
  fetchSheetsDrafts,
  SheetsConfigError,
  SheetsFetchError,
  SheetsPermissionError,
} from "./google-sheets.service.ts";

const originalFetch = globalThis.fetch;
const originalUrl = env.GOOGLE_SHEETS_CSV_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.GOOGLE_SHEETS_CSV_URL = originalUrl;
  vi.restoreAllMocks();
});

describe("fetchSheetsCsv", () => {
  it("throws SheetsConfigError when URL is not set", async () => {
    env.GOOGLE_SHEETS_CSV_URL = undefined;
    await expect(fetchSheetsCsv()).rejects.toBeInstanceOf(SheetsConfigError);
  });

  it("throws SheetsConfigError when URL is empty", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "   ";
    await expect(fetchSheetsCsv()).rejects.toBeInstanceOf(SheetsConfigError);
  });

  it("returns CSV text on success", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/test/export?format=csv&gid=0";
    globalThis.fetch = vi.fn(async () => {
      return new Response("a,b,c\n1,2,3", { status: 200 });
    }) as typeof fetch;

    const result = await fetchSheetsCsv();
    expect(result).toBe("a,b,c\n1,2,3");
  });

  it("throws SheetsPermissionError on 403", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/test/export?format=csv&gid=0";
    globalThis.fetch = vi.fn(async () => {
      return new Response("Forbidden", { status: 403 });
    }) as typeof fetch;

    await expect(fetchSheetsCsv()).rejects.toBeInstanceOf(SheetsPermissionError);
  });

  it("throws SheetsPermissionError on 401", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/test/export?format=csv&gid=0";
    globalThis.fetch = vi.fn(async () => {
      return new Response("Unauthorized", { status: 401 });
    }) as typeof fetch;

    await expect(fetchSheetsCsv()).rejects.toBeInstanceOf(SheetsPermissionError);
  });

  it("throws SheetsFetchError on 500", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/test/export?format=csv&gid=0";
    globalThis.fetch = vi.fn(async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof fetch;

    await expect(fetchSheetsCsv()).rejects.toBeInstanceOf(SheetsFetchError);
  });

  it("throws SheetsFetchError on network error", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/test/export?format=csv&gid=0";
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network failure");
    }) as typeof fetch;

    await expect(fetchSheetsCsv()).rejects.toBeInstanceOf(SheetsFetchError);
  });
});

describe("fetchSheetsDrafts", () => {
  it("returns parsed drafts from a valid CSV", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/test/export?format=csv&gid=0";
    const csv = [
      "No,Picture,สินค้า,จำนวน,บาร์โค็ด,หน่วย,ต้นทุนต่อ 1 หน่วย,ราคาต้นทุนต่อรายการ,ราคาขายต่อ 1 หน่วย",
      "1,,Product A,5,111,ชิ้น,10,50,20",
    ].join("\n");

    globalThis.fetch = vi.fn(async () => {
      return new Response(csv, { status: 200 });
    }) as typeof fetch;

    const drafts = await fetchSheetsDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.barcode).toBe("111");
    expect(drafts[0]?.costPriceSatang).toBe(1000);
  });

  it("throws AppError with SHEETS_MISSING_HEADERS code on invalid header", async () => {
    env.GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/test/export?format=csv&gid=0";
    globalThis.fetch = vi.fn(async () => {
      return new Response("wrong,header,row\n1,2,3", { status: 200 });
    }) as typeof fetch;

    try {
      await fetchSheetsDrafts();
      expect.fail("should have thrown");
    } catch (error) {
      expect((error as { code: string }).code).toBe("SHEETS_MISSING_HEADERS");
    }
  });
});
