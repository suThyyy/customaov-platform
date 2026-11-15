import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ChatMessage, RoomDetail as ApiRoomDetail, RoomMember, UserSummary } from '@customaov/contracts'
import { AppProviders } from '../context/AppContext'
import { FakeWebSocket } from '../test/fakeWebSocket'
import RoomDetail from './RoomDetail'

vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))

/* ---------------- Dữ liệu mẫu theo contracts ---------------- */

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const LANES = ['TOP', 'JG', 'MID', 'AD', 'SP'] as const
const NAMES = ['suthy', 'minz', 'vanhh', 'hieukm', 'kaka', 'lamz', 'tunn', 'baoo', 'khoa', 'duyy']
const userOf = (i: number, username = NAMES[i]): UserSummary => ({
  id: uid(i + 1),
  username,
  displayName: username[0].toUpperCase() + username.slice(1),
  avatarUrl: null,
  level: 10,
  crowned: false,
})
const USERS = NAMES.map((_, i) => userOf(i))
const GUEST = userOf(50, 'khach')
const member = (user: UserSummary, i: number): RoomMember => ({ user, lane: LANES[i % 5], ready: false, captain: i === 0, tier: null })

function roomDetail(overrides: Partial<ApiRoomDetail> = {}): ApiRoomDetail & { restricted: false } {
  return {
    code: 'AOV-1024',
    title: 'Phòng thử API',
    highlight: null,
    thumbnail: 'room-1.jpg',
    host: USERS[0],
    mode: 'normal',
    modeLabel: '5v5 · Custom',
    visibility: 'public',
    playerCount: 10,
    capacity: 10,
    status: 'waiting',
    isMember: true,
    config: { format: '5v5', pickMode: 'draft', series: 'BO1', tools: [], notes: '' },
    teams: { blue: USERS.slice(0, 5).map(member), red: USERS.slice(5).map((u, i) => member(u, i)) },
    spectators: [],
    myRole: 'host',
    lastSplit: null,
    result: null,
    ...overrides,
    restricted: false,
  }
}

const message = (n: number, text: string, author: UserSummary | null = USERS[1]): ChatMessage => ({
  id: uid(900 + n),
  author,
  text,
  system: author === null,
  at: `2026-11-15T10:${String(n).padStart(2, '0')}:00.000Z`,
})

/* ---------------- fetch giả theo URL ---------------- */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const apiError = (status: number, code: string, msg: string) => json({ error: { code, message: msg } }, status)

type Handler = (body: unknown, url: URL) => Response | Promise<Response>
let routes: Record<string, Handler>
let calls: Array<{ key: string; url: URL; body: unknown }>

