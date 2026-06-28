import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("health endpoint", () => {
  it("returns service health", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        service: "pos-grocery-api",
        status: "ok",
      },
    });
  });

  it("returns a consistent not found response", async () => {
    const response = await request(createApp()).get("/api/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    });
  });
});
