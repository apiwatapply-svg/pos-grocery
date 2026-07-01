import { createPrismaUserRepository } from "./prisma-user.repository.ts";

export type UserRole = "owner" | "admin" | "cashier" | "stock";
export type UserStatus = "active" | "inactive";
export type StoreStatus = "active" | "inactive";
export type ProductStatus = "active" | "inactive";
export type InventoryTransactionType = "receive" | "count" | "sale" | "void";
export type PaymentMethod = "cash" | "transfer" | "card";

export type StoreRecord = {
  id: string;
  name: string;
  phone: string;
  address: string;
  ownerName: string;
  logoUrl?: string;
  status: StoreStatus;
};

export type UserRecord = {
  id: string;
  storeId: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
};

export type ProductImageRecord = {
  id: string;
  productId: string;
  provider: "cloudinary";
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  altText?: string;
  createdAt: string;
};

export type ProductRecord = {
  id: string;
  storeId: string;
  categoryId?: string;
  name: string;
  barcode: string;
  unit: string;
  costPriceSatang: number;
  salePriceSatang: number;
  stockQuantity: number;
  status: ProductStatus;
  images: ProductImageRecord[];
  averageMonthlySalesQuantity?: number;
};

export type InventoryTransactionRecord = {
  id: string;
  productId: string;
  type: InventoryTransactionType;
  quantityChange: number;
  unitCostSatang?: number;
  balanceAfterChange: number;
  note?: string;
  createdByUserId?: string;
  createdAt: string;
};

export type InventoryTransactionWithProductRecord = InventoryTransactionRecord & {
  product: ProductRecord;
  createdBy?: Pick<UserRecord, "id" | "username" | "displayName">;
};

export type SaleItemRecord = {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang?: number;
  totalSatang: number;
  totalCostSatang?: number;
};

export type PaymentRecord = {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amountSatang: number;
  createdAt: string;
};

export type ReceiptRecord = {
  id: string;
  saleId: string;
  content: string;
  createdAt: string;
};

export type SaleRecord = {
  id: string;
  storeId: string;
  cashierUserId: string;
  receiptNumber: string;
  subtotalSatang: number;
  totalSatang: number;
  cashReceivedSatang: number;
  changeDueSatang: number;
  status: "completed" | "void";
  soldAt: string;
  createdAt: string;
  items: SaleItemRecord[];
  payment: PaymentRecord;
  receipt: ReceiptRecord;
};

export type SaleSummaryRecord = Pick<
  SaleRecord,
  | "id"
  | "storeId"
  | "cashierUserId"
  | "receiptNumber"
  | "totalSatang"
  | "cashReceivedSatang"
  | "changeDueSatang"
  | "status"
  | "soldAt"
  | "createdAt"
> & {
  itemCount: number;
  lineItemCount: number;
  totalCostSatang: number;
  profitSatang: number;
  profitMarginPercent: number;
};

