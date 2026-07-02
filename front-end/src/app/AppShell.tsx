import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { canAccessRoute, type AppRouteId } from '../lib/auth/permissions'
import { clearSession, readSession } from '../lib/auth/session'
import { navGroups, protectedRoutes } from './routes'

type AppShellProps = {
  children: ReactNode
}

const collapsedNavLabels: Partial<Record<AppRouteId, string>> = {
  dashboard: 'DB',
  pos: 'ขาย',
  'customer-display': 'จอ',
  receipts: 'บิล',
  products: 'สค',
  'product-create': '+สค',
  inventory: 'คลัง',
  'inventory-receiving': 'รับ',
  'stock-counting': 'นับ',
  'sales-report': 'ยอด',
  'store-settings': 'ร้าน',
  'user-management': 'ผู้',
}

const sidebarCollapsedStorageKey = 'pos-grocery:sidebar-collapsed'

function readSidebarCollapsedPreference() {
  return localStorage.getItem(sidebarCollapsedStorageKey) === 'true'
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsedPreference)
  const navigate = useNavigate()
  const session = readSession()
  const user = session?.user

  async function logout() {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'ออกจากระบบ?',
      text: 'ยืนยันการออกจากระบบ POS Grocery',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
    })

    if (!result.isConfirmed) {
      return
    }

    clearSession()
    navigate('/login')
  }

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem(sidebarCollapsedStorageKey, String(next))
      return next
    })
  }

  return (
    <div className="app-layout" data-sidebar-collapsed={isSidebarCollapsed}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-lockup">
            <span>POS</span>
            <strong>POS Grocery</strong>
          </div>
          <button
            aria-label={isSidebarCollapsed ? 'ขยาย sidebar' : 'หุบ sidebar'}
            className="sidebar-collapse-button"
            onClick={toggleSidebarCollapsed}
            title={isSidebarCollapsed ? 'ขยาย sidebar' : 'หุบ sidebar'}
            type="button"
          >
            {isSidebarCollapsed ? '›' : '‹'}
          </button>
        </div>
        <nav aria-label="เมนูหลัก" className="sidebar-nav">
          {navGroups.map((group) => {
            const groupRoutes = protectedRoutes.filter(
              (route) =>
                route.navGroup === group.id &&
                user &&
                canAccessRoute(user.role, route.id) &&
                route.id !== 'inventory' &&
                route.id !== 'product-create' &&
                !route.path.includes(':'),
            )

            if (groupRoutes.length === 0) {
              return null
            }

            return (
              <section className="nav-group" key={group.id}>
                <h2>{group.label}</h2>
                {groupRoutes.map((route) => (
                  <NavLink
                    aria-label={route.label}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    key={route.id}
                    title={route.label}
                    to={route.path}
                  >
                    <span className="nav-link-short" aria-hidden="true">
                      {collapsedNavLabels[route.id] ?? route.label.slice(0, 2)}
                    </span>
                    <span className="nav-link-label">{route.label}</span>
                  </NavLink>
                ))}
              </section>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          {user ? (
            <div className="sidebar-user">
              <strong>{user.displayName}</strong>
              <span>{user.role}</span>
            </div>
          ) : null}
          <button
            className="sidebar-logout ghost-button compact"
            onClick={logout}
            type="button"
          >
            <span className="sidebar-logout-short" aria-hidden="true">ออก</span>
            <span className="sidebar-logout-label">Logout</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <main className="route-content">{children}</main>
      </div>
    </div>
  )
}
