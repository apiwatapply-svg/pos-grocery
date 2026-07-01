import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  ownerName: z.string().min(1),
  logoUrl: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
