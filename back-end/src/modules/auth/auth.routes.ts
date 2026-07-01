import { Router } from "express";
import { createAuthController } from "./auth.controller.ts";
import type { UserRepository } from "../users/user.repository.ts";

export function createAuthRouter(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const router = Router();

  router.post("/login", createAuthController(deps));

  return router;
}
