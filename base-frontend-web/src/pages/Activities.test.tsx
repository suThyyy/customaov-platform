import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { activities } from '../mocks'
import { AppProviders } from '../context/AppContext'
import Activities from './Activities'

afterEach(cleanup)

describe('/activities (chế độ mock)', () => {
  it('hiện dữ liệu mocks/activity.ts, 1 trang thì không có phân trang', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/activities']}>
          <Routes>
            <Route path="/activities" element={<Activities />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    )
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const a of activities) expect(screen.getByText(a.text, { exact: false })).toBeTruthy()
    expect(screen.getByText(activities[0].timeAgo)).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Phân trang lịch sử hoạt động' })).toBeNull()
  })
})