function serve(me: UserSummary, room: unknown, messages: ChatMessage[] = []) {
  routes = {
    'GET /api/auth/me': () => json({ user: { ...me, uid: '123456' }, csrfToken: 'test-token' }),
    'GET /api/rooms/AOV-1024': () => json(room),
    'GET /api/rooms/AOV-1024/messages': () => json(messages),
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  document.cookie = 'csrf=test-token; path=/'
  calls = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url.pathname}`
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ key, url, body })
    const handler = routes[key]
    if (!handler) return apiError(404, 'NOT_FOUND', `Không có route giả cho ${key}`)
    return handler(body, url)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.cookie = 'csrf=; Max-Age=0; path=/'
})

function renderRoom(path = '/rooms/AOV-1024') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/rooms/:roomId" element={<RoomDetail />} />
          <Route path="/dashboard" element={<p>dashboard-page</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

const callsTo = (key: string) => calls.filter((c) => c.key === key)
const teamNames = (label: string) => {
  const panel = screen.getByRole('region', { name: label })
  return USERS.map((u) => u.displayName).filter((name) => within(panel).queryByText(name) !== null)
}
const openSocket = () => act(() => FakeWebSocket.last().open())

/* ---------------- Test ---------------- */

describe('RoomDetail – chế độ api', () => {
  it('tải phòng bằng GET /api/rooms/:code?key= và subscribe kênh realtime kèm key', async () => {
    serve(USERS[0], roomDetail(), [message(1, 'Chào cả phòng')])
    renderRoom('/rooms/AOV-1024?key=moi-ban')

    expect(await screen.findByRole('heading', { level: 1, name: /Phòng thử API/ })).toBeTruthy()
    expect(callsTo('GET /api/rooms/AOV-1024')[0].url.search).toBe('?key=moi-ban')
    expect(screen.getByText('Bạn là chủ phòng')).toBeTruthy()
    expect(teamNames('Team Xanh')).toEqual(['Suthy', 'Minz', 'Vanhh', 'Hieukm', 'Kaka'])
    expect(teamNames('Team Đỏ')).toEqual(['Lamz', 'Tunn', 'Baoo', 'Khoa', 'Duyy'])
    const log = await screen.findByRole('log', { name: 'Tin nhắn trong phòng' })
    expect(within(log).getByText('Chào cả phòng')).toBeTruthy()

    openSocket()
    expect(FakeWebSocket.last().sent).toEqual([{ type: 'subscribe', room: 'AOV-1024', key: 'moi-ban' }])
  })

  it('phòng restricted: chỉ thông tin cơ bản + "Vào phòng"; lỗi 403 hiện toast thông báo của server', async () => {
    const full = roomDetail({ visibility: 'private', playerCount: 6, isMember: false })
    // RoomSummary & {restricted: true}: không có teams/spectators/config/lastSplit/result (API.md 9.1)
    const summary = Object.fromEntries(
      Object.entries(full).filter(([key]) => !['teams', 'config', 'spectators', 'myRole', 'lastSplit', 'result'].includes(key)),
    )
    serve(GUEST, { ...summary, restricted: true })
    routes['POST /api/rooms/AOV-1024/join'] = () => apiError(403, 'FORBIDDEN', 'Phòng riêng tư cần mã mời hợp lệ')
    const user = userEvent.setup()
    renderRoom()

    expect(await screen.findByText('Phòng riêng tư')).toBeTruthy()
    expect(screen.getByText('6/10')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Team Xanh' })).toBeNull()
    expect(screen.queryByText('Chat phòng')).toBeNull()
    expect(callsTo('GET /api/rooms/AOV-1024/messages')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Vào phòng' }))
    expect(callsTo('POST /api/rooms/AOV-1024/join')[0].body).toEqual({ as: 'player' })
    expect(await screen.findByText('Không thể vào phòng')).toBeTruthy()
    expect(screen.getByText('Phòng riêng tư cần mã mời hợp lệ')).toBeTruthy()
  })

  it('chủ phòng bấm "Chia lại" → POST /split {mode:"random"} và hiển thị đội server trả về', async () => {
    serve(USERS[0], roomDetail())
    const swapped = roomDetail({
      teams: {
        blue: [USERS[0], USERS[5], USERS[2], USERS[3], USERS[4]].map(member),
        red: [USERS[1], USERS[6], USERS[7], USERS[8], USERS[9]].map(member),
      },
      lastSplit: { mode: 'random', balanceLevel: null, warning: false, at: '2026-11-15T10:00:00.000Z' },
    })
    routes['POST /api/rooms/AOV-1024/split'] = () => json(swapped)
    const user = userEvent.setup()
    renderRoom()

    await user.click(await screen.findByRole('button', { name: 'Chia lại' }))

    expect(callsTo('POST /api/rooms/AOV-1024/split').map((c) => c.body)).toEqual([{ mode: 'random' }])
    expect(await screen.findByText('Đã chia đội')).toBeTruthy()
    expect(screen.getByText('Ngẫu nhiên · 5 vs 5')).toBeTruthy()
    expect(teamNames('Team Xanh')).toContain('Lamz')
    expect(teamNames('Team Đỏ')).toContain('Minz')
  })

  it('lỗi 409 khi chia đội cân bằng → toast thông báo của server, giữ đội cũ', async () => {
    serve(USERS[0], roomDetail())
    routes['POST /api/rooms/AOV-1024/split'] = () => apiError(409, 'CONFLICT', 'Cần đúng 10 người chơi để chia đội')
    const user = userEvent.setup()
    renderRoom()

    await user.click(await screen.findByRole('button', { name: /Chia đội cân bằng/ }))

    expect(callsTo('POST /api/rooms/AOV-1024/split')[0].body).toEqual({ mode: 'tier' })
    expect(await screen.findByText('Không thể chia đội')).toBeTruthy()
    expect(screen.getByText('Cần đúng 10 người chơi để chia đội')).toBeTruthy()
    expect(teamNames('Team Xanh')).toContain('Minz')
  })

  it('chủ phòng đổi đội qua menu → POST /move với userId (uuid) của người chơi', async () => {
    const blue = USERS.slice(0, 5).map(member)
    const red = USERS.slice(5, 9).map(member)
    serve(USERS[0], roomDetail({ playerCount: 9, teams: { blue, red } }))
    routes['POST /api/rooms/AOV-1024/move'] = () =>
      json(roomDetail({ playerCount: 9, teams: { blue: blue.filter((m) => m.user.username !== 'minz'), red: [...red, blue[1]] } }))
    const user = userEvent.setup()
    renderRoom()

    await user.click(await screen.findByRole('button', { name: 'Tuỳ chọn cho Minz' }))
    await user.click(screen.getByRole('menuitem', { name: /Chuyển sang Team Đỏ/ }))

    expect(callsTo('POST /api/rooms/AOV-1024/move')[0].body).toEqual({ userId: USERS[1].id, to: 'red' })
    expect(await screen.findByText('Đã chuyển Minz sang Team Đỏ')).toBeTruthy()
    expect(teamNames('Team Đỏ')).toContain('Minz')
  })

  it('khán giả: không thấy ô gửi chat, không có "Chia lại"/menu đổi đội, vẫn đọc được chat', async () => {
    serve(GUEST, roomDetail({ myRole: 'spectator', spectators: [GUEST] }), [message(1, 'Random cho vui đi')])
    renderRoom()

    expect(await screen.findByText('Bạn là khán giả')).toBeTruthy()
    const log = await screen.findByRole('log', { name: 'Tin nhắn trong phòng' })
    expect(within(log).getByText('Random cho vui đi')).toBeTruthy()
    expect(screen.queryByLabelText('Nhập tin nhắn')).toBeNull()
    expect(screen.getByText('Khán giả chỉ xem chat. Vào đội để gửi tin nhắn.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Chia lại' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Tuỳ chọn cho/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Xuất kết quả chia đội' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Rời phòng' })).toBeTruthy()
  })

  it('nhận room.updated qua WS → re-render với dữ liệu mới', async () => {
    serve(USERS[0], roomDetail())
    renderRoom()
    await screen.findByRole('region', { name: 'Team Xanh' })
    openSocket()

    act(() =>
      FakeWebSocket.last().emit({
        type: 'room.updated',
        room: roomDetail({
          title: 'Phòng đã đổi tên',
          playerCount: 9,
          teams: { blue: USERS.slice(0, 5).map(member), red: USERS.slice(5, 9).map(member) },
        }),
      }),
    )

    expect(screen.getByRole('heading', { level: 1, name: /Phòng đã đổi tên/ })).toBeTruthy()
    expect(teamNames('Team Đỏ')).not.toContain('Duyy')
    expect(screen.getByText('9/10')).toBeTruthy()
  })

  it('gửi chat → POST /messages; tin WS cùng id không bị hiện trùng', async () => {
    serve(USERS[0], roomDetail(), [message(1, 'Chào cả phòng')])
    const sent = message(2, 'Vào trận thôi', USERS[0])
    routes['POST /api/rooms/AOV-1024/messages'] = () => json(sent, 201)
    const user = userEvent.setup()
    renderRoom()
    const log = await screen.findByRole('log', { name: 'Tin nhắn trong phòng' })
    openSocket()

    await user.type(screen.getByLabelText('Nhập tin nhắn'), 'Vào trận thôi{Enter}')
    expect(callsTo('POST /api/rooms/AOV-1024/messages')[0].body).toEqual({ text: 'Vào trận thôi' })
    await waitFor(() => expect(within(log).getByText('Vào trận thôi')).toBeTruthy())
    expect((screen.getByLabelText('Nhập tin nhắn') as HTMLInputElement).value).toBe('')

    act(() => FakeWebSocket.last().emit({ type: 'chat.message', room: 'AOV-1024', message: sent }))
    act(() => FakeWebSocket.last().emit({ type: 'chat.message', room: 'AOV-1024', message: message(3, 'Ok luôn') }))
    expect(within(log).getAllByText('Vào trận thôi')).toHaveLength(1)
    expect(within(log).getByText('Ok luôn')).toBeTruthy()
  })

  it('room.kicked → toast rồi điều hướng /dashboard', async () => {
    serve(USERS[3], roomDetail({ myRole: 'player' }))
    renderRoom()
    await screen.findByText('Bạn là người chơi')
    openSocket()

    act(() => FakeWebSocket.last().emit({ type: 'room.kicked', room: 'AOV-1024' }))

    expect(await screen.findByText('dashboard-page')).toBeTruthy()
    expect(screen.getByText('Bạn đã bị mời ra khỏi phòng')).toBeTruthy()
    expect(FakeWebSocket.instances.every((socket) => socket.closed)).toBe(true)
  })

  it('người chơi chọn lane và bấm sẵn sàng → PATCH /me', async () => {
    const me = USERS[3]
    const base = roomDetail({ myRole: 'player' })
    serve(me, base)
    routes['PATCH /api/rooms/AOV-1024/me'] = (body) => {
      const patch = body as { lane?: (typeof LANES)[number]; ready?: boolean }
      const update = (m: ReturnType<typeof member>) => (m.user.id === me.id ? { ...m, ...patch } : m)
      return json(roomDetail({ myRole: 'player', teams: { blue: base.teams.blue.map(update), red: base.teams.red } }))
    }
    const user = userEvent.setup()
    renderRoom()

    const lanes = await screen.findByRole('group', { name: 'Chọn lane' })
    await user.click(within(lanes).getByRole('button', { name: /^SP/ }))
    expect(callsTo('PATCH /api/rooms/AOV-1024/me')[0].body).toEqual({ lane: 'SP' })
    await waitFor(() => expect(within(lanes).getByRole('button', { name: /^SP/ }).getAttribute('aria-pressed')).toBe('true'))

    await user.click(screen.getByRole('button', { name: 'Sẵn sàng' }))
    expect(callsTo('PATCH /api/rooms/AOV-1024/me')[1].body).toEqual({ ready: true })
    expect(await screen.findByRole('button', { name: 'Huỷ sẵn sàng' })).toBeTruthy()
  })
})
