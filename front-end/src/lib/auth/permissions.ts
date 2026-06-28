export type Role = 'owner' | 'admin' | 'cashier' | 'stock'

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
  | 'best-sellers-report'
  | 'store-settings'
  | 'user-management'

export const routePermissions: Record<AppRouteId, Role[]> = {
  dashboard: ['owner', 'admin', 'stock'],
  pos: ['owner', 'admin', 'cashier'],
  'customer-display': ['owner', 'admin', 'cashier'],
  receipts: ['owner', 'admin', 'cashier'],
  'receipt-detail': ['owner', 'admin', 'cashier'],
  products: ['owner', 'admin', 'cashier', 'stock'],
  'product-create': ['owner', 'admin'],
  'product-edit': ['owner', 'admin'],
  inventory: ['owner', 'admin', 'stock'],
  'inventory-receiving': ['owner', 'admin', 'stock'],
  'stock-counting': ['owner', 'admin', 'stock'],
  'sales-report': ['owner', 'admin'],
  'best-sellers-report': ['owner', 'admin'],
  'store-settings': ['owner', 'admin'],
  'user-management': ['owner', 'admin'],
}

export function canAccessRoute(role: Role, routeId: AppRouteId) {
  return routePermissions[routeId].includes(role)
}
