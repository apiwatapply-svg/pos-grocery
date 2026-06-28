import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  countInventoryController,
  exportInventoryController,
  receiveInventoryController,
} from "./inventory.controller.js";
import type { UserRepository } from "../users/user.repository.js";

export function createInventoryRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.use(requireAuth(deps));
  router.post("/receive", requireRole(["owner", "admin", "stock"]), receiveInventoryController(deps));
  router.post("/count", requireRole(["owner", "admin", "stock"]), countInventoryController(deps));
  router.get("/export.xlsx", exportInventoryController(deps));

  return router;
}
