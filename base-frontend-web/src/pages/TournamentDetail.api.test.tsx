import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TournamentDetailSchema, type TournamentDetail as ApiDetail } from '@customaov/contracts'
import { resetClientForTests } from '../api/client'
import { TEST_ME } from '../api/testing'
import { clearDataCache } from '../api/hooks'
import { AppProviders } from '../context/AppContext'
import TournamentDetail from './TournamentDetail'

vi.mock('../api/source', () => ({ DATA_SOURCE: 'api' }))

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const team = (n: number, name: string) => ({ id: uuid(n), name, logo: '/logo.png' })
const ALPHA = team(1, 'Đội Alpha')
const BETA = team(2, 'Đội Beta')
const GAMMA = team(3, 'Đội Gamma')
const SEMI_1 = uuid(101)
const SEMI_2 = uuid(102)
const FINAL = uuid(103)

/** Giải 3 đội / 4 chỗ, đã bốc thăm: Gamma được BYE, chung kết chờ thắng trận 1 (TBD) */
const detail = (overrides: Partial<ApiDetail> = {}): ApiDetail =>
  TournamentDetailSchema.parse({
    slug: 'cup-test',
    name: 'Cup Test',
    titleIcon: 'trophy',
    cover: '/tour-2.jpg',
    status: 'live',
    format: '5v5 – Cộng đồng',
    organizer: 'BTC Test',
    description: 'Giải thử nghiệm.',
    teamCount: 4,
    registrationDeadline: '2026-11-10T23:59:00+07:00',
    drawDate: '2026-11-11T12:00:00+07:00',
    dateStart: '2026-11-12T12:00:00+07:00',
    dateEnd: '2026-11-20T12:00:00+07:00',
    createdAt: '2026-11-01T12:00:00+07:00',
    timeLabel: 'Thời gian: 12/11 – 20/11',
    dateRange: '12/11 – 20/11',
    title: 'Cup Test',
    intro: ['Giải thử.'],
    mode: '5v5 • Custom',
    category: 'Giải cộng đồng',
    formatLabel: 'Loại trực tiếp (BO3)',
    series: 'BO3',
    heroImage: '/tour-2.jpg',
    rules: ['Luật 1'],
    prizes: [{ place: 'Vô địch', reward: '1.000.000đ' }],
    teamList: [ALPHA, BETA, GAMMA],
    bracket: [
      {
        name: 'Bán kết',
        matches: [
          {
            id: SEMI_1,
            label: 'Trận 1',
            time: 'Chưa xếp lịch',
            slots: [
              { team: ALPHA, score: null, bye: false },
              { team: BETA, score: null, bye: false },
            ],
          },
          {
            id: SEMI_2,
            label: 'Trận 2',
            time: 'Chưa xếp lịch',
            slots: [
              { team: GAMMA, score: null, bye: false },
              { team: null, score: null, bye: true },
            ],
          },
        ],
      },
      {
        name: 'Chung kết',
        matches: [
          {
            id: FINAL,
            label: 'Chung kết',
            time: 'Chưa xếp lịch',
            slots: [
              { team: null, score: null, bye: false },
              { team: GAMMA, score: null, bye: false },
            ],
          },
        ],
      },
    ],
    upcoming: [{ id: SEMI_1, stage: 'Bán kết · Trận 1', time: 'Chưa xếp lịch', home: ALPHA, away: BETA }],
    results: [],
    champion: null,
    myRole: 'organizer',
    myRegistration: null,
    ...overrides,
  })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type Handler = (method: string, body: unknown) => Response | undefined

let current: ApiDetail
let handler: Handler
let fetchMock: MockInstance<typeof fetch>

const calls = (method: string, path: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url) === path && (init?.method ?? 'GET') === method)

beforeEach(() => {
  clearDataCache()
  resetClientForTests()
  document.cookie = 'csrf=test-token; Path=/'
  current = detail()
  handler = () => undefined
  fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const custom = handler(method, body)
    if (custom) return custom
    if (url === '/api/auth/me') return json({ user: current.myRole ? TEST_ME : null, csrfToken: 'test-token' })
    if (url === '/api/tournaments/cup-test') return json(current)
    if (url.startsWith('/api/tournaments/cup-test/')) return json(current)
    return json({ error: { code: 'NOT_FOUND', message: 'Không thấy' } }, 404)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.cookie = 'csrf=; Max-Age=0; Path=/'
})

