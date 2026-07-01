// API client — talks to backend.
// In sandbox: backend runs in-process via Next.js catch-all API route (same origin)
// In production: NEXT_PUBLIC_API_URL is set to the Cloud Run backend URL

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

function buildUrl(path: string): string {
  if (API_BASE) {
    return `${API_BASE}${path}`
  }
  // Same origin — Next.js API route delegates to Hono backend
  return path
}

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('ld_token', token)
    else localStorage.removeItem('ld_token')
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('ld_token')
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = buildUrl(path)
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return data as T
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T = any>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
}

// ─── Typed API helpers ───

export interface User { id: string; email: string; name: string; role: string }
export interface AuthResponse { token: string; user: User }

export const authApi = {
  register: (email: string, name: string, password: string) =>
    api.post<AuthResponse>('/api/auth/register', { email, name, password }),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),
  me: () => api.get<{ user: User }>('/api/auth/me'),
}
