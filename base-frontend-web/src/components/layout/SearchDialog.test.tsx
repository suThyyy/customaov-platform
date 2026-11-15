import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { SearchResponse } from '@customaov/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDataCache, SEARCH_DEBOUNCE_MS } from '../../api'
import { SearchDialog } from './SearchDialog'

// Kiểm thử chế độ api (VITE_DATA_SOURCE=api); fetch được giả lập.
vi.mock('../../api/source', () => ({ DATA_SOURCE: 'api' }))

const user = (n: number, username: string, displayName: string) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  username,
  displayName,
  avatarUrl: null,
  level: 3,
  crowned: false,
})

const RESULT: SearchResponse = {
  rooms: [
    {
      code: 'AOV-1025',
      title: 'Giao lưu cộng đồng #07',
      highlight: null,
      thumbnail: '/mock-assets/room-2.jpg',
      host: user(1, 'hieukm', 'HieuKM'),
      mode: 'friendly',
      modeLabel: 'BO1 · Vui',
      visibility: 'public',
      playerCount: 6,
      capacity: 10,
      status: 'waiting',
      isMember: false,
    },
  ],
  tournaments: [
    {
      slug: 'giai-giao-luu',
      name: 'Giải Giao Lưu Mùa Đông',
      titleIcon: 'trophy',
      cover: '/mock-assets/tour-1.jpg',
      status: 'open',
      format: '5v5 – BO3',
      organizer: 'BTC',
      description: '',
      teamCount: 8,
      registeredTeams: 2,
      registrationDeadline: '2026-11-20T16:59:00.000Z',
      drawDate: '2026-11-21T03:00:00.000Z',
      dateStart: '2026-11-22T03:00:00.000Z',
      dateEnd: '2026-11-27T03:00:00.000Z',
      createdAt: '2026-11-01T03:00:00.000Z',
      timeLabel: 'Hạn đăng ký: 20/11, 23:59',
      dateRange: '22/11 – 27/11',
    },
  ],
  users: [user(2, 'giaolinh', 'Giao Linh')],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** fetch giả: trả RESULT; nếu request bị huỷ thì reject AbortError như trình duyệt. */
function mockFetch(respond: (url: string) => Response | Promise<Response> = () => json(RESULT)) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const signal = init?.signal
    return new Promise<Response>((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      Promise.resolve(respond(String(input))).then(resolve, reject)
    })
  })
}

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="location">{pathname}</div>
}

const onClose = vi.fn()

function renderDialog() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SearchDialog open onClose={onClose} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const input = () => screen.getByRole('combobox', { name: /Tìm phòng, người chơi, giải đấu/ })
const type = (value: string) => fireEvent.change(input(), { target: { value } })
/** Chạy hết debounce rồi đợi promise fetch/parse xong */
async function settle(ms = SEARCH_DEBOUNCE_MS) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
  for (let i = 0; i < 5; i++) await act(async () => {})
}
const searchUrls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.map(([url]) => decodeURIComponent(String(url).replace(/\+/g, ' ')))

beforeEach(() => {
  vi.useFakeTimers()
  clearDataCache()
  onClose.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SearchDialog (chế độ api)', () => {
  it('dưới 2 ký tự: không gọi API, hiện gợi ý nhập thêm', async () => {
    const fetchMock = mockFetch()
    renderDialog()
    type('g')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Nhập ít nhất 2 ký tự/)).toBeTruthy()
  })

  it('debounce 250ms: gõ liên tục chỉ gửi 1 request với từ khoá cuối', async () => {
    const fetchMock = mockFetch()
    renderDialog()
    type('gi')
    await act(async () => vi.advanceTimersByTime(100))
    type('gia')
    await act(async () => vi.advanceTimersByTime(100))
    type('giao')
    await act(async () => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1))
    expect(fetchMock).not.toHaveBeenCalled()
    // Trong lúc chờ debounce: hiện trạng thái đang tải
    expect(screen.getByRole('status').textContent).toContain('Đang tải kết quả tìm kiếm')

    await settle(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(searchUrls(fetchMock)).toEqual(['/api/search?q=giao'])
  })

  it('huỷ request cũ bằng AbortController khi từ khoá đổi', async () => {
    const pending: Array<(r: Response) => void> = []
    const fetchMock = mockFetch(() => new Promise<Response>((resolve) => pending.push(resolve)))
    renderDialog()

    type('giao')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal
    expect(firstSignal?.aborted).toBe(false)

    type('giao luu')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(firstSignal?.aborted).toBe(true)
    expect(fetchMock.mock.calls[1]?.[1]?.signal?.aborted).toBe(false)
    expect(searchUrls(fetchMock)[1]).toBe('/api/search?q=giao luu')

    // Request mới trả về → hiện kết quả, request cũ không ghi đè
    await act(async () => pending[1]?.(json(RESULT)))
    for (let i = 0; i < 5; i++) await act(async () => {})
    expect(screen.getByRole('option', { name: /Giao lưu cộng đồng #07/ })).toBeTruthy()
  })

  it('hiển thị kết quả theo nhóm Phòng / Giải đấu / Người chơi', async () => {
    mockFetch()
    renderDialog()
    type('giao')
    await settle()

    const listbox = screen.getByRole('listbox', { name: 'Kết quả tìm kiếm' })
    const rooms = within(listbox).getByRole('group', { name: /Phòng/ })
    const tours = within(listbox).getByRole('group', { name: /Giải đấu/ })
    const people = within(listbox).getByRole('group', { name: /Người chơi/ })
    expect(within(rooms).getByRole('option').textContent).toContain('Giao lưu cộng đồng #07')
    expect(within(rooms).getByRole('option').textContent).toContain('#AOV-1025')
    expect(within(tours).getByRole('option').textContent).toContain('Giải Giao Lưu Mùa Đông')
    expect(within(people).getByRole('option').textContent).toContain('Giao Linh')
    expect(input().getAttribute('aria-expanded')).toBe('true')
  })

  it('↑/↓ đổi kết quả đang chọn, Enter điều hướng và đóng hộp', async () => {
    mockFetch()
    renderDialog()
    type('giao')
    await settle()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
    expect(input().getAttribute('aria-activedescendant')).toBe(options[0]?.id)

    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1]?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'ArrowDown' }) // vòng về đầu
    expect(screen.getAllByRole('option')[0]?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input(), { key: 'ArrowUp' }) // vòng về cuối
    expect(input().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[2]?.id)
    fireEvent.keyDown(input(), { key: 'ArrowUp' })

    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByTestId('location').textContent).toBe('/tournaments/giai-giao-luu')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('không có kết quả → trạng thái trống', async () => {
    mockFetch(() => json({ rooms: [], tournaments: [], users: [] }))
    renderDialog()
    type('zzzz')
    await settle()
    expect(screen.getByText('Không tìm thấy kết quả cho "zzzz".')).toBeTruthy()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('lỗi API → trạng thái lỗi, "Thử lại" gọi lại', async () => {
    const fetchMock = mockFetch(() =>
      json({ error: { code: 'RATE_LIMITED', message: 'Bạn tìm kiếm quá nhanh' } }, 429),
    )
    renderDialog()
    type('giao')
    await settle()
    expect(screen.getByRole('alert').textContent).toContain('Không tải được kết quả tìm kiếm')

    fetchMock.mockImplementation(() => Promise.resolve(json(RESULT)))
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await settle(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })
})
