export type Role = 'super_admin' | 'store_admin' | 'cashier' | 'stock'

export type AppRouteId =
  | 'dashboard'
  | 'pos'
  | 'customer-display'
  | 'receipts'
  | 'receipt-detail'
  | 'products'
  | 'product-create'
  | 'product-edit'
  | 'inventory'
  | 'inventory-receiving'
  | 'stock-counting'
  | 'sales-report'
  | 'store-settings'
  | 'user-management'

/**
 * Access policy for the current permission model.
 *
 * - `super_admin` only ever opens the store settings page and the user
 *   management page. The Login page is the only other screen it can
 *   open before authentication. It cannot open POS, products,
 *   inventory, or reports; those are store-scoped surfaces.
 * - `store_admin` (the store owner) opens every store-scoped page
 *   inside their own store: dashboard, POS, products, inventory,
 *   reports, and the user management page (which only lists users
 *   from the admin's own store).
 * - `cashier` opens POS, receipts, and the customer display.
 * - `stock` opens the inventory and stock counting surfaces.
 *
 * If a new role is added, update this map and the corresponding
 * backend `requireRole(...)` whitelists. The
 * `App.tsx > defaultRouteForCurrentUser` helper picks the landing
 * page from the same role list.
 */
export const routePermissions: Record<AppRouteId, Role[]> = {
  dashboard: ['store_admin', 'stock'],
  pos: ['store_admin', 'cashier'],
  'customer-display': ['store_admin', 'cashier'],
  receipts: ['store_admin', 'cashier'],
  'receipt-detail': ['store_admin', 'cashier'],
  products: ['store_admin', 'cashier', 'stock'],
  'product-create': ['store_admin'],
  'product-edit': ['store_admin'],
  inventory: ['store_admin', 'stock'],
  'inventory-receiving': ['store_admin', 'stock'],
  'stock-counting': ['store_admin', 'stock'],
  'sales-report': ['store_admin'],
  'store-settings': ['super_admin'],
  'user-management': ['super_admin', 'store_admin'],
}

export function canAccessRoute(role: Role, routeId: AppRouteId) {
  return routePermissions[routeId].includes(role)
}
