import { createClient, type InStatement } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.ts";
import type {
  InventoryTransactionRecord,
  InventoryTransactionWithProductRecord,
  ProductImageRecord,
  ProductSalesHistoryRecord,
  ProductRecord,
  SaleSummaryRecord,
  SaleRecord,
  StoreRecord,
  UserRecord,
  UserRepository,
} from "./user.repository.ts";

type PrismaUserRepositoryOptions = {
  prisma?: PrismaClient;
};

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);
const optional = <T>(value: T | null | undefined) => value ?? undefined;
const storeCache = new Map<string, StoreRecord>();
let checkoutClient: ReturnType<typeof createClient> | undefined;

function createPrismaClient() {
  const adapter = new PrismaLibSQL({
    url: env.DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  return new PrismaClient({ adapter });
}

function getCheckoutClient() {
  checkoutClient ??= createClient({
    url: env.DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  return checkoutClient;
}

function mapStore(store: {
  id: string;
  name: string;
  phone: string;
  address: string;
  ownerName: string;
  logoUrl: string | null;
  status: string;
}): StoreRecord {
  return {
    id: store.id,
    name: store.name,
    phone: store.phone,
    address: store.address,
    ownerName: store.ownerName,
    logoUrl: optional(store.logoUrl),
    status: store.status === "inactive" ? "inactive" : "active",
  };
}

function cacheStore(store: StoreRecord) {
  storeCache.set(store.id, store);
  return store;
}

function mapUser(user: {
  id: string;
  storeId: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: string;
  status: string;
}): UserRecord {
  return {
    id: user.id,
    storeId: user.storeId,
    username: user.username,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role === "cashier" || user.role === "stock" || user.role === "admin" ? user.role : "owner",
    status: user.status === "inactive" ? "inactive" : "active",
  };
}

function mapImage(image: {
  id: string;
  productId: string;
  provider: string;
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  altText: string | null;
  createdAt: Date | string;
}): ProductImageRecord {
  return {
    id: image.id,
    productId: image.productId,
    provider: "cloudinary",
    publicId: image.publicId,
    secureUrl: image.secureUrl,
    thumbnailUrl: image.thumbnailUrl,
    width: optional(image.width),
    height: optional(image.height),
    format: optional(image.format),
    bytes: optional(image.bytes),
    altText: optional(image.altText),
    createdAt: toIso(image.createdAt),
  };
}

function mapProduct(product: {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  barcode: string;
  unit: string;
  costPriceSatang: number;
  salePriceSatang: number;
  stockQuantity: number;
  status: string;
  images?: Array<Parameters<typeof mapImage>[0]>;
}): ProductRecord {
  return {
    id: product.id,
    storeId: product.storeId,
    categoryId: optional(product.categoryId),
    name: product.name,
    barcode: product.barcode,
    unit: product.unit,
    costPriceSatang: product.costPriceSatang,
    salePriceSatang: product.salePriceSatang,
    stockQuantity: product.stockQuantity,
    status: product.status === "inactive" ? "inactive" : "active",
    images: product.images?.map(mapImage) ?? [],
  };
}

function monthKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 7);
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function averageMonthlySalesQuantity(monthlyQuantities?: Map<string, number>) {
  if (!monthlyQuantities || monthlyQuantities.size === 0) {
    return 0;
  }

  const totalQuantity = Array.from(monthlyQuantities.values()).reduce((sum, quantity) => sum + quantity, 0);

  return roundOneDecimal(totalQuantity / monthlyQuantities.size);
}

function mapInventoryTransaction(transaction: {
  id: string;
  productId: string;
  type: string;
  quantityChange: number;
  unitCostSatang: number | null;
  balanceAfterChange: number;
  note: string | null;
  createdByUserId: string | null;
  createdAt: Date | string;
}): InventoryTransactionRecord {
  return {
    id: transaction.id,
    productId: transaction.productId,
    type:
      transaction.type === "receive" ||
      transaction.type === "count" ||
      transaction.type === "sale" ||
      transaction.type === "void"
        ? transaction.type
        : "count",
    quantityChange: transaction.quantityChange,
    unitCostSatang: optional(transaction.unitCostSatang),
    balanceAfterChange: transaction.balanceAfterChange,
    note: optional(transaction.note),
    createdByUserId: optional(transaction.createdByUserId),
    createdAt: toIso(transaction.createdAt),
  };
}

function mapInventoryTransactionWithProduct(transaction: Parameters<typeof mapInventoryTransaction>[0] & {
  product: Parameters<typeof mapProduct>[0];
  createdByUser?: Pick<UserRecord, "id" | "username" | "displayName"> | null;
}): InventoryTransactionWithProductRecord {
  const createdBy = transaction.createdByUser
    ? {
        id: transaction.createdByUser.id,
        username: transaction.createdByUser.username,
        displayName: transaction.createdByUser.displayName,
      }
    : undefined;

  return {
    ...mapInventoryTransaction(transaction),
    product: mapProduct(transaction.product),
    createdBy,
  };
}

function mapSale(sale: {
  id: string;
  storeId: string;
  cashierUserId: string;
  receiptNumber: string;
  subtotalSatang: number;
  totalSatang: number;
  cashReceivedSatang: number;
  changeDueSatang: number;
  status: string;
  soldAt: Date | string;
  createdAt: Date | string;
  items: Array<{
    id: string;
    saleId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceSatang: number;
    totalSatang: number;
    product?: { barcode: string; costPriceSatang: number };
  }>;
  payment: {
    id: string;
    saleId: string;
    method: string;
    amountSatang: number;
    createdAt: Date | string;
  } | null;
  receipt: {
    id: string;
    saleId: string;
    content: string;
    createdAt: Date | string;
  } | null;
}): SaleRecord {
  if (!sale.payment || !sale.receipt) {
    throw new Error("Sale is missing payment or receipt.");
  }

  return {
    id: sale.id,
    storeId: sale.storeId,
    cashierUserId: sale.cashierUserId,
    receiptNumber: sale.receiptNumber,
    subtotalSatang: sale.subtotalSatang,
    totalSatang: sale.totalSatang,
    cashReceivedSatang: sale.cashReceivedSatang,
    changeDueSatang: sale.changeDueSatang,
    status: sale.status === "void" ? "void" : "completed",
    soldAt: toIso(sale.soldAt),
    createdAt: toIso(sale.createdAt),
    items: sale.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      productName: item.productName,
      barcode: item.product?.barcode ?? "",
      quantity: item.quantity,
      unitPriceSatang: item.unitPriceSatang,
      unitCostSatang: item.product?.costPriceSatang ?? 0,
      totalSatang: item.totalSatang,
      totalCostSatang: (item.product?.costPriceSatang ?? 0) * item.quantity,
    })),
    payment: {
      id: sale.payment.id,
      saleId: sale.payment.saleId,
      method:
        sale.payment.method === "transfer" || sale.payment.method === "card"
          ? sale.payment.method
          : "cash",
      amountSatang: sale.payment.amountSatang,
      createdAt: toIso(sale.payment.createdAt),
    },
    receipt: {
      id: sale.receipt.id,
      saleId: sale.receipt.saleId,
      content: sale.receipt.content,
      createdAt: toIso(sale.receipt.createdAt),
    },
  };
}

