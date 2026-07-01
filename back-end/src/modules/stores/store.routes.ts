import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.ts";
import { readCacheMiddleware } from "../../shared/middleware/read-cache.middleware.ts";
import type { UserRepository } from "../users/user.repository.ts";
import {
  createStoreController,
  getCurrentStoreController,
  listStoresController,
  updateCurrentStoreController,
  updateStoreByIdController,
} from "./store.controller.ts";

export function createStoreRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.get("/", requireAuth(deps), requireRole(["owner", "admin"]), readCacheMiddleware(), listStoresController(deps));
  router.post("/", requireAuth(deps), requireRole(["owner", "admin"]), createStoreController(deps));
  router.get("/current", requireAuth(deps), readCacheMiddleware(), getCurrentStoreController(deps));
  router.patch(
    "/current",
    requireAuth(deps),
    requireRole(["owner", "admin"]),
    updateCurrentStoreController(deps),
  );
  router.patch(
    "/:storeId",
    requireAuth(deps),
    requireRole(["owner", "admin"]),
    updateStoreByIdController(deps),
  );

  return router;
}
