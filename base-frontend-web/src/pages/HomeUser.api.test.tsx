import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TournamentSummary } from '@customaov/contracts'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { clearDataCache } from '../api'
import { errorResponse, jsonResponse, mockFetch, testRoomDetail, testRoomSummary, type FetchCall } from '../api/testing'
import { AppProviders } from '../context/AppContext'
import HomeUser from './HomeUser'

// Chế độ api: mọi dữ liệu đi qua `fetch` (đã giả lập bằng `mockFetch`)
vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))

const OPEN = testRoomSummary('AOV-2001', { title: 'Kèo tối nay' })
const LIVE = testRoomSummary('AOV-2002', { title: 'Đang đánh', status: 'live', mode: 'tournament', modeLabel: '5v5 · Căng' })
const MINE = testRoomSummary('AOV-1024', { title: 'Phòng của tôi', isMember: true })

const OPEN_TOURNAMENT: TournamentSummary = {
  slug: 'ngu-kiet-cup-mua-2',
  name: 'Ngũ Kiệt Cup – Mùa 2',
  titleIcon: 'trophy',
  cover: '/tour-1.jpg',
  status: 'open',
  format: '5v5 · BO3',
  organizer: 'CustomAOV',
  description: 'Giải cộng đồng cuối tuần',
  teamCount: 16,
  registeredTeams: 9,
  registrationDeadline: '2026-11-20T16:59:00.000Z',
  dateStart: '2026-11-22T12:00:00.000Z',
  dateEnd: '2026-11-27T15:00:00.000Z',
  createdAt: '2026-11-10T10:00:00.000Z',
  timeLabel: '22/11 – 27/11',
  dateRange: '22/11 – 27/11',
}

function RoomProbe() {
  const { pathname } = useLocation()
  return <p>room:{pathname}</p>
}

function TournamentProbe() {
  const { pathname } = useLocation()
  return <p>tournament:{pathname}</p>
}

