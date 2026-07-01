import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../config/env.ts";
import { uploadProductImageToCloudinary } from "./cloudinary.service.ts";

const originalEnv = {
  NODE_ENV: env.NODE_ENV,
  CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
  CLOUDINARY_UPLOAD_FOLDER: env.CLOUDINARY_UPLOAD_FOLDER,
};

afterEach(() => {
  env.NODE_ENV = originalEnv.NODE_ENV;
  env.CLOUDINARY_CLOUD_NAME = originalEnv.CLOUDINARY_CLOUD_NAME;
  env.CLOUDINARY_API_KEY = originalEnv.CLOUDINARY_API_KEY;
  env.CLOUDINARY_API_SECRET = originalEnv.CLOUDINARY_API_SECRET;
  env.CLOUDINARY_UPLOAD_FOLDER = originalEnv.CLOUDINARY_UPLOAD_FOLDER;
});

describe("Cloudinary product image upload", () => {
  it("does not return demo image URLs when Cloudinary runtime config is missing", async () => {
    env.NODE_ENV = "development";
    env.CLOUDINARY_CLOUD_NAME = undefined;
    env.CLOUDINARY_API_KEY = undefined;
    env.CLOUDINARY_API_SECRET = undefined;

    await expect(
      uploadProductImageToCloudinary({
        storeId: "store-1",
        fileName: "product.jpg",
        dataUri: "data:image/jpeg;base64,abc",
      }),
    ).rejects.toThrow("Cloudinary configuration is required for product image uploads.");
  });

  it("places uploads under a per-store folder so different stores do not collide", async () => {
    env.NODE_ENV = "test";
    env.CLOUDINARY_UPLOAD_FOLDER = "pos-grocery";

    const storeA = await uploadProductImageToCloudinary({
      storeId: "store-a",
      fileName: "milk.png",
      dataUri: "data:image/png;base64,abc",
    });
    const storeB = await uploadProductImageToCloudinary({
      storeId: "store-b",
      fileName: "milk.png",
      dataUri: "data:image/png;base64,abc",
    });

    expect(storeA.publicId).toMatch(/^pos-grocery\/store-a\/products\//);
    expect(storeB.publicId).toMatch(/^pos-grocery\/store-b\/products\//);
    expect(storeA.publicId).not.toBe(storeB.publicId);
    expect(storeA.secureUrl).toContain("/store-a/products/");
    expect(storeB.secureUrl).toContain("/store-b/products/");
  });

  it("generates unique publicIds even when the same file is uploaded twice for one store", async () => {
    env.NODE_ENV = "test";
    env.CLOUDINARY_UPLOAD_FOLDER = "pos-grocery";

    const first = await uploadProductImageToCloudinary({
      storeId: "store-a",
      fileName: "milk.png",
      dataUri: "data:image/png;base64,abc",
    });
    const second = await uploadProductImageToCloudinary({
      storeId: "store-a",
      fileName: "milk.png",
      dataUri: "data:image/png;base64,abc",
    });

    expect(first.publicId).not.toBe(second.publicId);
    expect(first.publicId).not.toContain("milk.png");
  });
});
