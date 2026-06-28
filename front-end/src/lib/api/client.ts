import { readSession } from '../auth/session'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'

function buildHeaders(hasBody: boolean) {
  const headers = new Headers()
  const session = readSession()

  if (hasBody) {
    headers.set('Content-Type', 'application/json')
  }

  if (session) {
    headers.set('Authorization', `Bearer ${session.token}`)
  }

  return headers
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json()

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message ?? 'Request failed')
  }

  return payload.data as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: buildHeaders(false),
  })

  return readApiResponse<T>(response)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  })

  return readApiResponse<T>(response)
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'PATCH',
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  })

  return readApiResponse<T>(response)
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: buildHeaders(false),
  })

  return readApiResponse<T>(response)
}
