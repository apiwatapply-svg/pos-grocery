import { defaultUserRepository } from "../src/modules/users/user.repository.js";

const groceryProducts = [
  {
    name: "Jasmine Rice 5kg",
    barcode: "8851000000001",
    sku: "RICE-5KG",
    unit: "bag",
    costPriceSatang: 14500,
    salePriceSatang: 17900,
    stockQuantity: 20,
  },
  {
    name: "Sugar 1kg",
    barcode: "8851000000002",
    sku: "SUGAR-1KG",
    unit: "bag",
    costPriceSatang: 2200,
    salePriceSatang: 2800,
    stockQuantity: 36,
  },
  {
    name: "Fish Sauce 700ml",
    barcode: "8851000000003",
    sku: "FISHSAUCE-700",
    unit: "bottle",
    costPriceSatang: 2500,
    salePriceSatang: 3500,
    stockQuantity: 30,
  },
  {
    name: "Cooking Oil 1L",
    barcode: "8851000000004",
    sku: "OIL-1L",
    unit: "bottle",
    costPriceSatang: 4800,
    salePriceSatang: 5900,
    stockQuantity: 24,
  },
  {
    name: "UHT Milk 1L",
    barcode: "8851000000005",
    sku: "MILK-1L",
    unit: "box",
    costPriceSatang: 3400,
    salePriceSatang: 4500,
    stockQuantity: 40,
  },
  {
    name: "Canned Sardines",
    barcode: "8851000000006",
    sku: "SARDINE-CAN",
    unit: "can",
    costPriceSatang: 1700,
    salePriceSatang: 2500,
    stockQuantity: 48,
  },
  {
    name: "Dishwashing Liquid",
    barcode: "8851000000007",
    sku: "DISH-LIQUID",
    unit: "bottle",
    costPriceSatang: 2800,
    salePriceSatang: 3900,
    stockQuantity: 22,
  },
  {
    name: "Toilet Paper 6 Rolls",
    barcode: "8851000000008",
    sku: "TISSUE-6ROLL",
    unit: "pack",
    costPriceSatang: 4900,
    salePriceSatang: 6500,
    stockQuantity: 18,
  },
  {
    name: "Coffee Sachet Pack",
    barcode: "8851000000009",
    sku: "COFFEE-SACHET",
    unit: "pack",
    costPriceSatang: 3600,
    salePriceSatang: 4900,
    stockQuantity: 32,
  },
  {
    name: "Egg Pack 10 pcs",
    barcode: "8851000000010",
    sku: "EGG-10",
    unit: "pack",
    costPriceSatang: 4200,
    salePriceSatang: 5500,
    stockQuantity: 26,
  },
];

async function main() {
  const store = await defaultUserRepository.getFirstStore();

  if (!store) {
    throw new Error("No store found. Start the backend once to seed the admin store first.");
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const product of groceryProducts) {
    const existing = await defaultUserRepository.findProductByBarcode(store.id, product.barcode);

    if (existing) {
      skippedCount += 1;
      continue;
    }

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

    createdCount += 1;
  }

  const products = await defaultUserRepository.listProducts(store.id);
  console.log(`created=${createdCount} skipped=${skippedCount} total=${products.length}`);
  for (const product of products) {
    console.log(`${product.barcode} | ${product.name} | stock=${product.stockQuantity}`);
  }
}

await main();
