import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DEFAULT_BALANCE_LEVEL, DEFAULT_TIER_SCORES, splitTeams5v5 } from '@customaov/team-core'
import { AppProviders } from '../context/AppContext'
import { players } from '../mocks'
import { createMockRoomWithConfig, resetMockRoomConfigStore } from '../mocks/roomConfig'
import RoomDetail from './RoomDetail'

vi.mock('@customaov/team-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@customaov/team-core')>()
  return { ...actual, splitTeams5v5: vi.fn(actual.splitTeams5v5) }
})

const ALL_NAMES = Object.values(players).map((p) => p.name)

function renderRoom(roomId: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/rooms/${roomId}`]}>
        <Routes>
          <Route path="/rooms/:roomId" element={<RoomDetail />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

function namesIn(teamLabel: string): string[] {
  const panel = screen.getByRole('region', { name: teamLabel })
  return ALL_NAMES.filter((name) => within(panel).queryByText(name) !== null)
}

function expectValidFiveVsFive() {
  const blue = namesIn('Team Xanh')
  const red = namesIn('Team Đỏ')
  expect(blue).toHaveLength(5)
  expect(red).toHaveLength(5)
  // mỗi người xuất hiện đúng một lần trên hai đội
  for (const name of ALL_NAMES) {
    expect([...blue, ...red].filter((n) => n === name)).toHaveLength(1)
  }
  return { blue, red }
}

beforeEach(() => {
  resetMockRoomConfigStore()
  vi.mocked(splitTeams5v5).mockClear()
})
afterEach(cleanup)

describe('RoomDetail – chia đội', () => {
  it('meta dưới h1 lấy BO và quyền truy cập từ cấu hình phòng mới', async () => {
    const roomId = createMockRoomWithConfig({
      name: 'Kèo review cấu hình',
      series: 'BO5',
      access: 'private',
      playStyle: 'tryhard',
      splitTool: 'tier',
    })
    renderRoom(roomId)

    const meta = screen.getByRole('list', { name: 'Thông tin phòng' })
    expect(await within(meta).findByText('BO5')).toBeTruthy()
    expect(within(meta).getByText('Riêng tư')).toBeTruthy()
    expect(within(meta).queryByText('Tryhard')).toBeNull()
    expect(within(meta).queryByText(/5v5 · (Custom|Căng|Vui)/)).toBeNull()
  })

  it('“Chia lại” gọi splitTeams5v5 (random, không score) và render 5v5', async () => {
    const user = userEvent.setup()
    renderRoom('AOV-1024')

    await user.click(screen.getByRole('button', { name: 'Chia lại' }))

    expect(splitTeams5v5).toHaveBeenCalledTimes(1)
    const [input, options] = vi.mocked(splitTeams5v5).mock.calls[0]
    expect(input).toHaveLength(10)
    expect(options.mode).toBe('random')
    expect(options).not.toHaveProperty('scores')

    const result = vi.mocked(splitTeams5v5).mock.results[0]
    if (result.type !== 'return') throw new Error('split should return')
    const { blue, red } = expectValidFiveVsFive()
    const nameOf = (id: string) => Object.values(players).find((p) => p.id === id)?.name
    // UI hiển thị đúng teamA → Team Xanh, teamB → Team Đỏ
    expect([...blue].sort()).toEqual(result.value.teamA.map((e) => nameOf(e.id)).sort())
    expect([...red].sort()).toEqual(result.value.teamB.map((e) => nameOf(e.id)).sort())

    expect(await screen.findByText('Đã chia đội')).toBeTruthy()
    expect(screen.getByText('Ngẫu nhiên · 5 vs 5')).toBeTruthy()
  })

  it('chia lại nhiều lần vẫn giữ đủ 10 người, không mất/nhân đôi', async () => {
    const user = userEvent.setup()
    renderRoom('AOV-1024')
    const button = screen.getByRole('button', { name: 'Chia lại' })
    for (let i = 0; i < 3; i++) await user.click(button)
    expect(splitTeams5v5).toHaveBeenCalledTimes(3)
    expectValidFiveVsFive()
  })

  it('hiển thị cảnh báo khi warning === true', async () => {
    const actual = await vi.importActual<typeof import('@customaov/team-core')>('@customaov/team-core')
    vi.mocked(splitTeams5v5).mockImplementationOnce((input, options) => ({
      ...actual.splitTeams5v5(input, options),
      warning: true,
    }))
    const user = userEvent.setup()
    renderRoom('AOV-1024')

    await user.click(screen.getByRole('button', { name: 'Chia lại' }))

    expect(await screen.findByText('Chưa đạt mức cân bằng mong muốn')).toBeTruthy()
    expect(screen.queryByText('Đã chia đội')).toBeNull()
    expectValidFiveVsFive()
  })

  it('“Chia đội cân bằng” dùng mode tier + DEFAULT_TIER_SCORES; mock thiếu tier → báo lỗi, giữ đội cũ', async () => {
    const user = userEvent.setup()
    renderRoom('AOV-1024')
    const before = { blue: namesIn('Team Xanh'), red: namesIn('Team Đỏ') }

    await user.click(screen.getByRole('button', { name: /Chia đội cân bằng/ }))

    expect(splitTeams5v5).toHaveBeenCalledTimes(1)
    const [, options] = vi.mocked(splitTeams5v5).mock.calls[0]
    if (options.mode === 'random') throw new Error('expected balanced options')
    expect(options.mode).toBe('tier')
    expect(options.scores).toBe(DEFAULT_TIER_SCORES)
    expect(options.balanceLevel).toBe(DEFAULT_BALANCE_LEVEL)

    expect(await screen.findByText('Không thể chia đội')).toBeTruthy()
    expect(screen.getByText('Thiếu dữ liệu Tier/Rank của người chơi để chia đội cân bằng.')).toBeTruthy()
    expect({ blue: namesIn('Team Xanh'), red: namesIn('Team Đỏ') }).toEqual(before)
  })

  // Phase 4b: chỉ chủ phòng chia đội được, nên phòng thiếu người được tạo bằng cách
  // chủ phòng (suthy ở AOV-1024) mời 1 người ra khỏi phòng → còn 9 người.
  it('phòng thiếu người → thông báo INVALID_PLAYER_COUNT tiếng Việt', async () => {
    const user = userEvent.setup()
    renderRoom('AOV-1024')

    await user.click(screen.getByRole('button', { name: 'Tuỳ chọn cho Vanhh' }))
    await user.click(screen.getByRole('menuitem', { name: /Mời ra khỏi phòng/ }))
    expect(namesIn('Team Xanh')).not.toContain('Vanhh')

    await user.click(screen.getByRole('button', { name: 'Chia lại' }))

    expect(splitTeams5v5).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Cần đúng 10 người chơi để chia đội 5v5 (hiện có 9).')).toBeTruthy()
    expect(screen.queryByText(/requires exactly 10/)).toBeNull()
  })
})

describe('RoomDetail – vai trò, đổi đội, chat (Phase 4b)', () => {
  it('chủ phòng: 1 nút chính "Xuất kết quả chia đội"; "Chia lại" là nút phụ', () => {
    renderRoom('AOV-1024')
    expect(screen.getByText('Bạn là chủ phòng')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xuất kết quả chia đội' }).className).toContain('bg-gold-gradient')
    expect(screen.getByRole('button', { name: 'Chia lại' }).className).not.toContain('bg-gold-gradient')
  })

  it('khán giả: không có "Chia lại", công cụ bị khoá, chat chỉ đọc', () => {
    renderRoom('AOV-1026')
    expect(screen.getByText('Bạn là khán giả')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Chia lại' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Tuỳ chọn cho/ })).toBeNull()
    expect((screen.getByRole('button', { name: /Chia đội cân bằng/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Nhập tin nhắn') as HTMLInputElement).disabled).toBe(true)
  })

  it('menu "Chuyển sang Team Đỏ" khi đội kia đủ người → báo lỗi, giữ nguyên đội', async () => {
    const user = userEvent.setup()
    renderRoom('AOV-1024')
    const before = { blue: namesIn('Team Xanh'), red: namesIn('Team Đỏ') }
    await user.click(screen.getByRole('button', { name: 'Tuỳ chọn cho Minz' }))
    await user.click(screen.getByRole('menuitem', { name: /Chuyển sang Team Đỏ/ }))
    expect(await screen.findByText('Không thể đổi đội')).toBeTruthy()
    expect({ blue: namesIn('Team Xanh'), red: namesIn('Team Đỏ') }).toEqual(before)
  })

  it('đội kia còn chỗ → chuyển được người chơi qua menu', async () => {
    const user = userEvent.setup()
    renderRoom('AOV-1024')
    await user.click(screen.getByRole('button', { name: 'Tuỳ chọn cho Hieukm' }))
    await user.click(screen.getByRole('menuitem', { name: /Mời ra khỏi phòng/ }))
    await user.click(screen.getByRole('button', { name: 'Tuỳ chọn cho Minz' }))
    await user.click(screen.getByRole('menuitem', { name: /Chuyển sang Team Đỏ/ }))
    expect(namesIn('Team Đỏ')).toContain('Minz')
    expect(namesIn('Team Xanh')).not.toContain('Minz')
    expect(namesIn('Team Xanh')).toHaveLength(4)
    expect(namesIn('Team Đỏ')).toHaveLength(5)
  })

  it('chat: hiển thị tin cũ và gửi được tin mới', async () => {
    const user = userEvent.setup()
    renderRoom('AOV-1024')
    const log = screen.getByRole('log', { name: 'Tin nhắn trong phòng' })
    expect(within(log).getByText('Random cho vui đi 😆')).toBeTruthy()
    await user.type(screen.getByLabelText('Nhập tin nhắn'), 'Vào trận thôi{Enter}')
    expect(within(log).getByText('Vào trận thôi')).toBeTruthy()
    expect((screen.getByLabelText('Nhập tin nhắn') as HTMLInputElement).value).toBe('')
  })
})
