import type { RequestHandler } from "express";
import { createStyledWorkbookBuffer, sendWorkbook } from "../../shared/excel/workbook.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../auth/auth.middleware.js";
import { defaultUserRepository, type UserRepository } from "../users/user.repository.js";
import { countInventorySchema, receiveInventorySchema } from "./inventory.schemas.js";

function requireLocalUser(response: Parameters<RequestHandler>[1]) {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return user;
}

export function receiveInventoryController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const result = receiveInventorySchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Inventory receiving data is invalid.");
      }

      const product = await repository.findProductById(result.data.productId);
      if (!product || product.storeId !== user.storeId) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      }

      const movement = await repository.adjustInventory({
        productId: product.id,
        type: "receive",
        quantityChange: result.data.quantity,
        unitCostSatang: result.data.unitCostSatang,
        note: result.data.note,
        createdByUserId: user.id,
      });

      response.status(201).json({ success: true, data: movement });
    } catch (error) {
      next(error);
    }
  };
}

export function countInventoryController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const result = countInventorySchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Inventory count data is invalid.");
      }

      const product = await repository.findProductById(result.data.productId);
      if (!product || product.storeId !== user.storeId) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      }

      const quantityChange = result.data.countedQuantity - product.stockQuantity;
      const movement = await repository.adjustInventory({
        productId: product.id,
        type: "count",
        quantityChange,
        note: result.data.note,
        createdByUserId: user.id,
      });

      response.status(201).json({ success: true, data: movement });
    } catch (error) {
      next(error);
    }
  };
}

export function exportInventoryController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (_request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const products = await repository.listProducts(user.storeId);
      const buffer = await createStyledWorkbookBuffer({
        sheetName: "Inventory",
        columns: [
          { header: "Barcode", key: "barcode", width: 20 },
          { header: "SKU", key: "sku", width: 18 },
          { header: "Product", key: "name", width: 32 },
          { header: "Unit", key: "unit", width: 12 },
          { header: "Cost", key: "cost", width: 14 },
          { header: "Sale Price", key: "salePrice", width: 14 },
          { header: "Stock", key: "stock", width: 12 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows: products.map((product) => ({
          barcode: product.barcode,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          cost: product.costPriceSatang / 100,
          salePrice: product.salePriceSatang / 100,
          stock: product.stockQuantity,
          status: product.status,
        })),
      });

      sendWorkbook(response, "inventory.xlsx", buffer);
    } catch (error) {
      next(error);
    }
  };
}