function renderDetail(tab?: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/tournaments/cup-test${tab ? `?tab=${tab}` : ''}`]}>
        <Routes>
          <Route path="/tournaments/:slug" element={<TournamentDetail />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('TournamentDetail (chế độ api)', () => {
  it('nhánh đấu hiện "BYE" và "Chưa xác định" cho slot chưa có đội', async () => {
    renderDetail('bracket')
    const bracket = await screen.findByRole('region', { name: 'Nhánh đấu (cuộn ngang)' })
    expect(within(bracket).getByText('BYE')).toBeTruthy()
    expect(within(bracket).getByText('Chưa xác định')).toBeTruthy()
    expect(within(bracket).getByText('Đội Alpha')).toBeTruthy()
    // Trận BYE / chờ đội không có nút xem trận
    expect(within(bracket).getAllByRole('button', { name: /^Xem / })).toHaveLength(1)
  })

  it('lịch thi đấu: trận thiếu giờ hiện "Chưa xếp lịch", không liệt kê trận BYE', async () => {
    renderDetail('schedule')
    expect(await screen.findByRole('heading', { name: /Chưa xếp lịch/ })).toBeTruthy()
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Đội Alpha')).toBeTruthy()
    expect(within(panel).queryByText('BYE')).toBeNull()
    expect(within(panel).queryByText('Chưa xác định')).toBeNull()
  })

  it('lịch thi đấu dùng upcoming do API trả thay vì tự suy từ nhánh đấu', async () => {
    current = detail({
      upcoming: [{ id: uuid(104), stage: 'Lịch riêng từ backend', time: '18/11 20:00', home: BETA, away: GAMMA }],
    })
    renderDetail('schedule')
    const panel = await screen.findByRole('tabpanel')
    expect(within(panel).getByText('Lịch riêng từ backend')).toBeTruthy()
    expect(within(panel).queryByText('Đội Alpha')).toBeNull()
  })

  it('tab kết quả hiện nhà vô địch khi chung kết có tỉ số', async () => {
    current = detail({
      status: 'finished',
      bracket: [
        {
          name: 'Chung kết',
          matches: [
            {
              id: FINAL,
              label: 'Chung kết',
              time: '20/11 19:00',
              slots: [
                { team: ALPHA, score: 1, bye: false },
                { team: GAMMA, score: 2, bye: false },
              ],
            },
          ],
        },
      ],
      upcoming: [],
      results: [{ id: FINAL, stage: 'Chung kết', time: '20/11 19:00', home: ALPHA, away: GAMMA, score: [1, 2] }],
      champion: GAMMA,
      myRole: null,
    })
    renderDetail('results')
    expect(await screen.findByText('Nhà vô địch Cup Test')).toBeTruthy()
    expect(screen.getByText('Á quân: Đội Alpha')).toBeTruthy()
  })

  it('tab kết quả dùng results/champion của API khi khác dữ liệu suy từ nhánh đấu', async () => {
    current = detail({
      status: 'finished',
      bracket: [
        {
          name: 'Chung kết',
          matches: [
            {
              id: FINAL,
              label: 'Chung kết',
              time: '20/11 19:00',
              slots: [
                { team: ALPHA, score: 2, bye: false },
                { team: GAMMA, score: 0, bye: false },
              ],
            },
          ],
        },
      ],
      upcoming: [],
      results: [{ id: uuid(105), stage: 'Chung kết do backend', time: '20/11 20:00', home: BETA, away: GAMMA, score: [2, 1] }],
      champion: BETA,
      myRole: null,
    })
    renderDetail('results')

    const championLabel = await screen.findByText('Nhà vô địch Cup Test')
    expect(within(championLabel.parentElement as HTMLElement).getByText('Đội Beta')).toBeTruthy()
    expect(screen.getByText('Á quân: Đội Gamma')).toBeTruthy()
    const results = screen.getByRole('heading', { name: /Kết quả các trận/ }).closest('section') as HTMLElement
    expect(within(results).getByText('Chung kết do backend')).toBeTruthy()
    expect(within(results).queryByText('Đội Alpha')).toBeNull()
  })

  it('BTC thấy bảng điều khiển, người khác thì không', async () => {
    renderDetail()
    expect(await screen.findByRole('region', { name: 'Bảng điều khiển ban tổ chức' })).toBeTruthy()
    cleanup()

    clearDataCache()
    current = detail({ myRole: 'captain' })
    renderDetail()
    expect(await screen.findByRole('tab', { name: /Thông tin/ })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Bảng điều khiển ban tổ chức' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Bốc/ })).toBeNull()
  })

  it('bốc lại: xác nhận rồi gọi POST draw và tải lại chi tiết', async () => {
    const user = userEvent.setup()
    renderDetail()
    const panel = await screen.findByRole('region', { name: 'Bảng điều khiển ban tổ chức' })
    expect(calls('GET', '/api/tournaments/cup-test')).toHaveLength(1)

    await user.click(within(panel).getByRole('button', { name: 'Bốc lại' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bốc lại nhánh đấu?' })
    expect(calls('POST', '/api/tournaments/cup-test/draw')).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Bốc lại' }))

    await waitFor(() => expect(calls('POST', '/api/tournaments/cup-test/draw')).toHaveLength(1))
    const [, init] = calls('POST', '/api/tournaments/cup-test/draw')[0]
    expect((init?.headers as Headers).get('x-csrf-token')).toBe('test-token')
    await waitFor(() => expect(calls('GET', '/api/tournaments/cup-test')).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('giải mở đăng ký: có "Đóng đăng ký", nút bốc thăm bị khoá tới khi đóng', async () => {
    const user = userEvent.setup()
    current = detail({
      status: 'open',
      registrationDeadline: '2099-01-01T23:59:00+07:00',
      registeredTeams: 3,
      bracket: [],
      upcoming: [],
    })
    renderDetail()
    const panel = await screen.findByRole('region', { name: 'Bảng điều khiển ban tổ chức' })
    expect((within(panel).getByRole('button', { name: 'Bốc thăm' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(panel).getByText('Đóng đăng ký trước khi bốc thăm.')).toBeTruthy()

    await user.click(within(panel).getByRole('button', { name: 'Đóng đăng ký' }))
    const dialog = await screen.findByRole('dialog', { name: 'Đóng đăng ký?' })
    await user.click(within(dialog).getByRole('button', { name: 'Đóng đăng ký' }))
    await waitFor(() => expect(calls('POST', '/api/tournaments/cup-test/close-registration')).toHaveLength(1))
  })

  it('ScoreDialog chặn tỉ số sai BO và chỉ gửi tỉ số hợp lệ', async () => {
    const user = userEvent.setup()
    renderDetail()
    const panel = await screen.findByRole('region', { name: 'Bảng điều khiển ban tổ chức' })
    // Chỉ trận đủ 2 đội có nút nhập tỉ số (không có trận BYE / chờ đội)
    expect(within(panel).getAllByRole('button', { name: /^Nhập tỉ số/ })).toHaveLength(1)
    await user.click(within(panel).getByRole('button', { name: /^Nhập tỉ số Bán kết · Trận 1/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Nhập tỉ số' })
    const save = within(dialog).getByRole('button', { name: 'Lưu tỉ số' }) as HTMLButtonElement
    await user.selectOptions(within(dialog).getByLabelText('Đội Alpha'), '1')
    await user.selectOptions(within(dialog).getByLabelText('Đội Beta'), '1')
    expect(within(dialog).getByRole('alert').textContent).toMatch(/không hợp lệ với thể thức BO3/)
    expect(save.disabled).toBe(true)
    await user.click(save)
    expect(calls('POST', `/api/tournaments/cup-test/matches/${SEMI_1}/score`)).toHaveLength(0)

    await user.selectOptions(within(dialog).getByLabelText('Đội Alpha'), '2')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    await user.click(save)
    await waitFor(() => expect(calls('POST', `/api/tournaments/cup-test/matches/${SEMI_1}/score`)).toHaveLength(1))
    const [, init] = calls('POST', `/api/tournaments/cup-test/matches/${SEMI_1}/score`)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ scoreA: 2, scoreB: 1 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls('GET', '/api/tournaments/cup-test')).toHaveLength(2)
  })

  it('lỗi 409 (LOCKED) khi nhập tỉ số hiện thông báo của server', async () => {
    const user = userEvent.setup()
    handler = (method) =>
      method === 'POST'
        ? json({ error: { code: 'CONFLICT', message: 'Không thể sửa tỉ số khi trận vòng sau đã có tỉ số' } }, 409)
        : undefined
    renderDetail()
    const panel = await screen.findByRole('region', { name: 'Bảng điều khiển ban tổ chức' })
    await user.click(within(panel).getByRole('button', { name: /^Nhập tỉ số/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Nhập tỉ số' })
    await user.selectOptions(within(dialog).getByLabelText('Đội Alpha'), '2')
    await user.selectOptions(within(dialog).getByLabelText('Đội Beta'), '0')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu tỉ số' }))
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Không thể sửa tỉ số khi trận vòng sau đã có tỉ số')
    expect(screen.getByRole('dialog', { name: 'Nhập tỉ số' })).toBeTruthy()
  })

  it('xếp lịch gửi PATCH với giờ Việt Nam', async () => {
    const user = userEvent.setup()
    renderDetail()
    const panel = await screen.findByRole('region', { name: 'Bảng điều khiển ban tổ chức' })
    await user.click(within(panel).getByRole('button', { name: /^Xếp lịch/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Xếp lịch trận đấu' })
    const input = within(dialog).getByLabelText(/Ngày giờ thi đấu/) as HTMLInputElement
    await user.type(input, '2026-11-20T19:00')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu lịch' }))
    await waitFor(() => expect(calls('PATCH', `/api/tournaments/cup-test/matches/${SEMI_1}`)).toHaveLength(1))
    const [, init] = calls('PATCH', `/api/tournaments/cup-test/matches/${SEMI_1}`)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ scheduledAt: '2026-11-20T19:00:00+07:00' })
  })
})
