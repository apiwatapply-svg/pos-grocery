import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../auth/auth.middleware.js";
import { defaultUserRepository, type UserRepository } from "../users/user.repository.js";
import { updateStoreSchema } from "./store.schemas.js";

export function getCurrentStoreController(deps?: {
  repository?: UserRepository;
}): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (_request, response, next) => {
    try {
      const user = response.locals.authUser as AuthenticatedUser | undefined;

      if (!user) {
        throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
      }

      const store = await repository.findStoreById(user.storeId);

      if (!store) {
        throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");
      }

      response.json({
        success: true,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  };
}

export function updateCurrentStoreController(deps?: {
  repository?: UserRepository;
}): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = response.locals.authUser as AuthenticatedUser | undefined;

      if (!user) {
        throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
      }

      const result = updateStoreSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Store settings are invalid.");
      }

      const store = await repository.updateStore(user.storeId, result.data);

      if (!store) {
        throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");
      }

      response.json({
        success: true,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  };
}
