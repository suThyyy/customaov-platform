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

async function fillStep1AndGoToReview(user: ReturnType<typeof userEvent.setup>) {
  const name = screen.getByRole('textbox', { name: /Tên phòng/ })
  await user.type(name, 'Kèo thứ bảy')
  await user.click(next())
  await user.click(next())
  await user.click(next())
  expect(stepTitle().textContent).toBe('Bước 4 — Xem lại')
}

const createCalls = (calls: FetchCall[]) => calls.filter((c) => c.url.pathname === '/api/rooms' && c.method === 'POST')

beforeEach(() => {
  clearDataCache()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('/rooms/new – chế độ api', () => {
  it('bước cuối gửi POST /api/rooms với cấu hình 4 bước rồi điều hướng /rooms/<code>', async () => {
    const user = userEvent.setup()
    const { calls } = mockFetch((call) =>
      call.url.pathname === '/api/rooms' && call.method === 'POST'
        ? jsonResponse(testRoomDetail('AOV-5555', { myRole: 'host' }), 201)
        : undefined,
    )
    renderWizard()
    await user.type(screen.getByRole('textbox', { name: /Tên phòng/ }), 'Kèo thứ bảy')
    await user.click(screen.getByRole('radio', { name: 'BO3' }))
    await user.click(screen.getByRole('radio', { name: 'Công khai' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /Tryhard — Competitive/ }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /Tier Balance/ }))
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    expect(await screen.findByText('room:/rooms/AOV-5555')).toBeTruthy()
    const [create] = createCalls(calls)
    expect(create.body).toEqual({
      title: 'Kèo thứ bảy',
      mode: 'normal',
      visibility: 'public',
      config: {
        format: '5v5',
        pickMode: 'blind',
        series: 'BO3',
        tools: ['balance'],
        notes: '',
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
    await fillStep1AndGoToReview(user)
    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    expect(await screen.findByText('Tên phòng đã có người dùng')).toBeTruthy()
    expect(stepTitle().textContent).toBe('Bước 1 — Thông tin phòng')
    const name = screen.getByRole('textbox', { name: /Tên phòng/ })
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Thể thức không hợp lệ')).toBeTruthy()

    await user.click(screen.getByRole('radio', { name: 'BO3' }))
    expect(screen.queryByText('Thể thức không hợp lệ')).toBeNull()
  })

  it('lỗi khác (409) hiện role="alert" và giữ ở bước xem lại', async () => {
    const user = userEvent.setup()
    mockFetch((call) =>
      call.url.pathname === '/api/rooms' && call.method === 'POST'
        ? errorResponse(409, 'CONFLICT', 'Bạn đang là người chơi ở phòng khác (AOV-1024)')
        : undefined,
    )
    renderWizard()
    await fillStep1AndGoToReview(user)
    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('AOV-1024')
    expect(stepTitle().textContent).toBe('Bước 4 — Xem lại')
    expect(screen.queryByText(/^room:/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Tạo phòng' }).hasAttribute('disabled')).toBe(false)
  })
})
