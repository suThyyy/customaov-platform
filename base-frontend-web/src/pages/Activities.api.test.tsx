import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Activity as ApiActivity, ActivitiesQuery } from '@customaov/contracts'
import { endpoints } from '../api/endpoints'
import { clearDataCache } from '../api/hooks'
import { AppProviders } from '../context/AppContext'
import Activities from './Activities'
import HomeUser from './HomeUser'

vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))
vi.mock('../api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/endpoints')>()
  return {
    ...actual,
    endpoints: {
      ...actual.endpoints,
      me: vi.fn(async () => ({ user: { id: 'u1', username: 'suthy', displayName: 'Suthy' } })),
      rooms: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 50 })),
      tournaments: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 50 })),
      activities: vi.fn(),
    },
  }
})

/** Khớp đúng mục số n (không khớp n0, n1…); mục có emphasis bị tách thành nhiều nút chữ. */
const item = (n: number) => new RegExp(`^Hoạt động số ${n}(?!\\d)`)

const MINUTE = 60_000

/** Feed giả `total` mục; mục i xảy ra cách đây (i + 5) phút, mới nhất ở trên. */
function feed(total: number) {
  return async (query: Partial<ActivitiesQuery> = {}) => {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const now = Date.now()
    const items: ApiActivity[] = []
    for (let i = (page - 1) * pageSize; i < Math.min(total, page * pageSize); i++) {
      items.push({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        kind: i % 2 ? 'result' : 'join',
        text: `Hoạt động số ${i + 1}`,
        ...(i % 2 ? { emphasis: 'Team Xanh thắng' } : {}),
        at: new Date(now - (i + 5) * MINUTE).toISOString(),
      })
    }
    return { items, total, page, pageSize }
  }
}

function renderAt(path: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard" element={<HomeUser />} />
          <Route path="/activities" element={<Activities />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

beforeEach(() => {
  clearDataCache()
  vi.mocked(endpoints.activities).mockReset()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Hoạt động (chế độ api)', () => {
  it('dashboard hiện 5 mục gần nhất với thời gian tương đối và link Lịch sử hoạt động', async () => {
    vi.mocked(endpoints.activities).mockImplementation(feed(12) as never)
    renderAt('/dashboard')

    expect(await screen.findByText(item(1))).toBeTruthy()
    expect(endpoints.activities).toHaveBeenCalledWith({ page: 1, pageSize: 5 }, expect.anything())
    const card = screen.getByRole('heading', { name: 'Hoạt động gần đây' }).closest('div.p-4') as HTMLElement
    expect(within(card).getAllByRole('listitem')).toHaveLength(5)
    expect(within(card).queryByText(item(6))).toBeNull()
    expect(within(card).getByText('5 phút trước')).toBeTruthy()
    expect(within(card).getAllByText('Team Xanh thắng')).toHaveLength(2)
    expect(within(card).getByRole('link', { name: /Xem tất cả/ }).getAttribute('href')).toBe('/activities')
  })

  it('/activities phân trang: trang 1 có 10 mục, bấm Trang 3 tải mục 21–23', async () => {
    vi.mocked(endpoints.activities).mockImplementation(feed(23) as never)
    const user = userEvent.setup()
    renderAt('/activities')

    expect(await screen.findByText(item(1))).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Lịch sử hoạt động')
    expect(screen.getByText(item(10))).toBeTruthy()
    expect(screen.queryByText(item(11))).toBeNull()

    const nav = screen.getByRole('navigation', { name: 'Phân trang lịch sử hoạt động' })
    expect(within(nav).getByRole('button', { name: 'Trang 1' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(nav).getByRole('button', { name: 'Trang 3' }))

    expect(await screen.findByText(item(21))).toBeTruthy()
    expect(screen.getByText(item(23))).toBeTruthy()
    expect(screen.queryByText(item(1))).toBeNull()
    expect(endpoints.activities).toHaveBeenLastCalledWith({ page: 3, pageSize: 10 }, expect.anything())
    expect(
      within(screen.getByRole('navigation', { name: 'Phân trang lịch sử hoạt động' }))
        .getByRole('button', { name: 'Trang 3' })
        .getAttribute('aria-current'),
    ).toBe('page')
  })

  it('/activities không có hoạt động: empty state, không có phân trang', async () => {
    vi.mocked(endpoints.activities).mockImplementation(feed(0) as never)
    renderAt('/activities')

    expect(await screen.findByText('Chưa có hoạt động nào')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: 'Phân trang lịch sử hoạt động' })).toBeNull()
  })
})
