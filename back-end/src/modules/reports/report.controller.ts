import type { RequestHandler } from "express";
import { createStyledWorkbookBuffer, sendWorkbook } from "../../shared/excel/workbook.ts";
import { AppError } from "../../shared/errors/app-error.ts";
import type { AuthenticatedUser } from "../auth/auth.middleware.ts";
import { defaultUserRepository, type SaleRecord, type UserRepository } from "../users/user.repository.ts";

const bangkokHourFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

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

function formatReportDate(value: string | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function bahtFromSatang(value: number) {
  return Number((value / 100).toFixed(2));
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

function saleItemCostSatang(item: SaleRecord["items"][number]) {
  return item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity;
}

function bangkokHour(value: string) {
  const hour = Number(bangkokHourFormatter.format(new Date(value)));
  return hour === 24 ? 0 : hour;
}

function productSalesReportRows(sales: SaleRecord[]) {
  const rows = new Map<
    string,
    {
      productId: string;
      productName: string;
      barcode: string;
      billIds: Set<string>;
      quantity: number;
      totalSalesSatang: number;
      totalCostSatang: number;
    }
  >();

  for (const sale of sales.filter((record) => record.status === "completed")) {
    for (const item of sale.items) {
      const current = rows.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        barcode: item.barcode,
        billIds: new Set<string>(),
        quantity: 0,
        totalSalesSatang: 0,
        totalCostSatang: 0,
      };

      current.billIds.add(sale.id);
      current.quantity += item.quantity;
      current.totalSalesSatang += item.totalSatang;
      current.totalCostSatang += saleItemCostSatang(item);
      rows.set(item.productId, current);
    }
  }

  return Array.from(rows.values())
    .map((row, index) => {
      const profitSatang = row.totalSalesSatang - row.totalCostSatang;

      return {
        no: index + 1,
        productName: row.productName,
        barcode: row.barcode,
        billCount: row.billIds.size,
        quantity: row.quantity,
        totalSalesSatang: row.totalSalesSatang,
        totalCostSatang: row.totalCostSatang,
        profitSatang,
        profitMarginPercent: marginPercent(profitSatang, row.totalSalesSatang),
      };
    })
    .sort((left, right) => {
      if (right.totalSalesSatang !== left.totalSalesSatang) {
        return right.totalSalesSatang - left.totalSalesSatang;
      }

      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }

      return left.productName.localeCompare(right.productName);
    })
    .map((row, index) => ({ ...row, no: index + 1 }));
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

function bestProfitProducts(sales: SaleRecord[]) {
  const rows = new Map<
    string,
    {
      productId: string;
      productName: string;
      quantity: number;
      totalSalesSatang: number;
      totalCostSatang: number;
      profitSatang: number;
      profitMarginPercent: number;
    }
  >();

  for (const sale of sales.filter((record) => record.status === "completed")) {
    for (const item of sale.items) {
      const current = rows.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        totalSalesSatang: 0,
        totalCostSatang: 0,
        profitSatang: 0,
        profitMarginPercent: 0,
      };
      const totalSalesSatang = current.totalSalesSatang + item.totalSatang;
      const totalCostSatang = current.totalCostSatang + saleItemCostSatang(item);
      const profitSatang = totalSalesSatang - totalCostSatang;

      rows.set(item.productId, {
        ...current,
        quantity: current.quantity + item.quantity,
        totalSalesSatang,
        totalCostSatang,
        profitSatang,
        profitMarginPercent: marginPercent(profitSatang, totalSalesSatang),
      });
    }
  }

  return Array.from(rows.values()).sort((left, right) => right.profitSatang - left.profitSatang);
}

function bestTimeSlots(sales: SaleRecord[]) {
  const rows = new Map<number, { hour: number; orderCount: number; totalSalesSatang: number }>();

  for (const sale of sales.filter((record) => record.status === "completed")) {
    const hour = bangkokHour(sale.soldAt);
    const current = rows.get(hour) ?? { hour, orderCount: 0, totalSalesSatang: 0 };
    rows.set(hour, {
      hour,
      orderCount: current.orderCount + 1,
      totalSalesSatang: current.totalSalesSatang + sale.totalSatang,
    });
  }

  return Array.from(rows.values()).sort((left, right) => right.totalSalesSatang - left.totalSalesSatang);
}

