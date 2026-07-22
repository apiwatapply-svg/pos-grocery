import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.ts";
import { createAuthToken, hashPassword } from "../auth/auth.service.ts";
import { createInMemoryUserRepository, type UserRecord } from "../users/user.repository.ts";

const jwtSecret = "test-secret-that-is-long-enough-for-store-tests";

async function createStoreFixture() {
  const repository = createInMemoryUserRepository();
  const store = await repository.createStore({
    name: "POS Grocery",
    phone: "0800000000",
    address: "Bangkok",
    ownerName: "Owner",
    logoUrl: "https://example.com/store-logo.png",
    status: "active",
  });
  const owner = await repository.createUser({
    storeId: store.id,
    username: "owner",
    passwordHash: await hashPassword("admin"),
    displayName: "Owner",
    role: "super_admin",
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
    expect(response.body.data.logoUrl).toBeUndefined();
  });

  it("returns the current store logo only when requested", async () => {
    const { repository, cashier } = await createStoreFixture();
    const response = await request(createApp({ repository, jwtSecret }))
      .get("/api/store/current?includeLogo=true")
      .set("Authorization", authHeader(cashier));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: "POS Grocery",
      logoUrl: "https://example.com/store-logo.png",
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
      .send({ name: "New Store", phone: "0811111111", logoUrl: "https://example.com/new-logo.png" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: "New Store",
      phone: "0811111111",
      logoUrl: "https://example.com/new-logo.png",
    });
  });

  it("allows an owner to update a store with a real logo data URL", async () => {
    const { repository, owner, store } = await createStoreFixture();
    const logoDataUrl = `data:image/png;base64,${"a".repeat(150_000)}`;

    const response = await request(createApp({ repository, jwtSecret }))
      .patch(`/api/store/${store.id}`)
      .set("Authorization", authHeader(owner))
      .send({
        name: "POS Grocery",
        phone: "0925487891",
        address: "1/1 ม1",
        ownerName: "admin",
        logoUrl: logoDataUrl,
        status: "active",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: store.id,
      phone: "0925487891",
      address: "1/1 ม1",
      logoUrl: logoDataUrl,
    });
  });

  it("allows an owner/admin to list every store for multi-store management", async () => {
    const { repository, owner } = await createStoreFixture();
    await repository.createStore({
      name: "Second Branch",
      phone: "0822222222",
      address: "Chiang Mai",
      ownerName: "Branch Owner",
      logoUrl: "https://example.com/branch-logo.png",
      status: "active",
    });

    const response = await request(createApp({ repository, jwtSecret }))
      .get("/api/store")
      .set("Authorization", authHeader(owner));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ name: "POS Grocery", phone: "0800000000" }),
      expect.objectContaining({ name: "Second Branch", phone: "0822222222" }),
    ]);
  });

  it("creates a new store from the admin store management page", async () => {
    const { repository, owner } = await createStoreFixture();
    const response = await request(createApp({ repository, jwtSecret }))
      .post("/api/store")
      .set("Authorization", authHeader(owner))
      .send({
        name: "New Branch",
        phone: "0833333333",
        address: "Phuket",
        ownerName: "New Owner",
        logoUrl: "https://example.com/new-branch-logo.png",
        status: "active",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "New Branch",
      phone: "0833333333",
      address: "Phuket",
      ownerName: "New Owner",
      logoUrl: "https://example.com/new-branch-logo.png",
      status: "active",
    });
    await expect(repository.findStoreById(response.body.data.id)).resolves.toMatchObject({
      name: "New Branch",
    });
  });

  it("prevents a cashier from listing or creating stores", async () => {
    const { repository, cashier } = await createStoreFixture();
    const app = createApp({ repository, jwtSecret });

    const listResponse = await request(app)
      .get("/api/store")
      .set("Authorization", authHeader(cashier));
    const createResponse = await request(app)
      .post("/api/store")
      .set("Authorization", authHeader(cashier))
      .send({
        name: "Blocked Store",
        phone: "0800000001",
        address: "Blocked",
        ownerName: "Blocked",
      });

    expect(listResponse.status).toBe(403);
    expect(createResponse.status).toBe(403);
  });
});
