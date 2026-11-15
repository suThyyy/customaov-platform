import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Registration, TournamentDetail as ApiTournamentDetail } from '@customaov/contracts'
import { AppProviders } from '../context/AppContext'
import { clearDataCache, endpoints } from '../api'
import TournamentDetail from './TournamentDetail'

// Chế độ api cho toàn bộ module (hooks, AppContext, trang).
vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))

const person = (n: number, username: string) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  username,
  displayName: username.toUpperCase(),
  avatarUrl: null,
  level: 1,
  crowned: false,
})
const me = { ...person(1, 'suthy'), uid: '100001' }

const registration = (status: Registration['status'], rejectReason: string | null = null): Registration => ({
  id: '10000000-0000-4000-8000-000000000001',
  teamName: 'Rồng Lửa',
  members: [person(1, 'suthy'), person(2, 'minz'), person(3, 'rika'), person(4, 'tine'), person(5, 'linh')],
  subs: [],
  status,
  rejectReason,
  createdAt: '2026-11-15T12:00:00.000Z',
})

const detail = (overrides: Partial<ApiTournamentDetail> = {}): ApiTournamentDetail => ({
  slug: 'giai-test',
  name: 'Giải Test',
  titleIcon: 'trophy',
  cover: '/mock-assets/tour-1.jpg',
  status: 'open',
  format: '5v5 – BO3',
  organizer: 'BTC',
  description: 'Mô tả',
  teamCount: 8,
  registeredTeams: 2,
  registrationDeadline: '2026-11-20T16:59:00.000Z',
  drawDate: '2026-11-21T12:00:00.000Z',
  dateStart: '2026-11-22T12:00:00.000Z',
  dateEnd: '2026-11-27T15:00:00.000Z',
  createdAt: '2026-11-14T03:00:00.000Z',
  timeLabel: 'Hạn đăng ký: 20/11, 23:59',
  dateRange: '22/11 – 27/11',
  title: 'Giải Test',
  intro: ['Giới thiệu'],
  mode: '5v5 • Custom',
  category: 'Giải đấu Custom',
  formatLabel: 'Loại trực tiếp (BO3)',
  series: 'BO3',
  heroImage: '/mock-assets/hero-tournament.jpg',
  rules: [],
  prizes: [],
  teamList: [],
  bracket: [],
  upcoming: [],
  results: [],
  champion: null,
  myRole: null,
  myRegistration: null,
  ...overrides,
})

function renderPage(path = '/tournaments/giai-test') {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tournaments/:slug" element={<TournamentDetail />} />
          <Route path="/" element={<p>landing</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

beforeEach(() => {
  clearDataCache()
  vi.spyOn(endpoints, 'me').mockResolvedValue({ user: me, csrfToken: 'csrf' })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TournamentDetail (api) – đăng ký đội', () => {
  it('chưa có đội: nút chính mở hộp thoại đăng ký với đội trưởng là mình', async () => {
    vi.spyOn(endpoints, 'tournament').mockResolvedValue(detail())
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng ký tham gia' }))
    const dialog = await screen.findByRole('dialog', { name: 'Đăng ký đội' })
    expect((within(dialog).getByLabelText(/Thành viên 1/) as HTMLInputElement).value).toBe('suthy')
  })

  it('đơn chờ duyệt: hiện trạng thái, rút đăng ký rồi tải lại giải', async () => {
    const tournament = vi
      .spyOn(endpoints, 'tournament')
      .mockResolvedValueOnce(detail({ myRole: 'captain', myRegistration: registration('pending') }))
      .mockResolvedValueOnce(detail({ myRegistration: registration('withdrawn') }))
    const withdraw = vi.spyOn(endpoints, 'deleteRegistration').mockResolvedValue(undefined)
    renderPage()

    const card = await screen.findByRole('region', { name: 'Đăng ký của bạn' })
    expect(within(card).getByText('Chờ duyệt')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đăng ký của bạn' })).toBeTruthy()

    fireEvent.click(within(card).getByRole('button', { name: 'Rút đăng ký' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rút đăng ký?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rút đăng ký' }))

    await waitFor(() => expect(withdraw).toHaveBeenCalledWith('giai-test', registration('pending').id))
    await waitFor(() => expect(tournament).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Đã rút')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Rút đăng ký' })).toBeNull()
  })

  it('bị từ chối: hiện lý do', async () => {
    vi.spyOn(endpoints, 'tournament').mockResolvedValue(
      detail({ myRegistration: registration('rejected', 'Thiếu thông tin liên hệ') }),
    )
    renderPage()
    const card = await screen.findByRole('region', { name: 'Đăng ký của bạn' })
    expect(within(card).getByText('Bị từ chối')).toBeTruthy()
    expect(within(card).getByText(/Thiếu thông tin liên hệ/)).toBeTruthy()
  })

  it('BTC thấy bảng duyệt đăng ký ở tab Danh sách đội', async () => {
    vi.spyOn(endpoints, 'tournament').mockResolvedValue(detail({ myRole: 'organizer' }))
    vi.spyOn(endpoints, 'registrations').mockResolvedValue([registration('pending')])
    renderPage('/tournaments/giai-test?tab=teams')
    expect(await screen.findByRole('button', { name: 'Duyệt đội Rồng Lửa' })).toBeTruthy()
    expect(screen.getByText('Đã duyệt 2/8')).toBeTruthy()
  })
})
