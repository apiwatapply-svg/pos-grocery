/**
 * Image search service.
 *
 * Strategy (in order):
 *  1. Open Food Facts API (https://world.openfoodfacts.org) — free, no API key,
 *     looks up by barcode. Returns product + image_front_url when found.
 *  2. Google Custom Search JSON API — requires GOOGLE_CUSTOM_SEARCH_API_KEY and
 *     GOOGLE_CUSTOM_SEARCH_ENGINE_ID env vars. Searches by product name when
 *     OFF misses.
 *  3. Returns null so the caller can decide what to do (e.g. use a default
 *     placeholder image).
 *
 * Fail-soft by design: never throws, returns null on any error so the
 * product sync can keep going.
 */

export type ImageSearchResult = {
  source: "openfoodfacts" | "google";
  imageUrl: string;
  width?: number;
  height?: number;
};

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const GOOGLE_BASE = "https://www.googleapis.com/customsearch/v1";

type OpenFoodFactsResponse = {
  status?: number;
  status_verbose?: string;
  product?: {
    image_front_url?: string;
    image_front_small_url?: string;
    image_url?: string;
  };
};

type GoogleCustomSearchResponse = {
  items?: Array<{
    link?: string;
    image?: {
      width?: number;
      height?: number;
    };
  }>;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidBarcode(barcode: string): boolean {
  // EAN-8, EAN-12 (UPC-A), EAN-13
  return /^\d{8,14}$/.test(barcode);
}

export async function searchImageByBarcode(
  barcode: string,
  options: { timeoutMs?: number } = {},
): Promise<ImageSearchResult | null> {
  if (!isValidBarcode(barcode)) {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? 5000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${OFF_BASE}/${encodeURIComponent(barcode)}.json`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OpenFoodFactsResponse;
    if (data.status !== 1 || !data.product) {
      return null;
    }

    const imageUrl =
      data.product.image_front_small_url ??
      data.product.image_front_url ??
      data.product.image_url;

    if (!imageUrl) {
      return null;
    }

    return {
      source: "openfoodfacts",
      imageUrl,
    };
  } catch {
    return null;
  }
}

export async function searchImageByQuery(
  query: string,
  options: { timeoutMs?: number; apiKey?: string; engineId?: string } = {},
): Promise<ImageSearchResult | null> {
  const apiKey = options.apiKey ?? process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const engineId = options.engineId ?? process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  const timeoutMs = options.timeoutMs ?? 5000;

  if (!apiKey || !engineId || !query.trim()) {
    return null;
  }

  const searchQuery = `${query.trim()} product photo`;
  const params = new URLSearchParams({
    key: apiKey,
    cx: engineId,
    q: searchQuery,
    searchType: "image",
    num: "1",
    safe: "active",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${GOOGLE_BASE}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GoogleCustomSearchResponse;
    const firstItem = data.items?.[0];
    if (!firstItem?.link) {
      return null;
    }

    return {
      source: "google",
      imageUrl: firstItem.link,
      width: firstItem.image?.width,
      height: firstItem.image?.height,
    };
  } catch {
    return null;
  }
}

export async function searchProductImage(input: {
  barcode?: string;
  productName: string;
  apiKey?: string;
  engineId?: string;
}): Promise<ImageSearchResult | null> {
  // Wait a little between calls so we don't hammer upstream rate limits
  const RATE_LIMIT_MS = 200;
  await delay(RATE_LIMIT_MS);

  if (input.barcode) {
    const offResult = await searchImageByBarcode(input.barcode);
    if (offResult) {
      return offResult;
    }
  }

  // Fallback to Google Custom Search if configured
  if (input.apiKey || (process.env.GOOGLE_CUSTOM_SEARCH_API_KEY && process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID)) {
    const googleResult = await searchImageByQuery(input.productName, {
      apiKey: input.apiKey,
      engineId: input.engineId,
    });
    if (googleResult) {
      return googleResult;
    }
  }

  return null;
}
