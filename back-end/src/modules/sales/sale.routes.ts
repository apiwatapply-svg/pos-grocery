import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.ts";
import { readCacheMiddleware } from "../../shared/middleware/read-cache.middleware.ts";
import {
  activateSaleController,
  cancelSaleController,
  checkoutController,
  getReceiptController,
  getSaleController,
  listSalesController,
} from "./sale.controller.ts";
import type { UserRepository } from "../users/user.repository.ts";

export function createSaleRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.get("/", readCacheMiddleware(), listSalesController(deps));
  router.post("/checkout", requireRole(["owner", "admin", "cashier"]), checkoutController(deps));
  router.post("/:id/cancel", requireRole(["owner", "admin"]), cancelSaleController(deps));
  router.post("/:id/activate", requireRole(["owner", "admin"]), activateSaleController(deps));
  router.get("/:id", readCacheMiddleware(), getSaleController(deps));
  router.get("/:id/receipt", readCacheMiddleware(), getReceiptController(deps));

  return router;
}
