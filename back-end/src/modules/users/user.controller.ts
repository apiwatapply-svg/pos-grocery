import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../auth/auth.middleware.js";
import { hashPassword, toPublicUser } from "../auth/auth.service.js";
import { createUserSchema, updateUserSchema } from "./user.schemas.js";
import { defaultUserRepository, type UserRepository } from "./user.repository.js";

function requireLocalUser(response: Parameters<RequestHandler>[1]) {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return user;
}

export function listUsersController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (_request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const users = await repository.listUsers(user.storeId);

      response.json({ success: true, data: users.map(toPublicUser) });
    } catch (error) {
      next(error);
    }
  };
}

export function createUserController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const result = createUserSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "User data is invalid.");
      }

      const existing = await repository.findUserByUsername(result.data.username);
      if (existing?.storeId === user.storeId) {
        throw new AppError(409, "USERNAME_EXISTS", "Username already exists.");
      }

      const created = await repository.createUser({
        storeId: user.storeId,
        username: result.data.username,
        passwordHash: await hashPassword(result.data.password),
        displayName: result.data.displayName,
        role: result.data.role,
        status: result.data.status,
      });

      response.status(201).json({ success: true, data: toPublicUser(created) });
    } catch (error) {
      next(error);
    }
  };
}

export function updateUserController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const authUser = requireLocalUser(response);
      const result = updateUserSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "User data is invalid.");
      }

      const userId = String(request.params.id);
      const target = await repository.findUserById(userId);
      if (!target || target.storeId !== authUser.storeId) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      }

      const { password, ...rest } = result.data;
      const updated = await repository.updateUser(userId, {
        ...rest,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      });

      if (!updated) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      }

      response.json({ success: true, data: toPublicUser(updated) });
    } catch (error) {
      next(error);
    }
  };
}

export function deleteUserController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const authUser = requireLocalUser(response);
      const userId = String(request.params.id);
      const target = await repository.findUserById(userId);
      if (!target || target.storeId !== authUser.storeId) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      }

      const updated = await repository.deactivateUser(userId);

      if (!updated) {
        throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      }

      response.json({ success: true, data: toPublicUser(updated) });
    } catch (error) {
      next(error);
    }
  };
}
