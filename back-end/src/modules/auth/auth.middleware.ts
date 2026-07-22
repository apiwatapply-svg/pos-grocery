import type { RequestHandler } from "express";
import { env } from "../../config/env.ts";
import { AppError } from "../../shared/errors/app-error.ts";
import { verifyAuthToken } from "./auth.service.ts";
import type { UserRepository, UserRole } from "../users/user.repository.ts";

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

function tokenRole(role: string): UserRole {
  if (role === "super_admin" || role === "store_admin" || role === "cashier" || role === "stock") {
    return role;
  }

  throw new AppError(401, "INVALID_TOKEN", "Authentication token is invalid.");
}

export function requireAuth(deps?: AuthMiddlewareDeps): RequestHandler {
  const jwtSecret = deps?.jwtSecret ?? env.JWT_SECRET;

  return async (request, response, next) => {
    try {
      if (!jwtSecret) {
        throw new AppError(500, "AUTH_NOT_CONFIGURED", "Authentication is not configured.");
      }

      const payload = verifyAuthToken(readBearerToken(request.header("authorization")), jwtSecret);

      response.locals.authUser = {
        id: payload.sub,
        storeId: payload.storeId,
        username: payload.username,
        role: tokenRole(payload.role),
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
