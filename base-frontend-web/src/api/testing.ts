/**
 * Dữ liệu và `fetch` giả cho test chế độ api (không dùng ở runtime).
 * Đặt trong `src/api/` vì mock data của UI chỉ nằm ở `src/mocks/`; đây là phản hồi HTTP giả theo contracts.
 */
import type { Me, RoomDetail, RoomSummary } from '@customaov/contracts'
import { vi } from 'vitest'

export const TEST_ME: Me = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'suthy',
  displayName: 'Su Thy',
  avatarUrl: null,
  level: 30,
  crowned: true,
  uid: '123456',
}

export const testRoomSummary = (code: string, overrides: Partial<RoomSummary> = {}): RoomSummary => ({
  code,
  title: `Phòng ${code}`,
  highlight: null,
  thumbnail: '/thumb.jpg',
  host: { id: '00000000-0000-4000-8000-000000000002', username: 'host_a', displayName: 'Host A', avatarUrl: null, level: 10, crowned: false },
  mode: 'normal',
  modeLabel: '5v5 · Custom',
  visibility: 'public',
  playerCount: 3,
  capacity: 10,
  status: 'waiting',
  isMember: false,
  ...overrides,
})

export const testRoomDetail = (code: string, overrides: Partial<RoomDetail> = {}): RoomDetail => ({
  ...testRoomSummary(code),
  config: { format: '5v5', pickMode: 'draft', series: 'BO1', tools: ['balance'], notes: '' },
  teams: { blue: [], red: [] },
  spectators: [],
  myRole: 'player',
  lastSplit: null,
  result: null,
  ...overrides,
})

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export const errorResponse = (status: number, code: string, message: string, details?: unknown) =>
  jsonResponse({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status)

export interface FetchCall {
  method: string
  url: URL
  body: unknown
}

/**
 * Thay `fetch` bằng bộ định tuyến: `route(call)` trả `Response` (hoặc `undefined` → 404).
 * `/api/auth/me` mặc định trả `TEST_ME`. Gắn sẵn cookie `csrf` để request ghi không phải gọi `/api/auth/csrf`.
 */
export function mockFetch(route: (call: FetchCall) => Response | undefined) {
  document.cookie = 'csrf=test-token; Path=/'
  const calls: FetchCall[] = []
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const call: FetchCall = {
      method: (init?.method ?? 'GET').toUpperCase(),
      url,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    const response = route(call)
    if (response) return response
    if (url.pathname === '/api/auth/me') return jsonResponse({ user: TEST_ME, csrfToken: 'test-token' })
    return errorResponse(404, 'NOT_FOUND', 'Không có')
  })
  return { calls, spy }
}