function mapSaleForReport(sale: Omit<Parameters<typeof mapSale>[0], "payment" | "receipt">): SaleRecord {
  return {
    id: sale.id,
    storeId: sale.storeId,
    cashierUserId: sale.cashierUserId,
    receiptNumber: sale.receiptNumber,
    subtotalSatang: sale.subtotalSatang,
    totalSatang: sale.totalSatang,
    cashReceivedSatang: sale.cashReceivedSatang,
    changeDueSatang: sale.changeDueSatang,
    status: sale.status === "void" ? "void" : "completed",
    soldAt: toIso(sale.soldAt),
    createdAt: toIso(sale.createdAt),
    items: sale.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      productName: item.productName,
      barcode: item.product?.barcode ?? "",
      quantity: item.quantity,
      unitPriceSatang: item.unitPriceSatang,
      unitCostSatang: item.product?.costPriceSatang ?? 0,
      totalSatang: item.totalSatang,
      totalCostSatang: (item.product?.costPriceSatang ?? 0) * item.quantity,
    })),
    payment: {
      id: "",
      saleId: sale.id,
      method: "cash",
      amountSatang: sale.totalSatang,
      createdAt: toIso(sale.createdAt),
    },
    receipt: {
      id: "",
      saleId: sale.id,
      content: "",
      createdAt: toIso(sale.createdAt),
    },
  };
}

type SaleSummarySqlRow = {
  id: string;
  storeId: string;
  cashierUserId: string;
  receiptNumber: string;
  totalSatang: number | bigint;
  cashReceivedSatang: number | bigint;
  changeDueSatang: number | bigint;
  status: string;
  soldAt: Date | string;
  createdAt: Date | string;
  lineItemCount: number | bigint | null;
  itemCount: number | bigint | null;
  totalCostSatang: number | bigint | null;
  totalCount: number | bigint | null;
};

type LibSqlUpdatedProductStockRow = {
  id: string;
  stockQuantity: number | bigint | string;
};

type LibSqlSaleRow = {
  id: string;
  storeId: string;
  cashierUserId: string;
  receiptNumber: string;
  subtotalSatang: number | bigint | string;
  totalSatang: number | bigint | string;
  cashReceivedSatang: number | bigint | string;
  changeDueSatang: number | bigint | string;
  status: string;
  soldAt: Date | string;
  createdAt: Date | string;
};

type LibSqlSaleItemRow = {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number | bigint | string;
  unitPriceSatang: number | bigint | string;
  unitCostSatang: number | bigint | string | null;
  totalSatang: number | bigint | string;
  totalCostSatang: number | bigint | string | null;
};

