import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppProviders } from '../context/AppContext'
import { ApiError } from '../api'
import { endpoints } from '../api/endpoints'
import { LoginModal } from './LoginModal'
import { RequireAuth } from './layout/RequireAuth'

vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))

const sampleMe = {
  id: '00000000-0000-4000-8000-000000000001',
  uid: '100001',
  username: 'suthy',
  displayName: 'Suthy',
  avatarUrl: null,
  level: 42,
  crowned: false,
}

function LocationEcho() {
  const { pathname, search } = useLocation()
  return <p data-testid="loc">{pathname + search}</p>
}

function renderModal(intent: 'login' | 'register' | 'start' = 'login', redirectTo = '/dashboard') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/?login=${intent}`]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <LocationEcho />
                <LoginModal intent={intent} redirectTo={redirectTo} onClose={() => {}} />
              </>
            }
          />
          <Route path="/dashboard" element={<p data-testid="loc">/dashboard</p>} />
          <Route path="/profile" element={<p data-testid="loc">/profile</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

beforeEach(() => {
  vi.spyOn(endpoints, 'me').mockResolvedValue({ user: null, csrfToken: 'csrf-init' })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LoginModal (chế độ api)', () => {
  it('ẩn nút tài khoản mẫu và có tab Đăng nhập / Đăng ký', () => {
    renderModal('login')
    expect(screen.queryByRole('button', { name: /tài khoản mẫu/i })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Đăng nhập' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Đăng ký' }).getAttribute('aria-selected')).toBe('false')
  })

  it('validate bằng schema contracts trước khi gọi API', async () => {
    const loginSpy = vi.spyOn(endpoints, 'login')
    renderModal('login')

    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'a!' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(2)
    expect(loginSpy).not.toHaveBeenCalled()
  })

  it('hiển thị trạng thái đang gửi và điều hướng sau khi đăng nhập thành công', async () => {
    let resolveLogin!: (value: { user: typeof sampleMe }) => void
    vi.spyOn(endpoints, 'login').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve
        }),
    )

    renderModal('login', '/profile')
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'Suthy' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'customaov123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    const submittingBtn = await screen.findByRole('button', { name: 'Đang đăng nhập...' })
    expect((submittingBtn as HTMLButtonElement).disabled).toBe(true)
    expect(endpoints.login).toHaveBeenCalledWith({ username: 'suthy', password: 'customaov123' })

    resolveLogin({ user: sampleMe })
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe('/profile')
    })
  })

  it('hiển thị lỗi 401 chung trong form với role="alert"', async () => {
    vi.spyOn(endpoints, 'login').mockRejectedValue(
      new ApiError('Tên đăng nhập hoặc mật khẩu không đúng', 'UNAUTHENTICATED', 401),
    )

    renderModal('login')
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'suthy' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrongpass1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Tên đăng nhập hoặc mật khẩu không đúng')
  })

  it('hiển thị lỗi 409 trùng username khi đăng ký với role="alert"', async () => {
    vi.spyOn(endpoints, 'register').mockRejectedValue(
      new ApiError('Tên đăng nhập đã được sử dụng', 'CONFLICT', 409),
    )

    renderModal('register')
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'suthy' } })
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Suthy' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'customaov123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Tên đăng nhập đã được sử dụng')
  })

  it('hiển thị lỗi 429 kèm số giây chờ với role="alert"', async () => {
    vi.spyOn(endpoints, 'login').mockRejectedValue(
      new ApiError('Quá nhiều lần thử', 'RATE_LIMITED', 429, 45),
    )

    renderModal('login')
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'suthy' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'customaov123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('45 giây')
  })
})

describe('RequireAuth (chế độ api)', () => {
  it('hiện trạng thái loading khi đang gọi /api/auth/me, không chuyển hướng sớm', async () => {
    let resolveMe!: (value: { user: typeof sampleMe | null; csrfToken: string }) => void
    vi.spyOn(endpoints, 'me').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMe = resolve
        }),
    )

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/" element={<p data-testid="landing">landing</p>} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<p data-testid="dashboard">dashboard</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    )

    expect(screen.getByText(/Đang kiểm tra phiên đăng nhập/i)).toBeTruthy()
    expect(screen.queryByTestId('landing')).toBeNull()

    resolveMe({ user: sampleMe, csrfToken: 'csrf-1' })
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeTruthy()
    })
  })
})
