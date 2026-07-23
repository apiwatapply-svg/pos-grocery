import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { LoginPage } from './features/auth/LoginPage'
import { InventoryListPage } from './features/inventory/InventoryListPage'
import { InventoryReceivingPage } from './features/inventory/InventoryReceivingPage'
import { StockCountingPage } from './features/inventory/StockCountingPage'
import { CustomerDisplayPage } from './features/pos/CustomerDisplayPage'
import { PosCheckoutPage } from './features/pos/PosCheckoutPage'
import { ProductFormPage } from './features/products/ProductFormPage'
import { ProductListPage } from './features/products/ProductListPage'
import { ReceiptDetailPage } from './features/receipts/ReceiptDetailPage'
import { ReceiptListPage } from './features/receipts/ReceiptListPage'
import { SalesReportPage } from './features/reports/SalesReportPage'
import { NotFoundPage } from './features/shared/NotFoundPage'
import { StoreSettingsPage } from './features/store/StoreSettingsPage'
import { UserManagementPage } from './features/users/UserManagementPage'
import type { AppRouteId } from './lib/auth/permissions'
import { readSession } from './lib/auth/session'

function defaultRouteForCurrentUser() {
  const role = readSession()?.user.role

  if (role === 'super_admin') {
    return '/settings/store'
  }
  if (role === 'cashier') {
    return '/pos'
  }
  if (role === 'stock') {
    return '/inventory'
  }
  if (role === 'store_admin') {
    return '/dashboard'
  }

  return '/login'
}

function protectedPage(routeId: AppRouteId, page: ReactElement) {
  return (
    <RequireAuth routeId={routeId}>
      <AppShell>{page}</AppShell>
    </RequireAuth>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={defaultRouteForCurrentUser()} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={protectedPage('dashboard', <DashboardPage />)} />
      <Route path="/pos" element={protectedPage('pos', <PosCheckoutPage />)} />
      <Route
        path="/customer-display"
        element={protectedPage('customer-display', <CustomerDisplayPage />)}
      />
      <Route path="/receipts" element={protectedPage('receipts', <ReceiptListPage />)} />
      <Route
        path="/receipts/:receiptId"
        element={protectedPage('receipt-detail', <ReceiptDetailPage />)}
      />
      <Route path="/products" element={protectedPage('products', <ProductListPage />)} />
      <Route path="/products/new" element={protectedPage('product-create', <ProductFormPage />)} />
      <Route
        path="/products/:productId/edit"
        element={protectedPage('product-edit', <ProductFormPage />)}
      />
      <Route path="/inventory" element={protectedPage('inventory', <InventoryListPage />)} />
      <Route
        path="/inventory/receiving"
        element={protectedPage('inventory-receiving', <InventoryReceivingPage />)}
      />
      <Route
        path="/inventory/counting"
        element={protectedPage('stock-counting', <StockCountingPage />)}
      />
      <Route path="/reports/sales" element={protectedPage('sales-report', <SalesReportPage />)} />
      <Route path="/settings/store" element={protectedPage('store-settings', <StoreSettingsPage />)} />
      <Route path="/settings/users" element={protectedPage('user-management', <UserManagementPage />)} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
