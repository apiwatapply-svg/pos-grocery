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
      expect(route.roles.length).toBeGreaterThan(0)
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