function hourlySales(sales: SaleRecord[]) {
  const rows = new Map<
    number,
    {
      hour: number;
      orderCount: number;
      totalSalesSatang: number;
      items: Map<
        string,
        {
          productId: string;
          productName: string;
          quantity: number;
          totalSalesSatang: number;
          totalCostSatang: number;
          profitSatang: number;
        }
      >;
    }
  >();

  for (const sale of sales.filter((record) => record.status === "completed")) {
    const hour = bangkokHour(sale.soldAt);
    const current = rows.get(hour) ?? {
      hour,
      orderCount: 0,
      totalSalesSatang: 0,
      items: new Map<
        string,
        {
          productId: string;
          productName: string;
          quantity: number;
          totalSalesSatang: number;
          totalCostSatang: number;
          profitSatang: number;
        }
      >(),
    };

    for (const item of sale.items) {
      const currentItem = current.items.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        totalSalesSatang: 0,
        totalCostSatang: 0,
        profitSatang: 0,
      };
      const itemTotalSalesSatang = currentItem.totalSalesSatang + item.totalSatang;
      const itemTotalCostSatang = currentItem.totalCostSatang + saleItemCostSatang(item);

      current.items.set(item.productId, {
        ...currentItem,
        quantity: currentItem.quantity + item.quantity,
        totalSalesSatang: itemTotalSalesSatang,
        totalCostSatang: itemTotalCostSatang,
        profitSatang: itemTotalSalesSatang - itemTotalCostSatang,
      });
    }

    rows.set(hour, {
      ...current,
      orderCount: current.orderCount + 1,
      totalSalesSatang: current.totalSalesSatang + sale.totalSatang,
    });
  }

  return Array.from(rows.values())
    .map((slot) => ({
      hour: slot.hour,
      orderCount: slot.orderCount,
      totalSalesSatang: slot.totalSalesSatang,
      items: Array.from(slot.items.values()).sort((left, right) => right.profitSatang - left.profitSatang),
    }))
    .sort((left, right) => left.hour - right.hour);
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
          productSales: productSalesReportRows(sales),
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
          bestProfitProducts: bestProfitProducts(sales),
          bestTimeSlots: bestTimeSlots(sales),
          hourlySales: hourlySales(sales),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export function productSalesHistoryController(deps?: { repository?: UserRepository }): RequestHandler {
  const repository = deps?.repository ?? defaultUserRepository;

  return async (request, response, next) => {
    try {
      const user = requireLocalUser(response);
      const productId = Array.isArray(request.params.productId) ? request.params.productId[0] : request.params.productId;
      const product = productId ? await repository.findProductById(productId) : null;

      if (!product || product.storeId !== user.storeId) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      }

      const rows = await repository.listProductSalesHistory(user.storeId, product.id, dateRange(request));

      response.json({
        success: true,
        data: {
          productId: product.id,
          rows,
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
      const range = dateRange(request);
      const sales = await repository.listSales(user.storeId, range);
      const summary = summarize(sales);
      const productRows = productSalesReportRows(sales);
      const buffer = await createStyledWorkbookBuffer({
        sheetName: "Product Sales",
        title: "รายงานยอดขายรายสินค้า",
        metadataRows: [
          ["ช่วงวันที่", `${formatReportDate(range.from)} ถึง ${formatReportDate(range.to)}`],
          ["ออกรายงานเมื่อ", formatReportDate(new Date().toISOString())],
        ],
        summaryRows: [
          ["สรุปยอดขาย", ""],
          ["จำนวนบิล", summary.orderCount],
          ["จำนวนชิ้น", summary.itemsSold],
          ["ยอดขายรวม", bahtFromSatang(summary.totalSalesSatang)],
          ["ต้นทุนรวม", bahtFromSatang(summary.totalCostSatang)],
          ["กำไรรวม", bahtFromSatang(summary.profitSatang)],
          ["กำไร %", `${summary.profitMarginPercent}%`],
        ],
        columns: [
          { header: "No", key: "no", width: 8 },
          { header: "Product", key: "productName", width: 32 },
          { header: "Barcode", key: "barcode", width: 20 },
          { header: "Bill Count", key: "orderCount", width: 14 },
          { header: "Items Sold", key: "itemCount", width: 14 },
          { header: "Total", key: "total", width: 14 },
          { header: "Cost", key: "cost", width: 14 },
          { header: "Profit", key: "profit", width: 14 },
          { header: "Profit %", key: "margin", width: 14 },
        ],
        rows: productRows.map((row) => ({
          no: row.no,
          productName: row.productName,
          barcode: row.barcode,
          orderCount: row.billCount,
          itemCount: row.quantity,
          total: row.totalSalesSatang / 100,
          cost: row.totalCostSatang / 100,
          profit: row.profitSatang / 100,
          margin: `${row.profitMarginPercent}%`,
        })),
      });

      sendWorkbook(response, "sales-report.xlsx", buffer);
    } catch (error) {
      next(error);
    }
  };
}
