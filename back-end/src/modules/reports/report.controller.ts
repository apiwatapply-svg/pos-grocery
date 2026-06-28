import type { RequestHandler } from "express";
import { createStyledWorkbookBuffer, sendWorkbook } from "../../shared/excel/workbook.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../auth/auth.middleware.js";
import { defaultUserRepository, type SaleRecord, type UserRepository } from "../users/user.repository.js";

function requireLocalUser(response: Parameters<RequestHandler>[1]) {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  return user;
}

function dateRange(request: Parameters<RequestHandler>[0]) {
  return {
    from: typeof request.query.from === "string" ? request.query.from : undefined,
    to: typeof request.query.to === "string" ? request.query.to : undefined,
  };
}

function summarize(sales: SaleRecord[]) {
  return {
    orderCount: sales.length,
    totalSalesSatang: sales.reduce((sum, sale) => sum + sale.totalSatang, 0),
    itemsSold: sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    ),
  };
}

function bestSellers(sales: SaleRecord[]) {
  const rows = new Map<string, { productId: string; productName: string; quantity: number; totalSalesSatang: number }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const current = rows.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        totalSalesSatang: 0,
      };
      rows.set(item.productId, {
        ...current,
        quantity: current.quantity + item.quantity,
        totalSalesSatang: current.totalSalesSatang + item.totalSatang,
      });
    }
  }

  return Array.from(rows.values()).sort((left, right) => right.quantity - left.quantity);
}

function bestTimeSlots(sales: SaleRecord[]) {
  const rows = new Map<number, { hour: number; orderCount: number; totalSalesSatang: number }>();

  for (const sale of sales) {
    const hour = new Date(sale.soldAt).getUTCHours();
    const current = rows.get(hour) ?? { hour, orderCount: 0, totalSalesSatang: 0 };
    rows.set(hour, {
      hour,
      orderCount: current.orderCount + 1,
      totalSalesSatang: current.totalSalesSatang + sale.totalSatang,
    });
  }

  return Array.from(rows.values()).sort((left, right) => right.totalSalesSatang - left.totalSalesSatang);
}

export function salesReportController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const sales = await repository.listSales(user.storeId, dateRange(request));

      response.json({
        success: true,
        data: {
          summary: summarize(sales),
          sales,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export function dashboardController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const sales = await repository.listSales(user.storeId, dateRange(request));

      response.json({
        success: true,
        data: {
          summary: summarize(sales),
          bestSellers: bestSellers(sales),
          bestTimeSlots: bestTimeSlots(sales),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export function exportSalesReportController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const sales = await repository.listSales(user.storeId, dateRange(request));
      const buffer = await createStyledWorkbookBuffer({
        sheetName: "Sales Report",
        columns: [
          { header: "Receipt", key: "receipt", width: 24 },
          { header: "Sold At", key: "soldAt", width: 24 },
          { header: "Items", key: "items", width: 36 },
          { header: "Total", key: "total", width: 14 },
          { header: "Cash", key: "cash", width: 14 },
          { header: "Change", key: "change", width: 14 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows: sales.map((sale) => ({
          receipt: sale.receiptNumber,
          soldAt: sale.soldAt,
          items: sale.items.map((item) => `${item.productName} x${item.quantity}`).join(", "),
          total: sale.totalSatang / 100,
          cash: sale.cashReceivedSatang / 100,
          change: sale.changeDueSatang / 100,
          status: sale.status,
        })),
      });

      sendWorkbook(response, "sales-report.xlsx", buffer);
    } catch (error) {
      next(error);
    }
  };
}
