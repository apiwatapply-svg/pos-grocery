import { describe, expect, it } from "vitest";
import { comparePassword, hashPassword, requireActiveUser } from "./auth.service.js";

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
});
