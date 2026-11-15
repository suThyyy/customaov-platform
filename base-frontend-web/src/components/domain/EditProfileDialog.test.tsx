import { useCallback, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { profile } from '../../mocks'
import { AppProviders } from '../../context/AppContext'
import * as api from '../../api'
import { EditProfileDialog } from './EditProfileDialog'

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>()
  return { ...actual, DATA_SOURCE: 'api', updateProfile: vi.fn() }
})

function Harness({ onSaved = vi.fn() }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <AppProviders>
      <button type="button" onClick={() => setOpen(true)}>Mở chỉnh sửa</button>
      <EditProfileDialog open={open} onClose={close} profile={profile} onSaved={onSaved} />
    </AppProviders>
  )
}

beforeEach(() => {
  vi.mocked(api.updateProfile).mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('EditProfileDialog', () => {
  it('validate giới thiệu quá dài và URL không dùng HTTPS tại chỗ', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Mở chỉnh sửa' }))

    const bio = screen.getByLabelText('Giới thiệu')
    const avatar = screen.getByLabelText('URL ảnh đại diện')
    fireEvent.change(bio, { target: { value: 'a'.repeat(281) } })
    await user.clear(avatar)
    await user.type(avatar, 'http://example.com/avatar.png')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(bio.getAttribute('aria-invalid')).toBe('true')
    expect(bio.getAttribute('aria-describedby')).toBe('edit-profile-bio-error')
    expect(avatar.getAttribute('aria-invalid')).toBe('true')
    expect(avatar.getAttribute('aria-describedby')).toBe('edit-profile-avatarUrl-error')
    expect(api.updateProfile).not.toHaveBeenCalled()
  })

  it('lưu thành công, làm mới hồ sơ và trả focus về nút mở', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<Harness onSaved={onSaved} />)
    const opener = screen.getByRole('button', { name: 'Mở chỉnh sửa' })
    await user.click(opener)
    await user.clear(screen.getByLabelText('Tên hiển thị'))
    await user.type(screen.getByLabelText('Tên hiển thị'), 'Tên mới')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledTimes(1))
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Đã cập nhật hồ sơ')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('hiện lỗi server trong vùng alert và giữ dialog mở', async () => {
    vi.mocked(api.updateProfile).mockRejectedValueOnce(new Error('Máy chủ bận'))
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Mở chỉnh sửa' }))
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Máy chủ bận')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
