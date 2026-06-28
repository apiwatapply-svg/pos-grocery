import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createAuthToken, hashPassword } from "../auth/auth.service.js";
import { createInMemoryUserRepository, type UserRecord } from "../users/user.repository.js";

const jwtSecret = "test-secret-that-is-long-enough-for-store-tests";

async function createStoreFixture() {
  const repository = createInMemoryUserRepository();
  const store = await repository.createStore({
    name: "POS Grocery",
    phone: "0800000000",
    address: "Bangkok",
    ownerName: "Owner",
    status: "active",
  });
  const owner = await repository.createUser({
    storeId: store.id,
    username: "owner",
    passwordHash: await hashPassword("admin"),
    displayName: "Owner",
    role: "owner",
    status: "active",
  });
  const cashier = await repository.createUser({
    storeId: store.id,
    username: "cashier",
    passwordHash: await hashPassword("cashier"),
    displayName: "Cashier",
    role: "cashier",
    status: "active",
  });
  return { repository, store, owner, cashier };
}

function authHeader(user: UserRecord) {
  return `Bearer ${createAuthToken(user, jwtSecret)}`;
}

describe("store routes", () => {
  it("returns 401 when reading store without authentication", async () => {
    const { repository } = await createStoreFixture();
    const response = await request(createApp({ repository, jwtSecret })).get("/api/store/current");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("allows a cashier to read the current store", async () => {
    const { repository, cashier } = await createStoreFixture();
    const response = await request(createApp({ repository, jwtSecret }))
      .get("/api/store/current")
      .set("Authorization", authHeader(cashier));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: "POS Grocery",
      phone: "0800000000",
    });
  });

  it("prevents a cashier from updating store settings", async () => {
    const { repository, cashier } = await createStoreFixture();
    const response = await request(createApp({ repository, jwtSecret }))
      .patch("/api/store/current")
      .set("Authorization", authHeader(cashier))
      .send({ name: "New Store" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an owner to update store settings", async () => {
    const { repository, owner } = await createStoreFixture();
    const response = await request(createApp({ repository, jwtSecret }))
      .patch("/api/store/current")
      .set("Authorization", authHeader(owner))
      .send({ name: "New Store", phone: "0811111111" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: "New Store",
      phone: "0811111111",
    });
  });
});
