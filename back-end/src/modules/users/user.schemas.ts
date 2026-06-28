import { z } from "zod";

export const userRoleSchema = z.enum(["owner", "admin", "cashier", "stock"]);
export const userStatusSchema = z.enum(["active", "inactive"]);

export const createUserSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(6),
  displayName: z.string().trim().min(1),
  role: userRoleSchema,
  status: userStatusSchema.default("active"),
});

export const updateUserSchema = z
  .object({
    username: z.string().trim().min(3).optional(),
    password: z.string().min(6).optional(),
    displayName: z.string().trim().min(1).optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");
