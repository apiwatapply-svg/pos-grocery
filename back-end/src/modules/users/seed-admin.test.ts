import { describe, expect, it } from "vitest";
import { comparePassword } from "../auth/auth.service.js";
import { seedInitialAdmin } from "./seed-admin.js";
import { createInMemoryUserRepository } from "./user.repository.js";

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
