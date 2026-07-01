import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.ts";
import { hashPassword } from "./auth.service.ts";
import { createInMemoryUserRepository } from "../users/user.repository.ts";

const jwtSecret = "test-secret-that-is-long-enough-for-auth-tests";

async function createRepositoryWithOwner() {
  const repository = createInMemoryUserRepository();
  const store = await repository.createStore({
    name: "POS Grocery",
    phone: "0800000000",
    address: "Bangkok",
    ownerName: "Owner",
    status: "active",
  });
  await repository.createUser({
    storeId: store.id,
    username: "admin",
    passwordHash: await hashPassword("admin"),
    displayName: "Admin",
    role: "owner",
    status: "active",
  });
  return repository;
}

describe("auth routes", () => {
  it("returns 400 for missing username or password", async () => {
    const response = await request(createApp({ jwtSecret })).post("/api/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Username and password are required.",
      },
    });
  });

  it("returns 401 for invalid credentials", async () => {
    const repository = await createRepositoryWithOwner();
    const response = await request(createApp({ repository, jwtSecret }))
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 instead of an unexpected server error for an invalid bearer token", async () => {
    const repository = await createRepositoryWithOwner();
    const response = await request(createApp({ repository, jwtSecret }))
      .get("/api/products")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid authentication token.",
      },
    });
  });

  it("returns a user profile and token for valid credentials", async () => {
    const repository = await createRepositoryWithOwner();
    const response = await request(createApp({ repository, jwtSecret }))
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      username: "admin",
      displayName: "Admin",
      role: "owner",
      status: "active",
    });
  });

  it("authenticates against the stored database password hash, not environment credentials", async () => {
    const repository = createInMemoryUserRepository();
    const store = await repository.createStore({
      name: "POS Grocery",
      phone: "0800000000",
      address: "Bangkok",
      ownerName: "Owner",
      status: "active",
    });
    await repository.createUser({
      storeId: store.id,
      username: "admin",
      passwordHash: await hashPassword("database-password"),
      displayName: "Admin",
      role: "owner",
      status: "active",
    });

    const envStylePassword = await request(createApp({ repository, jwtSecret }))
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin" });
    const databasePassword = await request(createApp({ repository, jwtSecret }))
      .post("/api/auth/login")
      .send({ username: "admin", password: "database-password" });

    expect(envStylePassword.status).toBe(401);
    expect(envStylePassword.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(databasePassword.status).toBe(200);
    expect(databasePassword.body.data.user.username).toBe("admin");
  });
});
