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
  const completedSales = sales.filter((sale) => sale.status === "completed");
  const totalSalesSatang = completedSales.reduce((sum, sale) => sum + sale.totalSatang, 0);
  const totalCostSatang = completedSales.reduce((sum, sale) => sum + saleCostSatang(sale), 0);
  const profitSatang = totalSalesSatang - totalCostSatang;

  return {
    orderCount: completedSales.length,
    totalSalesSatang,
    itemsSold: completedSales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    ),
    totalCostSatang,
    profitSatang,
    profitMarginPercent: marginPercent(profitSatang, totalSalesSatang),
  };
}

function marginPercent(profitSatang: number, totalSalesSatang: number) {
  if (totalSalesSatang <= 0) {
    return 0;
  }

  return Number(((profitSatang / totalSalesSatang) * 100).toFixed(2));
}

function saleCostSatang(sale: SaleRecord) {
  return sale.items.reduce((sum, item) => {
    const itemCost = item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity;
    return sum + itemCost;
  }, 0);
}

function saleItemCount(sale: SaleRecord) {
  return sale.items.reduce((sum, item) => sum + item.quantity, 0);
}

function saleReportRows(sales: SaleRecord[]) {
  return sales.map((sale, index) => {
    const isCompleted = sale.status === "completed";
    const totalSalesSatang = isCompleted ? sale.totalSatang : 0;
    const itemCount = isCompleted ? saleItemCount(sale) : 0;
    const totalCostSatang = isCompleted ? saleCostSatang(sale) : 0;
    const profitSatang = totalSalesSatang - totalCostSatang;

    return {
      ...sale,
      billNumber: index + 1,
      orderCount: isCompleted ? 1 : 0,
      itemCount,
      totalCostSatang,
      profitSatang,
      profitMarginPercent: marginPercent(profitSatang, totalSalesSatang),
    };
  });
}

function bestSellers(sales: SaleRecord[]) {
  const rows = new Map<string, { productId: string; productName: string; quantity: number; totalSalesSatang: number }>();

  for (const sale of sales.filter((record) => record.status === "completed")) {
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

  for (const sale of sales.filter((record) => record.status === "completed")) {
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
          sales: saleReportRows(sales),
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
          { header: "No", key: "no", width: 8 },
          { header: "Receipt", key: "receipt", width: 24 },
          { header: "Sold At", key: "soldAt", width: 24 },
          { header: "Bill Count", key: "orderCount", width: 14 },
          { header: "Items", key: "items", width: 36 },
          { header: "Items Sold", key: "itemCount", width: 14 },
          { header: "Total", key: "total", width: 14 },
          { header: "Cost", key: "cost", width: 14 },
          { header: "Profit", key: "profit", width: 14 },
          { header: "Profit %", key: "margin", width: 14 },
          { header: "Cash", key: "cash", width: 14 },
          { header: "Change", key: "change", width: 14 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows: saleReportRows(sales).map((sale) => ({
          no: sale.billNumber,
          receipt: sale.receiptNumber,
          soldAt: sale.soldAt,
          orderCount: sale.orderCount,
          items: sale.items.map((item) => `${item.productName} x${item.quantity}`).join(", "),
          itemCount: sale.itemCount,
          total: (sale.orderCount ? sale.totalSatang : 0) / 100,
          cost: sale.totalCostSatang / 100,
          profit: sale.profitSatang / 100,
          margin: `${sale.profitMarginPercent}%`,
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
