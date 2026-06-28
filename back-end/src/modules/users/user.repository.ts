import { createPrismaUserRepository } from "./prisma-user.repository.js";

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
  sku?: string;
  unit: string;
  costPriceSatang: number;
  salePriceSatang: number;
  stockQuantity: number;
  status: ProductStatus;
  images: ProductImageRecord[];
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

export type SaleItemRecord = {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitPriceSatang: number;
  totalSatang: number;
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

export type StoreUpdate = Partial<Pick<StoreRecord, "name" | "phone" | "address" | "ownerName" | "status">>;
export type UserUpdate = Partial<Pick<UserRecord, "username" | "passwordHash" | "displayName" | "role" | "status">>;
export type ProductUpdate = Partial<
  Pick<
    ProductRecord,
    | "categoryId"
    | "name"
    | "barcode"
    | "sku"
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
  createUser(input: Omit<UserRecord, "id">): Promise<UserRecord>;
  updateUser(id: string, input: UserUpdate): Promise<UserRecord | null>;
  deactivateUser(id: string): Promise<UserRecord | null>;

  findStoreById(id: string): Promise<StoreRecord | null>;
  getFirstStore(): Promise<StoreRecord | null>;
  createStore(input: Omit<StoreRecord, "id">): Promise<StoreRecord>;
  updateStore(id: string, input: StoreUpdate): Promise<StoreRecord | null>;

  listProducts(storeId: string): Promise<ProductRecord[]>;
  findProductById(id: string): Promise<ProductRecord | null>;
  findProductByBarcode(storeId: string, barcode: string): Promise<ProductRecord | null>;
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

  createSale(input: Omit<SaleRecord, "id" | "createdAt">): Promise<SaleRecord>;
  findSaleById(id: string): Promise<SaleRecord | null>;
  voidSale(id: string): Promise<SaleRecord | null>;
  listSales(storeId: string, input?: { from?: string; to?: string }): Promise<SaleRecord[]>;
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
    async listProducts(storeId) {
      return Array.from(products.values()).filter((product) => product.storeId === storeId);
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
    async listSales(storeId, input) {
      return Array.from(sales.values()).filter(
        (sale) => sale.storeId === storeId && inRange(sale.soldAt, input),
      );
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
