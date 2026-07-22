import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { comparePassword, createAuthToken, hashPassword, requireActiveUser } from "./auth.service.ts";
import type { UserRecord } from "../users/user.repository.ts";

describe("auth service", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("admin");

    expect(hash).not.toBe("admin");
    await expect(comparePassword("admin", hash)).resolves.toBe(true);
    await expect(comparePassword("wrong", hash)).resolves.toBe(false);
  });

  it("rejects inactive users", () => {
    expect(() => requireActiveUser({ status: "inactive" })).toThrow("User is inactive.");
  });

  it("creates a token without an expiry so the session lasts until logout", () => {
    const user: UserRecord = {
      id: "user-1",
      storeId: "store-1",
      username: "admin",
      passwordHash: "hash",
      displayName: "Admin",
      role: "super_admin",
      status: "active",
    };
    const token = createAuthToken(user, "test-secret-that-is-long-enough");
    const payload = jwt.decode(token);

    expect(payload).toMatchObject({
      sub: "user-1",
      storeId: "store-1",
      username: "admin",
      role: "super_admin",
    });
    expect(payload).not.toHaveProperty("exp");
  });
});
