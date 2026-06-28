import { routePermissions, type AppRouteId, type Role } from '../lib/auth/permissions'

export type NavGroup = 'sales' | 'inventory' | 'reports' | 'settings'

export type AppRoute = {
  id: AppRouteId
  path: string
  label: string
  navGroup: NavGroup
  roles: Role[]
}

export const navGroups: { id: NavGroup; label: string }[] = [
  { id: 'sales', label: 'ขายหน้าร้าน' },
  { id: 'inventory', label: 'สินค้าและสต็อก' },
  { id: 'reports', label: 'รายงาน' },
  { id: 'settings', label: 'ตั้งค่า' },
]

export const protectedRoutes: AppRoute[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    navGroup: 'reports',
    roles: routePermissions.dashboard,
  },
  {
    id: 'pos',
    path: '/pos',
    label: 'ขายสินค้า',
    navGroup: 'sales',
    roles: routePermissions.pos,
  },
  {
    id: 'customer-display',
    path: '/customer-display',
    label: 'จอลูกค้า',
    navGroup: 'sales',
    roles: routePermissions['customer-display'],
  },
  {
    id: 'receipts',
    path: '/receipts',
    label: 'ใบเสร็จ',
    navGroup: 'sales',
    roles: routePermissions.receipts,
  },
  {
    id: 'receipt-detail',
    path: '/receipts/:receiptId',
    label: 'รายละเอียดใบเสร็จ',
    navGroup: 'sales',
    roles: routePermissions['receipt-detail'],
  },
  {
    id: 'products',
    path: '/products',
    label: 'สินค้า',
    navGroup: 'inventory',
    roles: routePermissions.products,
  },
  {
    id: 'product-create',
    path: '/products/new',
    label: 'เพิ่มสินค้า',
    navGroup: 'inventory',
    roles: routePermissions['product-create'],
  },
  {
    id: 'product-edit',
    path: '/products/:productId/edit',
    label: 'แก้ไขสินค้า',
    navGroup: 'inventory',
    roles: routePermissions['product-edit'],
  },
  {
    id: 'inventory',
    path: '/inventory',
    label: 'สินค้าคงคลัง',
    navGroup: 'inventory',
    roles: routePermissions.inventory,
  },
  {
    id: 'inventory-receiving',
    path: '/inventory/receiving',
    label: 'รับของเข้า',
    navGroup: 'inventory',
    roles: routePermissions['inventory-receiving'],
  },
  {
    id: 'stock-counting',
    path: '/inventory/counting',
    label: 'ตรวจนับ stock',
    navGroup: 'inventory',
    roles: routePermissions['stock-counting'],
  },
  {
    id: 'sales-report',
    path: '/reports/sales',
    label: 'รายงานยอดขาย',
    navGroup: 'reports',
    roles: routePermissions['sales-report'],
  },
  {
    id: 'best-sellers-report',
    path: '/reports/best-sellers',
    label: 'สินค้าขายดี',
    navGroup: 'reports',
    roles: routePermissions['best-sellers-report'],
  },
  {
    id: 'store-settings',
    path: '/settings/store',
    label: 'ข้อมูลร้าน',
    navGroup: 'settings',
    roles: routePermissions['store-settings'],
  },
  {
    id: 'user-management',
    path: '/settings/users',
    label: 'ผู้ใช้ระบบ',
    navGroup: 'settings',
    roles: routePermissions['user-management'],
  },
]

export const appRoutes = [
  {
    path: '/login',
    label: 'Login',
  },
  ...protectedRoutes,
]
