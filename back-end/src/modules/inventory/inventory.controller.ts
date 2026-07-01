import type { RequestHandler } from "express";
import { createStyledWorkbookBuffer, sendWorkbook } from "../../shared/excel/workbook.ts";
import { AppError } from "../../shared/errors/app-error.ts";
import type { AuthenticatedUser } from "../auth/auth.middleware.ts";
import { defaultUserRepository, type UserRepository } from "../users/user.repository.ts";
import { countInventorySchema, receiveInventorySchema } from "./inventory.schemas.ts";

function requireLocalUser(response: Parameters<RequestHandler>[1]) {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return user;
}

function inventoryTransactionResponse(
  transaction: Awaited<ReturnType<UserRepository["listInventoryTransactions"]>>[number],
) {
  return {
    id: transaction.id,
    productId: transaction.productId,
    productName: transaction.product.name,
    barcode: transaction.product.barcode,
    type: transaction.type,
    quantityChange: transaction.quantityChange,
    balanceAfterChange: transaction.balanceAfterChange,
    createdAt: transaction.createdAt,
    createdBy: transaction.createdBy?.displayName ?? transaction.createdBy?.username,
  };
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

export function listInventoryTransactionsController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const requestedLimit = typeof request.query.limit === "string" ? Number(request.query.limit) : 50;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 50;
      const transactions = await repository.listInventoryTransactions(user.storeId, { limit });

      response.json({ success: true, data: transactions.map(inventoryTransactionResponse) });
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
          { header: "อันดับ", key: "rank", width: 10 },
          { header: "Barcode", key: "barcode", width: 20 },
          { header: "Product", key: "name", width: 32 },
          { header: "Unit", key: "unit", width: 12 },
          { header: "Cost", key: "cost", width: 14 },
          { header: "Sale Price", key: "salePrice", width: 14 },
          { header: "Stock", key: "stock", width: 12 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows: products.map((product, index) => ({
          rank: index + 1,
          barcode: product.barcode,
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
