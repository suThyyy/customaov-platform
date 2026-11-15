import { CSRF_COOKIE, CSRF_HEADER, CsrfResponseSchema, ErrorBodySchema, type ErrorCode } from '@customaov/contracts'

export interface ResponseSchema<T> {
  parse(value: unknown): T
}

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly retryAfter?: number
  /** `error.details` của server (400 VALIDATION: `[{path, message}]`) */
  readonly details?: unknown

  constructor(message: string, code: ErrorCode, status: number, retryAfter?: number, details?: unknown) {
    super(message)
    this.details = details
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }

  /** Lỗi theo từng trường (`details` dạng `[{path, message}]`), khoá là `path` (vd. `title`, `config.format`) */
  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {}
    if (!Array.isArray(this.details)) return result
    for (const item of this.details) {
      if (item && typeof item === 'object' && typeof item.path === 'string' && typeof item.message === 'string')
        result[item.path] ??= item.message
    }
    return result
  }
}

let csrfRequest: Promise<string> | undefined

const cookieValue = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined
  const prefix = `${encodeURIComponent(name)}=`
  const entry = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined
}

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

async function csrfToken(signal?: AbortSignal): Promise<string> {
  const existing = cookieValue(CSRF_COOKIE)
  if (existing) return existing
  csrfRequest ??= fetch('/api/auth/csrf', { credentials: 'include', signal })
    .then(async (response) => {
      const body = await parseBody(response)
      if (!response.ok) throwApiError(response.status, body)
      return cookieValue(CSRF_COOKIE) ?? CsrfResponseSchema.parse(body).csrfToken
    })
    .finally(() => {
      csrfRequest = undefined
    })
  return csrfRequest
}

function throwApiError(status: number, body: unknown, retryAfter?: number): never {
  const parsed = ErrorBodySchema.safeParse(body)
  if (parsed.success) throw new ApiError(parsed.data.error.message, parsed.data.error.code, status, retryAfter, parsed.data.error.details)
  throw new ApiError(`Yêu cầu thất bại (${status})`, 'INTERNAL', status, retryAfter)
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function apiRequest<T>(
  path: string,
  schema: ResponseSchema<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (method !== 'GET' && method !== 'HEAD') headers.set(CSRF_HEADER, await csrfToken(options.signal ?? undefined))
  if (options.body !== undefined) headers.set('content-type', 'application/json')
  const response = await fetch(path, {
    ...options,
    method,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const body = await parseBody(response)
  const retryHeader = response.headers.get('retry-after')
  const retrySeconds = retryHeader ? Number.parseInt(retryHeader, 10) : NaN
  const retryAfter = Number.isFinite(retrySeconds) && retrySeconds > 0 ? retrySeconds : undefined
  if (!response.ok) throwApiError(response.status, body, retryAfter)
  return schema.parse(body)
}

export const resetClientForTests = (): void => {
  csrfRequest = undefined
}
