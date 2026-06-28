import { describe, expect, it } from "vitest";
import { buildSeedProductImage, demoSeedImageProducts, grocerySeedProducts } from "./product-seed-images.js";

describe("grocery product seed images", () => {
  it("defines ten grocery products with image sources", () => {
    expect(grocerySeedProducts).toHaveLength(10);
    expect(grocerySeedProducts.every((product) => product.imageSourceUrl.startsWith("https://"))).toBe(true);
  });

  it("defines image backfills for the two original demo products", () => {
    expect(demoSeedImageProducts.map((product) => product.barcode)).toEqual([
      "8850002000010",
      "8850001000011",
    ]);
  });

  it("builds Cloudinary image metadata for seeded products", () => {
    const image = buildSeedProductImage(grocerySeedProducts[0], "pos-demo");

    expect(image).toEqual(
      expect.objectContaining({
        provider: "cloudinary",
        publicId: "pos-grocery/products/seed/rice-5kg",
        altText: "Jasmine Rice 5kg",
        format: "jpg",
      }),
    );
    expect(image.secureUrl).toContain("https://res.cloudinary.com/pos-demo/image/fetch/");
    expect(image.secureUrl).toContain("f_auto,q_auto,w_640");
    expect(image.thumbnailUrl).toContain("c_fill,h_240,w_240");
  });
});
