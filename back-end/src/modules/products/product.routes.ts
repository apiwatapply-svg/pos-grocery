import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.ts";
import { readCacheMiddleware } from "../../shared/middleware/read-cache.middleware.ts";
import {
  createProductController,
  listProductsController,
  updateProductController,
  uploadProductImageController,
} from "./product.controller.ts";
import type { UserRepository } from "../users/user.repository.ts";

export function createProductRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.get("/", readCacheMiddleware(), listProductsController(deps));
  router.post("/", requireRole(["super_admin"]), createProductController(deps));
  router.patch("/:id", requireRole(["super_admin"]), updateProductController(deps));
  router.post("/:id/images", requireRole(["super_admin"]), uploadProductImageController(deps));

  return router;
}
