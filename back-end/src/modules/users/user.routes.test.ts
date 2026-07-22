import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.ts";
import { createAuthToken, hashPassword } from "../auth/auth.service.ts";
import { createInMemoryUserRepository, type UserRecord } from "./user.repository.ts";

const jwtSecret = "test-secret-that-is-long-enough-for-user-tests";

function authHeader(user: UserRecord) {
  return `Bearer ${createAuthToken(user, jwtSecret)}`;
}

async function createMultiStoreFixture() {
  const repository = createInMemoryUserRepository();
  const firstStore = await repository.createStore({
    name: "Main Store",
    phone: "0800000000",
    address: "Bangkok",
    ownerName: "Main Owner",
    status: "active",
  });
  const secondStore = await repository.createStore({
    name: "Second Store",
    phone: "0811111111",
    address: "Chiang Mai",
    ownerName: "Second Owner",
    status: "active",
  });
  const systemAdmin = await repository.createUser({
    storeId: firstStore.id,
    username: "system-admin",
    passwordHash: await hashPassword("admin123"),
    displayName: "System Admin",
    role: "super_admin",
    status: "active",
  });
  const storeAdmin = await repository.createUser({
    storeId: firstStore.id,
    username: "main-store-admin",
    passwordHash: await hashPassword("admin123"),
    displayName: "Main Store Admin",
    role: "store_admin",
    status: "active",
  });
  await repository.createUser({
    storeId: secondStore.id,
    username: "second-cashier",
    passwordHash: await hashPassword("cashier123"),
    displayName: "Second Cashier",
    role: "cashier",
    status: "active",
  });

  return { repository, firstStore, secondStore, systemAdmin, storeAdmin };
}

describe("user routes", () => {
  it("lets a system admin list and create users for every store", async () => {
    const { repository, secondStore, systemAdmin } = await createMultiStoreFixture();
    const app = createApp({ repository, jwtSecret });

    const listed = await request(app).get("/api/users").set("Authorization", authHeader(systemAdmin));
    const created = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader(systemAdmin))
      .send({
        storeId: secondStore.id,
        username: "second-stock",
        password: "stock123",
        displayName: "Second Stock",
        role: "stock",
      });

    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: "system-admin", storeId: systemAdmin.storeId }),
        expect.objectContaining({ username: "second-cashier", storeId: secondStore.id }),
      ]),
    );
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      storeId: secondStore.id,
      username: "second-stock",
      role: "stock",
      status: "active",
    });
  });

  it("forbids store-admin from listing or managing users", async () => {
    const { repository, firstStore, secondStore, storeAdmin } = await createMultiStoreFixture();
    const app = createApp({ repository, jwtSecret });

    const listed = await request(app).get("/api/users").set("Authorization", authHeader(storeAdmin));
    const created = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader(storeAdmin))
      .send({
        storeId: secondStore.id,
        username: "wrong-store-cashier",
        password: "cashier123",
        displayName: "Wrong Store Cashier",
        role: "cashier",
      });

    expect(listed.status).toBe(403);
    expect(created.status).toBe(403);
    // Even though the store-admin already exists for firstStore, the user
    // management API is reserved for super_admin in the current access model.
    expect(firstStore.id).toBe(storeAdmin.storeId);
  });
});
