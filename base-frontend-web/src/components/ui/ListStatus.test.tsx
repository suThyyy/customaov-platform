import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useMockStatus } from '../../lib/mockStatus'
import { ListStatus, SkeletonRows } from './ListStatus'

function Demo() {
  const { status, retry } = useMockStatus()
  const { search } = useLocation()
  return (
    <>
      <span data-testid="search">{search}</span>
      <ListStatus status={status} onRetry={retry} label="danh sách phòng" skeleton={<SkeletonRows count={2} />}>
        <p>Dữ liệu</p>
      </ListStatus>
    </>
  )
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/x" element={<Demo />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(cleanup)

describe('ListStatus + useMockStatus (Phase 5)', () => {
  it('mặc định hiện dữ liệu', () => {
    renderAt('/x')
    expect(screen.getByText('Dữ liệu')).toBeTruthy()
  })

  it('?mock=loading → skeleton + thông báo cho trình đọc màn hình', () => {
    renderAt('/x?mock=loading')
    expect(screen.queryByText('Dữ liệu')).toBeNull()
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Đang tải danh sách phòng…')).toBeTruthy()
  })

  it('?mock=error → lỗi; "Thử lại" bỏ query và hiện dữ liệu, giữ query khác', async () => {
    const user = userEvent.setup()
    renderAt('/x?tab=a&mock=error')
    expect(screen.getByRole('alert').textContent).toContain('Không tải được danh sách phòng')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(screen.getByText('Dữ liệu')).toBeTruthy()
    expect(screen.getByTestId('search').textContent).toBe('?tab=a')
  })
})
