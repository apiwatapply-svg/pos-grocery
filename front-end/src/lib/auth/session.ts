import type { Role } from './permissions'

export const sessionStorageKey = 'pos-grocery:session'

export type CurrentUser = {
  id: string
  username: string
  displayName: string
  role: Role
}

export type Session = {
  token: string
  user: CurrentUser
}

export function readSession(): Session | null {
  const storedSession = localStorage.getItem(sessionStorageKey)
  if (!storedSession) {
    return null
  }

  try {
    return JSON.parse(storedSession) as Session
  } catch {
    clearSession()
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(sessionStorageKey, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(sessionStorageKey)
}
