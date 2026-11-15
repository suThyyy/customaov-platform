import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders } from '../../context/AppContext'
import { ApiError, endpoints, type Registration } from '../../api'
import { RegistrationsPanel } from './RegistrationsPanel'

const user = (n: number) => ({
  id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
  username: `p${n}`,
  displayName: `Player ${n}`,
  avatarUrl: null,
  level: 1,
  crowned: false,
})

const reg = (n: number, teamName: string, status: Registration['status'] = 'pending'): Registration => ({
  id: `10000000-0000-4000-8000-00000000000${n}`,
  teamName,
  members: [1, 2, 3, 4, 5].map((i) => user(n * 10 + i)),
  subs: [],
  status,
  rejectReason: null,
  createdAt: '2026-11-15T12:00:00.000Z',
})

let slugCounter = 0
function renderPanel(props: { approvedCount?: number; teamCount?: number } = {}) {
  const onChanged = vi.fn().mockResolvedValue(undefined)
  const slug = `giai-panel-${++slugCounter}`
  render(
    <AppProviders>
      <MemoryRouter>
        <RegistrationsPanel
          slug={slug}
          teamCount={props.teamCount ?? 4}
          approvedCount={props.approvedCount ?? 1}
          onChanged={onChanged}
        />
      </MemoryRouter>
    </AppProviders>,
  )
  return { onChanged, slug }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RegistrationsPanel', () => {
  it('chỉ liệt kê đơn chờ duyệt; Duyệt gọi API, tải lại danh sách và báo onChanged', async () => {
    const list = vi
      .spyOn(endpoints, 'registrations')
      .mockResolvedValueOnce([reg(1, 'Rồng Lửa'), reg(2, 'Đội Cũ', 'approved'), reg(3, 'Hổ Đen')])
      .mockResolvedValueOnce([reg(1, 'Rồng Lửa', 'approved'), reg(2, 'Đội Cũ', 'approved'), reg(3, 'Hổ Đen')])
    const approve = vi.spyOn(endpoints, 'approveRegistration').mockResolvedValue(reg(1, 'Rồng Lửa', 'approved'))
    const { onChanged, slug } = renderPanel()

    const pending = await screen.findByRole('list', { name: 'Đơn chờ duyệt' })
    expect(within(pending).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('Đội Cũ')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Duyệt đội Rồng Lửa' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(approve).toHaveBeenCalledWith(slug, reg(1, 'Rồng Lửa').id)
    expect(list).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Duyệt đội Rồng Lửa' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Duyệt đội Hổ Đen' })).toBeTruthy()
  })

  it('Từ chối kèm lý do', async () => {
    vi.spyOn(endpoints, 'registrations').mockResolvedValue([reg(1, 'Rồng Lửa')])
    const reject = vi.spyOn(endpoints, 'rejectRegistration').mockResolvedValue(reg(1, 'Rồng Lửa', 'rejected'))
    const { onChanged, slug } = renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Từ chối đội Rồng Lửa' }))
    fireEvent.change(screen.getByLabelText(/Lý do từ chối/), { target: { value: ' Thiếu liên hệ ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(reject).toHaveBeenCalledWith(slug, reg(1, 'Rồng Lửa').id, { reason: 'Thiếu liên hệ' })
  })

  it('lỗi server hiện role="alert"; đủ đội thì khoá nút Duyệt', async () => {
    vi.spyOn(endpoints, 'registrations').mockResolvedValue([reg(1, 'Rồng Lửa')])
    vi.spyOn(endpoints, 'rejectRegistration').mockRejectedValue(
      new ApiError('Giải đã đóng đăng ký, không thể từ chối đội', 'CONFLICT', 409),
    )
    const { onChanged } = renderPanel({ approvedCount: 4, teamCount: 4 })

    const approveBtn = (await screen.findByRole('button', { name: 'Duyệt đội Rồng Lửa' })) as HTMLButtonElement
    expect(approveBtn.disabled).toBe(true)
    expect(screen.getByText(/Giải đã đủ đội/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Từ chối đội Rồng Lửa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }))
    expect((await screen.findByRole('alert')).textContent).toContain('đóng đăng ký')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('empty state khi không có đơn chờ', async () => {
    vi.spyOn(endpoints, 'registrations').mockResolvedValue([reg(1, 'Đội Cũ', 'approved')])
    renderPanel()
    expect(await screen.findByText('Không có đơn nào chờ duyệt.')).toBeTruthy()
  })
})
