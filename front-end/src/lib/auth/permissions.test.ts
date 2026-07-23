import { describe, expect, it } from 'vitest'
import { canAccessRoute, routePermissions, type AppRouteId } from './permissions'

const routes: AppRouteId[] = [
  'dashboard',
  'pos',
  'customer-display',
  'receipts',
  'receipt-detail',
  'products',
  'product-create',
  'product-edit',
  'inventory',
  'inventory-receiving',
  'stock-counting',
  'sales-report',
  'store-settings',
  'user-management',
]

describe('route permissions', () => {
  it('defines permissions for every protected route', () => {
    expect(Object.keys(routePermissions).sort()).toEqual([...routes].sort())
  })

  it('only super_admin can open the store management page', () => {
    expect(canAccessRoute('super_admin', 'store-settings')).toBe(true)
    expect(canAccessRoute('store_admin', 'store-settings')).toBe(false)
    expect(canAccessRoute('cashier', 'store-settings')).toBe(false)
    expect(canAccessRoute('stock', 'store-settings')).toBe(false)
  })

  it('super_admin and store_admin can open the user management page', () => {
    expect(canAccessRoute('super_admin', 'user-management')).toBe(true)
    expect(canAccessRoute('store_admin', 'user-management')).toBe(true)
    expect(canAccessRoute('cashier', 'user-management')).toBe(false)
    expect(canAccessRoute('stock', 'user-management')).toBe(false)
  })

  it('keeps every store-scoped page open for store_admin', () => {
    const storeAdminPages: AppRouteId[] = [
      'dashboard',
      'pos',
      'customer-display',
      'receipts',
      'receipt-detail',
      'products',
      'product-create',
      'product-edit',
      'inventory',
      'inventory-receiving',
      'stock-counting',
      'sales-report',
    ]

    for (const page of storeAdminPages) {
      expect(canAccessRoute('store_admin', page)).toBe(true)
    }
  })

  it('limits the cashier to POS, receipts, and the customer display', () => {
    expect(canAccessRoute('cashier', 'pos')).toBe(true)
    expect(canAccessRoute('cashier', 'customer-display')).toBe(true)
    expect(canAccessRoute('cashier', 'receipts')).toBe(true)
    expect(canAccessRoute('cashier', 'receipt-detail')).toBe(true)
    expect(canAccessRoute('cashier', 'products')).toBe(true)

    expect(canAccessRoute('cashier', 'dashboard')).toBe(false)
    expect(canAccessRoute('cashier', 'inventory')).toBe(false)
    expect(canAccessRoute('cashier', 'product-create')).toBe(false)
    expect(canAccessRoute('cashier', 'product-edit')).toBe(false)
    expect(canAccessRoute('cashier', 'sales-report')).toBe(false)
  })

  it('limits the stock role to inventory and product browsing', () => {
    expect(canAccessRoute('stock', 'dashboard')).toBe(true)
    expect(canAccessRoute('stock', 'products')).toBe(true)
    expect(canAccessRoute('stock', 'inventory')).toBe(true)
    expect(canAccessRoute('stock', 'inventory-receiving')).toBe(true)
    expect(canAccessRoute('stock', 'stock-counting')).toBe(true)

    expect(canAccessRoute('stock', 'pos')).toBe(false)
    expect(canAccessRoute('stock', 'customer-display')).toBe(false)
    expect(canAccessRoute('stock', 'receipts')).toBe(false)
    expect(canAccessRoute('stock', 'product-create')).toBe(false)
    expect(canAccessRoute('stock', 'product-edit')).toBe(false)
    expect(canAccessRoute('stock', 'sales-report')).toBe(false)
  })

  it('keeps every store-scoped page off limits for super_admin', () => {
    const storeScopedPages: AppRouteId[] = [
      'dashboard',
      'pos',
      'customer-display',
      'receipts',
      'receipt-detail',
      'products',
      'product-create',
      'product-edit',
      'inventory',
      'inventory-receiving',
      'stock-counting',
      'sales-report',
    ]

    for (const page of storeScopedPages) {
      expect(canAccessRoute('super_admin', page)).toBe(false)
    }
  })
})