function dbNumber(value: number | bigint | null | undefined) {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function dbNumberLoose(value: number | bigint | string | null | undefined) {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function mapSaleSummarySqlRow(row: SaleSummarySqlRow): SaleSummaryRecord {
  const status = row.status === "void" ? "void" : "completed";
  const totalSatang = dbNumber(row.totalSatang);
  const totalCostSatang = status === "completed" ? dbNumber(row.totalCostSatang) : 0;
  const profitSatang = status === "completed" ? totalSatang - totalCostSatang : 0;

  return {
    id: row.id,
    storeId: row.storeId,
    cashierUserId: row.cashierUserId,
    receiptNumber: row.receiptNumber,
    totalSatang,
    cashReceivedSatang: dbNumber(row.cashReceivedSatang),
    changeDueSatang: dbNumber(row.changeDueSatang),
    status,
    soldAt: toIso(row.soldAt),
    createdAt: toIso(row.createdAt),
    itemCount: status === "completed" ? dbNumber(row.itemCount) : 0,
    lineItemCount: status === "completed" ? dbNumber(row.lineItemCount) : 0,
    totalCostSatang,
    profitSatang,
    profitMarginPercent: totalSatang > 0
      ? Number(((profitSatang / totalSatang) * 100).toFixed(2))
      : 0,
  };
}

function mapLibSqlSale(sale: LibSqlSaleRow, items: LibSqlSaleItemRow[]): SaleRecord {
  const createdAt = toIso(sale.createdAt);
  const totalSatang = dbNumberLoose(sale.totalSatang);

  return {
    id: sale.id,
    storeId: sale.storeId,
    cashierUserId: sale.cashierUserId,
    receiptNumber: sale.receiptNumber,
    subtotalSatang: dbNumberLoose(sale.subtotalSatang),
    totalSatang,
    cashReceivedSatang: dbNumberLoose(sale.cashReceivedSatang),
    changeDueSatang: dbNumberLoose(sale.changeDueSatang),
    status: sale.status === "void" ? "void" : "completed",
    soldAt: toIso(sale.soldAt),
    createdAt,
    items: items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      productName: item.productName,
      barcode: item.barcode,
      quantity: dbNumberLoose(item.quantity),
      unitPriceSatang: dbNumberLoose(item.unitPriceSatang),
      unitCostSatang: dbNumberLoose(item.unitCostSatang),
      totalSatang: dbNumberLoose(item.totalSatang),
      totalCostSatang: dbNumberLoose(item.totalCostSatang),
    })),
    payment: {
      id: "",
      saleId: sale.id,
      method: "cash",
      amountSatang: totalSatang,
      createdAt,
    },
    receipt: {
      id: "",
      saleId: sale.id,
      content: "",
      createdAt,
    },
  };
}

function saleSummaryWhereClause(storeId: string, input?: { from?: string; to?: string }) {
  const conditions = [Prisma.sql`s."storeId" = ${storeId}`];

  if (input?.from) {
    conditions.push(Prisma.sql`s."soldAt" >= ${new Date(input.from)}`);
  }

  if (input?.to) {
    conditions.push(Prisma.sql`s."soldAt" <= ${new Date(input.to)}`);
  }

  return Prisma.join(conditions, " AND ");
}

const bangkokDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Bangkok",
  year: "numeric",
});

function dateKeyFromIso(value: string | Date) {
  return bangkokDateFormatter.format(new Date(value));
}

function dateKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function reportDateWindow(input?: { from?: string; to?: string }) {
  const todayKey = dateKeyFromDate(new Date());
  const fromKey = input?.from ? input.from.slice(0, 10) : todayKey;
  const toKey = input?.to ? input.to.slice(0, 10) : fromKey;

  return fromKey <= toKey ? { fromKey, toKey } : { fromKey: toKey, toKey: fromKey };
}