export type ProductSalesHistoryRecord = {
  date: string;
  quantity: number;
  totalSalesSatang: number;
  totalCostSatang: number;
  profitSatang: number;
  profitMarginPercent: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type StoreUpdate = Partial<Pick<StoreRecord, "name" | "phone" | "address" | "ownerName" | "logoUrl" | "status">>;
export type UserUpdate = Partial<Pick<UserRecord, "storeId" | "username" | "passwordHash" | "displayName" | "role" | "status">>;
export type ProductUpdate = Partial<
  Pick<
    ProductRecord,
    | "categoryId"
    | "name"
    | "barcode"
    | "unit"
    | "costPriceSatang"
    | "salePriceSatang"
    | "status"
  >
>;

export type UserRepository = {
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  listUsers(storeId: string): Promise<UserRecord[]>;
  listAllUsers(): Promise<UserRecord[]>;
  createUser(input: Omit<UserRecord, "id">): Promise<UserRecord>;
  updateUser(id: string, input: UserUpdate): Promise<UserRecord | null>;
  deactivateUser(id: string): Promise<UserRecord | null>;

  findStoreById(id: string): Promise<StoreRecord | null>;
  listStores(): Promise<StoreRecord[]>;
  getFirstStore(): Promise<StoreRecord | null>;
  createStore(input: Omit<StoreRecord, "id">): Promise<StoreRecord>;
  updateStore(id: string, input: StoreUpdate): Promise<StoreRecord | null>;

  listProducts(
    storeId: string,
    input?: { includeImages?: boolean; includeSalesStats?: boolean },
  ): Promise<ProductRecord[]>;
  findProductById(id: string): Promise<ProductRecord | null>;
  findProductByBarcode(storeId: string, barcode: string): Promise<ProductRecord | null>;
  findProductsByBarcodes(storeId: string, barcodes: string[]): Promise<ProductRecord[]>;
  createProduct(input: Omit<ProductRecord, "id" | "images" | "stockQuantity"> & { stockQuantity?: number }): Promise<ProductRecord>;
  updateProduct(id: string, input: ProductUpdate): Promise<ProductRecord | null>;
  addProductImage(input: Omit<ProductImageRecord, "id" | "createdAt">): Promise<ProductImageRecord | null>;
  adjustInventory(input: {
    productId: string;
    type: InventoryTransactionType;
    quantityChange: number;
    unitCostSatang?: number;
    note?: string;
    createdByUserId?: string;
  }): Promise<{ product: ProductRecord; transaction: InventoryTransactionRecord } | null>;
  listInventoryTransactions(
    storeId: string,
    input?: { limit?: number },
  ): Promise<InventoryTransactionWithProductRecord[]>;

  createSale(input: Omit<SaleRecord, "id" | "createdAt">): Promise<SaleRecord>;
  createSaleWithInventory(input: Omit<SaleRecord, "id" | "createdAt">): Promise<SaleRecord | null>;
  findSaleById(id: string): Promise<SaleRecord | null>;
  voidSaleByIdWithInventory(storeId: string, saleId: string, userId: string): Promise<SaleRecord | null>;
  voidSaleWithInventory(sale: SaleRecord, userId: string): Promise<SaleRecord | null>;
  voidSale(id: string): Promise<SaleRecord | null>;
  activateSale(id: string): Promise<SaleRecord | null>;
  listSales(storeId: string, input?: { from?: string; to?: string }): Promise<SaleRecord[]>;
  listProductSalesHistory(
    storeId: string,
    productId: string,
    input?: { from?: string; to?: string },
  ): Promise<ProductSalesHistoryRecord[]>;
  listSaleSummaries(
    storeId: string,
    input?: { from?: string; to?: string; page?: number; pageSize?: number; limit?: number },
  ): Promise<PaginatedResult<SaleSummaryRecord>>;
};

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();

function inRange(value: string, input?: { from?: string; to?: string }) {
  if (input?.from && value < input.from) {
    return false;
  }

  if (input?.to && value > input.to) {
    return false;
  }

  return true;
}

function marginPercent(profitSatang: number, totalSalesSatang: number) {
  if (totalSalesSatang <= 0) {
    return 0;
  }

  return Number(((profitSatang / totalSalesSatang) * 100).toFixed(2));
}

const bangkokDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Bangkok",
  year: "numeric",
});

