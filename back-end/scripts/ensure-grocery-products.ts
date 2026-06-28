import { env } from "../src/config/env.js";
import { defaultUserRepository, type ProductRecord } from "../src/modules/users/user.repository.js";
import { buildSeedProductImage, grocerySeedProducts, type GrocerySeedProduct } from "./product-seed-images.js";

async function ensureProductImage(product: ProductRecord, seedProduct: GrocerySeedProduct) {
  if (product.images.length > 0) {
    return "skipped";
  }

  const image = await defaultUserRepository.addProductImage({
    productId: product.id,
    ...buildSeedProductImage(seedProduct, env.CLOUDINARY_CLOUD_NAME ?? "demo"),
  });

  if (!image) {
    throw new Error(`Unable to add seed image for ${seedProduct.name}.`);
  }

  return "created";
}

async function main() {
  const store = await defaultUserRepository.getFirstStore();

  if (!store) {
    throw new Error("No store found. Start the backend once to seed the admin store first.");
  }

  let createdCount = 0;
  let skippedCount = 0;
  let imagesCreatedCount = 0;
  let imagesSkippedCount = 0;

  for (const product of grocerySeedProducts) {
    const existing = await defaultUserRepository.findProductByBarcode(store.id, product.barcode);
    let savedProduct: ProductRecord;

    if (existing) {
      skippedCount += 1;
      savedProduct = existing;
    } else {
      const created = await defaultUserRepository.createProduct({
        storeId: store.id,
        name: product.name,
        barcode: product.barcode,
        sku: product.sku,
        unit: product.unit,
        costPriceSatang: product.costPriceSatang,
        salePriceSatang: product.salePriceSatang,
        status: "active",
      });

      await defaultUserRepository.adjustInventory({
        productId: created.id,
        type: "receive",
        quantityChange: product.stockQuantity,
        unitCostSatang: product.costPriceSatang,
        note: "Seed 10 grocery products into SQL",
      });

      savedProduct = created;
      createdCount += 1;
    }

    const imageResult = await ensureProductImage(savedProduct, product);
    if (imageResult === "created") {
      imagesCreatedCount += 1;
    } else {
      imagesSkippedCount += 1;
    }
  }

  const products = await defaultUserRepository.listProducts(store.id);
  console.log(
    `created=${createdCount} skipped=${skippedCount} imagesCreated=${imagesCreatedCount} imagesSkipped=${imagesSkippedCount} total=${products.length}`,
  );
  for (const product of products) {
    console.log(`${product.barcode} | ${product.name} | stock=${product.stockQuantity} | images=${product.images.length}`);
  }
}

await main();
