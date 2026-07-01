import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.ts";
import { readCacheMiddleware } from "../../shared/middleware/read-cache.middleware.ts";
import {
  dashboardController,
  exportSalesReportController,
  productSalesHistoryController,
  salesReportController,
} from "./report.controller.ts";
import type { UserRepository } from "../users/user.repository.ts";

export function createReportRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.get("/sales", readCacheMiddleware(), salesReportController(deps));
  router.get("/dashboard", readCacheMiddleware(), dashboardController(deps));
  router.get("/products/:productId/sales-history", readCacheMiddleware(), productSalesHistoryController(deps));
  router.get("/export.xlsx", exportSalesReportController(deps));

  return router;
}
