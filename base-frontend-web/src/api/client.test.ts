import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CsrfResponseSchema } from '@customaov/contracts'
import { ApiError, apiRequest, resetClientForTests } from './client'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('api client', () => {
  beforeEach(() => {
    document.cookie = 'csrf=; Max-Age=0; Path=/'
    resetClientForTests()
    vi.restoreAllMocks()
  })

  it('lấy CSRF khi thiếu cookie và gắn header cho request ghi', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ csrfToken: 'fresh-token' }))
      .mockResolvedValueOnce(json({ csrfToken: 'ok' }))

    await apiRequest('/api/example', CsrfResponseSchema, { method: 'POST', body: { value: 1 } })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/csrf', expect.objectContaining({ credentials: 'include' }))
    const second = fetchMock.mock.calls[1]
    expect(second?.[0]).toBe('/api/example')
    expect((second?.[1]?.headers as Headers).get('x-csrf-token')).toBe('fresh-token')
    expect(second?.[1]?.credentials).toBe('include')
  })

  it('chuyển error body thành ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: { code: 'NOT_FOUND', message: 'Không thấy' } }, 404))

    await expect(apiRequest('/api/missing', CsrfResponseSchema)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NOT_FOUND',
      status: 404,
      message: 'Không thấy',
    })
  })

  it('giữ details của lỗi 400 và tách lỗi theo trường', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ error: { code: 'VALIDATION', message: 'Dữ liệu không hợp lệ', details: [{ path: 'title', message: 'Bắt buộc' }] } }, 400),
    )

    const error = await apiRequest('/api/rooms', CsrfResponseSchema).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors()).toEqual({ title: 'Bắt buộc' })
  })
})
