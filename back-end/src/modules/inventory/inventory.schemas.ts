import { z } from "zod";

export const receiveInventorySchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitCostSatang: z.number().int().min(0).optional(),
  note: z.string().trim().optional(),
});

export const countInventorySchema = z.object({
  productId: z.string().trim().min(1),
  countedQuantity: z.number().int().min(0),
  note: z.string().trim().optional(),
});
