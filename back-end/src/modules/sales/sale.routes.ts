import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { cancelSaleController, checkoutController, getReceiptController } from "./sale.controller.js";
import type { UserRepository } from "../users/user.repository.js";

export function createSaleRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.post("/checkout", requireRole(["owner", "admin", "cashier"]), checkoutController(deps));
  router.post("/:id/cancel", requireRole(["owner", "admin"]), cancelSaleController(deps));
  router.get("/:id/receipt", getReceiptController(deps));

  return router;
}
