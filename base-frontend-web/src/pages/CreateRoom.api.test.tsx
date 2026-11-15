import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { clearDataCache } from '../api'
import { errorResponse, jsonResponse, mockFetch, testRoomDetail, type FetchCall } from '../api/testing'
import { AppProviders } from '../context/AppContext'
import CreateRoom from './CreateRoom'

vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))

function RoomProbe() {
  const { pathname } = useLocation()
  return <p>room:{pathname}</p>
}

function renderWizard() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/rooms/new']}>
        <Routes>
          <Route path="/rooms/new" element={<CreateRoom />} />
          <Route path="/rooms/:roomId" element={<RoomProbe />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

const next = () => screen.getByRole('button', { name: 'Tiếp tục' })
const stepTitle = () => screen.getByRole('heading', { level: 2 })

async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(next())
  await user.click(next())
  await user.click(next())
  expect(stepTitle().textContent).toBe('Xem lại')
}

const createCalls = (calls: FetchCall[]) => calls.filter((c) => c.url.pathname === '/api/rooms' && c.method === 'POST')

beforeEach(() => {
  clearDataCache()
  // jsdom không có scrollIntoView (wizard cuộn tiêu đề bước vào khung nhìn khi đổi bước)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('/rooms/new – chế độ api', () => {
  it('3v3 và 1v1 bị vô hiệu kèm nhãn "Sắp có"', async () => {
    const user = userEvent.setup()
    mockFetch(() => undefined)
    renderWizard()
    await user.click(next())
    expect(stepTitle().textContent).toBe('Cấu hình trận')

    const r5 = screen.getByRole('radio', { name: /5 vs 5/ })
    const r3 = screen.getByRole('radio', { name: /3 vs 3/ })
    const r1 = screen.getByRole('radio', { name: /1 vs 1/ })
    expect(r5.hasAttribute('disabled')).toBe(false)
    expect(r3.hasAttribute('disabled')).toBe(true)
    expect(r1.hasAttribute('disabled')).toBe(true)
    expect(screen.getAllByText('Sắp có')).toHaveLength(2)

    await user.click(screen.getByText('3 vs 3'))
    expect((r5 as HTMLInputElement).checked).toBe(true)
  })

  it('bước cuối gửi POST /api/rooms với cấu hình 4 bước rồi điều hướng /rooms/<code>', async () => {
    const user = userEvent.setup()
    const { calls } = mockFetch((call) =>
      call.url.pathname === '/api/rooms' && call.method === 'POST'
        ? jsonResponse(testRoomDetail('AOV-5555', { myRole: 'host' }), 201)
        : undefined,
    )
    renderWizard()
    const name = screen.getByRole('textbox', { name: /Tên phòng/ })
    await user.clear(name)
    await user.type(name, 'Kèo thứ bảy')
    await user.click(screen.getByText('Giao hữu'))
    await user.click(screen.getByText('Công khai'))
    await user.click(next())
    await user.click(screen.getByText('BO3'))
    await user.click(next())
    await user.click(screen.getByRole('switch', { name: 'Random tướng' }))
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    expect(await screen.findByText('room:/rooms/AOV-5555')).toBeTruthy()
    const [create] = createCalls(calls)
    expect(create.body).toEqual({
      title: 'Kèo thứ bảy',
      mode: 'friendly',
      visibility: 'public',
      config: {
        format: '5v5',
        pickMode: 'draft',
        series: 'BO3',
        tools: ['balance', 'lane', 'champion', 'chat'],
        notes: 'Giao hữu vui vẻ, full đội 5v5.\nƯu tiên đúng giờ và giữ fair-play.',
      },
    })
  })

  it('lỗi 400 có details hiện ngay tại ô và quay về bước chứa ô đó', async () => {
    const user = userEvent.setup()
    mockFetch((call) =>
      call.url.pathname === '/api/rooms' && call.method === 'POST'
        ? errorResponse(400, 'VALIDATION', 'Dữ liệu không hợp lệ', [
            { path: 'title', message: 'Tên phòng đã có người dùng' },
            { path: 'config.series', message: 'Thể thức không hợp lệ' },
          ])
        : undefined,
    )
    renderWizard()
    await goToReview(user)
    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    expect(await screen.findByText('Tên phòng đã có người dùng')).toBeTruthy()
    expect(stepTitle().textContent).toBe('Thông tin phòng')
    const name = screen.getByRole('textbox', { name: /Tên phòng/ })
    expect(name.getAttribute('aria-invalid')).toBe('true')
    // không có alert chung cho lỗi đã gắn được vào ô
    expect(screen.queryByText(/Chưa tạo được phòng/)).toBeNull()

    await user.click(next())
    expect(screen.getByText('Thể thức không hợp lệ')).toBeTruthy()
    await user.click(screen.getByText('BO5'))
    expect(screen.queryByText('Thể thức không hợp lệ')).toBeNull()
  })

  it('lỗi 400 "Sắp có" (thể thức) hiện ở ô Số người', async () => {
    const user = userEvent.setup()
    mockFetch((call) =>
      call.url.pathname === '/api/rooms' && call.method === 'POST'
        ? errorResponse(400, 'VALIDATION', 'Sắp có: MVP chỉ hỗ trợ thể thức 5v5')
        : undefined,
    )
    renderWizard()
    await goToReview(user)
    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))
    expect(await screen.findByText('Sắp có: MVP chỉ hỗ trợ thể thức 5v5')).toBeTruthy()
    expect(stepTitle().textContent).toBe('Cấu hình trận')
  })

  it('lỗi khác (409) hiện role="alert" và giữ ở bước xem lại', async () => {
    const user = userEvent.setup()
    mockFetch((call) =>
      call.url.pathname === '/api/rooms' && call.method === 'POST'
        ? errorResponse(409, 'CONFLICT', 'Bạn đang là người chơi ở phòng khác (AOV-1024)')
        : undefined,
    )
    renderWizard()
    await goToReview(user)
    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    const alert = await screen.findByText(/Chưa tạo được phòng/)
    expect(alert.closest('[role="alert"]')?.textContent).toContain('AOV-1024')
    expect(stepTitle().textContent).toBe('Xem lại')
    expect(screen.queryByText(/^room:/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Tạo phòng' }).hasAttribute('disabled')).toBe(false)
  })
})
