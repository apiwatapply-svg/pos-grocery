import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createAuthToken, hashPassword } from "./auth/auth.service.js";
import { createInMemoryUserRepository, type UserRecord } from "./users/user.repository.js";

const jwtSecret = "test-secret-that-is-long-enough-for-pos-mvp-tests";

async function createFixture() {
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

  return { app: createApp({ repository, jwtSecret }), repository, store, owner };
}

function authHeader(user: UserRecord) {
  return `Bearer ${createAuthToken(user, jwtSecret)}`;
}

function parseBinary(
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer) => chunks.push(chunk));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("POS Grocery MVP API", () => {
  it("manages users with full CRUD operations", async () => {
    const { app, owner } = await createFixture();

    const created = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader(owner))
      .send({
        username: "cashier",
        password: "cashier123",
        displayName: "Cashier One",
        role: "cashier",
        status: "active",
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      username: "cashier",
      displayName: "Cashier One",
      role: "cashier",
      status: "active",
    });
    expect(created.body.data.passwordHash).toBeUndefined();

    const listed = await request(app).get("/api/users").set("Authorization", authHeader(owner));

    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "cashier" })]),
    );

    const updated = await request(app)
      .patch(`/api/users/${created.body.data.id}`)
      .set("Authorization", authHeader(owner))
      .send({ displayName: "Cashier Updated", status: "inactive" });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      displayName: "Cashier Updated",
      status: "inactive",
    });

    const deleted = await request(app)
      .delete(`/api/users/${created.body.data.id}`)
      .set("Authorization", authHeader(owner));

    expect(deleted.status).toBe(200);
    expect(deleted.body.data.status).toBe("inactive");
  });

  it("manages products, Cloudinary image metadata, and inventory movements", async () => {
    const { app, owner } = await createFixture();

    const product = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader(owner))
      .send({
        name: "Instant Noodles",
        barcode: "8850001000011",
        sku: "NOODLE-001",
        unit: "pack",
        costPriceSatang: 700,
        salePriceSatang: 1200,
        status: "active",
      });

    expect(product.status).toBe(201);
    expect(product.body.data).toMatchObject({
      name: "Instant Noodles",
      barcode: "8850001000011",
      stockQuantity: 0,
    });

    const image = await request(app)
      .post(`/api/products/${product.body.data.id}/images`)
      .set("Authorization", authHeader(owner))
      .send({
        fileName: "noodle.jpg",
        dataUri: "data:image/jpeg;base64,dGVzdA==",
        altText: "Instant Noodles product photo",
      });

    expect(image.status).toBe(201);
    expect(image.body.data).toMatchObject({
      provider: "cloudinary",
      secureUrl: expect.stringContaining("cloudinary"),
      altText: "Instant Noodles product photo",
    });

    const received = await request(app)
      .post("/api/inventory/receive")
      .set("Authorization", authHeader(owner))
      .send({
        productId: product.body.data.id,
        quantity: 24,
        unitCostSatang: 700,
        note: "Initial stock",
      });

    expect(received.status).toBe(201);
    expect(received.body.data.product.stockQuantity).toBe(24);

    const counted = await request(app)
      .post("/api/inventory/count")
      .set("Authorization", authHeader(owner))
      .send({
        productId: product.body.data.id,
        countedQuantity: 22,
        note: "Shelf count",
      });

    expect(counted.status).toBe(201);
    expect(counted.body.data.product.stockQuantity).toBe(22);

    const exported = await request(app)
      .get("/api/inventory/export.xlsx")
      .set("Authorization", authHeader(owner))
      .buffer(true)
      .parse(parseBinary);

    expect(exported.status).toBe(200);
    expect(exported.header["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(exported.body.length).toBeGreaterThan(1000);
  });

  it("checks out barcode sales, deducts stock, returns receipt, and reports dashboard data", async () => {
    const { app, owner } = await createFixture();

    const product = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader(owner))
      .send({
        name: "Drinking Water",
        barcode: "8850002000010",
        unit: "bottle",
        costPriceSatang: 400,
        salePriceSatang: 700,
        status: "active",
      });

    await request(app)
      .post("/api/inventory/receive")
      .set("Authorization", authHeader(owner))
      .send({
        productId: product.body.data.id,
        quantity: 10,
        unitCostSatang: 400,
      });

    const sale = await request(app)
      .post("/api/sales/checkout")
      .set("Authorization", authHeader(owner))
      .send({
        barcodeItems: [{ barcode: "8850002000010", quantity: 3 }],
        cashReceivedSatang: 5000,
        paymentMethod: "cash",
        soldAt: "2026-06-28T09:30:00.000Z",
      });

    expect(sale.status).toBe(201);
    expect(sale.body.data).toMatchObject({
      subtotalSatang: 2100,
      totalSatang: 2100,
      cashReceivedSatang: 5000,
      changeDueSatang: 2900,
      status: "completed",
    });
    expect(sale.body.data.items).toEqual([
      expect.objectContaining({
        productName: "Drinking Water",
        quantity: 3,
        totalSatang: 2100,
      }),
    ]);

    const products = await request(app).get("/api/products").set("Authorization", authHeader(owner));
    expect(products.body.data[0].stockQuantity).toBe(7);

    const cancelledSale = await request(app)
      .post(`/api/sales/${sale.body.data.id}/cancel`)
      .set("Authorization", authHeader(owner))
      .send({});

    expect(cancelledSale.status).toBe(200);
    expect(cancelledSale.body.data.status).toBe("void");

    const productsAfterCancel = await request(app).get("/api/products").set("Authorization", authHeader(owner));
    expect(productsAfterCancel.body.data[0].stockQuantity).toBe(10);

    const receipt = await request(app)
      .get(`/api/sales/${sale.body.data.id}/receipt`)
      .set("Authorization", authHeader(owner));

    expect(receipt.status).toBe(200);
    expect(receipt.body.data.content).toContain("Drinking Water");
    expect(receipt.body.data.content).toContain("21.00");

    const report = await request(app)
      .get("/api/reports/sales?from=2026-06-28T00:00:00.000Z&to=2026-06-28T23:59:59.999Z")
      .set("Authorization", authHeader(owner));

    expect(report.status).toBe(200);
    expect(report.body.data.summary).toMatchObject({
      orderCount: 0,
      totalSalesSatang: 0,
      itemsSold: 0,
    });
    expect(report.body.data.sales[0].status).toBe("void");

    const dashboard = await request(app)
      .get("/api/reports/dashboard?from=2026-06-28T00:00:00.000Z&to=2026-06-28T23:59:59.999Z")
      .set("Authorization", authHeader(owner));

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.bestSellers).toEqual([]);
    expect(dashboard.body.data.bestTimeSlots).toEqual([]);

    const exported = await request(app)
      .get("/api/reports/export.xlsx?from=2026-06-28T00:00:00.000Z&to=2026-06-28T23:59:59.999Z")
      .set("Authorization", authHeader(owner))
      .buffer(true)
      .parse(parseBinary);

    expect(exported.status).toBe(200);
    expect(exported.header["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(exported.body.length).toBeGreaterThan(1000);
  });
});
