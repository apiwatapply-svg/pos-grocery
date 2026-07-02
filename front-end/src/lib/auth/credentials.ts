const lastUsernameStorageKey = "pos-grocery:last-username"

export function readRememberedUsername(): string {
  if (typeof localStorage === "undefined") {
    return ""
  }
  return localStorage.getItem(lastUsernameStorageKey) ?? ""
}

export function rememberUsername(username: string) {
  if (typeof localStorage === "undefined") {
    return
  }
  const trimmed = username.trim()
  if (trimmed) {
    localStorage.setItem(lastUsernameStorageKey, trimmed)
  }
}

export function clearRememberedUsername() {
  if (typeof localStorage === "undefined") {
    return
  }
  localStorage.removeItem(lastUsernameStorageKey)
}
