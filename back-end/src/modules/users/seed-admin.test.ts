import { describe, expect, it } from "vitest";
import { comparePassword } from "../auth/auth.service.ts";
import { seedInitialAdmin } from "./seed-admin.ts";
import { createInMemoryUserRepository } from "./user.repository.ts";

describe("seedInitialAdmin", () => {
  it("creates the first store and owner user", async () => {
    const repository = createInMemoryUserRepository();

    await seedInitialAdmin({
      adminUsername: "admin",
      adminPassword: "admin",
      storeName: "POS Grocery",
      repository,
    });

    const store = await repository.getFirstStore();
    const user = await repository.findUserByUsername("admin");
    const products = store ? await repository.listProducts(store.id) : [];

    expect(store).toMatchObject({
      name: "POS Grocery",
      status: "active",
    });
    expect(user).toMatchObject({
      username: "admin",
      role: "owner",
      status: "active",
      storeId: store?.id,
    });
    await expect(comparePassword("admin", user?.passwordHash ?? "")).resolves.toBe(true);
    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Drinking Water",
          barcode: "8850002000010",
          stockQuantity: 24,
        }),
        expect.objectContaining({
          name: "Instant Noodles",
          barcode: "8850001000011",
          stockQuantity: 18,
        }),
      ]),
    );
  });

  it("does not duplicate the admin user when run twice", async () => {
    const repository = createInMemoryUserRepository();

    await seedInitialAdmin({
      adminUsername: "admin",
      adminPassword: "admin",
      storeName: "POS Grocery",
      repository,
    });
    await seedInitialAdmin({
      adminUsername: "admin",
      adminPassword: "admin",
      storeName: "POS Grocery",
      repository,
    });

    const user = await repository.findUserByUsername("admin");

    expect(user?.username).toBe("admin");
  });
});
