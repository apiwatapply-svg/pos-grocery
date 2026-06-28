import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import type {
  InventoryTransactionRecord,
  ProductImageRecord,
  ProductRecord,
  SaleRecord,
  StoreRecord,
  UserRecord,
  UserRepository,
} from "./user.repository.js";

type PrismaUserRepositoryOptions = {
  prisma?: PrismaClient;
};

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);
const optional = <T>(value: T | null | undefined) => value ?? undefined;

function createPrismaClient() {
  const adapter = new PrismaLibSQL({
    url: env.DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  return new PrismaClient({ adapter });
}

function mapStore(store: {
  id: string;
  name: string;
  phone: string;
  address: string;
  ownerName: string;
  status: string;
}): StoreRecord {
  return {
    id: store.id,
    name: store.name,
    phone: store.phone,
    address: store.address,
    ownerName: store.ownerName,
    status: store.status === "inactive" ? "inactive" : "active",
  };
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
  sku: string | null;
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
    sku: optional(product.sku),
    unit: product.unit,
    costPriceSatang: product.costPriceSatang,
    salePriceSatang: product.salePriceSatang,
    stockQuantity: product.stockQuantity,
    status: product.status === "inactive" ? "inactive" : "active",
    images: product.images?.map(mapImage) ?? [],
  };
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
    product?: { barcode: string };
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
      totalSatang: item.totalSatang,
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

export function createPrismaUserRepository(options?: PrismaUserRepositoryOptions): UserRepository {
  const prisma = options?.prisma ?? createPrismaClient();

  return {
    async findUserByUsername(username) {
      const normalized = username.trim().toLowerCase();
      const users = await prisma.user.findMany();
      const user = users.find((candidate: { username: string }) => candidate.username.toLowerCase() === normalized);
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
      const store = await prisma.store.findUnique({ where: { id } });
      return store ? mapStore(store) : null;
    },
    async getFirstStore() {
      const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
      return store ? mapStore(store) : null;
    },
    async createStore(input) {
      return mapStore(await prisma.store.create({ data: input }));
    },
    async updateStore(id, input) {
      try {
        return mapStore(await prisma.store.update({ where: { id }, data: input }));
      } catch {
        return null;
      }
    },
    async listProducts(storeId) {
      const products = await prisma.product.findMany({
        where: { storeId },
        include: { images: true },
        orderBy: { name: "asc" },
      });
      return products.map(mapProduct);
    },
    async findProductById(id) {
      const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
      return product ? mapProduct(product) : null;
    },
    async findProductByBarcode(storeId, barcode) {
      const product = await prisma.product.findUnique({
        where: { storeId_barcode: { storeId, barcode: barcode.trim() } },
        include: { images: true },
      });
      return product ? mapProduct(product) : null;
    },
    async createProduct(input) {
      const product = await prisma.product.create({
        data: {
          storeId: input.storeId,
          categoryId: input.categoryId,
          name: input.name,
          barcode: input.barcode,
          sku: input.sku,
          unit: input.unit,
          costPriceSatang: input.costPriceSatang,
          salePriceSatang: input.salePriceSatang,
          stockQuantity: input.stockQuantity ?? 0,
          status: input.status,
        },
        include: { images: true },
      });
      return mapProduct(product);
    },
    async updateProduct(id, input) {
      try {
        const product = await prisma.product.update({
          where: { id },
          data: input,
          include: { images: true },
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
          include: { images: true },
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
          include: { images: true },
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
    async findSaleById(id) {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, payment: true, receipt: true },
      });
      return sale ? mapSale(sale) : null;
    },
    async voidSale(id) {
      const sale = await prisma.sale.update({
        where: { id },
        data: { status: "void" },
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
        include: { items: { include: { product: true } }, payment: true, receipt: true },
        orderBy: { soldAt: "desc" },
      });
      return sales.map(mapSale);
    },
  };
}
