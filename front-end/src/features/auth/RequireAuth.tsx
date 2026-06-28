import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { canAccessRoute, type AppRouteId } from '../../lib/auth/permissions'
import { readSession } from '../../lib/auth/session'
import { AccessDeniedPage } from '../shared/AccessDeniedPage'

type RequireAuthProps = {
  children: ReactNode
  routeId: AppRouteId
}

export function RequireAuth({ children, routeId }: RequireAuthProps) {
  const location = useLocation()
  const session = readSession()

  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  if (!canAccessRoute(session.user.role, routeId)) {
    return <AccessDeniedPage />
  }

  return children
}
