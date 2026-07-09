import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.ts";
import type { AuthenticatedUser } from "../auth/auth.middleware.ts";
import {
  defaultUserRepository,
  type UserRepository,
} from "../users/user.repository.ts";
import { checkoutSchema } from "./sale.schemas.ts";

function requireLocalUser(response: Parameters<RequestHandler>[1]) {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return user;
}

function receiptNumber(date: Date) {
  const unixSeconds = Math.floor(date.getTime() / 1000);

  return `R-${unixSeconds}`;
}

function positiveInt(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function dateRange(request: Parameters<RequestHandler>[0]) {
  return {
    from: typeof request.query.from === "string" ? request.query.from : undefined,
    to: typeof request.query.to === "string" ? request.query.to : undefined,
  };
}

export function listSalesController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const pageSize = positiveInt(request.query.pageSize ?? request.query.limit, 10, 100);
      const page = positiveInt(request.query.page, 1, 100000);
      const result = await repository.listSaleSummaries(user.storeId, {
        ...dateRange(request),
        page,
        pageSize,
      });

      response.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}

export function getSaleController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const sale = await repository.findSaleById(String(request.params.id));

      if (!sale || sale.storeId !== user.storeId) {
        throw new AppError(404, "SALE_NOT_FOUND", "Sale not found.");
      }

      response.json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  };
}

export function checkoutController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const result = checkoutSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Checkout data is invalid.");
      }

      const soldAt = result.data.soldAt ?? new Date().toISOString();
      const sale = await repository.checkoutWithInventory({
        storeId: user.storeId,
        cashierUserId: user.id,
        receiptNumber: receiptNumber(new Date(soldAt)),
        barcodeItems: result.data.barcodeItems,
        paymentMethod: result.data.paymentMethod,
        cashReceivedSatang: result.data.cashReceivedSatang,
        soldAt,
      });

      response.status(201).json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  };
}

export function getReceiptController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const sale = await repository.findSaleById(String(request.params.id));

      if (!sale || sale.storeId !== user.storeId) {
        throw new AppError(404, "SALE_NOT_FOUND", "Sale not found.");
      }

      response.json({ success: true, data: sale.receipt });
    } catch (error) {
      next(error);
    }
  };
}

export function cancelSaleController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const voidedSale = await repository.voidSaleByIdWithInventory(user.storeId, String(request.params.id), user.id);
      if (!voidedSale) {
        throw new AppError(404, "SALE_NOT_FOUND", "Sale not found.");
      }

      response.json({ success: true, data: voidedSale });
    } catch (error) {
      next(error);
    }
  };
}

export function activateSaleController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const sale = await repository.findSaleById(String(request.params.id));

      if (!sale || sale.storeId !== user.storeId) {
        throw new AppError(404, "SALE_NOT_FOUND", "Sale not found.");
      }

      if (sale.status === "void") {
        for (const item of sale.items) {
          const product = await repository.findProductById(item.productId);
          if (!product || product.storeId !== user.storeId) {
            throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
          }
          if (product.stockQuantity < item.quantity) {
            throw new AppError(409, "INSUFFICIENT_STOCK", "Product stock is not enough.");
          }
        }

        for (const item of sale.items) {
          await repository.adjustInventory({
            productId: item.productId,
            type: "sale",
            quantityChange: -item.quantity,
            note: `Activate sale ${sale.receiptNumber}`,
            createdByUserId: user.id,
          });
        }
      }

      const activatedSale = await repository.activateSale(sale.id);
      if (!activatedSale) {
        throw new AppError(404, "SALE_NOT_FOUND", "Sale not found.");
      }

      response.json({ success: true, data: activatedSale });
    } catch (error) {
      next(error);
    }
  };
}
