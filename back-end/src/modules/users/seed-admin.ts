import { hashPassword } from "../auth/auth.service.js";
import { defaultUserRepository, type UserRepository } from "./user.repository.js";

const seedProducts = [
  {
    name: "Drinking Water",
    barcode: "8850002000010",
    sku: "WATER-001",
    unit: "bottle",
    costPriceSatang: 400,
    salePriceSatang: 700,
    stockQuantity: 24,
  },
  {
    name: "Instant Noodles",
    barcode: "8850001000011",
    sku: "NOODLE-001",
    unit: "pack",
    costPriceSatang: 700,
    salePriceSatang: 1200,
    stockQuantity: 18,
  },
];

export async function seedInitialAdmin(deps: {
  adminUsername: string;
  adminPassword: string;
  storeName: string;
  repository?: UserRepository;
}): Promise<void> {
  const repository = deps.repository ?? defaultUserRepository;
  let store = await repository.getFirstStore();

  if (!store) {
    store = await repository.createStore({
      name: deps.storeName,
      phone: "-",
      address: "-",
      ownerName: deps.adminUsername,
      status: "active",
    });
  }

  const existingUser = await repository.findUserByUsername(deps.adminUsername);

  if (!existingUser) {
    await repository.createUser({
      storeId: store.id,
      username: deps.adminUsername,
      passwordHash: await hashPassword(deps.adminPassword),
      displayName: deps.adminUsername,
      role: "owner",
      status: "active",
    });
  }

  const products = await repository.listProducts(store.id);
  if (products.length > 0) {
    return;
  }

  for (const seedProduct of seedProducts) {
    const product = await repository.createProduct({
      storeId: store.id,
      name: seedProduct.name,
      barcode: seedProduct.barcode,
      sku: seedProduct.sku,
      unit: seedProduct.unit,
      costPriceSatang: seedProduct.costPriceSatang,
      salePriceSatang: seedProduct.salePriceSatang,
      status: "active",
    });
    await repository.adjustInventory({
      productId: product.id,
      type: "receive",
      quantityChange: seedProduct.stockQuantity,
      unitCostSatang: seedProduct.costPriceSatang,
      note: "Initial demo stock",
    });
  }
}
