import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { UserRepository } from "../users/user.repository.js";
import { getCurrentStoreController, updateCurrentStoreController } from "./store.controller.js";

export function createStoreRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.get("/current", requireAuth(deps), getCurrentStoreController(deps));
  router.patch(
    "/current",
    requireAuth(deps),
    requireRole(["owner", "admin"]),
    updateCurrentStoreController(deps),
  );

  return router;
}
