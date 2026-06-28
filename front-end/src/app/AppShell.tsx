import { type ReactNode, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
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
  'best-sellers-report': 'ดี',
  'store-settings': 'ร้าน',
  'user-management': 'ผู้',
}

const sidebarCollapsedStorageKey = 'pos-grocery:sidebar-collapsed'

function readSidebarCollapsedPreference() {
  return localStorage.getItem(sidebarCollapsedStorageKey) === 'true'
}

export function AppShell({ children }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsedPreference)
  const navigate = useNavigate()
  const session = readSession()
  const user = session?.user
  const canUsePos = user ? canAccessRoute(user.role, 'pos') : false

  function logout() {
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
        <nav aria-label="เมนูหลัก" className="sidebar-nav" data-open={isMenuOpen}>
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
                    onClick={() => setIsMenuOpen(false)}
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
      </aside>

      <div className="app-main">
        <header className="navbar">
          <button
            aria-label={isMenuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            className="menu-button"
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            ☰
          </button>
          <div className="navbar-store">
            <strong>POS Grocery</strong>
            <span>{user?.displayName ?? 'Guest'}</span>
            <span>{user?.role ?? 'guest'}</span>
          </div>
          <div className="navbar-actions">
            {canUsePos ? (
              <Link className="navbar-pos-button primary-button compact" to="/pos">
                ไปหน้า POS
              </Link>
            ) : null}
            <button className="ghost-button compact" onClick={logout} type="button">
              Logout
            </button>
          </div>
        </header>
        <main className="route-content">{children}</main>
      </div>
    </div>
  )
}
