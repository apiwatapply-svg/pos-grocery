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

  it.each([
    [
      'owner',
      routes.filter(
        (route) => route !== 'store-settings' && route !== 'user-management',
      ),
    ],
    ['admin', routes],
    ['cashier', ['pos', 'customer-display', 'receipts', 'receipt-detail', 'products']],
    ['stock', ['dashboard', 'products', 'inventory', 'inventory-receiving', 'stock-counting']],
  ] as [Role, AppRouteId[]][])('allows %s to access the expected pages', (role, allowedRoutes) => {
    for (const route of routes) {
      expect(canAccessRoute(role, route)).toBe(allowedRoutes.includes(route))
    }
  })
})
