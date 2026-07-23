import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.ts";
import { readCacheMiddleware } from "../../shared/middleware/read-cache.middleware.ts";
import {
  createUserController,
  deleteUserController,
  listUsersController,
  updateUserController,
} from "./user.controller.ts";
import type { UserRepository } from "./user.repository.ts";

export function createUserRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();
  const userManagementRoles = ["super_admin", "store_admin"] as const;

  router.use(requireAuth(deps), requireRole([...userManagementRoles]));
  router.get("/", readCacheMiddleware(), listUsersController(deps));
  router.post("/", createUserController(deps));
  router.patch("/:id", updateUserController(deps));
  router.delete("/:id", deleteUserController(deps));

  return router;
}