function dateKeyFromIso(value: string) {
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

function monthKeyFromIso(value: string) {
  return value.slice(0, 7);
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function productMonthlySalesAverages(storeId: string, productIds: string[], saleRecords: SaleRecord[]) {
  const monthlyQuantitiesByProduct = new Map<string, Map<string, number>>();
  const trackedProductIds = new Set(productIds);

  for (const sale of saleRecords) {
    if (sale.storeId !== storeId || sale.status !== "completed") {
      continue;
    }

    const month = monthKeyFromIso(sale.soldAt);

    for (const item of sale.items) {
      if (!trackedProductIds.has(item.productId)) {
        continue;
      }

      const monthlyQuantities = monthlyQuantitiesByProduct.get(item.productId) ?? new Map<string, number>();
      monthlyQuantities.set(month, (monthlyQuantities.get(month) ?? 0) + item.quantity);
      monthlyQuantitiesByProduct.set(item.productId, monthlyQuantities);
    }
  }

  return new Map(
    productIds.map((productId) => {
      const monthlyQuantities = monthlyQuantitiesByProduct.get(productId);
      if (!monthlyQuantities || monthlyQuantities.size === 0) {
        return [productId, 0];
      }

      const totalQuantity = Array.from(monthlyQuantities.values()).reduce((sum, quantity) => sum + quantity, 0);
      return [productId, roundOneDecimal(totalQuantity / monthlyQuantities.size)];
    }),
  );
}

function saleSummary(sale: SaleRecord): SaleSummaryRecord {
  const isCompleted = sale.status === "completed";
  const itemCount = isCompleted ? sale.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const totalCostSatang = isCompleted
    ? sale.items.reduce((sum, item) => sum + (item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity), 0)
    : 0;
  const profitSatang = isCompleted ? sale.totalSatang - totalCostSatang : 0;

  return {
    id: sale.id,
    storeId: sale.storeId,
    cashierUserId: sale.cashierUserId,
    receiptNumber: sale.receiptNumber,
    totalSatang: sale.totalSatang,
    cashReceivedSatang: sale.cashReceivedSatang,
    changeDueSatang: sale.changeDueSatang,
    status: sale.status,
    soldAt: sale.soldAt,
    createdAt: sale.createdAt,
    itemCount,
    lineItemCount: isCompleted ? sale.items.length : 0,
    totalCostSatang,
    profitSatang,
    profitMarginPercent: marginPercent(profitSatang, sale.totalSatang),
  };
}

export function createInMemoryUserRepository(seed?: {
  stores?: StoreRecord[];
  users?: UserRecord[];
  products?: ProductRecord[];
  sales?: SaleRecord[];
}): UserRepository {
  const stores = new Map<string, StoreRecord>();
  const users = new Map<string, UserRecord>();
  const products = new Map<string, ProductRecord>();
  const inventoryTransactions = new Map<string, InventoryTransactionRecord>();
  const sales = new Map<string, SaleRecord>();

  seed?.stores?.forEach((store) => stores.set(store.id, store));
  seed?.users?.forEach((user) => users.set(user.id, user));
  seed?.products?.forEach((product) => products.set(product.id, product));
  seed?.sales?.forEach((sale) => sales.set(sale.id, sale));

  return {
    async findUserByUsername(username) {
      const normalized = username.trim().toLowerCase();
      return (
        Array.from(users.values()).find((user) => user.username.toLowerCase() === normalized) ??
        null
      );
    },
    async findUserById(id) {
      return users.get(id) ?? null;
    },
    async listUsers(storeId) {
      return Array.from(users.values()).filter((user) => user.storeId === storeId);
    },
    async listAllUsers() {
      return Array.from(users.values());
    },
    async createUser(input) {
      const user = { id: createId("user"), ...input };
      users.set(user.id, user);
      return user;
    },
    async updateUser(id, input) {
      const user = users.get(id);

      if (!user) {
        return null;
      }

      const updatedUser = { ...user, ...input };
      users.set(id, updatedUser);
      return updatedUser;
    },
    async deactivateUser(id) {
      const user = users.get(id);

      if (!user) {
        return null;
      }

      const updatedUser = { ...user, status: "inactive" as const };
      users.set(id, updatedUser);
      return updatedUser;
    },
    async findStoreById(id) {
      return stores.get(id) ?? null;
    },
    async listStores() {
      return Array.from(stores.values());
    },
    async getFirstStore() {
      return Array.from(stores.values())[0] ?? null;
    },
    async createStore(input) {
      const store = { id: createId("store"), ...input };
      stores.set(store.id, store);
      return store;
    },
    async updateStore(id, input) {
      const store = stores.get(id);

      if (!store) {
        return null;
      }

      const updatedStore = { ...store, ...input };
      stores.set(id, updatedStore);
      return updatedStore;
    },
    async listProducts(storeId, input) {
      const storeProducts = Array.from(products.values()).filter((product) => product.storeId === storeId);
      const includeSalesStats = input?.includeSalesStats ?? true;
      const monthlyAverages = includeSalesStats
        ? productMonthlySalesAverages(
            storeId,
            storeProducts.map((product) => product.id),
            Array.from(sales.values()),
          )
        : new Map<string, number>();

      return storeProducts.map((product) => ({
        ...product,
        images: input?.includeImages === false ? [] : product.images,
        averageMonthlySalesQuantity: monthlyAverages.get(product.id) ?? 0,
      }));
    },
    async findProductById(id) {
      return products.get(id) ?? null;
    },
    async findProductByBarcode(storeId, barcode) {
      const normalized = barcode.trim();
      return (
        Array.from(products.values()).find(
          (product) => product.storeId === storeId && product.barcode === normalized,
        ) ?? null
      );
    },
    async findProductsByBarcodes(storeId, barcodes) {
      const barcodeSet = new Set(barcodes.map((barcode) => barcode.trim()));
      return Array.from(products.values()).filter(
        (product) => product.storeId === storeId && barcodeSet.has(product.barcode),
      );
    },
    async createProduct(input) {
      const product = {
        id: createId("product"),
        ...input,
        stockQuantity: input.stockQuantity ?? 0,
        images: [],
      };
      products.set(product.id, product);
      return product;
    },
    async updateProduct(id, input) {
      const product = products.get(id);

      if (!product) {
        return null;
      }

      const updatedProduct = { ...product, ...input };
      products.set(id, updatedProduct);
      return updatedProduct;
    },
    async addProductImage(input) {
      const product = products.get(input.productId);

      if (!product) {
        return null;
      }

      const image = {
        id: createId("image"),
        createdAt: nowIso(),
        ...input,
      };
      const updatedProduct = { ...product, images: [...product.images, image] };
      products.set(product.id, updatedProduct);
      return image;
    },
    async adjustInventory(input) {
      const product = products.get(input.productId);

      if (!product) {
        return null;
      }

      const balanceAfterChange = product.stockQuantity + input.quantityChange;
      const updatedProduct = { ...product, stockQuantity: balanceAfterChange };
      const transaction = {
        id: createId("inv"),
        productId: input.productId,
        type: input.type,
        quantityChange: input.quantityChange,
        unitCostSatang: input.unitCostSatang,
        balanceAfterChange,
        note: input.note,
        createdByUserId: input.createdByUserId,
        createdAt: nowIso(),
      };
      products.set(product.id, updatedProduct);
      inventoryTransactions.set(transaction.id, transaction);
      return { product: updatedProduct, transaction };
    },
    async listInventoryTransactions(storeId, input) {
      const productById = new Map(
        Array.from(products.values())
          .filter((product) => product.storeId === storeId)
          .map((product) => [product.id, product]),
      );
      const limit = input?.limit ?? 50;

      return Array.from(inventoryTransactions.values())
        .filter((transaction) => productById.has(transaction.productId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit)
        .map((transaction) => {
          const createdByUser = transaction.createdByUserId
            ? users.get(transaction.createdByUserId)
            : undefined;

          return {
            ...transaction,
            product: productById.get(transaction.productId)!,
            createdBy: createdByUser
              ? {
                  id: createdByUser.id,
                  username: createdByUser.username,
                  displayName: createdByUser.displayName,
                }
              : undefined,
          };
        });
    },
    async createSale(input) {
      const id = createId("sale");
      const sale = {
        id,
        createdAt: nowIso(),
        ...input,
        items: input.items.map((item) => ({ ...item, saleId: id })),
        payment: { ...input.payment, saleId: id },
        receipt: { ...input.receipt, saleId: id },
      };
      sales.set(sale.id, sale);
      return sale;
    },
    async createSaleWithInventory(input) {
      const updatedProducts = new Map<string, ProductRecord>();

      for (const item of input.items) {
        const product = products.get(item.productId);

        if (!product || product.stockQuantity < item.quantity) {
          return null;
        }

        updatedProducts.set(item.productId, {
          ...product,
          stockQuantity: product.stockQuantity - item.quantity,
        });
      }

      for (const product of updatedProducts.values()) {
        products.set(product.id, product);
      }

      for (const item of input.items) {
        const product = updatedProducts.get(item.productId);

        if (!product) {
          return null;
        }

        const transaction = {
          id: createId("inv"),
          productId: item.productId,
          type: "sale" as const,
          quantityChange: -item.quantity,
          unitCostSatang: item.unitCostSatang,
          balanceAfterChange: product.stockQuantity,
          createdByUserId: input.cashierUserId,
          createdAt: nowIso(),
        };
        inventoryTransactions.set(transaction.id, transaction);
      }

      const id = createId("sale");
      const sale = {
        id,
        createdAt: nowIso(),
        ...input,
        items: input.items.map((item) => ({ ...item, saleId: id })),
        payment: { ...input.payment, saleId: id },
        receipt: { ...input.receipt, saleId: id },
      };
      sales.set(sale.id, sale);
      return sale;
    },
    async findSaleById(id) {
      return sales.get(id) ?? null;
    },
    async voidSale(id) {
      const sale = sales.get(id);
      if (!sale) {
        return null;
      }
      const voidedSale: SaleRecord = { ...sale, status: "void" };
      sales.set(id, voidedSale);
      return voidedSale;
    },
    async voidSaleWithInventory(sale, userId) {
      if (sale.status === "void") {
        return sale;
      }

      const updatedProducts = new Map<string, ProductRecord>();

      for (const item of sale.items) {
        const product = products.get(item.productId);
        if (!product) {
          return null;
        }
        updatedProducts.set(product.id, {
          ...product,
          stockQuantity: product.stockQuantity + item.quantity,
        });
      }

      for (const product of updatedProducts.values()) {
        products.set(product.id, product);
      }

      for (const item of sale.items) {
        const product = updatedProducts.get(item.productId);
        if (!product) {
          return null;
        }
        const transaction = {
          id: createId("inv"),
          productId: item.productId,
          type: "void" as const,
          quantityChange: item.quantity,
          unitCostSatang: item.unitCostSatang,
          balanceAfterChange: product.stockQuantity,
          note: `Void sale ${sale.receiptNumber}`,
          createdByUserId: userId,
          createdAt: nowIso(),
        };
        inventoryTransactions.set(transaction.id, transaction);
      }

      const voidedSale: SaleRecord = { ...sale, status: "void" };
      sales.set(sale.id, voidedSale);
      return voidedSale;
    },
    async voidSaleByIdWithInventory(storeId, saleId, userId) {
      const sale = sales.get(saleId);
      if (!sale || sale.storeId !== storeId) {
        return null;
      }

      return this.voidSaleWithInventory(sale, userId);
    },
    async activateSale(id) {
      const sale = sales.get(id);
      if (!sale) {
        return null;
      }
      const activatedSale: SaleRecord = { ...sale, status: "completed" };
      sales.set(id, activatedSale);
      return activatedSale;
    },
    async listSales(storeId, input) {
      return Array.from(sales.values()).filter(
        (sale) => sale.storeId === storeId && inRange(sale.soldAt, input),
      );
    },
    async listProductSalesHistory(storeId, productId, input) {
      const rows = new Map<string, ProductSalesHistoryRecord>();

      for (const sale of Array.from(sales.values())) {
        if (sale.storeId !== storeId || sale.status !== "completed" || !inRange(sale.soldAt, input)) {
          continue;
        }

        const date = dateKeyFromIso(sale.soldAt);

        for (const item of sale.items.filter((saleItem) => saleItem.productId === productId)) {
          const current = rows.get(date) ?? emptyProductSalesHistoryRow(date);
          const totalCostSatang = current.totalCostSatang + (item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity);
          const totalSalesSatang = current.totalSalesSatang + item.totalSatang;
          const profitSatang = totalSalesSatang - totalCostSatang;

          rows.set(date, {
            date,
            quantity: current.quantity + item.quantity,
            totalSalesSatang,
            totalCostSatang,
            profitSatang,
            profitMarginPercent: marginPercent(profitSatang, totalSalesSatang),
          });
        }
      }

      return fillProductSalesHistoryDates(rows, input);
    },
    async listSaleSummaries(storeId, input) {
      const pageSize = Math.max(1, input?.limit ?? input?.pageSize ?? 10);
      const page = Math.max(1, input?.page ?? 1);
      const filteredSales = Array.from(sales.values())
        .filter((sale) => sale.storeId === storeId && inRange(sale.soldAt, input))
        .sort((left, right) => right.soldAt.localeCompare(left.soldAt));
      const start = (page - 1) * pageSize;

      return {
        items: filteredSales.slice(start, start + pageSize).map(saleSummary),
        total: filteredSales.length,
        page,
        pageSize,
      };
    },
  };
}

let prismaBackedRepository: UserRepository | undefined;

function getDefaultUserRepository() {
  prismaBackedRepository ??= createPrismaUserRepository();
  return prismaBackedRepository;
}

export const defaultUserRepository = new Proxy({} as UserRepository, {
  get(_target, property: keyof UserRepository) {
    const value = getDefaultUserRepository()[property];
    return typeof value === "function" ? value.bind(getDefaultUserRepository()) : value;
  },
});
