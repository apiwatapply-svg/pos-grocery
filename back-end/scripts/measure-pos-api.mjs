const API_BASE = process.env.API_BASE ?? "http://localhost:8787/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();

  if (!response.ok || body.success === false) {
    throw new Error(`${path} failed: ${JSON.stringify(body.error ?? body)}`);
  }

  return body.data;
}

function ms(startedAt) {
  return Math.round(performance.now() - startedAt);
}

const loginStartedAt = performance.now();
const login = await request("/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "admin", password: "admin" }),
});
console.log(`login_ms=${ms(loginStartedAt)}`);

const authHeaders = { authorization: `Bearer ${login.token}` };

const productsStartedAt = performance.now();
const products = await request("/products?view=operation", { headers: authHeaders });
console.log(`products_ms=${ms(productsStartedAt)} count=${products.length}`);

const saleProducts = products.filter((product) => product.status === "active" && product.stockQuantity > 0).slice(0, 3);
if (saleProducts.length === 0) {
  throw new Error("No sellable products available.");
}

const checkoutStartedAt = performance.now();
const sale = await request("/sales/checkout", {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    barcodeItems: saleProducts.map((product) => ({ barcode: product.barcode, quantity: 1 })),
    cashReceivedSatang: saleProducts.reduce((sum, product) => sum + product.salePriceSatang, 0) + 100000,
    paymentMethod: "cash",
  }),
});
console.log(`checkout_ms=${ms(checkoutStartedAt)} lines=${saleProducts.length} total=${sale.totalSatang}`);

const receiptsStartedAt = performance.now();
const receipts = await request("/sales?limit=50", { headers: authHeaders });
console.log(`sales_limit_50_ms=${ms(receiptsStartedAt)} count=${receipts.items.length}`);

const cancelStartedAt = performance.now();
await request(`/sales/${sale.id}/cancel`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({}),
});
console.log(`cancel_ms=${ms(cancelStartedAt)}`);
