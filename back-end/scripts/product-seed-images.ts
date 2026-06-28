import type { ProductImageRecord } from "../src/modules/users/user.repository.js";

export type GrocerySeedProduct = {
  name: string;
  barcode: string;
  sku: string;
  imageSourceUrl: string;
};

export type GroceryStockSeedProduct = GrocerySeedProduct & {
  unit: string;
  costPriceSatang: number;
  salePriceSatang: number;
  stockQuantity: number;
};

type SeedProductImage = Omit<ProductImageRecord, "id" | "productId" | "createdAt">;

export const grocerySeedProducts: GroceryStockSeedProduct[] = [
  {
    name: "Jasmine Rice 5kg",
    barcode: "8851000000001",
    sku: "RICE-5KG",
    unit: "bag",
    costPriceSatang: 14500,
    salePriceSatang: 17900,
    stockQuantity: 20,
    imageSourceUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Sugar 1kg",
    barcode: "8851000000002",
    sku: "SUGAR-1KG",
    unit: "bag",
    costPriceSatang: 2200,
    salePriceSatang: 2800,
    stockQuantity: 36,
    imageSourceUrl: "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Fish Sauce 700ml",
    barcode: "8851000000003",
    sku: "FISHSAUCE-700",
    unit: "bottle",
    costPriceSatang: 2500,
    salePriceSatang: 3500,
    stockQuantity: 30,
    imageSourceUrl: "https://images.unsplash.com/photo-1604908554027-4f5f2bd253ac?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Cooking Oil 1L",
    barcode: "8851000000004",
    sku: "OIL-1L",
    unit: "bottle",
    costPriceSatang: 4800,
    salePriceSatang: 5900,
    stockQuantity: 24,
    imageSourceUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "UHT Milk 1L",
    barcode: "8851000000005",
    sku: "MILK-1L",
    unit: "box",
    costPriceSatang: 3400,
    salePriceSatang: 4500,
    stockQuantity: 40,
    imageSourceUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Canned Sardines",
    barcode: "8851000000006",
    sku: "SARDINE-CAN",
    unit: "can",
    costPriceSatang: 1700,
    salePriceSatang: 2500,
    stockQuantity: 48,
    imageSourceUrl: "https://images.unsplash.com/photo-1598514982901-ae62764ae75e?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Dishwashing Liquid",
    barcode: "8851000000007",
    sku: "DISH-LIQUID",
    unit: "bottle",
    costPriceSatang: 2800,
    salePriceSatang: 3900,
    stockQuantity: 22,
    imageSourceUrl: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Toilet Paper 6 Rolls",
    barcode: "8851000000008",
    sku: "TISSUE-6ROLL",
    unit: "pack",
    costPriceSatang: 4900,
    salePriceSatang: 6500,
    stockQuantity: 18,
    imageSourceUrl: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Coffee Sachet Pack",
    barcode: "8851000000009",
    sku: "COFFEE-SACHET",
    unit: "pack",
    costPriceSatang: 3600,
    salePriceSatang: 4900,
    stockQuantity: 32,
    imageSourceUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Egg Pack 10 pcs",
    barcode: "8851000000010",
    sku: "EGG-10",
    unit: "pack",
    costPriceSatang: 4200,
    salePriceSatang: 5500,
    stockQuantity: 26,
    imageSourceUrl: "https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&w=900&q=80",
  },
];

export const demoSeedImageProducts: GrocerySeedProduct[] = [
  {
    name: "Drinking Water",
    barcode: "8850002000010",
    sku: "WATER-001",
    imageSourceUrl: "https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Instant Noodles",
    barcode: "8850001000011",
    sku: "NOODLE-001",
    imageSourceUrl: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=900&q=80",
  },
];

function cloudinaryFetchUrl(cloudName: string, transform: string, sourceUrl: string) {
  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transform}/${encodeURIComponent(sourceUrl)}`;
}

export function buildSeedProductImage(product: GrocerySeedProduct, cloudName = "demo"): SeedProductImage {
  const publicId = `pos-grocery/products/seed/${product.sku.toLowerCase()}`;

  return {
    provider: "cloudinary",
    publicId,
    secureUrl: cloudinaryFetchUrl(cloudName, "f_auto,q_auto,w_640", product.imageSourceUrl),
    thumbnailUrl: cloudinaryFetchUrl(cloudName, "c_fill,h_240,w_240,f_auto,q_auto", product.imageSourceUrl),
    width: 640,
    height: 640,
    format: "jpg",
    altText: product.name,
  };
}
