/**
 * CLI script: Sync product images from Open Food Facts (barcode lookup)
 * + Google Custom Search (name lookup) + Cloudinary text-overlay default.
 *
 * Usage:
 *   npm run sync:images                # sync to first available store
 *   npm run sync:images <storeId>      # sync to specific store
 *
 * Required env: CLOUDINARY_* (always), GOOGLE_CUSTOM_SEARCH_* (optional)
 *
 * Strategy:
 *   1. If product already has an image → skip
 *   2. Search by barcode via Open Food Facts
 *   3. Fallback: search by product name via Google Custom Search
 *   4. Fallback: generate Cloudinary text-overlay placeholder
 *
 * Fail-soft: any per-product error is logged but never aborts the run.
 */

import { env } from "../src/config/env.js";
import { defaultUserRepository } from "../src/modules/users/user.repository.js";
import { searchProductImage } from "../src/modules/products/image-search.service.js";
import { uploadProductImageToCloudinary } from "../src/modules/products/cloudinary.service.js";
import type { ProductRecord } from "../src/modules/users/user.repository.js";

function formatLine(char: string, length = 60): string {
  return char.repeat(length);
}

function buildDefaultImageDataUri(productName: string): string {
  // Build a small SVG placeholder with the product name so we can upload
  // it to Cloudinary without depending on any pre-existing asset.
  const safeName = productName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const fontSize = safeName.length > 18 ? 36 : 44;
  const lines = wrapText(safeName, 18);
  const lineHeight = fontSize + 8;
  const totalHeight = lines.length * lineHeight;
  const startY = 200 - totalHeight / 2 + fontSize * 0.7;
  const textElements = lines
    .map(
      (line, i) =>
        `<text x="200" y="${startY + i * lineHeight}" text-anchor="middle" font-family="Arial, 'Noto Sans Thai', sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${line}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#333333"/>
    <rect x="10" y="10" width="380" height="380" fill="none" stroke="#666666" stroke-width="2"/>
    ${textElements}
  </svg>`;
  const base64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function uploadFromUrl(storeId: string, productName: string, imageUrl: string) {
  // Download the source image
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(imageUrl, { signal: controller.signal });
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${imageUrl}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${contentType};base64,${base64}`;

  return uploadProductImageToCloudinary({
    storeId,
    fileName: `${productName}.${contentType.split("/").pop() ?? "jpg"}`,
    dataUri,
  });
}

async function processProduct(storeId: string, product: ProductRecord) {
  if (product.images.length > 0) {
    return { status: "skipped" as const };
  }

  let searchResult = null;
  if (/^\d{8,14}$/.test(product.barcode)) {
    searchResult = await searchProductImage({
      barcode: product.barcode,
      productName: product.name,
    });
  }

  if (!searchResult) {
    searchResult = await searchProductImage({
      productName: product.name,
    });
  }

  let uploadedImage = null;
  let source = "none";

  if (searchResult) {
    try {
      uploadedImage = await uploadFromUrl(storeId, product.name, searchResult.imageUrl);
      source = searchResult.source;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`   ⚠️  Upload failed for "${product.name}": ${message}`);
    }
  }

  if (!uploadedImage) {
    try {
      const dataUri = buildDefaultImageDataUri(product.name);
      uploadedImage = await uploadProductImageToCloudinary({
        storeId,
        fileName: `${product.name}.svg`,
        dataUri,
      });
      source = "default";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: "failed" as const, error: `Default upload failed: ${message}` };
    }
  }

  const image = await defaultUserRepository.addProductImage({
    productId: product.id,
    provider: "cloudinary",
    publicId: uploadedImage.publicId,
    secureUrl: uploadedImage.secureUrl,
    thumbnailUrl: uploadedImage.thumbnailUrl,
    width: uploadedImage.width,
    height: uploadedImage.height,
    format: uploadedImage.format,
    bytes: uploadedImage.bytes,
  });

  if (!image) {
    return { status: "failed" as const, error: "addProductImage returned null" };
  }

  return { status: "ok" as const, source };
}

async function main() {
  console.log("🖼️  Starting product image sync...\n");

  if (!env.CLOUDINARY_CLOUD_NAME) {
    console.error("❌ CLOUDINARY_CLOUD_NAME is not set");
    process.exit(1);
  }

  // Determine target store
  const targetStoreId = process.argv[2];
  let resolvedStoreId: string;

  if (targetStoreId) {
    resolvedStoreId = targetStoreId;
  } else {
    const stores = await defaultUserRepository.listStores();
    if (stores.length === 0) {
      console.error("❌ No stores found");
      process.exit(1);
    }
    if (stores.length > 1) {
      console.log(`⚠️  Multiple stores found. Using first one: ${stores[0]!.id}`);
    }
    resolvedStoreId = stores[0]!.id;
  }

  console.log(`📍 Target store: ${resolvedStoreId}\n`);

  const products = await defaultUserRepository.listProducts(resolvedStoreId, { includeImages: true });
  console.log(`📦 Found ${products.length} products\n`);

  let okCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let offCount = 0;
  let googleCount = 0;
  let defaultCount = 0;
  const failed: Array<{ name: string; error: string }> = [];

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index]!;
    const result = await processProduct(resolvedStoreId, product);

    if (result.status === "skipped") {
      skippedCount += 1;
      console.log(`[${index + 1}/${products.length}] ⏭  ${product.name} (already has image)`);
    } else if (result.status === "ok") {
      okCount += 1;
      if (result.source === "openfoodfacts") offCount += 1;
      else if (result.source === "google") googleCount += 1;
      else if (result.source === "default") defaultCount += 1;
      console.log(`[${index + 1}/${products.length}] ✅ ${product.name} (${result.source})`);
    } else {
      failedCount += 1;
      failed.push({ name: product.name, error: result.error });
      console.log(`[${index + 1}/${products.length}] ❌ ${product.name}: ${result.error}`);
    }
  }

  console.log("");
  console.log(formatLine("="));
  console.log("🖼️  IMAGE SYNC SUMMARY");
  console.log(formatLine("="));
  console.log(`Total products:        ${products.length}`);
  console.log(`Images added:          ${okCount}`);
  console.log(`  ├─ from OpenFoodFacts: ${offCount}`);
  console.log(`  ├─ from Google:        ${googleCount}`);
  console.log(`  └─ default placeholder: ${defaultCount}`);
  console.log(`Skipped (had image):   ${skippedCount}`);
  console.log(`Failed:                ${failedCount}`);

  if (failed.length > 0) {
    console.log("\n❌ FAILED PRODUCTS:");
    for (const f of failed) {
      console.log(`   ${f.name}: ${f.error}`);
    }
  }

  console.log("");
  console.log("✅ Image sync completed");
}

main().catch((error) => {
  console.error("");
  console.error("❌ Image sync failed:");
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error("");
    console.error(error.stack);
  }
  process.exit(1);
});
