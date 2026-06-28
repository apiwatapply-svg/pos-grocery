import type { SaleRecord, StoreRecord } from "../users/user.repository.js";

function formatBaht(valueSatang: number) {
  return (valueSatang / 100).toFixed(2);
}

export function buildReceiptContent(store: StoreRecord, sale: SaleRecord) {
  const lines = [
    store.name,
    store.address,
    `Tel: ${store.phone}`,
    `Receipt: ${sale.receiptNumber}`,
    `Sold at: ${new Date(sale.soldAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
    "--------------------------------",
    ...sale.items.map(
      (item) =>
        `${item.productName} x${item.quantity} @${formatBaht(item.unitPriceSatang)} = ${formatBaht(
          item.totalSatang,
        )}`,
    ),
    "--------------------------------",
    `Total: ${formatBaht(sale.totalSatang)}`,
    `Cash: ${formatBaht(sale.cashReceivedSatang)}`,
    `Change: ${formatBaht(sale.changeDueSatang)}`,
    "Thank you",
  ];

  return lines.join("\n");
}
