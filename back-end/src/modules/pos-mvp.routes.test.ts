import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { createAuthToken, hashPassword } from "./auth/auth.service.ts";
import { createInMemoryUserRepository, type UserRecord } from "./users/user.repository.ts";

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
    role: "store_admin",
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

  return { app: createApp({ repository, jwtSecret }), repository, store, owner, cashier };
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

function zipEntryText(buffer: Buffer, entryName: string) {
  let offset = 0;

  while (offset < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }

    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraFieldLength;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");

    if (name === entryName) {
      return buffer.subarray(dataStart, dataStart + compressedSize).toString("utf8");
    }

    offset = dataStart + compressedSize;
  }

  throw new Error(`Missing zip entry ${entryName}`);
}

describe("POS Grocery MVP API", () => {
  it("manages users with full CRUD operations", async () => {
    const { app, owner } = await createFixture();

    const created = await request(app)
      .post("/api/users")
      .set("Authorization", authHeader(owner))
      .send({
        username: "second-user",
        password: "user1234",
        displayName: "Second User",
        role: "stock",
        status: "active",
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      username: "second-user",
      displayName: "Second User",
      role: "stock",
      status: "active",
    });
    expect(created.body.data.passwordHash).toBeUndefined();

    const listed = await request(app).get("/api/users").set("Authorization", authHeader(owner));

    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "second-user" })]),
    );

    const updated = await request(app)
      .patch(`/api/users/${created.body.data.id}`)
      .set("Authorization", authHeader(owner))
      .send({ displayName: "Second User Updated", status: "inactive" });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      displayName: "Second User Updated",
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

    const transactions = await request(app)
      .get("/api/inventory/transactions")
      .set("Authorization", authHeader(owner));

    expect(transactions.status).toBe(200);
    expect(transactions.body.data).toEqual(
      expect.objectContaining({
        total: 2,
        page: 1,
        pageSize: 20,
        items: [
          expect.objectContaining({
            productId: product.body.data.id,
            productName: "Instant Noodles",
            barcode: "8850001000011",
            type: "count",
            quantityChange: -2,
            balanceAfterChange: 22,
            createdBy: "Owner",
          }),
          expect.objectContaining({
            productId: product.body.data.id,
            productName: "Instant Noodles",
            barcode: "8850001000011",
            type: "receive",
            quantityChange: 24,
            balanceAfterChange: 24,
            createdBy: "Owner",
          }),
        ],
      }),
    );

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
    expect(exported.body.toString("utf8")).toContain("อันดับ");
    expect(exported.body.toString("utf8")).not.toContain("SKU");
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
    const expectedUnixSeconds = Math.floor(
      new Date("2026-06-28T09:30:00.000Z").getTime() / 1000,
    );
    expect(sale.body.data).toMatchObject({
      receiptNumber: `R-${expectedUnixSeconds}`,
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

    const activatedSale = await request(app)
      .post(`/api/sales/${sale.body.data.id}/activate`)
      .set("Authorization", authHeader(owner))
      .send({});

    expect(activatedSale.status).toBe(200);
    expect(activatedSale.body.data.status).toBe("completed");

    const productsAfterActivate = await request(app).get("/api/products").set("Authorization", authHeader(owner));
    expect(productsAfterActivate.body.data[0].stockQuantity).toBe(7);
    expect(productsAfterActivate.body.data[0].averageMonthlySalesQuantity).toBe(3);

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
      orderCount: 1,
      totalSalesSatang: 2100,
      itemsSold: 3,
    });
    expect(report.body.data.productSales[0]).toMatchObject({
      productName: "Drinking Water",
      quantity: 3,
      totalSalesSatang: 2100,
    });

    const productHistory = await request(app)
      .get(
        `/api/reports/products/${product.body.data.id}/sales-history?from=2026-06-27T00:00:00.000Z&to=2026-06-29T23:59:59.999Z`,
      )
      .set("Authorization", authHeader(owner));

    expect(productHistory.status).toBe(200);
    expect(productHistory.body.data).toEqual({
      productId: product.body.data.id,
      rows: [
        {
          date: "2026-06-27",
          quantity: 0,
          totalSalesSatang: 0,
          totalCostSatang: 0,
          profitSatang: 0,
          profitMarginPercent: 0,
        },
        {
          date: "2026-06-28",
          quantity: 3,
          totalSalesSatang: 2100,
          totalCostSatang: 1200,
          profitSatang: 900,
          profitMarginPercent: 75,
        },
        {
          date: "2026-06-29",
          quantity: 0,
          totalSalesSatang: 0,
          totalCostSatang: 0,
          profitSatang: 0,
          profitMarginPercent: 0,
        },
      ],
    });

    const dashboard = await request(app)
      .get("/api/reports/dashboard?from=2026-06-28T00:00:00.000Z&to=2026-06-28T23:59:59.999Z")
      .set("Authorization", authHeader(owner));

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.bestSellers[0]).toMatchObject({
      productName: "Drinking Water",
      quantity: 3,
      totalSalesSatang: 2100,
    });
    expect(dashboard.body.data.bestTimeSlots[0]).toMatchObject({
      orderCount: 1,
      totalSalesSatang: 2100,
    });

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
    const worksheet = zipEntryText(exported.body, "xl/worksheets/sheet1.xml");
    const styles = zipEntryText(exported.body, "xl/styles.xml");
    expect(worksheet).toContain("รายงานยอดขายรายสินค้า");
    expect(worksheet).toContain("ช่วงวันที่");
    expect(worksheet).toContain("สรุปยอดขาย");
    expect(worksheet).toContain("ยอดขายรวม");
    expect(worksheet).toContain("กำไรรวม");
    expect(worksheet).toContain("<autoFilter ref=");
    expect(worksheet).toContain("<pageMargins");
    expect(styles).toContain("<borders count=");
    expect(styles).toContain("style=\"thin\"");
    expect(worksheet).toContain("Product");
    expect(worksheet).toContain("Barcode");
    expect(worksheet).toContain("Drinking Water");
    expect(worksheet).toContain("8850002000010");
    expect(worksheet).toContain("3");
    expect(worksheet).toContain("21");
    expect(worksheet).not.toContain("Receipt");
  });

  it("reports cost, profit, and margin for each completed bill", async () => {
    const { app, owner } = await createFixture();

    const product = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader(owner))
      .send({
        name: "Profit Water",
        barcode: "8850002000027",
        unit: "bottle",
        costPriceSatang: 400,
        salePriceSatang: 700,
        status: "active",
      });
    const premiumSnack = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader(owner))
      .send({
        name: "Premium Snack",
        barcode: "8850003000028",
        unit: "pack",
        costPriceSatang: 100,
        salePriceSatang: 500,
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
    await request(app)
      .post("/api/inventory/receive")
      .set("Authorization", authHeader(owner))
      .send({
        productId: premiumSnack.body.data.id,
        quantity: 10,
        unitCostSatang: 100,
      });

    await request(app)
      .post("/api/sales/checkout")
      .set("Authorization", authHeader(owner))
      .send({
        barcodeItems: [{ barcode: "8850002000027", quantity: 3 }],
        cashReceivedSatang: 2100,
        paymentMethod: "cash",
        soldAt: "2026-06-28T01:15:00.000Z",
      });
    await request(app)
      .post("/api/sales/checkout")
      .set("Authorization", authHeader(owner))
      .send({
        barcodeItems: [{ barcode: "8850003000028", quantity: 2 }],
        cashReceivedSatang: 1000,
        paymentMethod: "cash",
        soldAt: "2026-06-28T01:45:00.000Z",
      });

    const report = await request(app)
      .get("/api/reports/sales?from=2026-06-28T00:00:00.000Z&to=2026-06-28T23:59:59.999Z")
      .set("Authorization", authHeader(owner));

    expect(report.status).toBe(200);
    expect(report.body.data.summary).toMatchObject({
      orderCount: 2,
      totalSalesSatang: 3100,
      itemsSold: 5,
      totalCostSatang: 1400,
      profitSatang: 1700,
      profitMarginPercent: 121.43,
    });
    expect(report.body.data.productSales[0]).toMatchObject({
      productName: "Profit Water",
      billCount: 1,
      quantity: 3,
      totalSalesSatang: 2100,
      totalCostSatang: 1200,
      profitSatang: 900,
      profitMarginPercent: 75,
    });

    const dashboard = await request(app)
      .get("/api/reports/dashboard?from=2026-06-28T00:00:00.000Z&to=2026-06-28T23:59:59.999Z")
      .set("Authorization", authHeader(owner));

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.bestSellers[0]).toMatchObject({
      productName: "Profit Water",
      quantity: 3,
      totalSalesSatang: 2100,
    });
    expect(dashboard.body.data.bestProfitProducts[0]).toMatchObject({
      productName: "Profit Water",
      profitSatang: 900,
      profitMarginPercent: 75,
    });
    expect(dashboard.body.data.hourlySales[0]).toMatchObject({
      hour: 8,
      orderCount: 2,
      totalSalesSatang: 3100,
    });
    expect(dashboard.body.data.hourlySales[0].items).toEqual([
      expect.objectContaining({
        productName: "Profit Water",
        quantity: 3,
      }),
      expect.objectContaining({
        productName: "Premium Snack",
        quantity: 2,
      }),
    ]);
  });

  it("lists sale summaries with sort and direction query parameters", async () => {
    const { app, owner } = await createFixture();

    const water = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader(owner))
      .send({
        name: "Sort Water",
        barcode: "8850005000009",
        unit: "bottle",
        costPriceSatang: 400,
        salePriceSatang: 500,
        status: "active",
      });

    const snack = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader(owner))
      .send({
        name: "Sort Snack",
        barcode: "8850005000016",
        unit: "pack",
        costPriceSatang: 800,
        salePriceSatang: 1500,
        status: "active",
      });

    await request(app)
      .post("/api/inventory/receive")
      .set("Authorization", authHeader(owner))
      .send({ productId: water.body.data.id, quantity: 20, unitCostSatang: 400 });
    await request(app)
      .post("/api/inventory/receive")
      .set("Authorization", authHeader(owner))
      .send({ productId: snack.body.data.id, quantity: 20, unitCostSatang: 800 });

    // Earlier, cheaper sale.
    await request(app)
      .post("/api/sales/checkout")
      .set("Authorization", authHeader(owner))
      .send({
        barcodeItems: [{ barcode: "8850005000009", quantity: 4 }],
        cashReceivedSatang: 5000,
        paymentMethod: "cash",
        soldAt: "2026-06-28T03:00:00.000Z",
      });

    // Later, more expensive sale.
    await request(app)
      .post("/api/sales/checkout")
      .set("Authorization", authHeader(owner))
      .send({
        barcodeItems: [{ barcode: "8850005000016", quantity: 5 }],
        cashReceivedSatang: 10000,
        paymentMethod: "cash",
        soldAt: "2026-06-28T05:00:00.000Z",
      });

    const newestFirst = await request(app)
      .get("/api/sales?page=1&pageSize=10&sort=soldAt&direction=desc")
      .set("Authorization", authHeader(owner));
    expect(newestFirst.status).toBe(200);
    expect(newestFirst.body.data.items).toHaveLength(2);
    expect(newestFirst.body.data.items[0].totalSatang).toBe(7500);
    expect(newestFirst.body.data.items[1].totalSatang).toBe(2000);

    const oldestFirst = await request(app)
      .get("/api/sales?page=1&pageSize=10&sort=soldAt&direction=asc")
      .set("Authorization", authHeader(owner));
    expect(oldestFirst.status).toBe(200);
    expect(oldestFirst.body.data.items[0].totalSatang).toBe(2000);
    expect(oldestFirst.body.data.items[1].totalSatang).toBe(7500);

    const highestTotalFirst = await request(app)
      .get("/api/sales?page=1&pageSize=10&sort=totalSatang&direction=desc")
      .set("Authorization", authHeader(owner));
    expect(highestTotalFirst.status).toBe(200);
    expect(highestTotalFirst.body.data.items[0].totalSatang).toBe(7500);
    expect(highestTotalFirst.body.data.items[0].profitSatang).toBe(3500);

    const lowestTotalFirst = await request(app)
      .get("/api/sales?page=1&pageSize=10&sort=totalSatang&direction=asc")
      .set("Authorization", authHeader(owner));
    expect(lowestTotalFirst.status).toBe(200);
    expect(lowestTotalFirst.body.data.items[0].totalSatang).toBe(2000);
  });

  it("lets a cashier check out a sale but only store_admin can cancel or activate it", async () => {
    const { app, owner, cashier } = await createFixture();

    const product = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader(owner))
      .send({
        name: "Cashier Water",
        barcode: "8850007000017",
        unit: "bottle",
        costPriceSatang: 400,
        salePriceSatang: 700,
        status: "active",
      });
    await request(app)
      .post("/api/inventory/receive")
      .set("Authorization", authHeader(owner))
      .send({ productId: product.body.data.id, quantity: 5, unitCostSatang: 400 });

    const sale = await request(app)
      .post("/api/sales/checkout")
      .set("Authorization", authHeader(cashier))
      .send({
        barcodeItems: [{ barcode: "8850007000017", quantity: 1 }],
        cashReceivedSatang: 1000,
        paymentMethod: "cash",
        soldAt: "2026-07-15T03:00:00.000Z",
      });
    expect(sale.status).toBe(201);
    const saleId = sale.body.data.id;

    const cancelledByCashier = await request(app)
      .post(`/api/sales/${saleId}/cancel`)
      .set("Authorization", authHeader(cashier))
      .send({});
    expect(cancelledByCashier.status).toBe(403);

    const cancelledByStoreAdmin = await request(app)
      .post(`/api/sales/${saleId}/cancel`)
      .set("Authorization", authHeader(owner))
      .send({});
    expect(cancelledByStoreAdmin.status).toBe(200);
    expect(cancelledByStoreAdmin.body.data.status).toBe("void");

    const activatedByCashier = await request(app)
      .post(`/api/sales/${saleId}/activate`)
      .set("Authorization", authHeader(cashier))
      .send({});
    expect(activatedByCashier.status).toBe(403);

    const activatedByStoreAdmin = await request(app)
      .post(`/api/sales/${saleId}/activate`)
      .set("Authorization", authHeader(owner))
      .send({});
    expect(activatedByStoreAdmin.status).toBe(200);
    expect(activatedByStoreAdmin.body.data.status).toBe("completed");
  });
});
