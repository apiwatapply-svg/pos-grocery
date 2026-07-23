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
  const secondStoreCashier = await repository.createUser({
    storeId: secondStore.id,
    username: "second-cashier",
    passwordHash: await hashPassword("cashier123"),
    displayName: "Second Cashier",
    role: "cashier",
    status: "active",
  });

  return { repository, firstStore, secondStore, systemAdmin, storeAdmin, secondStoreCashier };
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

  it("lets a store admin list and create users in their own store only", async () => {
    const { repository, firstStore, secondStore, storeAdmin } = await createMultiStoreFixture();
    const app = createApp({ repository, jwtSecret });

    const listed = await request(app).get("/api/users").set("Authorization", authHeader(storeAdmin));
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({ username: "system-admin", storeId: firstStore.id }),
      expect.objectContaining({ username: "main-store-admin", storeId: firstStore.id }),
    ]);

    const created = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader(storeAdmin))
      .send({
        username: "new-cashier",
        password: "cashier123",
        displayName: "New Cashier",
        role: "cashier",
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      storeId: firstStore.id,
      username: "new-cashier",
      role: "cashier",
      status: "active",
    });

    // Trying to write into another store pins the new user to the admin's own store.
    const wrongStoreCreated = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader(storeAdmin))
      .send({
        storeId: secondStore.id,
        username: "wrong-store-user",
        password: "cashier123",
        displayName: "Wrong Store User",
        role: "cashier",
      });

    expect(wrongStoreCreated.status).toBe(201);
    expect(wrongStoreCreated.body.data.storeId).toBe(firstStore.id);
  });

  it("forbids cashier and stock from listing or managing users", async () => {
    const { repository, firstStore, storeAdmin } = await createMultiStoreFixture();
    const app = createApp({ repository, jwtSecret });
    const storeAdminUserId = storeAdmin.id;

    for (const role of ["cashier", "stock"] as const) {
      const restrictedUser = await repository.createUser({
        storeId: firstStore.id,
        username: `restricted-${role}`,
        passwordHash: await hashPassword("user123"),
        displayName: `Restricted ${role}`,
        role,
        status: "active",
      });

      const listed = await request(app)
        .get("/api/users")
        .set("Authorization", authHeader(restrictedUser));
      const created = await request(app)
        .post("/api/users")
        .set("Authorization", authHeader(restrictedUser))
        .send({
          username: `attempted-${role}`,
          password: "user123",
          displayName: `Attempted ${role}`,
          role: "cashier",
        });
      const updated = await request(app)
        .patch(`/api/users/${storeAdminUserId}`)
        .set("Authorization", authHeader(restrictedUser))
        .send({ displayName: "Updated" });

      expect(listed.status).toBe(403);
      expect(created.status).toBe(403);
      expect(updated.status).toBe(403);
    }
  });
});
