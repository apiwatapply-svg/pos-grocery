import { z } from "zod";

export const productStatusSchema = z.enum(["active", "inactive"]);

export const createProductSchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  barcode: z.string().trim().min(1),
  sku: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1),
  costPriceSatang: z.number().int().min(0),
  salePriceSatang: z.number().int().min(0),
  status: productStatusSchema.default("active"),
});

export const updateProductSchema = createProductSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required.",
);

export const uploadProductImageSchema = z.object({
  fileName: z.string().trim().min(1),
  dataUri: z.string().trim().startsWith("data:"),
  altText: z.string().trim().min(1).optional(),
});
