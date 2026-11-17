import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiError, type Registration } from '../../api'
import { endpoints } from '../../api/endpoints'
import { RegisterTeamDialog } from './RegisterTeamDialog'

const user = (n: number, username: string) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  username,
  displayName: username.toUpperCase(),
  avatarUrl: null,
  level: 1,
  crowned: false,
})

const registration: Registration = {
  id: '10000000-0000-4000-8000-000000000001',
  teamName: 'Rồng Lửa',
  members: [user(1, 'suthy'), user(2, 'minz'), user(3, 'rika'), user(4, 'tine'), user(5, 'linh')],
  subs: [],
  status: 'pending',
  rejectReason: null,
  createdAt: '2026-11-15T12:00:00.000Z',
}

function renderDialog(onRegistered = vi.fn()) {
  const onClose = vi.fn()
  render(
    <RegisterTeamDialog
      open
      onClose={onClose}
      slug="ngu-kiet-cup-mua-1"
      tournamentName="Ngũ Kiệt Cup – Mùa 1"
      captainUsername="suthy"
      onRegistered={onRegistered}
    />,
  )
  return { onClose, onRegistered }
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

function fillValidTeam() {
  type('Tên đội', '  Rồng Lửa ')
  type('Thành viên 2', 'MINZ')
  type('Thành viên 3', 'rika')
  type('Thành viên 4', 'tine')
  type('Thành viên 5', 'linh')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RegisterTeamDialog', () => {
  it('đội trưởng là thành viên 1 (chỉ đọc); ô tên đội được autofocus', async () => {
    renderDialog()
    const captain = screen.getByLabelText(/Thành viên 1/) as HTMLInputElement
    expect(captain.value).toBe('suthy')
    expect(captain.readOnly).toBe(true)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Tên đội')))
  })

  it('validate bằng contracts: thiếu tên đội, username sai, trùng người → không gọi API', async () => {
    const spy = vi.spyOn(endpoints, 'createRegistration')
    renderDialog()
    type('Thành viên 2', 'A!')
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đăng ký' }))
    expect(await screen.findByText('Nhập tên đội.')).toBeTruthy()
    expect(screen.getByLabelText('Thành viên 2').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Thành viên 3').getAttribute('aria-invalid')).toBe('true')
    expect(spy).not.toHaveBeenCalled()

    fillValidTeam()
    type('Thành viên 5', 'minz')
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đăng ký' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((a) => a.textContent?.includes('chỉ được xuất hiện một lần'))).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('gửi body đã chuẩn hoá (chữ thường, bỏ dự bị trống) và báo onRegistered', async () => {
    const spy = vi.spyOn(endpoints, 'createRegistration').mockResolvedValue(registration)
    const { onRegistered } = renderDialog()
    fillValidTeam()
    type('Dự bị 2', 'nanm')
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đăng ký' }))
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith(registration))
    expect(spy).toHaveBeenCalledWith('ngu-kiet-cup-mua-1', {
      teamName: 'Rồng Lửa',
      members: ['suthy', 'minz', 'rika', 'tine', 'linh'],
      subs: ['nanm'],
    })
  })

  it('lỗi server (409) hiện trong role="alert"', async () => {
    vi.spyOn(endpoints, 'createRegistration').mockRejectedValue(
      new ApiError('Đã có đội trong giải này: MINZ (@minz)', 'CONFLICT', 409),
    )
    const { onRegistered } = renderDialog()
    fillValidTeam()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đăng ký' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('@minz')
    expect(onRegistered).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Gửi đăng ký' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
