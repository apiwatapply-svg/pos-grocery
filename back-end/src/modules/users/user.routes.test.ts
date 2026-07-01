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
    role: "admin",
    status: "active",
  });
  const owner = await repository.createUser({
    storeId: firstStore.id,
    username: "main-owner",
    passwordHash: await hashPassword("owner123"),
    displayName: "Main Owner",
    role: "owner",
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

  return { repository, firstStore, secondStore, systemAdmin, owner };
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

  it("keeps owner-managed users scoped to the owner's own store", async () => {
    const { repository, firstStore, secondStore, owner } = await createMultiStoreFixture();
    const app = createApp({ repository, jwtSecret });

    const listed = await request(app).get("/api/users").set("Authorization", authHeader(owner));
    const created = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader(owner))
      .send({
        storeId: secondStore.id,
        username: "wrong-store-cashier",
        password: "cashier123",
        displayName: "Wrong Store Cashier",
        role: "cashier",
      });

    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "main-owner", storeId: firstStore.id })]),
    );
    expect(listed.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "second-cashier" })]),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.storeId).toBe(firstStore.id);
  });
});
