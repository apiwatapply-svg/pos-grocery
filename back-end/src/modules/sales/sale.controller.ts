import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.ts";
import type { AuthenticatedUser } from "../auth/auth.middleware.ts";
import {
  defaultUserRepository,
  type SaleItemRecord,
  type SaleRecord,
  type UserRepository,
} from "../users/user.repository.ts";
import { buildReceiptContent } from "./receipt.service.ts";
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

      const store = await repository.findStoreById(user.storeId);
      if (!store) {
        throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");
      }

      const quantityByBarcode = new Map<string, number>();
      for (const line of result.data.barcodeItems) {
        const barcode = line.barcode.trim();
        quantityByBarcode.set(barcode, (quantityByBarcode.get(barcode) ?? 0) + line.quantity);
      }

      const products = await repository.findProductsByBarcodes(user.storeId, Array.from(quantityByBarcode.keys()));
      const productByBarcode = new Map(products.map((product) => [product.barcode, product]));

      const saleItems: SaleItemRecord[] = [];
      for (const [barcode, quantity] of quantityByBarcode) {
        const product = productByBarcode.get(barcode);
        if (!product || product.status !== "active") {
          throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
        }
        if (product.stockQuantity < quantity) {
          throw new AppError(409, "INSUFFICIENT_STOCK", "Product stock is not enough.");
        }

        saleItems.push({
          id: crypto.randomUUID(),
          saleId: "",
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity,
          unitPriceSatang: product.salePriceSatang,
          unitCostSatang: product.costPriceSatang,
          totalSatang: product.salePriceSatang * quantity,
          totalCostSatang: product.costPriceSatang * quantity,
        });
      }

      const totalSatang = saleItems.reduce((sum, item) => sum + item.totalSatang, 0);
      if (result.data.cashReceivedSatang < totalSatang) {
        throw new AppError(400, "INSUFFICIENT_PAYMENT", "Cash received is less than total.");
      }

      const soldAt = result.data.soldAt ?? new Date().toISOString();
      const baseSale = {
        storeId: user.storeId,
        cashierUserId: user.id,
        receiptNumber: receiptNumber(new Date(soldAt)),
        subtotalSatang: totalSatang,
        totalSatang,
        cashReceivedSatang: result.data.cashReceivedSatang,
        changeDueSatang: result.data.cashReceivedSatang - totalSatang,
        status: "completed" as const,
        soldAt,
        items: saleItems,
        payment: {
          id: crypto.randomUUID(),
          saleId: "",
          method: result.data.paymentMethod,
          amountSatang: totalSatang,
          createdAt: new Date().toISOString(),
        },
        receipt: {
          id: crypto.randomUUID(),
          saleId: "",
          content: "",
          createdAt: new Date().toISOString(),
        },
      };
      const sale = await repository.createSaleWithInventory({
        ...baseSale,
        receipt: {
          ...baseSale.receipt,
          content: buildReceiptContent(store, {
            id: "",
            createdAt: "",
            ...baseSale,
          } satisfies SaleRecord),
        },
      });

      if (!sale) {
        throw new AppError(409, "INSUFFICIENT_STOCK", "Product stock is not enough.");
      }

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
