import { afterEach, describe, expect, it } from 'vitest'
import { clearSession, readSession, saveSession, sessionStorageKey, type Session } from './session'

const session: Session = {
  token: 'token-123',
  user: {
    id: 'user-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'owner',
  },
}

afterEach(() => {
  localStorage.clear()
})

describe('session helpers', () => {
  it('returns null when no session is stored', () => {
    expect(readSession()).toBeNull()
  })

  it('saves and reads the current session', () => {
    saveSession(session)

    expect(readSession()).toEqual(session)
    expect(localStorage.getItem(sessionStorageKey)).toBe(JSON.stringify(session))
  })

  it('clears the current session', () => {
    saveSession(session)

    clearSession()

    expect(readSession()).toBeNull()
  })

  it('returns null and clears storage when the stored session is invalid JSON', () => {
    localStorage.setItem(sessionStorageKey, '{broken')

    expect(readSession()).toBeNull()
    expect(localStorage.getItem(sessionStorageKey)).toBeNull()
  })
})
