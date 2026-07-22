import { describe, expect, it } from 'vitest'
import { canAccessRoute, routePermissions, type AppRouteId, type Role } from './permissions'

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

  it('only super_admin can access the two protected management pages', () => {
    expect(canAccessRoute('super_admin', 'store-settings')).toBe(true)
    expect(canAccessRoute('super_admin', 'user-management')).toBe(true)
  })

  it('keeps every other role off the in-app pages', () => {
    const nonSuperAdminRoles: Role[] = ['store_admin', 'cashier', 'stock']

    for (const role of nonSuperAdminRoles) {
      for (const route of routes) {
        expect(canAccessRoute(role, route)).toBe(false)
      }
    }
  })
})
