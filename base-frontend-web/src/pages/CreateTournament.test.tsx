import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import * as api from '../api'
import { RequireAuth } from '../components/layout/RequireAuth'
import { AppProviders } from '../context/AppContext'
import CreateTournament from './CreateTournament'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    createTournament: vi.fn(actual.createTournament),
  }
})

function LocationProbe({ prefix }: { prefix: string }) {
  const { pathname, search } = useLocation()
  return (
    <p>
      {prefix}:{pathname}
      {search}
    </p>
  )
}

function renderWizard(initialPath = '/tournaments/new', loggedIn = true) {
  if (loggedIn) localStorage.setItem('customaov.mockLoggedIn', '1')
  else localStorage.clear()

  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<LocationProbe prefix="landing" />} />
          <Route path="/tournaments" element={<LocationProbe prefix="tournaments" />} />
          <Route element={<RequireAuth />}>
            <Route path="/tournaments/new" element={<CreateTournament />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

beforeEach(() => {
  sessionStorage.setItem('customaov.mockRole', 'admin')
  vi.mocked(api.createTournament).mockClear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

describe('CreateTournament', () => {
  it('khách truy cập /tournaments/new bị chuyển tới login', () => {
    renderWizard('/tournaments/new', false)
    expect(screen.getByText(`landing:/?login=login&next=${encodeURIComponent('/tournaments/new')}`)).toBeTruthy()
  })

  it('điều hướng qua 4 bước và validate tên giải đấu ở bước 1', async () => {
    const user = userEvent.setup()
    renderWizard()

    // Bước 1: xoá tên -> báo lỗi, focus vào ô tên và không sang bước 2
    const nameInput = screen.getByLabelText(/Tên giải đấu/)
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    expect(nameInput.getAttribute('aria-invalid')).toBe('true')
    const errId = nameInput.getAttribute('aria-describedby')
    expect(errId).toBeTruthy()
    expect(document.getElementById(errId!)?.textContent).toContain('Vui lòng nhập tên giải đấu')
    expect(document.activeElement).toBe(nameInput)
    expect(screen.getByRole('heading', { level: 2, name: 'Thông tin' })).toBeTruthy()

    // Nhập tên hợp lệ -> sang bước 2 -> bước 3 -> bước 4 -> quay lại bước 3
    await user.type(nameInput, 'Giải Mùa Đông')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Thể thức' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Lịch thi đấu' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Luật & giải thưởng' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Lịch thi đấu' })).toBeTruthy()
  })

  it('báo lỗi thứ tự ngày tại chỗ ở bước 3 và focus vào ô lỗi đầu tiên', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Lịch thi đấu' })).toBeTruthy()

    // Đặt ngày bốc thăm trước hạn đăng ký -> vi phạm thứ tự ngày
    const drawInput = screen.getByLabelText(/Ngày bốc thăm/)
    fireEvent.change(drawInput, { target: { value: '2026-11-18T10:00' } })

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    expect(drawInput.getAttribute('aria-invalid')).toBe('true')
    const errId = drawInput.getAttribute('aria-describedby')
    expect(errId).toBeTruthy()
    expect(document.getElementById(errId!)?.textContent).toContain(
      'Thứ tự ngày phải là hạn đăng ký ≤ bốc thăm ≤ bắt đầu ≤ kết thúc',
    )
    expect(document.activeElement).toBe(drawInput)
    expect(screen.getByRole('heading', { level: 2, name: 'Lịch thi đấu' })).toBeTruthy()
  })

  it('submit gọi createTournament, hiện toast giả lập và điều hướng về /tournaments', async () => {
    const user = userEvent.setup()
    renderWizard()

    const nameInput = screen.getByLabelText(/Tên giải đấu/)
    await user.clear(nameInput)
    await user.type(nameInput, 'Ngũ Kiệt Mở Rộng')

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await user.click(screen.getByRole('radio', { name: /16 đội/ }))
    await user.click(screen.getByRole('radio', { name: /BO5/ }))

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    await user.click(screen.getByRole('button', { name: 'Tạo giải' }))

    expect(api.createTournament).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.createTournament).mock.calls[0][0]).toMatchObject({
      name: 'Ngũ Kiệt Mở Rộng',
      teamCount: 16,
      series: 'BO5',
      cover: 'tour-1',
    })
    expect(await screen.findByText('Đã tạo giải (giả lập)')).toBeTruthy()
    expect(screen.getByText('tournaments:/tournaments')).toBeTruthy()
  })
})
