import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../auth/auth.middleware.js";
import {
  defaultUserRepository,
  type SaleItemRecord,
  type SaleRecord,
  type UserRepository,
} from "../users/user.repository.js";
import { buildReceiptContent } from "./receipt.service.js";
import { checkoutSchema } from "./sale.schemas.js";

function requireLocalUser(response: Parameters<RequestHandler>[1]) {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return user;
}

function receiptNumber(date: Date) {
  const yyyyMMdd = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `RC${yyyyMMdd}-${date.getTime()}`;
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

      const saleItems: SaleItemRecord[] = [];
      for (const line of result.data.barcodeItems) {
        const product = await repository.findProductByBarcode(user.storeId, line.barcode);
        if (!product || product.status !== "active") {
          throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
        }
        if (product.stockQuantity < line.quantity) {
          throw new AppError(409, "INSUFFICIENT_STOCK", "Product stock is not enough.");
        }

        saleItems.push({
          id: crypto.randomUUID(),
          saleId: "",
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: line.quantity,
          unitPriceSatang: product.salePriceSatang,
          unitCostSatang: product.costPriceSatang,
          totalSatang: product.salePriceSatang * line.quantity,
          totalCostSatang: product.costPriceSatang * line.quantity,
        });
      }

      const totalSatang = saleItems.reduce((sum, item) => sum + item.totalSatang, 0);
      if (result.data.cashReceivedSatang < totalSatang) {
        throw new AppError(400, "INSUFFICIENT_PAYMENT", "Cash received is less than total.");
      }

      for (const item of saleItems) {
        await repository.adjustInventory({
          productId: item.productId,
          type: "sale",
          quantityChange: -item.quantity,
          createdByUserId: user.id,
        });
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
      const sale = await repository.createSale({
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
      const sale = await repository.findSaleById(String(request.params.id));

      if (!sale || sale.storeId !== user.storeId) {
        throw new AppError(404, "SALE_NOT_FOUND", "Sale not found.");
      }

      if (sale.status !== "void") {
        for (const item of sale.items) {
          await repository.adjustInventory({
            productId: item.productId,
            type: "void",
            quantityChange: item.quantity,
            note: `Void sale ${sale.receiptNumber}`,
            createdByUserId: user.id,
          });
        }
      }

      const voidedSale = await repository.voidSale(sale.id);
      if (!voidedSale) {
        throw new AppError(404, "SALE_NOT_FOUND", "Sale not found.");
      }

      response.json({ success: true, data: voidedSale });
    } catch (error) {
      next(error);
    }
  };
}
