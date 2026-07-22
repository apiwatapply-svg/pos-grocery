import { env } from "../../config/env.ts";
import { AppError } from "../../shared/errors/app-error.ts";
import {
  parseSheetsCsv,
  SheetsParseError,
  type SheetsProductDraft,
} from "./google-sheets.mapper.ts";

/**
 * Google Sheets CSV Fetcher
 *
 * ดึงข้อมูลจาก Google Sheet ผ่าน public export URL (ไม่ต้อง auth)
 * URL ต้องเป็นแบบ:
 *   https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}
 */

const FETCH_TIMEOUT_MS = 30_000;

export class SheetsConfigError extends AppError {
  constructor(message: string) {
    super(500, "SHEETS_CONFIG_MISSING", message);
  }
}

export class SheetsFetchError extends AppError {
  constructor(message: string) {
    super(502, "SHEETS_FETCH_FAILED", message);
  }
}

export class SheetsPermissionError extends AppError {
  constructor(message: string) {
    super(403, "SHEETS_PERMISSION_DENIED", message);
  }
}

function getCsvUrl(): string {
  const url = env.GOOGLE_SHEETS_CSV_URL?.trim();
  if (!url) {
    throw new SheetsConfigError(
      "GOOGLE_SHEETS_CSV_URL is not configured. Set it in .env to enable Google Sheets sync.",
    );
  }
  return url;
}

/**
 * Fetch CSV text จาก Google Sheets public export URL
 */
export async function fetchSheetsCsv(): Promise<string> {
  const url = getCsvUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/csv, text/plain;q=0.9, */*;q=0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new SheetsPermissionError(
          "Google Sheet is not publicly accessible. Please share it with 'Anyone with the link' permission.",
        );
      }
      throw new SheetsFetchError(
        `Failed to fetch Google Sheet (HTTP ${response.status})`,
      );
    }

    return await response.text();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new SheetsFetchError("Google Sheet request timed out after 30 seconds");
    }
    throw new SheetsFetchError(
      error instanceof Error ? error.message : "Unknown fetch error",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * ดึงข้อมูลจาก Google Sheet แล้วแปลงเป็น SheetsProductDraft array
 * รวม error handling สำหรับทั้ง fetch และ parse
 */
export async function fetchSheetsDrafts(): Promise<SheetsProductDraft[]> {
  const csvText = await fetchSheetsCsv();
  try {
    return parseSheetsCsv(csvText);
  } catch (error) {
    if (error instanceof SheetsParseError) {
      throw new AppError(400, `SHEETS_${error.code}`, error.message);
    }
    throw error;
  }
}
