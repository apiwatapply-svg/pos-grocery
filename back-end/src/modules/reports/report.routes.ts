import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  dashboardController,
  exportSalesReportController,
  salesReportController,
} from "./report.controller.js";
import type { UserRepository } from "../users/user.repository.js";

export function createReportRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.get("/sales", salesReportController(deps));
  router.get("/dashboard", dashboardController(deps));
  router.get("/export.xlsx", exportSalesReportController(deps));

  return router;
}
