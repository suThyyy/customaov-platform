import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import * as api from '../api'
import { AppProviders } from '../context/AppContext'
import { resetMockRoomConfigStore } from '../mocks/roomConfig'
import CreateRoom from './CreateRoom'

function RoomProbe() {
  const location = useLocation()
  const state = location.state as { roomConfig?: api.RoomConfig; configPersisted?: boolean } | null
  return (
    <div>
      <p>room:{location.pathname}</p>
      <p>persisted:{String(state?.configPersisted)}</p>
      <p>config:{state?.roomConfig?.name}</p>
    </div>
  )
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

beforeEach(() => {
  localStorage.setItem('customaov.mockLoggedIn', '1')
  sessionStorage.setItem('customaov.mockRole', 'admin')
  resetMockRoomConfigStore()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('CreateRoom – wizard 4 bước', () => {
  it('stepper chỉ mở bước đã tới và không nhảy cóc', async () => {
    const user = userEvent.setup()
    renderWizard()

    const step1Btn = screen.getByRole('button', { name: '1. Phòng' })
    const step2Btn = screen.getByRole('button', { name: '2. Chế độ' })
    const step3Btn = screen.getByRole('button', { name: '3. Công cụ' })
    const step4Btn = screen.getByRole('button', { name: '4. Xem lại' })

    expect(step1Btn.hasAttribute('disabled')).toBe(false)
    expect(step2Btn.hasAttribute('disabled')).toBe(true)
    expect(step3Btn.hasAttribute('disabled')).toBe(true)
    expect(step4Btn.hasAttribute('disabled')).toBe(true)

    await user.type(screen.getByRole('textbox', { name: 'Tên phòng' }), 'Custom tối thứ 6')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Bước 2 — Phong cách thi đấu')
    expect(step2Btn.hasAttribute('disabled')).toBe(false)
    expect(step3Btn.hasAttribute('disabled')).toBe(true)

    await user.click(step1Btn)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Bước 1 — Thông tin phòng')
    expect(step2Btn.hasAttribute('disabled')).toBe(false)
  })

  it('validate tên phòng (trống và quá ngắn)', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('alert').textContent).toBe('Vui lòng nhập tên phòng.')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Bước 1 — Thông tin phòng')

    const input = screen.getByRole('textbox', { name: 'Tên phòng' })
    await user.type(input, 'AB')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('alert').textContent).toBe('Tên phòng phải có ít nhất 3 ký tự.')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Bước 1 — Thông tin phòng')
  })

  it('bước 4 hiện đúng giá trị đã chọn và gọi createRoomWithConfig đúng cấu hình', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(api, 'createRoomWithConfig')
    renderWizard()

    await user.type(screen.getByRole('textbox', { name: 'Tên phòng' }), 'Custom 5v5 cùng anh em')
    await user.click(screen.getByRole('radio', { name: 'BO7' }))
    await user.click(screen.getByRole('radio', { name: 'Công khai' }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    await user.click(screen.getByRole('radio', { name: /Tryhard — Competitive/ }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    await user.click(screen.getByRole('radio', { name: /Rank Balance/ }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Bước 4 — Xem lại')
    expect(screen.getByText('Custom 5v5 cùng anh em')).toBeTruthy()
    expect(screen.getByText('BO7')).toBeTruthy()
    expect(screen.getByText('Công khai')).toBeTruthy()
    expect(screen.getByText('Tryhard — Competitive')).toBeTruthy()
    expect(screen.getByText('Rank Balance')).toBeTruthy()
    expect(screen.getByText('OPEN')).toBeTruthy()
    expect(screen.queryByText('Fun / Tryhard')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    expect(spy).toHaveBeenCalledWith({
      name: 'Custom 5v5 cùng anh em',
      series: 'BO7',
      access: 'public',
      playStyle: 'tryhard',
      splitTool: 'rank',
    })
    expect(await screen.findByText(/^room:\/rooms\/AOV-/)).toBeTruthy()
    expect(screen.getByText('persisted:true')).toBeTruthy()
    expect(screen.getByText('config:Custom 5v5 cùng anh em')).toBeTruthy()
  })

  it('hỗ trợ điều hướng radiogroup bằng phím mũi tên', async () => {
    const user = userEvent.setup()
    renderWizard()

    const bo5 = screen.getByRole('radio', { name: 'BO5' })
    bo5.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'BO7' }).getAttribute('aria-checked')).toBe('true')
    await user.keyboard('{ArrowLeft}')
    expect(bo5.getAttribute('aria-checked')).toBe('true')
  })
})