function eachDateKey(fromKey: string, toKey: string) {
  const dates: string[] = [];
  const current = new Date(`${fromKey}T00:00:00.000Z`);
  const end = new Date(`${toKey}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(dateKeyFromDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function emptyProductSalesHistoryRow(date: string): ProductSalesHistoryRecord {
  return {
    date,
    quantity: 0,
    totalSalesSatang: 0,
    totalCostSatang: 0,
    profitSatang: 0,
    profitMarginPercent: 0,
  };
}

function fillProductSalesHistoryDates(
  rows: Map<string, ProductSalesHistoryRecord>,
  input?: { from?: string; to?: string },
) {
  const { fromKey, toKey } = reportDateWindow(input);

  return eachDateKey(fromKey, toKey).map((date) => rows.get(date) ?? emptyProductSalesHistoryRow(date));
}

export function createPrismaUserRepository(options?: PrismaUserRepositoryOptions): UserRepository {
  const prisma = options?.prisma ?? createPrismaClient();

  return {
    async findUserByUsername(username) {
      const normalized = username.trim().toLowerCase();
      const user = await prisma.user.findFirst({ where: { username: { equals: normalized } } });
      return user ? mapUser(user) : null;
    },
    async findUserById(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? mapUser(user) : null;
    },
    async listUsers(storeId) {
      const users = await prisma.user.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } });
      return users.map(mapUser);
    },
    async listAllUsers() {
      const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
      return users.map(mapUser);
    },
    async createUser(input) {
      return mapUser(await prisma.user.create({ data: input }));
    },
    async updateUser(id, input) {
      try {
        return mapUser(await prisma.user.update({ where: { id }, data: input }));
      } catch {
        return null;
      }
    },
    async deactivateUser(id) {
      try {
        return mapUser(await prisma.user.update({ where: { id }, data: { status: "inactive" } }));
      } catch {
        return null;
      }
    },
    async findStoreById(id) {
      const cachedStore = storeCache.get(id);
      if (cachedStore) {
        return cachedStore;
      }

      const store = await prisma.store.findUnique({ where: { id } });
      return store ? cacheStore(mapStore(store)) : null;
    },
    async listStores() {
      const stores = await prisma.store.findMany({ orderBy: { createdAt: "asc" } });
      return stores.map(mapStore);
    },
    async getFirstStore() {
      const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
      return store ? cacheStore(mapStore(store)) : null;
    },
    async createStore(input) {
      return cacheStore(mapStore(await prisma.store.create({ data: input })));
    },
    async updateStore(id, input) {
      try {
        const store = cacheStore(mapStore(await prisma.store.update({ where: { id }, data: input })));
        return store;
      } catch {
        storeCache.delete(id);
        return null;
      }
    },
    async listProducts(storeId, input) {
      const includeImages = input?.includeImages ?? true;
      const includeSalesStats = input?.includeSalesStats ?? true;
      const products = await prisma.product.findMany({
        where: { storeId },
        include: {
          images: includeImages ? { orderBy: { createdAt: "desc" } } : false,
        },
        orderBy: { name: "asc" },
      });

      const productIds = products.map((product) => product.id);
      const sales = includeSalesStats && productIds.length > 0
        ? await prisma.sale.findMany({
            where: {
              storeId,
              status: "completed",
              items: { some: { productId: { in: productIds } } },
            },
            select: {
              soldAt: true,
              items: {
                where: { productId: { in: productIds } },
                select: {
                  productId: true,
                  quantity: true,
                },
              },
            },
          })
        : [];
      const monthlyQuantitiesByProduct = new Map<string, Map<string, number>>();

      for (const sale of sales) {
        const month = monthKeyFromDate(sale.soldAt);

        for (const item of sale.items) {
          const monthlyQuantities = monthlyQuantitiesByProduct.get(item.productId) ?? new Map<string, number>();
          monthlyQuantities.set(month, (monthlyQuantities.get(month) ?? 0) + item.quantity);
          monthlyQuantitiesByProduct.set(item.productId, monthlyQuantities);
        }
      }

      return products.map((product) => ({
        ...mapProduct(product),
        averageMonthlySalesQuantity: averageMonthlySalesQuantity(monthlyQuantitiesByProduct.get(product.id)),
      }));
    },
    async findProductById(id) {
      const product = await prisma.product.findUnique({
        where: { id },
        include: { images: { orderBy: { createdAt: "desc" } } },
      });
      return product ? mapProduct(product) : null;
    },
    async findProductByBarcode(storeId, barcode) {
      const product = await prisma.product.findUnique({
        where: { storeId_barcode: { storeId, barcode: barcode.trim() } },
        include: { images: { orderBy: { createdAt: "desc" } } },
      });
      return product ? mapProduct(product) : null;
    },
    async findProductsByBarcodes(storeId, barcodes) {
      const uniqueBarcodes = Array.from(new Set(barcodes.map((barcode) => barcode.trim()).filter(Boolean)));

      if (uniqueBarcodes.length === 0) {
        return [];
      }

      const products = await prisma.product.findMany({
        where: {
          storeId,
          barcode: { in: uniqueBarcodes },
        },
      });
      return products.map((product) => mapProduct({ ...product, images: [] }));
    },
    async createProduct(input) {
      const product = await prisma.product.create({
        data: {
          storeId: input.storeId,
          categoryId: input.categoryId,
          name: input.name,
          barcode: input.barcode,
          unit: input.unit,
          costPriceSatang: input.costPriceSatang,
          salePriceSatang: input.salePriceSatang,
          stockQuantity: input.stockQuantity ?? 0,
          status: input.status,
        },
        include: { images: { orderBy: { createdAt: "desc" } } },
      });
      return mapProduct(product);
    },
    async updateProduct(id, input) {
      try {
        const product = await prisma.product.update({
          where: { id },
          data: input,
          include: { images: { orderBy: { createdAt: "desc" } } },
        });
        return mapProduct(product);
      } catch {
        return null;
      }
    },
    async addProductImage(input) {
      try {
        return mapImage(await prisma.productImage.create({ data: input }));
      } catch {
        return null;
      }
    },
    async adjustInventory(input) {
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const product = await tx.product.findUnique({
          where: { id: input.productId },
          include: { images: { orderBy: { createdAt: "desc" } } },
        });

        if (!product) {
          return null;
        }

        if (input.quantityChange < 0) {
          const updated = await tx.product.updateMany({
            where: {
              id: input.productId,
              stockQuantity: { gte: Math.abs(input.quantityChange) },
            },
            data: {
              stockQuantity: { increment: input.quantityChange },
            },
          });

          if (updated.count === 0) {
            return null;
          }
        } else {
          await tx.product.update({
            where: { id: input.productId },
            data: { stockQuantity: { increment: input.quantityChange } },
          });
        }

        const updatedProduct = await tx.product.findUniqueOrThrow({
          where: { id: input.productId },
          include: { images: { orderBy: { createdAt: "desc" } } },
        });
        const transaction = await tx.inventoryTransaction.create({
          data: {
            productId: input.productId,
            type: input.type,
            quantityChange: input.quantityChange,
            unitCostSatang: input.unitCostSatang,
            balanceAfterChange: updatedProduct.stockQuantity,
            note: input.note,
            createdByUserId: input.createdByUserId,
          },
        });

        return {
          product: mapProduct(updatedProduct),
          transaction: mapInventoryTransaction(transaction),
        };
      });
    },
    async listInventoryTransactions(storeId, input) {
      const transactions = await prisma.inventoryTransaction.findMany({
        where: { product: { storeId } },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
        include: {
          product: {
            select: {
              id: true,
              storeId: true,
              categoryId: true,
              name: true,
              barcode: true,
              unit: true,
              costPriceSatang: true,
              salePriceSatang: true,
              stockQuantity: true,
              status: true,
            },
          },
        },
      });
      const userIds = Array.from(
        new Set(
          transactions
            .map((transaction) => transaction.createdByUserId)
            .filter((userId): userId is string => Boolean(userId)),
        ),
      );
      const createdByUsers = userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, displayName: true },
          })
        : [];
      const createdByById = new Map(createdByUsers.map((user) => [user.id, user]));

      return transactions.map((transaction) =>
        mapInventoryTransactionWithProduct({
          ...transaction,
          createdByUser: transaction.createdByUserId
            ? createdByById.get(transaction.createdByUserId) ?? null
            : null,
        }),
      );
    },
    async createSale(input) {
      const sale = await prisma.sale.create({
        data: {
          storeId: input.storeId,
          cashierUserId: input.cashierUserId,
          receiptNumber: input.receiptNumber,
          subtotalSatang: input.subtotalSatang,
          totalSatang: input.totalSatang,
          cashReceivedSatang: input.cashReceivedSatang,
          changeDueSatang: input.changeDueSatang,
          status: input.status,
          soldAt: new Date(input.soldAt),
          items: {
            create: input.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPriceSatang: item.unitPriceSatang,
              totalSatang: item.totalSatang,
            })),
          },
          payment: {
            create: {
              id: input.payment.id,
              method: input.payment.method,
              amountSatang: input.payment.amountSatang,
              createdAt: new Date(input.payment.createdAt),
            },
          },
          receipt: {
            create: {
              id: input.receipt.id,
              content: input.receipt.content,
              createdAt: new Date(input.receipt.createdAt),
            },
          },
        },
        include: { items: { include: { product: true } }, payment: true, receipt: true },
      });
      return mapSale(sale);
    },
    async createSaleWithInventory(input) {
      if (input.items.length === 0) {
        return null;
      }

      const client = getCheckoutClient();
      const transaction = await client.transaction("write");
      const saleId = randomUUID();
      const createdAt = new Date().toISOString();
      const soldAt = new Date(input.soldAt).toISOString();
      const itemIds = input.items.map((item) => item.productId);
      const stockCase = input.items.map(() => "WHEN ? THEN ?").join(" ");
      const stockCaseArgs = input.items.flatMap((item) => [item.productId, item.quantity]);
      const productIdPlaceholders = itemIds.map(() => "?").join(", ");

      try {
        const updatedProducts = await transaction.execute({
          sql: `
            UPDATE "Product"
            SET "stockQuantity" = "stockQuantity" - CASE "id" ${stockCase} ELSE 0 END
            WHERE "id" IN (${productIdPlaceholders})
              AND "stockQuantity" >= CASE "id" ${stockCase} ELSE 0 END
            RETURNING "id", "stockQuantity"
          `,
          args: [...stockCaseArgs, ...itemIds, ...stockCaseArgs],
        });

        if (updatedProducts.rows.length !== itemIds.length) {
          await transaction.rollback();
          return null;
        }

        const stockByProductId = new Map(
          updatedProducts.rows.map((product) => {
            const row = product as unknown as LibSqlUpdatedProductStockRow;
            return [String(row.id), dbNumberLoose(row.stockQuantity)];
          }),
        );

        const statements: InStatement[] = [
          {
            sql: `
              INSERT INTO "Sale" (
                id, "storeId", "cashierUserId", "receiptNumber", "subtotalSatang",
                "totalSatang", "cashReceivedSatang", "changeDueSatang", status,
                "soldAt", "createdAt"
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              saleId,
              input.storeId,
              input.cashierUserId,
              input.receiptNumber,
              input.subtotalSatang,
              input.totalSatang,
              input.cashReceivedSatang,
              input.changeDueSatang,
              input.status,
              soldAt,
              createdAt,
            ],
          },
          ...input.items.map((item) => ({
            sql: `
              INSERT INTO "SaleItem" (
                id, "saleId", "productId", "productName", quantity,
                "unitPriceSatang", "totalSatang"
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              item.id,
              saleId,
              item.productId,
              item.productName,
              item.quantity,
              item.unitPriceSatang,
              item.totalSatang,
            ],
          })),
          ...input.items.map((item) => ({
            sql: `
              INSERT INTO "InventoryTransaction" (
                id, "productId", type, "quantityChange", "unitCostSatang",
                "balanceAfterChange", note, "createdByUserId", "createdAt"
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              randomUUID(),
              item.productId,
              "sale",
              -item.quantity,
              item.unitCostSatang ?? null,
              stockByProductId.get(item.productId) ?? 0,
              null,
              input.cashierUserId,
              createdAt,
            ],
          })),
          {
            sql: `
              INSERT INTO "Payment" (id, "saleId", method, "amountSatang", "createdAt")
              VALUES (?, ?, ?, ?, ?)
            `,
            args: [
              input.payment.id,
              saleId,
              input.payment.method,
              input.payment.amountSatang,
              new Date(input.payment.createdAt).toISOString(),
            ],
          },
          {
            sql: `
              INSERT INTO "Receipt" (id, "saleId", content, "createdAt")
              VALUES (?, ?, ?, ?)
            `,
            args: [
              input.receipt.id,
              saleId,
              input.receipt.content,
              new Date(input.receipt.createdAt).toISOString(),
            ],
          },
        ];

        await transaction.batch(statements);

        await transaction.commit();

        return {
          ...input,
          id: saleId,
          soldAt,
          createdAt,
          items: input.items.map((item) => ({ ...item, saleId })),
          payment: { ...input.payment, saleId },
          receipt: { ...input.receipt, saleId },
        };
      } catch (error) {
        if (!transaction.closed) {
          await transaction.rollback();
        }
        throw error;
      } finally {
        transaction.close();
      }
    },
    async findSaleById(id) {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, payment: true, receipt: true },
      });
      return sale ? mapSale(sale) : null;
    },
    async voidSaleByIdWithInventory(storeId, saleId, userId) {
      const client = getCheckoutClient();
      const transaction = await client.transaction("write");

      try {
        const saleResult = await transaction.execute({
          sql: `
            SELECT
              id, "storeId", "cashierUserId", "receiptNumber", "subtotalSatang",
              "totalSatang", "cashReceivedSatang", "changeDueSatang", status,
              "soldAt", "createdAt"
            FROM "Sale"
            WHERE id = ? AND "storeId" = ?
            LIMIT 1
          `,
          args: [saleId, storeId],
        });

        if (saleResult.rows.length === 0) {
          await transaction.rollback();
          return null;
        }

        const saleRow = saleResult.rows[0] as unknown as LibSqlSaleRow;
        const itemResult = await transaction.execute({
          sql: `
            SELECT
              si.id, si."saleId", si."productId", si."productName",
              p.barcode,
              si.quantity, si."unitPriceSatang",
              p."costPriceSatang" AS "unitCostSatang",
              si."totalSatang",
              p."costPriceSatang" * si.quantity AS "totalCostSatang"
            FROM "SaleItem" si
            LEFT JOIN "Product" p ON p.id = si."productId"
            WHERE si."saleId" = ?
            ORDER BY si.id ASC
          `,
          args: [saleId],
        });
        const itemRows = itemResult.rows as unknown as LibSqlSaleItemRow[];
        const sale = mapLibSqlSale(saleRow, itemRows);

        if (sale.status === "void") {
          await transaction.rollback();
          return sale;
        }

        if (itemRows.length === 0) {
          await transaction.execute({
            sql: 'UPDATE "Sale" SET status = ? WHERE id = ?',
            args: ["void", saleId],
          });
          await transaction.commit();
          return { ...sale, status: "void" };
        }

        const quantityByProductId = new Map<string, number>();
        for (const item of sale.items) {
          quantityByProductId.set(
            item.productId,
            (quantityByProductId.get(item.productId) ?? 0) + item.quantity,
          );
        }

        const stockRows = Array.from(quantityByProductId.entries());
        const stockCase = stockRows.map(() => "WHEN ? THEN ?").join(" ");
        const stockCaseArgs = stockRows.flatMap(([productId, quantity]) => [productId, quantity]);
        const productIds = stockRows.map(([productId]) => productId);
        const productIdPlaceholders = productIds.map(() => "?").join(", ");

        const updatedProducts = await transaction.execute({
          sql: `
            UPDATE "Product"
            SET "stockQuantity" = "stockQuantity" + CASE "id" ${stockCase} ELSE 0 END
            WHERE "id" IN (${productIdPlaceholders})
            RETURNING "id", "stockQuantity"
          `,
          args: [...stockCaseArgs, ...productIds],
        });

        if (updatedProducts.rows.length !== productIds.length) {
          await transaction.rollback();
          return null;
        }

        const stockByProductId = new Map(
          updatedProducts.rows.map((product) => {
            const row = product as unknown as LibSqlUpdatedProductStockRow;
            return [String(row.id), dbNumberLoose(row.stockQuantity)];
          }),
        );
        const createdAt = new Date().toISOString();
        const statements: InStatement[] = [
          ...sale.items.map((item) => ({
            sql: `
              INSERT INTO "InventoryTransaction" (
                id, "productId", type, "quantityChange", "unitCostSatang",
                "balanceAfterChange", note, "createdByUserId", "createdAt"
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              randomUUID(),
              item.productId,
              "void",
              item.quantity,
              item.unitCostSatang ?? null,
              stockByProductId.get(item.productId) ?? 0,
              `Void sale ${sale.receiptNumber}`,
              userId,
              createdAt,
            ],
          })),
          {
            sql: 'UPDATE "Sale" SET status = ? WHERE id = ?',
            args: ["void", saleId],
          },
        ];

        await transaction.batch(statements);
        await transaction.commit();

        return { ...sale, status: "void" };
      } catch (error) {
        if (!transaction.closed) {
          await transaction.rollback();
        }
        throw error;
      } finally {
        transaction.close();
      }
    },
    async voidSaleWithInventory(sale, userId) {
      if (sale.status === "void") {
        return sale;
      }

      if (sale.items.length === 0) {
        return mapSale(
          await prisma.sale.update({
            where: { id: sale.id },
            data: { status: "void" },
            include: { items: { include: { product: true } }, payment: true, receipt: true },
          }),
        );
      }

      const client = getCheckoutClient();
      const transaction = await client.transaction("write");
      const productIds = sale.items.map((item) => item.productId);
      const stockCase = sale.items.map(() => "WHEN ? THEN ?").join(" ");
      const stockCaseArgs = sale.items.flatMap((item) => [item.productId, item.quantity]);
      const productIdPlaceholders = productIds.map(() => "?").join(", ");
      const createdAt = new Date().toISOString();

      try {
        const updatedProducts = await transaction.execute({
          sql: `
            UPDATE "Product"
            SET "stockQuantity" = "stockQuantity" + CASE "id" ${stockCase} ELSE 0 END
            WHERE "id" IN (${productIdPlaceholders})
            RETURNING "id", "stockQuantity"
          `,
          args: [...stockCaseArgs, ...productIds],
        });

        if (updatedProducts.rows.length !== productIds.length) {
          await transaction.rollback();
          return null;
        }

        const stockByProductId = new Map(
          updatedProducts.rows.map((product) => {
            const row = product as unknown as LibSqlUpdatedProductStockRow;
            return [String(row.id), dbNumberLoose(row.stockQuantity)];
          }),
        );

        const statements: InStatement[] = [
          ...sale.items.map((item) => ({
            sql: `
              INSERT INTO "InventoryTransaction" (
                id, "productId", type, "quantityChange", "unitCostSatang",
                "balanceAfterChange", note, "createdByUserId", "createdAt"
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              randomUUID(),
              item.productId,
              "void",
              item.quantity,
              item.unitCostSatang ?? null,
              stockByProductId.get(item.productId) ?? 0,
              `Void sale ${sale.receiptNumber}`,
              userId,
              createdAt,
            ],
          })),
          {
            sql: 'UPDATE "Sale" SET status = ? WHERE id = ?',
            args: ["void", sale.id],
          },
        ];

        await transaction.batch(statements);
        await transaction.commit();

        return { ...sale, status: "void" };
      } catch (error) {
        if (!transaction.closed) {
          await transaction.rollback();
        }
        throw error;
      } finally {
        transaction.close();
      }
    },
    async voidSale(id) {
      const sale = await prisma.sale.update({
        where: { id },
        data: { status: "void" },
        include: { items: { include: { product: true } }, payment: true, receipt: true },
      });
      return mapSale(sale);
    },
    async activateSale(id) {
      const sale = await prisma.sale.update({
        where: { id },
        data: { status: "completed" },
        include: { items: { include: { product: true } }, payment: true, receipt: true },
      });
      return mapSale(sale);
    },
    async listSales(storeId, input) {
      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          soldAt: {
            gte: input?.from ? new Date(input.from) : undefined,
            lte: input?.to ? new Date(input.to) : undefined,
          },
        },
        select: {
          id: true,
          storeId: true,
          cashierUserId: true,
          receiptNumber: true,
          subtotalSatang: true,
          totalSatang: true,
          cashReceivedSatang: true,
          changeDueSatang: true,
          status: true,
          soldAt: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              saleId: true,
              productId: true,
              productName: true,
              quantity: true,
              unitPriceSatang: true,
              totalSatang: true,
              product: { select: { barcode: true, costPriceSatang: true } },
            },
          },
        },
        orderBy: { soldAt: "desc" },
      });
      return sales.map(mapSaleForReport);
    },
    async listProductSalesHistory(storeId, productId, input) {
      const product = await prisma.product.findFirst({
        where: { id: productId, storeId },
        select: { id: true },
      });

      if (!product) {
        return [];
      }

      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          status: "completed",
          soldAt: {
            gte: input?.from ? new Date(input.from) : undefined,
            lte: input?.to ? new Date(input.to) : undefined,
          },
          items: { some: { productId } },
        },
        select: {
          soldAt: true,
          items: {
            where: { productId },
            select: {
              quantity: true,
              totalSatang: true,
              product: { select: { costPriceSatang: true } },
            },
          },
        },
        orderBy: { soldAt: "asc" },
      });
      const rows = new Map<string, ProductSalesHistoryRecord>();

      for (const sale of sales) {
        const date = dateKeyFromIso(sale.soldAt);

        for (const item of sale.items) {
          const current = rows.get(date) ?? emptyProductSalesHistoryRow(date);
          const totalSalesSatang = current.totalSalesSatang + item.totalSatang;
          const totalCostSatang = current.totalCostSatang + item.product.costPriceSatang * item.quantity;
          const profitSatang = totalSalesSatang - totalCostSatang;

          rows.set(date, {
            date,
            quantity: current.quantity + item.quantity,
            totalSalesSatang,
            totalCostSatang,
            profitSatang,
            profitMarginPercent: totalSalesSatang > 0
              ? Number(((profitSatang / totalSalesSatang) * 100).toFixed(2))
              : 0,
          });
        }
      }

      return fillProductSalesHistoryDates(rows, input);
    },
    async listSaleSummaries(storeId, input) {
      const pageSize = Math.max(1, input?.limit ?? input?.pageSize ?? 10);
      const page = Math.max(1, input?.page ?? 1);
      const offset = (page - 1) * pageSize;
      const rows = await prisma.$queryRaw<SaleSummarySqlRow[]>(Prisma.sql`
        WITH filtered_sales AS (
          SELECT
            s."id",
            s."storeId",
            s."cashierUserId",
            s."receiptNumber",
            s."totalSatang",
            s."cashReceivedSatang",
            s."changeDueSatang",
            s."status",
            s."soldAt",
            s."createdAt",
            COUNT(*) OVER() AS "totalCount"
          FROM "Sale" s
          WHERE ${saleSummaryWhereClause(storeId, input)}
          ORDER BY s."soldAt" DESC
          LIMIT ${pageSize} OFFSET ${offset}
        )
        SELECT
          fs."id",
          fs."storeId",
          fs."cashierUserId",
          fs."receiptNumber",
          fs."totalSatang",
          fs."cashReceivedSatang",
          fs."changeDueSatang",
          fs."status",
          fs."soldAt",
          fs."createdAt",
          COALESCE(COUNT(si."id"), 0) AS "lineItemCount",
          COALESCE(SUM(CASE WHEN fs."status" = 'completed' THEN si."quantity" ELSE 0 END), 0) AS "itemCount",
          COALESCE(SUM(CASE WHEN fs."status" = 'completed' THEN p."costPriceSatang" * si."quantity" ELSE 0 END), 0) AS "totalCostSatang",
          COALESCE(MAX(fs."totalCount"), 0) AS "totalCount"
        FROM filtered_sales fs
        LEFT JOIN "SaleItem" si ON si."saleId" = fs."id"
        LEFT JOIN "Product" p ON p."id" = si."productId"
        GROUP BY
          fs."id",
          fs."storeId",
          fs."cashierUserId",
          fs."receiptNumber",
          fs."totalSatang",
          fs."cashReceivedSatang",
          fs."changeDueSatang",
          fs."status",
          fs."soldAt",
          fs."createdAt"
        ORDER BY fs."soldAt" DESC
      `);

      return {
        items: rows.map(mapSaleSummarySqlRow),
        total: rows.length > 0 ? dbNumber(rows[0].totalCount) : 0,
        page,
        pageSize,
      };
    },
  };
}
