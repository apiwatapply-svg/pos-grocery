import { z } from "zod";

export const checkoutSchema = z.object({
  barcodeItems: z
    .array(
      z.object({
        barcode: z.string().trim().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  cashReceivedSatang: z.number().int().min(0),
  paymentMethod: z.enum(["cash", "transfer", "card"]).default("cash"),
  soldAt: z.string().datetime().optional(),
});
