import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { hashPassword } from "./auth.service.js";
import { createInMemoryUserRepository } from "../users/user.repository.js";

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
});
