import { type ReactNode, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { canAccessRoute } from '../lib/auth/permissions'
import { clearSession, readSession } from '../lib/auth/session'
import { navGroups, protectedRoutes } from './routes'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navigate = useNavigate()
  const session = readSession()
  const user = session?.user

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>POS</span>
          <strong>POS Grocery</strong>
        </div>
        <nav aria-label="เมนูหลัก" className="sidebar-nav" data-open={isMenuOpen}>
          {navGroups.map((group) => {
            const groupRoutes = protectedRoutes.filter(
              (route) =>
                route.navGroup === group.id &&
                user &&
                canAccessRoute(user.role, route.id) &&
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
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    key={route.id}
                    onClick={() => setIsMenuOpen(false)}
                    to={route.path}
                  >
                    {route.label}
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
            <Link className="primary-button compact" to="/pos">
              ไปหน้า POS
            </Link>
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
