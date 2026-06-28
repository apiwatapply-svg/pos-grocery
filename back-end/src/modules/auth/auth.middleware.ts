import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { verifyAuthToken } from "./auth.service.js";
import { defaultUserRepository, type UserRepository, type UserRole } from "../users/user.repository.js";

export type AuthenticatedUser = {
  id: string;
  storeId: string;
  username: string;
  role: UserRole;
};

export type AuthMiddlewareDeps = {
  repository?: UserRepository;
  jwtSecret?: string;
};

function readBearerToken(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return header.slice("Bearer ".length).trim();
}

export function requireAuth(deps?: AuthMiddlewareDeps): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;
  const jwtSecret = deps?.jwtSecret ?? env.JWT_SECRET;

  return async (request, response, next) => {
    try {
      if (!jwtSecret) {
        throw new AppError(500, "AUTH_NOT_CONFIGURED", "Authentication is not configured.");
      }

      const payload = verifyAuthToken(readBearerToken(request.header("authorization")), jwtSecret);
      const user = await repository.findUserById(payload.sub);

      if (!user || user.status !== "active") {
        throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
      }

      response.locals.authUser = {
        id: user.id,
        storeId: user.storeId,
        username: user.username,
        role: user.role,
      } satisfies AuthenticatedUser;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(roles: UserRole[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.authUser as AuthenticatedUser | undefined;

    if (!user || !roles.includes(user.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }

    next();
  };
}
