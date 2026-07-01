import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.ts";
import type { AuthenticatedUser } from "../auth/auth.middleware.ts";
import { defaultUserRepository, type StoreRecord, type UserRepository } from "../users/user.repository.ts";
import { createStoreSchema, updateStoreSchema } from "./store.schemas.ts";

function storeResponse(store: StoreRecord, options?: { includeLogo?: boolean }) {
  return {
    id: store.id,
    name: store.name,
    phone: store.phone,
    address: store.address,
    ownerName: store.ownerName,
    status: store.status,
    ...(options?.includeLogo ? { logoUrl: store.logoUrl } : {}),
  };
}

export function listStoresController(deps?: {
  repository?: UserRepository;
}): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (_request, response, next) => {
    try {
      const user = response.locals.authUser as AuthenticatedUser | undefined;

      if (!user) {
        throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
      }

      const stores = await repository.listStores();

      response.json({
        success: true,
        data: stores,
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createStoreController(deps?: {
  repository?: UserRepository;
}): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = response.locals.authUser as AuthenticatedUser | undefined;

      if (!user) {
        throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
      }

      const result = createStoreSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Store details are invalid.");
      }

      const store = await repository.createStore(result.data);

      response.status(201).json({
        success: true,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  };
}

export function updateStoreByIdController(deps?: {
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

      const storeId = String(request.params.storeId);
      const store = await repository.updateStore(storeId, result.data);

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

export function getCurrentStoreController(deps?: {
  repository?: UserRepository;
}): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
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
        data: storeResponse(store, { includeLogo: request.query.includeLogo === "true" }),
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
