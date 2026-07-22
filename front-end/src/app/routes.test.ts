import { describe, expect, it } from 'vitest'
import { appRoutes, navGroups, protectedRoutes } from './routes'

describe('app routes', () => {
  it('defines the expected number of route pages', () => {
    expect(appRoutes).toHaveLength(15)
    expect(appRoutes.some((route) => route.path === '/reports/best-sellers')).toBe(false)
  })

  it('gives every protected route metadata for guards and navigation', () => {
    for (const route of protectedRoutes) {
      expect(route.id).toBeTruthy()
      expect(route.path).toMatch(/^\//)
      expect(route.label).toBeTruthy()
      expect(route.navGroup).toBeTruthy()
      // roles may be empty for routes the current permission model has
      // locked down. Each route must still resolve a permission array
      // (possibly empty) so the frontend can render an access-denied page.
      expect(Array.isArray(route.roles)).toBe(true)
    }
  })

  it('groups routes into the sidebar navigation groups', () => {
    expect(navGroups).toEqual([
      { id: 'sales', label: 'ขายหน้าร้าน' },
      { id: 'inventory', label: 'สินค้าและสต็อก' },
      { id: 'reports', label: 'รายงาน' },
      { id: 'settings', label: 'ตั้งค่า' },
    ])
  })
})