function renderDashboard() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<HomeUser />} />
          <Route path="/rooms/:roomId" element={<RoomProbe />} />
          <Route path="/tournaments/:slug" element={<TournamentProbe />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

const page = (items: unknown[], total = items.length, pageNo = 1) => jsonResponse({ items, total, page: pageNo, pageSize: 10 })

/** Router mặc định: danh sách phòng, "phòng của bạn", giải, hoạt động */
function baseRoute(call: FetchCall): Response | undefined {
  const { pathname, searchParams } = call.url
  if (pathname === '/api/rooms' && call.method === 'GET') {
    if (searchParams.get('mine') === '1') return page([MINE])
    return page([MINE, OPEN, LIVE], 12, Number(searchParams.get('page') ?? 1))
  }
  if (pathname === '/api/tournaments') return jsonResponse({ items: [], total: 0, page: 1, pageSize: 50 })
  if (pathname === '/api/activities') return jsonResponse({ items: [], total: 0, page: 1, pageSize: 50 })
  return undefined
}

/** Các lần gọi danh sách phòng của bảng (không tính `mine=1`) */
const listCalls = (calls: FetchCall[]) =>
  calls.filter((c) => c.url.pathname === '/api/rooms' && c.method === 'GET' && !c.url.searchParams.has('mine'))

const roomsTable = () => screen.getByRole('table', { name: 'Danh sách phòng custom đang hoạt động' })

beforeEach(() => clearDataCache())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Dashboard #rooms – chế độ api', () => {
  it('lấy trang 1 qua GET /api/rooms và đánh dấu phòng của bạn theo isMember', async () => {
    const { calls } = mockFetch(baseRoute)
    renderDashboard()

    await within(await screen.findByRole('table', { name: 'Danh sách phòng custom đang hoạt động' })).findByText('Kèo tối nay')
    const first = listCalls(calls)[0]
    expect(first.url.searchParams.get('page')).toBe('1')
    expect(first.url.searchParams.get('pageSize')).toBe('10')
    expect(first.url.searchParams.has('mode')).toBe(false)
    expect(within(roomsTable()).getAllByText('Phòng của bạn')).toHaveLength(1)
    // "Phòng bạn đang tham gia" dùng mine=1
    expect(calls.some((c) => c.url.searchParams.get('mine') === '1')).toBe(true)
    expect(screen.getByText('12', { selector: 'span.tabular' })).toBeTruthy()
  })

  it('lọc chế độ, tìm kiếm và phân trang đều gửi lên server', async () => {
    const user = userEvent.setup()
    const { calls } = mockFetch(baseRoute)
    renderDashboard()
    await within(await screen.findByRole('table')).findByText('Kèo tối nay')

    await user.click(screen.getByRole('button', { name: 'Tryhard' }))
    await waitFor(() => expect(listCalls(calls).at(-1)?.url.searchParams.get('mode')).toBe('normal'))

    await user.type(screen.getByRole('searchbox'), 'kèo')
    await waitFor(() => expect(listCalls(calls).at(-1)?.url.searchParams.get('q')).toBe('kèo'))
    expect(listCalls(calls).at(-1)?.url.searchParams.get('mode')).toBe('normal')
    // debounce: không gửi từng ký tự
    expect(listCalls(calls).filter((c) => c.url.searchParams.has('q'))).toHaveLength(1)

    const pager = await screen.findByRole('navigation', { name: 'Phân trang danh sách phòng' })
    await user.click(within(pager).getByRole('button', { name: 'Trang 2' }))
    await waitFor(() => expect(listCalls(calls).at(-1)?.url.searchParams.get('page')).toBe('2'))

    // đổi bộ lọc → về trang 1
    await user.click(screen.getByRole('button', { name: 'Tất cả' }))
    await waitFor(() => {
      const last = listCalls(calls).at(-1)!
      expect(last.url.searchParams.has('mode')).toBe(false)
      expect(last.url.searchParams.get('page')).toBe('1')
    })
  })

  it('"Vào phòng" gọi POST /join rồi điều hướng tới /rooms/<code>', async () => {
    const user = userEvent.setup()
    const { calls } = mockFetch((call) => {
      if (call.url.pathname === '/api/rooms/AOV-2001/join') return jsonResponse(testRoomDetail('AOV-2001'))
      return baseRoute(call)
    })
    renderDashboard()
    const table = await screen.findByRole('table')
    await user.click(await within(table).findByRole('button', { name: 'Vào phòng Kèo tối nay' }))

    expect(await screen.findByText('room:/rooms/AOV-2001')).toBeTruthy()
    const join = calls.find((c) => c.url.pathname === '/api/rooms/AOV-2001/join')
    expect(join?.method).toBe('POST')
    expect(join?.body).toEqual({ as: 'player' })
  })

  it('lỗi 409 (đang ở phòng khác) hiện toast có mã phòng hiện tại, không điều hướng', async () => {
    const user = userEvent.setup()
    mockFetch((call) => {
      if (call.url.pathname === '/api/rooms/AOV-2001/join')
        return errorResponse(409, 'CONFLICT', 'Bạn đang là người chơi ở phòng khác (AOV-1024)')
      return baseRoute(call)
    })
    renderDashboard()
    const table = await screen.findByRole('table')
    await user.click(await within(table).findByRole('button', { name: 'Vào phòng Kèo tối nay' }))

    const toast = await screen.findByText('Không vào được phòng #AOV-2001')
    expect(toast).toBeTruthy()
    expect(screen.getByText('Bạn đang là người chơi ở phòng khác (AOV-1024)')).toBeTruthy()
    expect(screen.queryByText(/^room:/)).toBeNull()
    // nút mở lại sau khi lỗi
    expect(within(table).getByRole('button', { name: 'Vào phòng Kèo tối nay' }).hasAttribute('disabled')).toBe(false)
  })

  it('"Theo dõi" và phòng mình đã là thành viên điều hướng thẳng, không gọi /join', async () => {
    const user = userEvent.setup()
    const { calls } = mockFetch(baseRoute)
    renderDashboard()
    const table = await screen.findByRole('table')
    await user.click(await within(table).findByRole('button', { name: 'Theo dõi phòng Đang đánh' }))
    expect(await screen.findByText('room:/rooms/AOV-2002')).toBeTruthy()
    expect(calls.some((c) => c.url.pathname.endsWith('/join'))).toBe(false)
  })

  it('lỗi tải danh sách hiện ListStatus có nút "Thử lại"', async () => {
    const user = userEvent.setup()
    let fail = true
    mockFetch((call) => {
      if (call.url.pathname === '/api/rooms' && !call.url.searchParams.has('mine') && fail)
        return errorResponse(500, 'INTERNAL', 'Lỗi máy chủ')
      return baseRoute(call)
    })
    renderDashboard()
    await screen.findByText('Phòng custom đang hoạt động')
    const card = document.getElementById('rooms')!
    const retry = await within(card).findByRole('button', { name: /Thử lại/ })
    fail = false
    await user.click(retry)
    await within(await screen.findByRole('table')).findByText('Kèo tối nay')
  })
})

