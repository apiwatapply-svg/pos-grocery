import type { RequestHandler } from "express";
import { env } from "../../config/env.ts";
import { AppError } from "../../shared/errors/app-error.ts";
import { comparePassword, createAuthToken, requireActiveUser, toPublicUser } from "./auth.service.ts";
import { loginSchema } from "./auth.schemas.ts";
import { defaultUserRepository, type UserRepository } from "../users/user.repository.ts";

export function createAuthController(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;
  const jwtSecret = deps?.jwtSecret ?? env.JWT_SECRET;

  return async (request, response, next) => {
    try {
      if (!jwtSecret) {
        throw new AppError(500, "AUTH_NOT_CONFIGURED", "Authentication is not configured.");
      }

      const result = loginSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Username and password are required.");
      }

      const user = await repository.findUserByUsername(result.data.username);

      if (!user || !(await comparePassword(result.data.password, user.passwordHash))) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
      }

      requireActiveUser(user);

      response.json({
        success: true,
        data: {
          token: createAuthToken(user, jwtSecret),
          user: toPublicUser(user),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
