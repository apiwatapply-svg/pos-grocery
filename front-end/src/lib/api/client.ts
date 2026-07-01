import Swal from 'sweetalert2'
import { clearSession, readSession } from '../auth/session'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'
const mutationFeedbackExcludedPrefixes = ['/auth/']
const getCacheTtlMs = 15000
const maxConcurrentGetRequests = 4

let activeMutationRequests = 0
let activeGetRequests = 0
const inFlightGetRequests = new Map<string, Promise<unknown>>()
const recentGetResponses = new Map<string, { expiresAt: number; value: unknown }>()
const queuedGetRequests: Array<() => void> = []

function runNextQueuedGetRequest() {
  if (activeGetRequests >= maxConcurrentGetRequests) {
    return
  }

  const nextRequest = queuedGetRequests.shift()

  if (!nextRequest) {
    return
  }

  activeGetRequests += 1
  nextRequest()
}

function scheduleGetRequest<T>(request: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queuedGetRequests.push(() => {
      request()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeGetRequests = Math.max(0, activeGetRequests - 1)
          runNextQueuedGetRequest()
        })
    })

    runNextQueuedGetRequest()
  })
}

function shouldShowMutationFeedback(path: string) {
  return !mutationFeedbackExcludedPrefixes.some((prefix) => path.startsWith(prefix))
}

function beginMutationFeedback(path: string) {
  if (!shouldShowMutationFeedback(path)) {
    return false
  }

  if (activeMutationRequests === 0) {
    void Swal.fire({
      title: 'กำลังบันทึกข้อมูล',
      text: 'โปรดรอสักครู่ ระบบกำลังส่งข้อมูลไปฐานข้อมูล',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading()
      },
    })
  }

  activeMutationRequests += 1

  return true
}

function endMutationFeedback(enabled: boolean, status: 'success' | 'error') {
  if (!enabled) {
    return
  }

  activeMutationRequests = Math.max(0, activeMutationRequests - 1)

  if (activeMutationRequests > 0) {
    return
  }

  if (status === 'success') {
    void Swal.fire({
      icon: 'success',
      title: 'บันทึกเรียบร้อย',
      toast: true,
      position: 'top-end',
      timer: 800,
      timerProgressBar: true,
      showConfirmButton: false,
    })
    return
  }

  Swal.close()
}

async function withMutationFeedback<T>(path: string, request: () => Promise<T>) {
  const feedbackEnabled = beginMutationFeedback(path)

  try {
    const result = await request()
    recentGetResponses.clear()
    endMutationFeedback(feedbackEnabled, 'success')
    return result
  } catch (error) {
    endMutationFeedback(feedbackEnabled, 'error')
    throw error
  }
}

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

function getRequestKey(path: string) {
  const session = readSession()
  return `${session?.token ?? 'anonymous'}:${path}`
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json()

  if (!response.ok || payload.success === false) {
    if (response.status === 401) {
      clearSession()
    }

    throw new Error(payload.error?.message ?? 'Request failed')
  }

  return payload.data as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const requestKey = getRequestKey(path)
  const recentResponse = recentGetResponses.get(requestKey)

  if (recentResponse && recentResponse.expiresAt > Date.now()) {
    return recentResponse.value as T
  }

  const existingRequest = inFlightGetRequests.get(requestKey) as Promise<T> | undefined

  if (existingRequest) {
    return existingRequest
  }

  const request = scheduleGetRequest(() =>
    fetch(`${apiBaseUrl}${path}`, {
      cache: 'no-store',
      headers: buildHeaders(false),
    })
      .then(async (response) => {
        const value = await readApiResponse<T>(response)
        recentGetResponses.set(requestKey, {
          expiresAt: Date.now() + getCacheTtlMs,
          value,
        })
        return value
      })
      .finally(() => {
        inFlightGetRequests.delete(requestKey)
      }),
  )

  inFlightGetRequests.set(requestKey, request)
  return request
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return withMutationFeedback(path, async () => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(body),
    })

    return readApiResponse<T>(response)
  })
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return withMutationFeedback(path, async () => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(true),
      body: JSON.stringify(body),
    })

    return readApiResponse<T>(response)
  })
}

export async function apiDelete<T>(path: string): Promise<T> {
  return withMutationFeedback(path, async () => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'DELETE',
      headers: buildHeaders(false),
    })

    return readApiResponse<T>(response)
  })
}

export async function apiDownload(path: string, fileName: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    headers: buildHeaders(false),
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearSession()
    }

    let message = 'Download failed'

    try {
      const payload = await response.json()
      message = payload.error?.message ?? message
    } catch {
      // Download responses can be binary or empty, so JSON error parsing is best-effort.
    }

    throw new Error(message)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
