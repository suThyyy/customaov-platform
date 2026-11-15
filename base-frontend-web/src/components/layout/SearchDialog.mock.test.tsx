import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchDialog } from './SearchDialog'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Chế độ mock (mặc định) phải giữ nguyên hành vi cũ: lọc đồng bộ, ô trống hiện gợi ý, không gọi mạng.
describe('SearchDialog (chế độ mock)', () => {
  it('ô trống hiện gợi ý; gõ là lọc ngay, không debounce, không fetch', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    render(
      <MemoryRouter>
        <SearchDialog open onClose={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Gợi ý')).toBeTruthy()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ngu kiet' } })
    expect(screen.getByRole('option', { name: /Ngũ Kiệt Cup/ })).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
