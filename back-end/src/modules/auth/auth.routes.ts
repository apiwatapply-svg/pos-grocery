import { Router } from "express";
import { createAuthController } from "./auth.controller.js";
import type { UserRepository } from "../users/user.repository.js";

export function createAuthRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.post("/login", createAuthController(deps));

  return router;
}
