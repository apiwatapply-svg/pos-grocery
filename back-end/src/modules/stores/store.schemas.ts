import { z } from "zod";

export const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
