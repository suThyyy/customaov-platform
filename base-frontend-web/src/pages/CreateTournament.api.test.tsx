import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError } from '../api/client'
import { endpoints } from '../api/endpoints'
import { RequireAuth } from '../components/layout/RequireAuth'
import { AppProviders } from '../context/AppContext'
import CreateTournament from './CreateTournament'

vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))
vi.mock('../api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/endpoints')>()
  return {
    ...actual,
    endpoints: {
      ...actual.endpoints,
      me: vi.fn(async () => ({ user: { id: 'u1', username: 'btc', displayName: 'BTC' } })),
      createTournament: vi.fn(),
    },
  }
})

function LocationProbe({ prefix }: { prefix: string }) {
  const { pathname } = useLocation()
  return <p>{`${prefix}:${pathname}`}</p>
}

function renderWizard() {
  localStorage.setItem('customaov.mockLoggedIn', '1')
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/tournaments/new']}>
        <Routes>
          <Route path="/tournaments" element={<LocationProbe prefix="tournaments" />} />
          <Route path="/tournaments/:slug" element={<LocationProbe prefix="detail" />} />
          <Route element={<RequireAuth />}>
            <Route path="/tournaments/new" element={<CreateTournament />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

async function goToLastStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Tiếp tục' }))
  await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
  await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
}

beforeEach(() => {
  vi.mocked(endpoints.createTournament).mockReset()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('CreateTournament (chế độ api)', () => {
  it('submit gọi endpoint POST và điều hướng tới /tournaments/<slug>', async () => {
    vi.mocked(endpoints.createTournament).mockResolvedValue({ slug: 'cup-moi' } as never)
    const user = userEvent.setup()
    renderWizard()

    await goToLastStep(user)
    await user.click(screen.getByRole('button', { name: 'Tạo giải' }))

    expect(endpoints.createTournament).toHaveBeenCalledTimes(1)
    expect(vi.mocked(endpoints.createTournament).mock.calls[0][0]).toMatchObject({
      teamCount: 8,
      series: 'BO3',
      cover: 'tour-1',
    })
    expect(await screen.findByText('detail:/tournaments/cup-moi')).toBeTruthy()
  })

  it('lỗi 400 hiện tại ô tương ứng và quay về bước chứa ô đó', async () => {
    vi.mocked(endpoints.createTournament).mockRejectedValue(
      new ApiError('Dữ liệu không hợp lệ', 'VALIDATION', 400, undefined, [
        { path: 'drawDate', message: 'Thứ tự ngày phải là hạn đăng ký ≤ bốc thăm ≤ bắt đầu ≤ kết thúc' },
      ]),
    )
    const user = userEvent.setup()
    renderWizard()

    await goToLastStep(user)
    await user.click(screen.getByRole('button', { name: 'Tạo giải' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Lịch thi đấu' })).toBeTruthy()
    const drawInput = screen.getByLabelText(/Ngày bốc thăm/)
    expect(drawInput.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(drawInput.getAttribute('aria-describedby')!)?.textContent).toContain(
      'Thứ tự ngày phải là',
    )
  })

  it('lỗi khác hiện role="alert"', async () => {
    vi.mocked(endpoints.createTournament).mockRejectedValue(
      new ApiError('Bạn tạo giải quá nhanh, thử lại sau 60 giây', 'RATE_LIMITED', 429),
    )
    const user = userEvent.setup()
    renderWizard()

    await goToLastStep(user)
    await user.click(screen.getByRole('button', { name: 'Tạo giải' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('tạo giải quá nhanh')
  })
})