describe('Dashboard promo, phòng của bạn & cô lập lỗi – chế độ api', () => {
  it('hiện promo giải open gần hạn nhất với tiến độ đăng ký và nút Đăng ký ngay', async () => {
    const user = userEvent.setup()
    const { calls } = mockFetch((call) => {
      if (call.url.pathname === '/api/tournaments') return jsonResponse({ items: [OPEN_TOURNAMENT], total: 1, page: 1, pageSize: 1 })
      return baseRoute(call)
    })
    renderDashboard()

    await screen.findByText('Ngũ Kiệt Cup')
    const tourCall = calls.find((c) => c.url.pathname === '/api/tournaments')
    expect(tourCall?.url.searchParams.get('status')).toBe('open')
    expect(tourCall?.url.searchParams.get('sort')).toBe('deadline')
    expect(tourCall?.url.searchParams.get('pageSize')).toBe('1')

    const progress = screen.getByRole('progressbar', { name: 'Tiến độ đăng ký' })
    expect(progress.getAttribute('aria-valuenow')).toBe('9')
    expect(progress.getAttribute('aria-valuemax')).toBe('16')
    expect(screen.getByText('9/16')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Đăng ký ngay' }))
    expect(await screen.findByText('tournament:/tournaments/ngu-kiet-cup-mua-2')).toBeTruthy()
  })

  it('ẩn khối promo khi không có giải open nào', async () => {
    mockFetch(baseRoute)
    renderDashboard()

    await within(await screen.findByRole('table', { name: 'Danh sách phòng custom đang hoạt động' })).findByText('Kèo tối nay')
    await waitFor(() => {
      expect(screen.queryByText('Giải đấu cộng đồng nổi bật')).toBeNull()
    })
    expect(screen.queryByRole('button', { name: 'Đăng ký ngay' })).toBeNull()
  })

  it('"Phòng bạn đang tham gia" gọi GET /api/rooms?mine=1 và hiện danh sách hoặc empty state', async () => {
    const { calls } = mockFetch(baseRoute)
    renderDashboard()

    const aside = screen.getByRole('complementary', { name: 'Thông tin của bạn' })
    await within(aside).findByText('Phòng của tôi')
    expect(calls.some((c) => c.url.pathname === '/api/rooms' && c.url.searchParams.get('mine') === '1')).toBe(true)
    const joinLink = within(aside).getByRole('link', { name: 'Vào phòng' })
    expect(joinLink.getAttribute('href')).toBe('/rooms/AOV-1024')

    cleanup()
    clearDataCache()
    mockFetch((call) => {
      if (call.url.pathname === '/api/rooms' && call.url.searchParams.get('mine') === '1') return page([])
      return baseRoute(call)
    })
    renderDashboard()
    const emptyAside = screen.getByRole('complementary', { name: 'Thông tin của bạn' })
    await within(emptyAside).findByText('Bạn chưa ở trong phòng nào.')
    expect(within(emptyAside).getByRole('link', { name: 'Tạo phòng' }).getAttribute('href')).toBe('/rooms/new')
  })

  it('lỗi một khối (promo hoặc phòng của bạn) chỉ hiện ListStatus ở khối đó, các khối khác vẫn chạy', async () => {
    const user = userEvent.setup()
    let failPromo = true
    mockFetch((call) => {
      if (call.url.pathname === '/api/tournaments') {
        return failPromo
          ? errorResponse(500, 'INTERNAL', 'Lỗi giải đấu')
          : jsonResponse({ items: [OPEN_TOURNAMENT], total: 1, page: 1, pageSize: 1 })
      }
      if (call.url.pathname === '/api/rooms' && call.url.searchParams.get('mine') === '1') {
        return errorResponse(500, 'INTERNAL', 'Lỗi phòng của bạn')
      }
      return baseRoute(call)
    })
    renderDashboard()

    // Bảng #rooms vẫn tải bình thường
    await within(await screen.findByRole('table', { name: 'Danh sách phòng custom đang hoạt động' })).findByText('Kèo tối nay')

    const aside = screen.getByRole('complementary', { name: 'Thông tin của bạn' })
    await within(aside).findByText('Không tải được phòng của bạn')
    await within(aside).findByText('Không tải được giải đấu nổi bật')

    failPromo = false
    const retryButtons = within(aside).getAllByRole('button', { name: /Thử lại/ })
    await user.click(retryButtons[1])
    await within(aside).findByText('Ngũ Kiệt Cup')
  })
})
