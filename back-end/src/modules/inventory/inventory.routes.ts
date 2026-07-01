import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.ts";
import { readCacheMiddleware } from "../../shared/middleware/read-cache.middleware.ts";
import {
  countInventoryController,
  exportInventoryController,
  listInventoryTransactionsController,
  receiveInventoryController,
} from "./inventory.controller.ts";
import type { UserRepository } from "../users/user.repository.ts";

export function createInventoryRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.post("/receive", requireRole(["owner", "admin", "stock"]), receiveInventoryController(deps));
  router.post("/count", requireRole(["owner", "admin", "stock"]), countInventoryController(deps));
  router.get(
    "/transactions",
    requireRole(["owner", "admin", "stock"]),
    readCacheMiddleware(),
    listInventoryTransactionsController(deps),
  );
  router.get("/export.xlsx", exportInventoryController(deps));

  return router;
}
