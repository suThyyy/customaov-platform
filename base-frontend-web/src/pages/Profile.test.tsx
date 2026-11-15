import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProviders } from '../context/AppContext'

vi.stubEnv('VITE_DATA_SOURCE', 'api')

const profileBody = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'suthy',
    displayName: 'Sư Thầy',
    avatarUrl: null,
    level: 42,
    crowned: true,
  },
  uid: '102394',
  bio: 'Custom vui là chính',
  bioExtra: 'Tìm đồng đội',
  roleBadge: 'Chủ phòng (Host)',
  playerBadge: 'Người chơi Custom',
  stats: {
    customMatches: 12,
    wins: 8,
    losses: 4,
    winRate: 66.7,
    tournamentsJoined: 3,
    titles: 1,
  },
  achievements: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Nhà vô địch',
      description: 'Vô địch một giải',
      date: '2026-11-15T10:00:00.000Z',
      icon: 'trophy',
    },
  ],
  history: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      roomCode: 'AOV-1024',
      roomTitle: 'Phòng của Sư Thầy',
      winner: 'blue',
      result: 'win',
      at: '2026-11-15T09:00:00.000Z',
    },
  ],
}

let Profile: typeof import('./Profile').default
let clearDataCache: typeof import('../api').clearDataCache

beforeAll(async () => {
  ;({ default: Profile } = await import('./Profile'))
  ;({ clearDataCache } = await import('../api'))
})

afterEach(() => {
  cleanup()
  clearDataCache()
  vi.restoreAllMocks()
})

function renderProfile(path = '/profile') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<Profile />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('Profile API', () => {
  it('hiện số liệu thật, lịch sử và empty state cho dữ liệu game', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { ...profileBody.user, uid: profileBody.uid }, csrfToken: 'test-csrf' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(profileBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    renderProfile()

    expect(await screen.findByRole('heading', { level: 1, name: /Sư Thầy/ })).toBeTruthy()
    for (const [label, value] of [['Trận Custom', '12'], ['Thắng', '8'], ['Thua', '4'], ['Giải đã tham gia', '3'], ['Danh hiệu', '1']]) {
      const card = screen.getAllByText(label)[0]!.parentElement!
      expect(within(card).getByText(value)).toBeTruthy()
    }
    expect(screen.getByText('Phòng của Sư Thầy')).toBeTruthy()
    expect(screen.getByText('Chưa có dữ liệu từ game – sẽ có sau MVP')).toBeTruthy()
  })

  it('hiện empty state h1 khi hồ sơ không tồn tại', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy người dùng' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    )
    renderProfile('/profile/khong_co')

    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy người chơi' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Không tải được hồ sơ')).toBeNull())
  })
})
