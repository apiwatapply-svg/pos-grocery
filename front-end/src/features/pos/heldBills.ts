export type HeldBillItem = {
  productId: string
  productName: string
  barcode: string
  imageUrl?: string
  quantity: number
  unitPrice: number
}

export type HeldBill = {
  id: string
  storeId: string
  items: HeldBillItem[]
  cashReceived: number
  note?: string
  createdAt: string
}

const STORAGE_PREFIX = 'pos-grocery:held-bills'
export const MAX_HELD_BILLS = 20

export function heldBillsStorageKey(storeId: string) {
  return `${STORAGE_PREFIX}:${storeId}`
}

function isCartItemArray(value: unknown): value is HeldBillItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as HeldBillItem).productId === 'string' &&
        typeof (item as HeldBillItem).productName === 'string' &&
        typeof (item as HeldBillItem).barcode === 'string' &&
        typeof (item as HeldBillItem).quantity === 'number' &&
        typeof (item as HeldBillItem).unitPrice === 'number',
    )
  )
}

export function loadHeldBills(storeId: string): HeldBill[] {
  if (!storeId) {
    return []
  }

  try {
    const raw = localStorage.getItem(heldBillsStorageKey(storeId))
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (bill): bill is HeldBill =>
        bill !== null &&
        typeof bill === 'object' &&
        typeof (bill as HeldBill).id === 'string' &&
        typeof (bill as HeldBill).storeId === 'string' &&
        typeof (bill as HeldBill).cashReceived === 'number' &&
        typeof (bill as HeldBill).createdAt === 'string' &&
        isCartItemArray((bill as HeldBill).items) &&
        ((bill as HeldBill).note === undefined ||
          typeof (bill as HeldBill).note === 'string'),
    )
  } catch {
    return []
  }
}

export function saveHeldBills(storeId: string, bills: HeldBill[]): void {
  if (!storeId) {
    return
  }
  try {
    localStorage.setItem(heldBillsStorageKey(storeId), JSON.stringify(bills))
  } catch {
    // localStorage may be full or unavailable — fail silently, the caller
    // will surface a user-facing error from its own catch.
    throw new Error('STORAGE_UNAVAILABLE')
  }
}

export function generateBillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `held-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
