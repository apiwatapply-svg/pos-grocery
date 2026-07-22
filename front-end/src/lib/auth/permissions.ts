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
 * - `super_admin` is the only role that can access the in-app screens.
 *   After login it may reach the store management page and the user
 *   management page (the only two protected pages allowed in the app).
 * - `store_admin`, `cashier`, and `stock` cannot access any protected page;
 *   the Login page is the only screen they can ever reach.
 *
 * If new roles are added in the future, add them here and document the
 * intended pages in the same place.
 */
export const routePermissions: Record<AppRouteId, Role[]> = {
  dashboard: [],
  pos: [],
  'customer-display': [],
  receipts: [],
  'receipt-detail': [],
  products: [],
  'product-create': [],
  'product-edit': [],
  inventory: [],
  'inventory-receiving': [],
  'stock-counting': [],
  'sales-report': [],
  'store-settings': ['super_admin'],
  'user-management': ['super_admin'],
}

export function canAccessRoute(role: Role, routeId: AppRouteId) {
  return routePermissions[routeId].includes(role)
}
