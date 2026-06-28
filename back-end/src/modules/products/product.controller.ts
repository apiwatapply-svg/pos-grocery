import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../auth/auth.middleware.js";
import { defaultUserRepository, type UserRepository } from "../users/user.repository.js";
import { uploadProductImageToCloudinary } from "./cloudinary.service.js";
import { createProductSchema, updateProductSchema, uploadProductImageSchema } from "./product.schemas.js";

function requireLocalUser(response: Parameters<RequestHandler>[1]) {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return user;
}

export function listProductsController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (_request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const products = await repository.listProducts(user.storeId);

      response.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  };
}

export function createProductController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const result = createProductSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Product data is invalid.");
      }

      const existing = await repository.findProductByBarcode(user.storeId, result.data.barcode);
      if (existing) {
        throw new AppError(409, "BARCODE_EXISTS", "Product barcode already exists.");
      }

      const product = await repository.createProduct({
        storeId: user.storeId,
        ...result.data,
      });

      response.status(201).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  };
}

export function updateProductController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const result = updateProductSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Product data is invalid.");
      }

      const productId = String(request.params.id);
      const product = await repository.findProductById(productId);
      if (!product || product.storeId !== user.storeId) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      }

      const updated = await repository.updateProduct(product.id, result.data);

      response.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };
}

export function uploadProductImageController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const result = uploadProductImageSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Product image data is invalid.");
      }

      const productId = String(request.params.id);
      const product = await repository.findProductById(productId);
      if (!product || product.storeId !== user.storeId) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      }

      const uploaded = await uploadProductImageToCloudinary(result.data);
      const image = await repository.addProductImage({
        productId: product.id,
        provider: "cloudinary",
        publicId: uploaded.publicId,
        secureUrl: uploaded.secureUrl,
        thumbnailUrl: uploaded.thumbnailUrl,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
        bytes: uploaded.bytes,
        altText: result.data.altText,
      });

      response.status(201).json({ success: true, data: image });
    } catch (error) {
      next(error);
    }
  };
}
