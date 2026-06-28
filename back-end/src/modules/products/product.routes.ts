import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  createProductController,
  listProductsController,
  updateProductController,
  uploadProductImageController,
} from "./product.controller.js";
import type { UserRepository } from "../users/user.repository.js";

export function createProductRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.get("/", listProductsController(deps));
  router.post("/", requireRole(["owner", "admin", "stock"]), createProductController(deps));
  router.patch("/:id", requireRole(["owner", "admin", "stock"]), updateProductController(deps));
  router.post("/:id/images", requireRole(["owner", "admin", "stock"]), uploadProductImageController(deps));

  return router;
}
